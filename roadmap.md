# ROADMAP — Klypt (unificado)

**Stack:** Tauri 2 (desktop) + Vanilla TS + **Supabase** (Auth + Database + Realtime) + Web client
**Backend:** Supabase (Auth + PostgreSQL + Realtime WebSocket) — NO custom server
**No emojis en la UI — usar iconos SVG inline**
**Auth:** OAuth PKCE via Supabase (Google + GitHub)

---

## PROYECTO: Klypt

### FASE 0 — Klypt → Klypt (Migracion existente)
**Objetivo:** Renombrar, actualizar branding, preparar para features nuevas

| # | Tarea | Archivo | Dep |
|---|-------|---------|-----|
| 0.1 | Renombrar producto: `productName` "Klypt", identifier `com.klypt.app` | `tauri.conf.json` | — |
| 0.2 | Window decorated, resizable, min 700x450 | `tauri.conf.json` | — |
| 0.3 | Deps Rust: `serde`, `uuid`, `chrono`, `regex`, `zxcvbn` | `Cargo.toml` | — |
| 0.4 | Deps TS: `@supabase/supabase-js`, `@tauri-apps/plugin-store` | `package.json` | — |
| 0.5 | OAuth PKCE: Supabase JS client + localhost callback handler en Rust | `src/auth.ts`, `src-tauri/src/lib.rs` | — |

---

### FASE M — Multi-Select Merge

| # | Tarea | Archivo | Dep |
|---|-------|---------|-----|
| M1 | Cmd/Ctrl+Click toggle en note-card | `src/main.ts` | — |
| M2 | CSS `.merge-checkbox` con glow animation | `src/styles.css` | M1 |
| M3 | Toolbar boton "Merge (N)" — visible si `mergeSelectedIds.size >= 2` | `src/main.ts`, `src/styles.css` | M2 |
| M4 | Dialogo merge: separator options + checkbox "Eliminar notas originales" (default checked) | `src/main.ts`, `src/styles.css` | M3 |
| M5 | `confirmMerge()`: merge → `add_note` → opcional `delete_note` x N → re-render sin hide | `src/main.ts` | M4 |
| M6 | Escape limpia seleccion; cerrar dialogo limpia | `src/main.ts` | M4 |

---

### FASE R — Regex Deteccion Sensible (Notas Almacenadas)

**Scope:** Analizar contenido de notas en storage. NO monitorizacion de clipboard.

| # | Tarea | Archivo | Dep |
|---|-------|---------|-----|
| R1 | Deps Rust: `regex` + `zxcvbn` | `Cargo.toml` | — |
| R2 | Patrones SOTA: email, API key `(sk\|ak\|ghp)-[A-Za-z0-9]{36,}`, CC `\d{4}[ -]?\d{4}`, SSN `\d{3}-\d{2}-\d{4}`, password-like (entropy via zxcvbn) | `src-tauri/src/sensitive.rs` | R1 |
| R3 | Scan notas al guardar/actualizar: `analyze_content(content) -> SensitiveScore` | `src-tauri/src/lib.rs` | R2 |
| R4 | Si score >= 3: toast "Contenido potencialmente sensible detectado" + botones "Privada" / "Descartar" | `src/main.ts` | R3 |
| R5 | DB: `ALTER TABLE notes ADD COLUMN is_private INTEGER DEFAULT 0` | `src-tauri/src/lib.rs` | R4 |
| R6 | Guardar nota con `is_private=true` | `src-tauri/src/lib.rs` | R5 |

---

### FASE P — Notas Privadas

| # | Tarea | Archivo | Dep |
|---|-------|---------|-----|
| P1 | Toggle icono (ojo) en note-card → `is_private` flip | `src/main.ts`, `src/styles.css` | R5 |
| P2 | Toggle "Mostrar en resumenes" → columna `show_in_summary` + badge visual | `src-tauri/src/lib.rs`, `src/styles.css` | P1 |
| P3 | Filtrar notas privadas en MRU (mostrar candado, blur content, requieren auth) | `src-tauri/src/lib.rs` | P1 |
| P4 | Auth futuro: notas privadas solo visibles post-login | `src-tauri/src/lib.rs` | P3 |

---

### FASE Q1 — Auth Supabase + Users (Semana 1) — PRIORIDAD

