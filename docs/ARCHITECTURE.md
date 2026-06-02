# Architecture Documentation — Memo v1.0.0

**Last Updated:** 2026-06-02

---

## System Overview

Memo is a **native macOS desktop application** built with the Tauri framework. The architecture is a hybrid: a Rust process manages the native window and system access, while a React/TypeScript single-page application runs inside a WebView (WKWebView) and provides all user interface.

```
┌─────────────────────────────────────────────────────────────────┐
│                        macOS Window                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │             WKWebView — React Application               │    │
│  │                                                         │    │
│  │   Sidebar  │  Matter List  │  Main Content Panel        │    │
│  │                                                         │    │
│  │   (React 19 + TypeScript + Tailwind CSS v4)             │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │  Tauri IPC                             │
│                         │  (invoke / plugin calls)               │
│  ┌──────────────────────▼──────────────────────────────────┐    │
│  │              Rust Process (Tauri 2)                     │    │
│  │                                                         │    │
│  │  tauri-plugin-sql    tauri-plugin-fs                    │    │
│  │  tauri-plugin-dialog tauri-plugin-opener                │    │
│  │  search_contacts (custom JXA command)                   │    │
│  └────────────┬────────────────────────┬────────────────────┘   │
│               │                        │                         │
│  ┌────────────▼──────────┐  ┌──────────▼───────────────────┐   │
│  │  SQLite Database      │  │  macOS System APIs           │   │
│  │  memoapp.db           │  │  Contacts · UPI · Mail · FS  │   │
│  │  ~/Library/AppSupport │  │                              │   │
│  └───────────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Languages

| Language | Version | Used For |
|---|---|---|
| TypeScript | ~5.8.3 | All frontend code |
| Rust | stable | Tauri backend, `search_contacts` command |
| SQL (SQLite dialect) | — | All database queries |
| JavaScript (JXA) | macOS | Contacts search script (embedded in Rust) |
| SVG | — | App icon source (`app-icon.svg`) |
| Markdown | — | Documentation |

### Frameworks & Runtime

| Framework | Version | Purpose |
|---|---|---|
| Tauri | 2.x | Desktop shell, window management, IPC bridge |
| React | 19.1.0 | UI component framework |
| Vite | 7.0.4 | Frontend bundler + dev server |

### Frontend Libraries

| Library | Version | Purpose |
|---|---|---|
| `tailwindcss` | 4.3.0 | Utility-first CSS (no config file — uses `@tailwindcss/vite` plugin) |
| `@react-pdf/renderer` | 4.5.1 | Client-side PDF generation (runs in WebView, no server) |
| `lucide-react` | 1.16.0 | Icon set (SVG-based) |
| `date-fns` | 4.3.0 | Date formatting (`format`, `addDays`) |
| `uuid` | 14.0.0 | UUID v4 generation for record IDs |

### Tauri Plugins (Rust + JS bridge)

| Plugin | Version | Purpose |
|---|---|---|
| `@tauri-apps/plugin-sql` | 2.4.0 | SQLite database access via tauri-plugin-sql |
| `@tauri-apps/plugin-dialog` | 2.7.1 | Native macOS Save / Open file dialogs |
| `@tauri-apps/plugin-fs` | 2.5.1 | File read and write operations |
| `@tauri-apps/plugin-opener` | 2.x | Open URLs (UPI, mailto, web links) |

### Build & Dev Tools

| Tool | Version | Purpose |
|---|---|---|
| `@tauri-apps/cli` | 2.x | Tauri build, icon gen, dev mode |
| `@vitejs/plugin-react` | 4.6.0 | React JSX + Fast Refresh |
| `@tailwindcss/vite` | 4.3.0 | Tailwind CSS Vite plugin |
| `typescript` | 5.8.3 | Type checking |
| `sharp` | 0.34.5 | Image processing (used by `tauri icon` command) |

---

## Frontend Architecture

### Entry Point

```
src/main.tsx
└── React.StrictMode
    └── ErrorBoundary         (catches runtime errors; shows fallback UI)
        └── ToastProvider     (context for toast notifications)
            └── App           (root layout and navigation state)
```

### Navigation Model

Navigation is **pure in-memory state** — there is no URL router, no `react-router`, no hash-based routing. The `nav` variable in `App.tsx` is a union type string:

```typescript
type NavSection = "matters" | "outstanding" | "record_payment" |
                  "dashboard" | "clients" | "firms" | "settings";
