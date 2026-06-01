# System Architecture Documentation

**App:** Memo v1.0.0  
**Last updated:** 2026-05-31

---

## Overview

Memo is a **native macOS desktop application** built with the Tauri framework. It combines a Rust backend (for system access and performance) with a React/TypeScript frontend (for the user interface). All data is stored locally in a SQLite database — there is no server, no cloud, and no internet connection required.

```
┌─────────────────────────────────────────────────────────┐
│                      macOS Window                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │           WKWebView  (React UI)                   │  │
│  │  Sidebar │ Matter List │ Main Content Panel       │  │
│  └─────────────────┬─────────────────────────────────┘  │
│                    │  Tauri IPC (invoke / plugin calls)  │
│  ┌─────────────────▼─────────────────────────────────┐  │
│  │               Rust Process (Tauri)                │  │
│  │  tauri-plugin-sql  │  tauri-plugin-fs             │  │
│  │  tauri-plugin-dialog │ tauri-plugin-opener        │  │
│  │  Custom command: search_contacts (osascript/JXA)  │  │
│  └─────────────────┬─────────────────────────────────┘  │
│                    │                                     │
│  ┌─────────────────▼────────┐  ┌──────────────────────┐ │
│  │  SQLite DB (memoapp.db)  │  │  macOS System APIs   │ │
│  │  ~/Library/Application   │  │  Contacts · UPI      │ │
│  │  Support/com.memoapp.app │  │  File system · Mail  │ │
│  └──────────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Desktop shell | Tauri | 2.x | Native macOS window, system API bridge |
| Rust runtime | Rust (stable) | — | System commands, plugin host |
| Frontend UI | React + TypeScript | 19 / 5.8 | All screens and components |
| Build tool | Vite | 7.x | Frontend bundling and dev server |
| Styling | Tailwind CSS v4 | 4.3 | Utility-first CSS |
| PDF generation | @react-pdf/renderer | 4.5 | Client-side PDF; no server needed |
| Database | SQLite (via tauri-plugin-sql) | — | Local persistent storage |
| Icons | Lucide React | 1.16 | UI icon set |

---

## Application Layers

### 1. User Interface (`src/`)

The UI is a **single-page React application** rendered inside a macOS WebView (WKWebView). Navigation is handled entirely in-memory — there is no URL routing.

**Key files:**
- `src/main.tsx` — React root; wraps app in `ErrorBoundary` and `ToastProvider`
- `src/App.tsx` — Top-level layout: sidebar + matter list panel + main content panel; handles all navigation state
- `src/index.css` — Global CSS; locks the WebView to light mode (`color-scheme: light`)
- `src/types.ts` — All TypeScript interfaces and type aliases shared across the app
- `src/db.ts` — All database access functions (the data access layer)
- `src/pdf/InvoicePDF.tsx` — PDF template rendering (three templates: Modern, Classic, Minimal)
- `src/demoData.ts` — Demo data loader and data-clearing utility

**Component structure:**
```
src/components/
├── Sidebar.tsx              Navigation sidebar (always visible)
├── Dashboard.tsx            Home screen with stats and recent matters
├── MatterList.tsx           Scrollable matter list with grouping/search
├── MatterForm.tsx           Create / edit matter (with inline client/firm picker)
├── MatterDetail.tsx         Matter overview: stats, parties, field summary
├── MatterTabs.tsx           Tab bar within matter detail
├── MatterParties.tsx        Manage petitioner / respondent parties
├── TimeEntries.tsx          Billable time log per matter
├── Appearances.tsx          Court appearance log per matter
├── Invoices.tsx             Invoice list and creation form
├── OutstandingDues.tsx      Cross-matter unpaid invoices dashboard
├── RecordPayment.tsx        Two-column payment recording with TDS support
├── ContactList.tsx          Client / AOR-Firm directory with linked matters
├── ContactPersonsPanel.tsx  Named contact persons per client or firm
├── InvoiceDesigner.tsx      Live invoice customisation preview
├── SettingsPage.tsx         Profile, invoice settings, backup, security
├── LockScreen.tsx           PIN lock screen
├── LockSettings.tsx         Configure / remove app lock
├── Onboarding.tsx           First-run profile setup wizard
├── AboutModal.tsx           About dialog with support contact
├── SupportModal.tsx         "Free Forever" pricing + tip screen (inactive)
├── Toast.tsx                Toast notification context and component
├── ErrorBoundary.tsx        React error boundary
└── ScreenshotHelper.tsx     Dev-only demo data seeder (⌘⇧D)
```

### 2. Data Access Layer (`src/db.ts`)

All database operations are in a single file. The `getDb()` function:
1. Connects to `sqlite:memoapp.db` on first call
2. Runs `migrate()` which creates all tables and safely adds any new columns (`addIfMissing`)
3. Returns a cached connection for subsequent calls

**Migration strategy:** Every schema change uses `ALTER TABLE … ADD COLUMN` wrapped in try/catch. This means existing databases are upgraded automatically on first launch of a new version without losing any data.

### 3. Rust Backend (`src-tauri/`)

The Rust layer does three things:
1. **Hosts the WebView** and manages the native window
2. **Provides plugins** (SQLite, file system, dialogs, URL opener)
3. **Exposes one custom command** — `search_contacts` — which runs a JXA (JavaScript for Automation) script via `osascript` to query the macOS Contacts app and return matching contacts as JSON

```rust
// Custom Tauri command in src-tauri/src/lib.rs
#[tauri::command]
async fn search_contacts(query: String) -> Result<Vec<MacContact>, String> {
    // Runs in a thread-pool thread (spawn_blocking)
    // Executes: osascript -l JavaScript -e <jxa_script>
    // Returns: Vec<MacContact> serialised as JSON
}
```

### 4. Database (`memoapp.db`)

**Location:** `~/Library/Application Support/com.memoapp.app/memoapp.db`

SQLite single-file database. See `DATABASE_SCHEMA.md` for full table definitions.

**Backup file location (user-chosen):** anywhere on disk; format is `.json`

---

## Data Flow Examples

### Creating a New Invoice

```
User fills InvoiceForm
  → selects unbilled appearances & time entries
  → chooses addressing option (A–F)
  → clicks "Save as Sent"