| # | Tarea | Detalle tecnico |
|---|-------|----------------|
| 1.1 | Crear proyecto Supabase: [supabase.com](https://supabase.com) → nuevo proyecto | Dashboard |
| 1.2 | SQL schema: `profiles(id, email, name, avatar_url, created_at)` + RLS policies | `supabase/schema.sql` |
| 1.3 | OAuth providers: Google + GitHub en Supabase Dashboard > Auth > Providers | Dashboard |
| 1.4 | Redirect URL: `http://localhost:1420/callback` en Supabase Auth settings | Dashboard |
| 1.5 | `auth.ts`: init Supabase client + `signInWithOAuth()` + PKCE flow | `src/auth.ts` |
| 1.6 | Auth screen UI: Google button, GitHub button, skip/login later | `src/main.ts`, `src/styles.css` |
| 1.7 | Session persistence: `tauri-plugin-store` guarda session token | `src-tauri/src/lib.rs` |
| 1.8 | `onAuthStateChange` listener: sincroniza auth state global | `src/auth.ts` |
| 1.9 | Lock/Unlock: boton lock → logout local, clear store, mostrar auth screen | `src/main.ts` |
| 1.10 | User profile header: avatar, name, logout | `src/main.ts` |

---

### FASE Q2 — Supabase Database + RLS (Semana 2)

| # | Tarea | Detalle tecnico |
|---|-------|----------------|
| 2.1 | SQL schema: `notes(id, user_id, title, content, is_private, show_in_summary, is_pinned, pin_order, click_count, created_at, updated_at)` | `supabase/schema.sql` |
| 2.2 | SQL schema: `clipboard_items(id, user_id, content, content_type, image_data, captured_at)` | `supabase/schema.sql` |
| 2.3 | RLS policies: usuarios solo ven sus propios datos | `supabase/schema.sql` |
| 2.4 | Migrar queries locales a Supabase: `supabase.from('notes').select/insert/update/delete` | `src/supabase.ts` |
| 2.5 | Agregar `user_id` a todas las notas locales existentes (primer login) | `src-tauri/src/lib.rs` |
| 2.6 | Supabase JS client singleton en frontend | `src/supabase.ts` |

---

### FASE Q3 — Supabase Realtime Sync (Semana 3) — PRIORIDAD

| # | Tarea | Detalle tecnico |
|---|-------|----------------|
| 3.1 | Enable Realtime en Supabase Dashboard: tables `notes`, `clipboard_items` | Dashboard |
| 3.2 | Subscribe to `notes` channel: `supabase.channel('notes').on('postgres_changes', ...)` | `src/realtime.ts` |
| 3.3 | Subscribe to `clipboard_items` channel | `src/realtime.ts` |
| 3.4 | Handle INSERT/UPDATE/DELETE: aplicar cambios en local state sin re-fetch completo | `src/main.ts` |
| 3.5 | Sync status: "Synced" / "Syncing..." / "Offline" indicator | `src/main.ts` |
| 3.6 | Optimistic updates: actualizar UI inmediatamente, rollback on error | `src/main.ts` |
| 3.7 | Conflict resolution: last-write-wins (comparar `updated_at`) + toast si conflicto | `src/main.ts` |

---

### FASE Q4 — Web Client (Semana 4) — PRIORIDAD

| # | Tarea | Detalle tecnico |
|---|-------|----------------|
| 4.1 | Web frontend scaffold: Vite + Vanilla TS | `web/` |
| 4.2 | Reutilizar `src/auth.ts` + `src/supabase.ts` en web | `web/src/` |
| 4.3 | Reutilizar `src/realtime.ts` en web | `web/src/` |
| 4.4 | OAuth login web: redirect a Supabase hosted auth page | `web/src/auth.ts` |
| 4.5 | Notes list + CRUD UI (mismo dark theme que desktop) | `web/src/main.ts`, `web/src/styles.css` |
| 4.6 | Responsive layout: mobile browser | `web/src/styles.css` |
| 4.7 | PWA: service worker + offline support (cache notes locally) | `web/` |

---

### FASE Q5 — Clipboard Watcher + Polish (Semana 5)

| # | Tarea | Detalle tecnico |
|---|-------|----------------|
| 5.1 | Clipboard watcher nice-to-have: `arboard` polls 500ms → guardar en Supabase | `src-tauri/src/lib.rs` |
| 5.2 | Sensitive detection on stored notes via Supabase Edge Function o Rust backend | `src-tauri/src/sensitive.rs` |
| 5.3 | System tray: show/hide, sync status, lock, quit | `src-tauri/src/lib.rs` |
| 5.4 | Global shortcut: `Ctrl+Alt+M` → toggle window | `src-tauri/src/lib.rs` |
| 5.5 | Settings: auto-lock timeout, clipboard watcher toggle | `settings.ts` |
| 5.6 | Keyboard shortcuts: `Ctrl+N/L/F/C` | `main.ts` |

---

### FASE Q6 — Release + CI/CD (Semana 6)

| # | Tarea | Detalle tecnico |
|---|-------|----------------|
| 6.1 | CI/CD: GitHub Actions (build-linux, build-win, build-mac, build-web) | `.github/workflows/` |
| 6.2 | Code signing: GPG (Linux), signtool (Win), codesign (macOS) | `.github/workflows/release.yml` |
| 6.3 | Web deployment: Vercel/Cloudflare Pages (point to `web/` folder) | `web/` |
| 6.4 | Supabase production: cambiar anon key + URL en env vars | `src/supabase.ts` |
| 6.5 | Draft release + attach binaries + checksums | `.github/workflows/release.yml` |
| 6.6 | README + Supabase project setup guide | `docs/`, `README.md` |

---

## Supabase Schema SQL

```sql
-- Profiles (auto-creado por Supabase Auth trigger)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_private BOOLEAN DEFAULT FALSE,
  show_in_summary BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,
  pin_order INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clipboard history
CREATE TABLE clipboard_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_type TEXT DEFAULT 'text',
  image_data TEXT DEFAULT '',
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can CRUD own notes" ON notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own clipboard" ON clipboard_items FOR ALL USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE clipboard_items;

-- Indexes
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_clipboard_user_id ON clipboard_items(user_id);
```

---

## PROYECTO: Klypt Passwords — EN PAUSA

Ver `roadmap-passwords.md` para scope completo cuando se retome.

---

## Resumen de tareas

| Fase | Descripcion | Tareas | Semanas |
|------|-------------|--------|---------|
| 0 | Migracion Klypt → Klypt | 5 | — |
| M | Multi-select merge | 6 | — |
| R | Regex deteccion sensible | 6 | — |
| P | Notas privadas | 4 | — |
| Q1 | Auth Supabase + Users | 10 | 1 |
| Q2 | Supabase Database + RLS | 6 | 2 |
| Q3 | Supabase Realtime Sync | 7 | 3 |
| Q4 | Web Client | 7 | 4 |
| Q5 | Clipboard + Polish | 6 | 5 |
| Q6 | Release + CI/CD | 6 | 6 |
| **Total** | | **63** | **~7** |

---

## Dependencias

### Rust (src-tauri/Cargo.toml)

| Crate | Uso |
|-------|-----|
| `serde` + `serde_json` | Serialization |
| `uuid` | IDs |
| `chrono` | Timestamps |
| `regex` | Sensitive detection |
| `zxcvbn` | Password entropy |
| `arboard` | Clipboard access (nice-to-have) |
| `tauri-plugin-store` | Session persistence |
| `tauri-plugin-global-shortcut` | Global shortcuts |
| `tauri-plugin-clipboard-manager` | Clipboard manager |



### TypeScript (package.json)

| Package | Uso |
|---------|-----|
| `@supabase/supabase-js` | Supabase client |
| `@tauri-apps/plugin-oauth` | OAuth deep link handler |
| `@tauri-apps/plugin-store` | Local session store |
| `fuse.js` | Fuzzy search |

---

## Estructura de directorios

```
klypt/
├── src/                    # Frontend desktop (Vanilla TS)
│   ├── main.ts            # Entry + keyboard shortcuts
│   ├── auth.ts            # Supabase OAuth PKCE flow
│   ├── supabase.ts       # Supabase client singleton
│   ├── realtime.ts        # Supabase Realtime subscriptions
│   ├── notes.ts           # Note CRUD via Supabase
│   ├── merge.ts           # Multi-select merge
│   ├── sensitive.ts       # Sensitive detection UI
│   ├── settings.ts        # Settings panel
│   └── styles.css
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs         # Tauri commands + clipboard watcher
│   │   ├── sensitive.rs   # Regex + zxcvbn patterns
│   │   └── clipboard.rs   # Clipboard watcher (nice-to-have)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── supabase/
│   └── schema.sql         # Database schema + RLS + Realtime
├── web/                   # Web client (Vanilla TS + Vite)
│   ├── src/
│   │   ├── main.ts
│   │   ├── auth.ts        # (shared from src/)
│   │   ├── supabase.ts   # (shared from src/)
│   │   ├── realtime.ts   # (shared from src/)
│   │   └── styles.css
│   ├── vite.config.ts
│   └── index.html
├── .github/workflows/
├── docs/
└── README.md
```