```

`App.tsx` renders the appropriate component based on `nav`. Sidebar calls `onChange(navSection)`.

```typescript
// App.tsx renderContent()
if (nav === "dashboard")       return <Dashboard onEditProfile={() => setNav("settings")} />;
if (nav === "outstanding")     return <OutstandingDues />;
if (nav === "record_payment")  return <RecordPayment />;
if (nav === "clients")         return <ContactList type="client" />;
if (nav === "firms")           return <ContactList type="firm" />;
if (nav === "settings")        return <SettingsPage ... />;
// else: matter detail / form / list
```

### State Management

No global state library. State is managed with React `useState` and `useEffect`.

**Pattern:** Props down, callbacks up.

`App.tsx` holds the top-level state:
- `nav` — current section
- `selectedMatter` — matter currently open
- `profile` — loaded on startup, updated when settings are saved
- `lock` / `unlocked` — app lock state
- `profileReady` — whether onboarding is complete

Child components hold their own local state and call parent callbacks (`onSave`, `onDelete`, `onNavigate`) when something changes.

**Refresh pattern:** When a mutation occurs in a child component, the parent increments a `refreshList` counter which triggers a `useEffect` re-fetch.

### Component Map

```
App.tsx (root)
├── Sidebar.tsx                    Always visible; navigation + app logo
├── MatterList.tsx                 Left panel when in matters section
│
├── Dashboard.tsx                  nav="dashboard"
│   └── (ProfileCard — read-only, links to Settings)
│
├── MatterForm.tsx                 New/edit matter
│   └── EntityPicker               Searchable combobox for clients/firms
│
├── MatterDetail.tsx               Matter overview tab
│   └── MatterParties.tsx          Parties panel
│
├── TimeEntries.tsx                Time tab
├── Appearances.tsx                Appearances tab
│
├── Invoices.tsx                   Invoices tab
│   ├── InvoiceForm                New invoice
│   ├── InvoiceRow                 Expanded invoice row
│   └── PaymentForm                Add payment
│
├── OutstandingDues.tsx            nav="outstanding"
│   └── PaymentForm (inline)
│
├── RecordPayment.tsx              nav="record_payment"
│   └── ReconciliationBanner
│
├── ContactList.tsx                nav="clients" or "firms"
│   ├── ContactDetail
│   │   ├── LinkedMattersPanel     Shows related matters
│   │   └── ContactPersonsPanel    Manage contact persons
│   │       └── ContactPersonForm
│   │           └── ContactPickerModal (macOS Contacts search)
│   └── ContactForm
│       └── ContactPickerModal
│
├── SettingsPage.tsx               nav="settings"
│   ├── LockSettings.tsx
│   └── InvoiceDesigner.tsx
│
├── LockScreen.tsx                 Shown before unlock
├── Onboarding.tsx                 First-run overlay
├── AboutModal.tsx                 ⓘ button
│   └── SupportModal.tsx           Tip screen (inactive)
│
└── ScreenshotHelper.tsx           Dev-only (⌘⇧D)
```

### Styling

- **Tailwind CSS v4** — utility classes only; no CSS modules or styled-components
- **Color scheme locked to light mode** via `color-scheme: light` in `index.css` — prevents macOS Dark Mode from making input text invisible
- **Theme:** Black and white (`neutral-900` for primary actions; `neutral-*` for all accents)
- **Status colours preserved:** Green for active/paid, amber for warnings, red for errors

### PDF Generation

```
User clicks Download PDF
    ↓
InvoiceRow.handleDownloadPDF()
    ↓
fetchMatterParties() + fetchContactPersons() × 2
    ↓
pdf(<InvoicePDF ...props />).toBlob()   ← @react-pdf/renderer
    ↓
blob.arrayBuffer() → Uint8Array
    ↓
tauri-plugin-dialog.save()              ← native Save dialog
    ↓
tauri-plugin-fs.writeFile()             ← writes to disk
```

---

## Backend Architecture

### Rust Process (`src-tauri/src/lib.rs`)

The Rust process has one responsibility beyond hosting the WebView: providing the `search_contacts` IPC command.

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![search_contacts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Everything else — database, file I/O, dialogs — is handled by Tauri plugins. The application developer never writes Rust for these; the TypeScript API calls the plugin bridge directly.

### `search_contacts` Command

```rust
// Async command — runs on Tokio thread pool
#[tauri::command]
async fn search_contacts(query: String) -> Result<Vec<MacContact>, String> {
    let query = query.trim().to_string();
    if query.is_empty() { return Ok(vec![]); }

    tauri::async_runtime::spawn_blocking(move || run_search(query))
        .await
        .map_err(|e| e.to_string())?
}

fn run_search(query: String) -> Result<Vec<MacContact>, String> {
    let script = JXA_TEMPLATE.replace("__QUERY__", &safe_query);
    let output = std::process::Command::new("osascript")
        .args(["-l", "JavaScript", "-e", &script])
        .output()?;
    serde_json::from_str(stdout.trim())
}
```

**Why `spawn_blocking`?** `osascript` is a blocking system call. Running it directly in an `async fn` would block the Tokio executor. `spawn_blocking` moves it to a thread-pool thread.

---

## Database Architecture

### Connection Management

```typescript
let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:memoapp.db");
  await migrate(_db);
  return _db;
}
```

- Single shared connection (SQLite supports only one writer)
- Migration runs exactly once per app session (on first `getDb()` call)
- All CRUD functions call `getDb()` — they get the cached connection on subsequent calls

### Query Pattern

All queries use parameterised placeholders:
```typescript
await db.execute(
  "INSERT INTO matters (id, case_title, ...) VALUES (?, ?, ...)",
  [matter.id, matter.case_title, ...]
);
```

Never string-interpolated SQL (prevents SQL injection, though the app has no external input surface anyway).

---

## Authentication Architecture

```
User sets PIN
    ↓
