use base64::{engine::general_purpose::STANDARD, Engine as _};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::sync::mpsc;
use std::thread;
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{AppHandle, Emitter, Manager};

static OAUTH_SERVER_PORT: std::sync::OnceLock<u16> = std::sync::OnceLock::new();

fn handle_oauth_connection(mut stream: std::net::TcpStream, expected_path: &str) -> Option<String> {
    let mut buffer = [0; 8192];
    let bytes_read = stream.read(&mut buffer).ok()?;
    let request = String::from_utf8_lossy(&buffer[..bytes_read]);

    let first_line = request.lines().next()?;
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    let path = parts[1];

    if !path.starts_with(expected_path) {
        return None;
    }

    let url = if path.contains("?") {
        format!("http://localhost{}", path)
    } else {
        String::new()
    };

    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body><p>Login successful! You can close this window and return to the app.</p></body></html>";
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();

    Some(url)
}

#[tauri::command]
async fn start_oauth(window: tauri::Window) -> Result<u16, String> {
    if let Some(existing_port) = OAUTH_SERVER_PORT.get() {
        info!("OAuth server already running on port: {}", existing_port);
        return Ok(*existing_port);
    }

    let (tx, rx) = mpsc::channel::<Result<u16, String>>();

    let _join_handle = thread::spawn(move || {
        let port: u16 = 9876;
        let bind_addr = format!("127.0.0.1:{}", port);

        let listener = match TcpListener::bind(&bind_addr) {
            Ok(l) => l,
            Err(e) => {
                let _ = tx.send(Err(format!("Failed to bind port {}: {}", port, e)));
                return;
            }
        };

        if let Err(_) = OAUTH_SERVER_PORT.set(port) {
            let _ = tx.send(Err("Port already in use".to_string()));
            return;
        }

        info!("OAuth server listening on port {}", port);
        let _ = tx.send(Ok(port));

        if let Ok((stream, _)) = listener.accept() {
            let url = handle_oauth_connection(stream, "/auth/callback");
            if let Some(callback_url) = url {
                info!("OAuth callback received: {}", callback_url);
                let _ = window.emit("oauth_callback", callback_url);
            }
        }
    });

    rx.recv().map_err(|e| e.to_string())?
}

/// Payload emitted to the frontend when clipboard content changes.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipboardPayload {
    pub content: String,
    pub content_type: String, // "text" or "image"
    pub image_data: String,   // base64 PNG, empty for text items
    pub captured_at: i64,     // Unix timestamp
}

// Converts raw RGBA bytes to PNG bytes
fn rgba_to_png(width: usize, height: usize, bytes: &[u8]) -> Vec<u8> {
    use image::{ImageBuffer, Rgba};
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_vec(width as u32, height as u32, bytes.to_vec())
            .unwrap_or_else(|| ImageBuffer::new(1, 1));
    let mut png_bytes = Vec::new();
    let _ = img.write_to(
        &mut std::io::Cursor::new(&mut png_bytes),
        image::ImageFormat::Png,
    );
    png_bytes
}

/// Copy a base64-encoded PNG image to the system clipboard.
#[tauri::command]
fn copy_image_to_clipboard(image_b64: String) -> Result<(), String> {
    let png_bytes = STANDARD.decode(&image_b64).map_err(|e| e.to_string())?;

    let img = image::load_from_memory_with_format(&png_bytes, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?
        .to_rgba8();

    let (width, height) = img.dimensions();
    let image_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: img.into_raw().into(),
    };

    arboard::Clipboard::new()
        .map_err(|e| e.to_string())?
        .set_image(image_data)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("focus-input", ());
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    info!("Klypt starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            copy_image_to_clipboard,
            hide_window,
            start_oauth
        ])
        .setup(|app| {
            // Background clipboard watcher — polls every 500ms, emits events to frontend
            let app_handle = app.handle().clone();
            thread::spawn(move || {
                let mut clipboard = match arboard::Clipboard::new() {
                    Ok(c) => c,
                    Err(e) => {
                        log::error!("Clipboard watcher init failed: {}", e);
                        return;
                    }
                };
                let mut last_text = String::new();
                let mut last_image_hash: u64 = 0;

                loop {
                    if let Ok(text) = clipboard.get_text() {
                        if !text.trim().is_empty() && text != last_text {
                            last_text = text.clone();
                            last_image_hash = 0;
                            let now = chrono::Utc::now().timestamp();
                            let _ = app_handle.emit("clipboard_change", ClipboardPayload {
                                content: text,
                                content_type: "text".into(),
                                image_data: String::new(),
                                captured_at: now,
                            });
                        }
                    } else if let Ok(img) = clipboard.get_image() {
                        let hash: u64 = img
                            .bytes
                            .iter()
                            .take(64)
                            .fold(0u64, |acc, b| acc.wrapping_add(*b as u64));
                        if hash != 0 && hash != last_image_hash {
                            last_image_hash = hash;
                            last_text = String::new();
                            let png_bytes = rgba_to_png(img.width, img.height, &img.bytes);
                            let b64 = STANDARD.encode(&png_bytes);
                            let now = chrono::Utc::now().timestamp();
                            let _ = app_handle.emit("clipboard_change", ClipboardPayload {
                                content: String::new(),
                                content_type: "image".into(),
                                image_data: b64,
                                captured_at: now,
                            });
                        }
                    }

                    thread::sleep(std::time::Duration::from_millis(500));
                }
            });

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

                let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::F2);
                let app_handle = app.handle().clone();
                match app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_window(&app_handle);
                    }
                }) {
                    Ok(_) => info!("Global shortcut registered: Ctrl+F2 (toggle)"),
                    Err(e) => warn!("Could not register Ctrl+F2 shortcut (already in use?): {}", e),
                };
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