InvoiceForm.buildAndSave()
  → db.insertInvoice(inv)           stores invoice row
  → db.markAppearancesBilled([ids]) sets is_billed=1
  → db.markTimeEntriesBilled([ids]) sets is_billed=1
  → state update → list re-renders

User clicks Download PDF
  → db.fetchMatterParties(matterId)
  → db.fetchContactPersons() × 2   resolve contact persons
  → @react-pdf/renderer renders InvoicePDF → Blob
  → tauri-plugin-dialog.save()      native Save dialog
  → tauri-plugin-fs.writeFile()     writes PDF bytes to disk
```

### Importing from macOS Contacts

```
User clicks "From Contacts" button
  → ContactPickerModal opens
  → User types a name
  → invoke("search_contacts", { query })
      → Rust: spawn_blocking(run_search)
          → osascript -l JavaScript -e <JXA script>
              → Contacts app filters by name/org
              → returns JSON array
      → Vec<MacContact> returned to JS
  → Results displayed
  → User clicks a contact
  → Form fields populated (name, email, phone, address)
```

---

## Security Model

| Concern | Approach |
|---|---|
| App lock | SHA-256 hash of PIN stored in `settings` table; no plaintext password ever stored |
| Data at rest | SQLite on user's Mac; protected by macOS file system permissions |
| Data in transit | None — app is fully offline |
| Contacts access | macOS TCC system; user grants/revokes via System Settings → Privacy → Contacts |
| CSP | Disabled (`null`) — acceptable for a local-only WebView with no remote content |

---

## Build & Distribution

```
Development:   npm run tauri dev
Production:    npm run tauri build
Output:        src-tauri/target/release/bundle/dmg/Memo_1.0.0_aarch64.dmg
               src-tauri/target/release/bundle/macos/Memo.app
```

The app is distributed as a **DMG** for direct installation. It is **not code-signed** with an Apple Developer certificate in the current release, so users must right-click → Open on first launch to bypass Gatekeeper.