sha256(pin) via crypto.subtle.digest("SHA-256", ...)
    ↓
hex-encode result
    ↓
store in settings table: { key: "lock", value: JSON.stringify({ hash: hexString }) }

User enters PIN at lock screen
    ↓
sha256(input) → hex string
    ↓
compare with stored hash
    ↓
if match: setUnlocked(true) in App.tsx state
```

**Session lifecycle:**
- `unlocked` is in-memory React state in `App.tsx`
- Defaults to `true` if no lock is configured
- Defaults to `false` if lock is configured
- Resets to `false` on every app restart
- User can manually lock by clicking 🔒 in sidebar

---

## File Storage Architecture

| Item | Location | Who writes |
|---|---|---|
| SQLite database | `~/Library/Application Support/com.memoapp.app/memoapp.db` | tauri-plugin-sql |
| Exported PDFs | User-chosen via Save dialog | tauri-plugin-fs |
| Backup JSON | User-chosen via Save dialog | tauri-plugin-fs |
| App bundle | `/Applications/Memo.app` | macOS installer |
| App icons | `src-tauri/icons/` (build artefact) | `tauri icon` command |

---

## External Integrations

### macOS Contacts (Read-only)

```
TypeScript:  invoke("search_contacts", { query })
             ↓
Rust:        spawn_blocking → run_search(query)
             ↓
             std::process::Command::new("osascript")
               .args(["-l", "JavaScript", "-e", JXA_SCRIPT])
             ↓
macOS:       osascript → JXA → Contacts.framework
             ↓
             JSON result back through stdout
             ↓
Rust:        serde_json::from_str → Vec<MacContact>
             ↓
TypeScript:  MacContact[] rendered in picker UI
```

### UPI Payment (Outbound, user-initiated)

```
User clicks "Send a Tip"
    ↓
openUrl("upi://pay?pa=ssmendon@icici&am=99&tn=...")
    ↓
macOS routes upi:// scheme to installed UPI app
    ↓
User completes payment in GPay / PhonePe / Paytm
    ↓
Memo has no further involvement
```

### Email (Outbound, user-initiated)

```
User clicks support email link
    ↓
openUrl("mailto:stripes_swoops_2b@icloud.com")
    ↓
macOS opens Mail.app
```

---

## IPC Permissions (`src-tauri/capabilities/default.json`)

All IPC calls from the WebView to Rust require explicit permission grants:

```json
{
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "opener:default",
    "sql:default", "sql:allow-execute", "sql:allow-select",
    "sql:allow-load", "sql:allow-close",
    "dialog:default", "dialog:allow-save", "dialog:allow-open",
    "fs:default", "fs:allow-write-file", "fs:allow-write-text-file",
    "fs:allow-read-file", "fs:allow-read-text-file"
  ]
}
```

Adding a new plugin call requires a matching permission entry here, or the call will fail silently.

---

## Window Configuration

```json
{
  "windows": [{
    "title": "Memo",
    "width": 1280, "height": 800,
    "minWidth": 900, "minHeight": 600,
    "titleBarStyle": "Overlay"
  }]
}
```

`titleBarStyle: "Overlay"` — native macOS traffic light buttons overlay the WebView content. The app renders a custom drag bar div with `data-tauri-drag-region` attribute at the top of the layout.

**Important:** The drag bar uses `data-tauri-drag-region` HTML attribute — NOT the `startDragging()` programmatic API. The `startDragging()` API was used previously but caused the WKWebView to lose OS-level keyboard focus, making all inputs non-functional. This was a significant bug that was fixed by switching to the attribute approach.

---

## Build Architecture

### Development Build

```
npm run tauri dev
    ↓
Vite dev server starts on localhost:1420
    ↓
Tauri launches native window pointing at localhost:1420
    ↓
HMR: frontend changes → instant reload
    ↓
Rust changes → requires restart
```

### Production Build

```
npm run tauri build
    ↓
Vite builds React app → dist/
    ↓
Tauri bundles dist/ into app Resources
    ↓
Rust compiles → binary at src-tauri/target/release/memoapp
    ↓
Tauri creates:
  - Memo.app (bundle)
  - Memo_1.0.0_aarch64.dmg (installer)
```

---

## Scalability Considerations

| Component | Current | Limit | Mitigation when needed |
|---|---|---|---|
| SQLite | Single file, no indexes beyond PK | ~50K rows performance degrades | Add indexes on `created_at`, `client_name`, `status` |
| Contacts JXA | No pagination | >5K contacts = slow | Switch to Contacts.framework via Rust objc2 bindings |
| PDF rendering | Runs in browser thread | >50 line items = brief freeze | Move to Rust thread via Tauri command |
| Matter list | All loaded into memory | >1K matters = sluggish scroll | Add pagination or virtual list |
