# AGENTS.md

This file provides guidance for AI agents working in this repository.

## Project Overview

Klypt is a frameless, always-on-top floating note manager built with **Tauri 2** (Rust backend) + **Vanilla TypeScript** (Vite frontend). It manages notes and clipboard history with usage-based sorting.

## Build Commands

```bash
# Development
npm run tauri dev        # Start Tauri dev mode (Vite + Rust backend together)
npm run dev              # Frontend only (Vite on port 1420)

# Build
npm run build            # Type-check + build frontend only
npm run tauri build      # Full production build (frontend + Rust binary + .deb)

# Rust backend only
cd src-tauri && cargo build
cd src-tauri && cargo check   # Fast type-check without linking

# Run single Rust test (if tests exist)
cd src-tauri && cargo test <test_name>
```

**Note:** No test or lint commands are currently configured for this project.

## Code Style Guidelines

### TypeScript (Frontend)

**File:** `src/main.ts` - single-file vanilla TypeScript

- **Imports:** Use `@tauri-apps/api/core` for invoke, `@tauri-apps/api/event` for listen, `@tauri-apps/plugin-clipboard-manager` for clipboard, `fuse.js` for fuzzy search
- **Naming:** camelCase for variables/functions, PascalCase for interfaces/types
- **Types:** Use explicit interfaces for data structures (Note, ClipboardItem)
- **DOM:** Type-cast DOM elements with `as HTMLXxxElement`
- **Error handling:** Use try/catch with `_` for ignored errors, show toast on failure
- **Formatting:** 2 spaces, no semicolons at line ends, trailing commas
- **State:** Use module-level variables for state, no framework
- **Async:** Use async/await, invoke Tauri commands with generic type: `invoke<Type>("command")`

### Rust (Backend)

**File:** `src-tauri/src/lib.rs`

- **Imports:** Group by std → external → tauri → local. Use `use X::Y;` with module paths
- **Naming:** snake_case for functions/variables, PascalCase for structs/enums
- **Types:** Explicit return types on functions, use `Result<T, String>` for fallible operations
- **Error handling:** Convert errors with `.map_err(|e| e.to_string())` for Tauri compatibility
- **Formatting:** Run `cargo fmt` before committing (4 spaces standard)
- **Database:** Use rusqlite with prepared statements, bind params with `params![]`
- **State:** Use `State<Database>` pattern with `Arc<Mutex<Connection>>` for thread safety
- **Tauri commands:** Mark with `#[tauri::command]`, register in `generate_handler![]`

### Adding New Tauri Commands

1. Add Rust function with `#[tauri::command]` in `src-tauri/src/lib.rs`
2. Register it in `.invoke_handler(tauri::generate_handler![...])`
3. Call from frontend: `invoke('command_name', { args })`

### Architecture Notes

- **Database:** SQLite at `~/.local/share/klypt/klypt.db`
- **Window:** 600×450px, frameless, transparent, always-on-top (config in `tauri.conf.json`)
- **Clipboard watcher:** Background thread polls every 500ms
- **Search:** Fuse.js with 150ms debounce, threshold 0.25

### Patterns to Follow

- **Frontend:** Single event handlers, render functions that rebuild DOM entirely
- **Backend:** Additive DB migrations (use `ALTER TABLE` with `let _ =` to ignore errors)
- **Shared:** Use consistent error messages in Spanish for UI feedback

### Key Files

- `src/main.ts` - Frontend UI, search, keyboard handling
- `src-tauri/src/lib.rs` - Rust backend, SQLite, clipboard watcher
- `src-tauri/tauri.conf.json` - Window and app configuration
- `package.json` - npm scripts and dependencies
- `src-tauri/Cargo.toml` - Rust dependencies

---

## Multi-Project Notes

This repo contains multiple projects. Verificar `roadmap.md` para scope completo.

- **Klypt** (este repo): Notas flotantes, Tauri desktop
- **Klypt** (nuevo repo): Sync app con OAuth + WebSocket + Web client
- **Klypt Passwords**: Deprecated / en pausa

**Reglas de estilo transversales:**
- **Sin emojis** en la UI (iconos SVG inline)
- Mensajes de error en espanol para feedback al usuario
- CSS variables para theming dark mode (#111827 base)