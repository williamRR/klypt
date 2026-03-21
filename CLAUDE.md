# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run both together)
npm run tauri dev        # Start Tauri dev mode (launches Vite + Rust backend)

# Build
npm run build            # Type-check + build frontend only
npm run tauri build      # Full production build (frontend + Rust binary + .deb)

# Frontend only (no Tauri)
npm run dev              # Vite dev server on port 1420

# Rust backend only
cd src-tauri && cargo build
cd src-tauri && cargo check   # Fast type-check without linking
```

No test or lint commands are configured.

## Architecture

Klypt is a frameless, always-on-top floating note manager built with **Tauri 2** (Rust backend) + **Vanilla TypeScript** (Vite frontend).

### How it works

- Global hotkey `Ctrl+F2` toggles the floating window; clicking outside hides it
- Three-column layout: **Pinned** notes (manual order, drag to reorder) | **MRU** notes (sorted by `click_count` DESC) | **Clipboard history** (auto-captured, last 100 items)
- Search is fuzzy (fuse.js, threshold 0.25, 150ms debounce) across title and content, filtering both pinned and MRU columns simultaneously
- Press `+` in the search box to open the add form; `Ctrl+Enter` saves; `Escape` cancels
- Clicking a note copies its content to clipboard, increments its `click_count`, and hides the window
- Multi-select notes with `Ctrl+Click` or the checkbox, then merge them into a new note via the Merge button

### Frontend (`src/main.ts`, `src/auth.ts`)

`src/main.ts` — single-file vanilla TypeScript for all UI: rendering three columns, keyboard navigation (arrow keys, Enter to copy, Escape to hide), add/edit form, merge dialog, and all Tauri command invocations.

`src/auth.ts` — Supabase auth module. Handles Google/GitHub OAuth via a local TCP server on port 9876 (started by `start_oauth` Tauri command) that captures the OAuth callback, then exchanges the code with Supabase. Auth state drives showing the auth screen vs the main app. Credentials come from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars (`.env` file).

### Backend (`src-tauri/src/lib.rs`)

Tauri commands exposed to the frontend:
- `get_notes` — unpinned notes ordered by `click_count` DESC, `updated_at` DESC, limit 50
- `get_pinned_notes` — pinned notes ordered by `pin_order` ASC
- `add_note` / `update_note` / `delete_note` — CRUD
- `increment_click` — bumps `click_count` on copy
- `pin_note` / `unpin_note` / `reorder_pinned` — pin management
- `get_clipboard_history` / `delete_clipboard_item` / `copy_image_to_clipboard` — clipboard history
- `hide_window` — hides app after note copy
- `start_oauth` — starts local TCP server on port 9876 for OAuth callback; emits `oauth_callback` event to frontend

**Clipboard watcher** — background thread polling every 500ms via `arboard`. Captures text and images (converted to base64 PNG), deduplicating by content equality (text) or a simple byte hash (images). Keeps the last 100 items.

**DB schema** — SQLite at `~/.local/share/klypt/klypt.db`. Tables: `notes` (id, title, content, click_count, is_pinned, pin_order, created_at, updated_at) and `clipboard_history` (id, content, content_type, image_data, captured_at). Schema is created on startup; additive columns are added via `ALTER TABLE` with silent failure (idempotent migrations).

### Window configuration

Defined in `src-tauri/tauri.conf.json`: 600×450px, frameless, transparent, non-resizable, always-on-top, hidden from taskbar. These constraints matter when modifying the UI layout.

### Adding a new Tauri command

1. Add the Rust function with `#[tauri::command]` in `src-tauri/src/lib.rs`
2. Register it in the `.invoke_handler(tauri::generate_handler![...])` call in `lib.rs`
3. Call it from the frontend with `invoke('command_name', { args })` from `@tauri-apps/api/core`
