# AI Agent Developer Guide — Memo v1.0.0

**Purpose:** This document is written for AI coding agents (Claude, GPT, Copilot) and developers who have never seen this codebase before. Read this before touching any file. It will save you from the most common mistakes and help you understand exactly how this application works.

**Last Updated:** 2026-06-02

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Folder Structure](#3-folder-structure)
4. [Database Structure](#4-database-structure)
5. [Key Business Rules](#5-key-business-rules)
6. [Security Model](#6-security-model)
7. [Authentication Flow](#7-authentication-flow)
8. [RLS Policies](#8-rls-policies)
9. [Component Patterns](#9-component-patterns)
10. [State Management](#10-state-management)
11. [API Patterns](#11-api-patterns)
12. [Migration Strategy](#12-migration-strategy)
13. [Naming Conventions](#13-naming-conventions)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment Process](#15-deployment-process)
16. [Safe To Modify](#16-safe-to-modify)
17. [Modify With Caution](#17-modify-with-caution)
18. [Never Modify Without Review](#18-never-modify-without-review)
19. [Critical Files Reference](#19-critical-files-reference)
20. [Common Mistakes to Avoid](#20-common-mistakes-to-avoid)

---

## 1. Project Overview

**Memo** is a native macOS desktop application for legal billing, built for Indian advocates and law firms.

**What it does:**
- Manages legal matters (cases) from instruction to invoice
- Logs court appearances and billable time against matters
- Generates GST-compliant PDF invoices with six addressing options
- Records payments and reconciles TDS (Tax Deducted at Source) deductions
- Maintains a directory of clients, firms, and named contact persons
- Integrates with macOS Contacts for data import

**What it is NOT:**
- Not a web app — it is a macOS desktop app (Tauri)
- Not connected to any cloud or server — fully offline
- Not multi-user — single user, single device
- Not open for public distribution via App Store — direct DMG distribution

**Tech stack in one line:**
```
Tauri 2 (Rust shell) + React 19 + TypeScript 5.8 + SQLite (local) + Tailwind CSS v4
```

**Where data lives:**
```
~/Library/Application Support/com.memoapp.app/memoapp.db
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     macOS Window                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  WKWebView  —  React 19 SPA (TypeScript + Tailwind) │    │
│  │                                                     │    │
│  │  App.tsx (root)                                     │    │
│  │  ├── Sidebar (always visible)                       │    │
│  │  ├── MatterList (matters section only)              │    │
│  │  └── Main Content Panel (swaps on nav change)       │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │  Tauri IPC (invoke / plugins)        │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  Rust Process (Tauri 2)                             │    │
│  │  • search_contacts command (osascript/JXA)          │    │
│  │  • tauri-plugin-sql (SQLite)                        │    │
│  │  • tauri-plugin-fs (file read/write)                │    │
│  │  • tauri-plugin-dialog (native file picker)         │    │
│  │  • tauri-plugin-opener (open URLs)                  │    │
│  └──────┬──────────────────────────┬────────────────────┘   │
│         │                          │                         │
│  ┌──────▼──────────┐   ┌───────────▼──────────────────┐    │
│  │  SQLite DB      │   │  macOS System                │    │
│  │  memoapp.db     │   │  Contacts · UPI · Mail · FS  │    │
│  └─────────────────┘   └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Key architectural principle:** The React UI communicates with the OS through the Tauri IPC bridge. There is no HTTP, no REST API, no WebSocket. All data access goes through `src/db.ts` which calls the SQLite plugin.

---

## 3. Folder Structure

```
MemoAppTauri/
│
├── src/                           ← ALL frontend code lives here
│   ├── main.tsx                   ← React entry: StrictMode + ErrorBoundary + ToastProvider + App
│   ├── App.tsx                    ← Root layout; all navigation state; startup logic
│   ├── types.ts                   ← Every shared TypeScript interface, type, enum, utility fn
│   ├── db.ts                      ← THE ENTIRE data access layer — all SQL, all CRUD, migrations
│   ├── demoData.ts                ← loadDemoData() and removeAllData() utilities
│   ├── index.css                  ← Global CSS (3 rules — box-sizing, body, color-scheme: light)
│   ├── vite-env.d.ts              ← Vite env type declarations
│   │
│   ├── components/                ← 25 React components
│   │   ├── Sidebar.tsx            ← Left navigation panel
│   │   ├── Dashboard.tsx          ← Home screen (stats + profile card + recent matters)
│   │   │
│   │   ├── MatterList.tsx         ← Matter list panel (search, group-by, ref numbers)
│   │   ├── MatterForm.tsx         ← New/edit matter (sticky title, entity pickers)
│   │   ├── MatterDetail.tsx       ← Matter overview tab (stats, parties, info grid)
│   │   ├── MatterTabs.tsx         ← Tab bar: Overview / Time / Appearances / Invoices
│   │   ├── MatterParties.tsx      ← Party management (petitioner, respondent, etc.)
│   │   │
│   │   ├── Appearances.tsx        ← Court appearances log
│   │   ├── TimeEntries.tsx        ← Billable time entries log
│   │   │
│   │   ├── Invoices.tsx           ← Invoice list, InvoiceForm, InvoiceRow, PaymentForm
│   │   ├── InvoiceDesigner.tsx    ← Live invoice template customisation
│   │   ├── OutstandingDues.tsx    ← Cross-matter unpaid invoice dashboard
│   │   ├── RecordPayment.tsx      ← Two-column payment recording screen
│   │   │
│   │   ├── ContactList.tsx        ← Client/Firm directory (list + detail + form)
│   │   ├── ContactPersonsPanel.tsx ← Named contact persons within a client/firm
│   │   │
│   │   ├── SettingsPage.tsx       ← All settings sections (profile, backup, security, demo)
│   │   ├── LockScreen.tsx         ← PIN entry screen
│   │   ├── LockSettings.tsx       ← Set/change/remove app lock
│   │   ├── Onboarding.tsx         ← First-run profile setup wizard
│   │   │
│   │   ├── AboutModal.tsx         ← About dialog (version, support email, tip button)
│   │   ├── SupportModal.tsx       ← Developer tip screen (UPI payment, INACTIVE)
│   │   ├── Toast.tsx              ← Toast notification context (INSTALLED, UNUSED)
│   │   ├── ErrorBoundary.tsx      ← React error boundary
│   │   └── ScreenshotHelper.tsx   ← Dev-only seed tool (⌘⇧D)
│   │
│   └── pdf/
│       └── InvoicePDF.tsx         ← All 3 PDF templates (Modern, Classic, Minimal)
│
├── src-tauri/                     ← ALL Rust/Tauri backend code lives here
│   ├── src/
│   │   ├── lib.rs                 ← App entry + plugins + search_contacts command
│   │   └── main.rs                ← Binary entry (calls lib::run())
│   ├── Cargo.toml                 ← Rust dependencies
│   ├── tauri.conf.json            ← App name, version, identifier, window config, bundle
│   ├── capabilities/
│   │   └── default.json           ← IPC permission grants (MUST update for new plugin calls)
│   └── Info.plist                 ← macOS privacy usage descriptions
│
├── docs/                          ← All documentation
├── app-icon.svg                   ← Source icon (regenerate icons: npm run tauri icon app-icon.svg)
├── package.json                   ← npm dependencies
├── vite.config.ts                 ← Vite config (uses @tailwindcss/vite plugin)
└── .gitignore                     ← Node type (excludes node_modules/ and src-tauri/target/)
```

---

## 4. Database Structure

### Connection Pattern

The database is SQLite, accessed via `tauri-plugin-sql`. There is one shared connection managed by `src/db.ts`:

```typescript
let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:memoapp.db");
  await migrate(_db);   // ← runs on EVERY first call per session
  return _db;
}
```

**Rule:** Never call `getDb()` directly from a component. Always call the exported CRUD functions.

### All 11 Tables

```
matters            — Legal cases (primary entity)
clients            — Reusable client directory
firms              — Reusable AOR/firm directory
contact_persons    — Named individuals within clients or firms
invoices           — GST invoices (FK → matters CASCADE)
payments           — Payment receipts (FK → invoices CASCADE)
advance_payments   — Retainer payments (FK → matters CASCADE)
appearances        — Court appearances (FK → matters CASCADE)
time_entries       — Billable time (FK → matters CASCADE)
matter_parties     — Parties represented (FK → matters CASCADE)
settings           — Key-value config store (profile, lock)
```

### Key Design Decisions You Must Know

**1. `matters` is denormalised**

```typescript
// matters.client_name is a TEXT string — NOT a foreign key to clients.id
// matters.firm_name is a TEXT string — NOT a foreign key to firms.id
```

This means: deleting a client does NOT affect matters. Renaming a client does NOT update existing matters. Matching is done by exact name comparison (`LOWER(client_name) = LOWER(?)`).

**2. `contact_persons` uses a composite logical FK**

```sql
entity_type TEXT NOT NULL  -- 'client' or 'firm'
entity_id   TEXT NOT NULL  -- the id of the parent client or firm
```

No FOREIGN KEY constraint in SQLite. Application logic enforces the relationship.

**3. `settings` is a key-value store**

```sql
key   TEXT PRIMARY KEY
value TEXT NOT NULL  -- always JSON-serialised
```

Known keys: `'profile'` (Profile JSON), `'app_lock'` (AppLock JSON with `username` + `passwordHash`).

**4. `invoices` has two addressing fields**

```sql
recipient_type  TEXT  -- legacy: 'firm' | 'client' | 'both'
address_mode    TEXT  -- new: 'org_firm' | 'org_client' | ... | 'contact_both'
```

Both are always written. Old invoices have `address_mode = NULL`; PDF rendering falls back to `recipient_type` in that case.

**5. Cascade deletes**

Deleting a matter CASCADE-deletes: `invoices`, `payments` (via invoices), `appearances`, `time_entries`, `advance_payments`, `matter_parties`.  
Deleting an invoice CASCADE-deletes: `payments`.  
Deleting a client/firm does NOT cascade to anything.

---

## 5. Key Business Rules

These are non-obvious rules embedded in the code. Get these wrong and you break core functionality.

### GST Calculation
```typescript
// src/components/Invoices.tsx → calcGST()
if (firm_state === client_state) {  // INTRA-state
  cgst = subtotal × (rate / 2 / 100);
  sgst = subtotal × (rate / 2 / 100);
  igst = 0;
} else {                            // INTER-state
  cgst = 0;
  sgst = 0;
  igst = subtotal × (rate / 100);
}
total = subtotal + cgst + sgst + igst;
```

Supplier state = advocate's profile state. Recipient state = matter's `firm_state` or `client_state` depending on `address_mode`.

### Invoice Settlement (TDS-aware)
```typescript
total_settled = SUM(payments.amount_paid) + SUM(payments.tds_amount)
isPaid = total_settled >= invoice.total_amount
```

An invoice where the client paid ₹90,000 and deducted ₹10,000 TDS against a ₹1,00,000 invoice is FULLY PAID. This is the fundamental Indian TDS reconciliation logic. Do not change this formula.

### Billed Work Items
```typescript
// When invoice status changes to "sent", work items are marked billed:
markAppearancesBilled(ids[])  // sets is_billed = 1
markTimeEntriesBilled(ids[])  // sets is_billed = 1
```

There is NO unmark-as-billed. Once billed, an appearance or time entry cannot be invoiced again. This is intentional — invoices are accounting records.

### Matter Reference Numbers
```typescript
// insertMatter() assigns the next sequential number:
const [{ max }] = await db.select("SELECT COALESCE(MAX(ref_number), 0) AS max FROM matters");
const ref_number = max + 1;
// THEN: return { ...m, ref_number };
```

`insertMatter` is the ONLY insert function that returns a value (not void). Callers must use the returned object. The `ref_number` never changes after assignment.

### Invoice Overdue — Manual Only
There is **no automatic `status → 'overdue'` transition**. The `OutstandingDues.tsx` screen computes `daysOverdue` dynamically from `due_date` but never writes it back to the database. Users must manually change status to `overdue` via the dropdown.

### App Lock — Username + Password
Despite documentation calling it "PIN-based", the implementation uses **username + password**:
```typescript
// db.ts
setLock(username: string, password: string)
verifyLock(username: string, password: string)
```
```typescript
// AppLock interface
interface AppLock {
  username: string;
  passwordHash: string;  // SHA-256 of password
}
```
Both username AND password must match. The `LockSettings.tsx` UI shows a username field.

### Backup Restore — Not Transactional
```typescript
// importAllData() does this — NO TRANSACTION:
for (table of deletionOrder) { await db.execute(`DELETE FROM ${table}`); }
for (table of BACKUP_TABLES) { /* INSERT each row */ }
```

If a row insert fails midway, the database is in a partial state. This is a known technical debt item.

---

## 6. Security Model

**Threat model:** Protection against unauthorised physical access to the Mac. Not designed for remote attacks.

| Aspect | Implementation |
|---|---|
| At-rest encryption | None — SQLite file is unencrypted |
| In-transit encryption | Not applicable — fully offline |
| Authentication | SHA-256 hashed password stored in `settings` table |
| Authorization | None — single-user, all-or-nothing access |
| IPC permissions | Explicitly granted in `capabilities/default.json` |
| Content Security Policy | Disabled (`"csp": null`) — acceptable for local-only WebView |

**The database is readable by any process with macOS user account access.** It contains bank account numbers, GSTIN, PAN, client data. This is the primary security risk.

**macOS TCC permissions required:**
- Contacts: requested on first `search_contacts` call
- File system: granted via entitlements (no prompt)
- Network: not requested at all

---

## 7. Authentication Flow

```
App launches
    │
    ├── getDb() → migrate() → database ready
    │
    ├── Promise.all([isProfileSetup(), loadProfile(), getLock()])
    │       │
    │       ├── profileReady = false → render Onboarding (full-screen overlay z-50)
    │       │                          User fills profile → saveProfile() → setProfileReady(true)
    │       │
    │       ├── lock !== null && !unlocked → render LockScreen (replaces entire app)
    │       │                                 User enters username + password
    │       │                                 verifyLock(username, password) → SHA-256 compare
    │       │                                 Correct → setUnlocked(true) → app renders
    │       │
    │       └── Normal app renders
    │
    └── User clicks 🔒 in sidebar → setUnlocked(false) → LockScreen shown again
```

**Session:** `unlocked` is in-memory React state. It resets on every app restart. There is no persistent session token.

**No brute-force protection.** There is no lockout after N failed attempts.

---

## 8. RLS Policies

**There are no Row-Level Security policies.** This is SQLite, not PostgreSQL. There is no database-level access control. All data is accessible to the app process, which means all data is accessible to the authenticated user. The only access control is the app-level lock screen described above.

---

## 9. Component Patterns

### Pattern 1 — Data-fetching Component

```typescript
export default function MyComponent({ matter }: { matter: Matter }) {
  const [data, setData] = useState<SomeType[]>([]);

  useEffect(() => {
    fetchSomething(matter.id).then(setData);
  }, [matter.id]);  // ← re-fetch when matter changes

  // render ...
}
```

### Pattern 2 — Form Component with DB Save

```typescript
function MyForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState({ name: initial?.name ?? "", ... });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm(f => ({ ...f, [k]: v }));  // ← ALWAYS functional update

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await insertOrUpdate(form);
      onSave(form);
    } catch (err) {
      // show error
    } finally {
      setSaving(false);
    }
  };
}
```

### Pattern 3 — Refresh Counter

When a child component mutates data and the parent needs to re-fetch its list:

```typescript
// Parent:
const [refresh, setRefresh] = useState(0);
<ChildList refresh={refresh} />
<ChildForm onSave={() => setRefresh(r => r + 1)} />

// Child list:
useEffect(() => { fetchItems().then(setItems); }, [refresh]);
```

### Pattern 4 — Confirmation Delete

```typescript
const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

{confirmDelete === item.id ? (
  <>
    <button onClick={() => handleDelete(item.id)}>Confirm</button>
    <button onClick={() => setConfirmDelete(null)}>Cancel</button>
  </>
) : (
  <button onClick={() => setConfirmDelete(item.id)}>Delete</button>
)}
```

### Pattern 5 — Inline Modal

Modals are rendered inline (not via a portal) with a fixed overlay div:

```typescript
{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
    <div className="bg-white rounded-2xl ...">
      {/* modal content */}
    </div>
  </div>
)}
```

### Pattern 6 — Navigation Trigger

```typescript
// To navigate to any section:
setNav("settings");   // from App.tsx; passed down as prop/callback

// NOT: <Link to="/settings"> or useNavigate() — there is no router
```

---

## 10. State Management

**No global state library.** Pure React `useState` + `useEffect` only.

### App.tsx — Root State (the source of truth for everything top-level)

```typescript
const [nav, setNav]                   = useState<NavSection>("matters");
const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
const [matterTab, setMatterTab]       = useState<MatterTab>("overview");
const [editing, setEditing]           = useState(false);
const [isNew, setIsNew]               = useState(false);
const [refreshList, setRefreshList]   = useState(0);    // ← increment to re-fetch matter list
const [profileReady, setProfileReady] = useState<boolean | null>(null);
const [profile, setProfile]           = useState<Profile | null>(null);
const [showAbout, setShowAbout]       = useState(false);
const [lock, setLock]                 = useState<AppLock | null | "loading">("loading");
const [unlocked, setUnlocked]         = useState(false);
```

**Startup sequence in `useEffect`:**
```typescript
Promise.all([isProfileSetup(), loadProfile(), getLock()])
  .then(([ready, prof, lk]) => {
    setProfileReady(ready);
    if (prof) setProfile(prof);
    setLock(lk);
    if (!lk) setUnlocked(true);  // no lock = immediately unlocked
  });
```

### Component-level State

Every component manages its own data. Components do not share state with siblings — they communicate only through props and callbacks passed from the parent.

### Communication Pattern: Props Down, Callbacks Up

```
App.tsx
  ↓ matter, profile props
MatterDetail.tsx
  ↑ onEdit(), onDelete() callbacks
  ↓ matter prop
MatterParties.tsx
```

---

## 11. API Patterns

### Calling a Tauri Plugin (file system, dialogs, etc.)

```typescript
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const filePath = await save({
  defaultPath: "invoice.pdf",
  filters: [{ name: "PDF", extensions: ["pdf"] }],
});
if (filePath) {
  await writeFile(filePath, uint8Array);
}
```

**Critical:** Every plugin operation needs an explicit entry in `src-tauri/capabilities/default.json`. If it's missing, the call fails silently or throws a permission error. Always check this file when adding new plugin calls.

### Calling the Custom Rust Command

```typescript
import { invoke } from "@tauri-apps/api/core";

const contacts = await invoke<MacContact[]>("search_contacts", { query: "Rajesh" });
```

The command is defined in `src-tauri/src/lib.rs` and registered in `generate_handler![]`.

### Database Queries

```typescript
// SELECT → returns array
const rows = await db.select<SomeType[]>("SELECT * FROM table WHERE id = ?", [id]);
const item = rows[0] ?? null;  // single row pattern

// INSERT / UPDATE / DELETE → returns void
await db.execute("INSERT INTO table (...) VALUES (?)", [value]);
```

**All queries are parameterised with `?`.** Never string-interpolate values into SQL.

### Opening URLs

```typescript
import { openUrl } from "@tauri-apps/plugin-opener";  // note: openUrl, not open

await openUrl("mailto:support@example.com");
await openUrl("upi://pay?pa=ssmendon@icici&am=99");
```

---

## 12. Migration Strategy

### The `addIfMissing` Pattern (the ONLY way to change schema)

```typescript
// src/db.ts → inside migrate(db: Database)
const addIfMissing = async (table: string, column: string, type: string) => {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch {
    /* already exists — silently skip */
  }
};

// Usage:
await addIfMissing("matters", "primary_client_contact_id", "TEXT");
await addIfMissing("payments", "tds_amount", "REAL DEFAULT 0");
```

### Rules

| Rule | Reason |
|---|---|
| ✅ Add new columns via `addIfMissing` | Safe for existing databases |
| ✅ Add new tables via `CREATE TABLE IF NOT EXISTS` | Safe for existing databases |
| ✅ Add backfill logic after `addIfMissing` | For columns that need values from existing data |
| ❌ Never DROP a column | Would break existing databases on update |
| ❌ Never RENAME a column | Would break existing databases on update |
| ❌ Never change a column's type | Would break existing databases on update |
| ❌ Never change the order of existing `addIfMissing` calls | Only append new ones at the end |

### When Adding a New Column — Full Checklist

```typescript
// 1. Add to migrate() in db.ts:
await addIfMissing("matters", "new_field", "TEXT");

// 2. Add to the TypeScript interface in types.ts:
interface Matter {
  // ... existing fields ...
  new_field?: string;  // optional
}

// 3. Add to INSERT SQL for that table:
`INSERT INTO matters (..., new_field) VALUES (..., ?)`
// params: [..., m.new_field ?? null]

// 4. Add to UPDATE SQL for that table (if editable):
`UPDATE matters SET ..., new_field=? WHERE id=?`
// params: [..., m.new_field ?? null, m.id]

// 5. Update DATABASE_DOCUMENTATION.md
// 6. Update CHANGELOG.md
```

### Settings Key Naming

The `settings` table uses two different key naming conventions — a **known inconsistency**:

```typescript
'profile'    // used by loadProfile() / saveProfile() — direct key
'app_lock'   // used by getLock() / setLock() — via getSetting()/setSetting() helper
```

If adding new settings keys, use the `getSetting`/`setSetting` helper pattern for consistency with the lock implementation.

---

## 13. Naming Conventions

### Files

| Type | Convention | Example |
|---|---|---|
| React component | PascalCase.tsx | `MatterDetail.tsx` |
| Utility / data | camelCase.ts | `db.ts`, `demoData.ts` |
| Types | camelCase.ts | `types.ts` |
| Tests (future) | `ComponentName.test.tsx` | `Invoices.test.tsx` |

### TypeScript

| Item | Convention | Example |
|---|---|---|
| Interface | PascalCase | `interface Matter { ... }` |
| Type alias | PascalCase | `type MatterStatus = ...` |
| Enum-like const array | ALL_CAPS | `TDS_SECTIONS`, `DEFAULT_PROFILE` |
| Utility function | camelCase | `fmtRef()`, `formatParty()` |
| Component | PascalCase, default export | `export default function MatterForm` |
| Hook | `use` prefix | `useToast()` |
| DB functions | verb + noun | `fetchMatters()`, `insertMatter()`, `updateMatter()`, `deleteMatter()` |

### Database

| Item | Convention | Example |
|---|---|---|
| Table name | snake_case, plural | `matters`, `time_entries` |
| Column name | snake_case | `case_title`, `created_at` |
| ID columns | `id` (PK), `{table_singular}_id` (FK) | `matter_id`, `invoice_id` |
| Boolean columns | `is_` prefix | `is_billed`, `is_billable` |
| Timestamp columns | `created_at`, `updated_at` | ISO 8601 text |

### CSS / Tailwind

```typescript
// Primary action buttons — ALWAYS neutral-900 (black), NEVER blue
"bg-neutral-900 text-white hover:bg-neutral-800"

// Selected/active state
"bg-neutral-100 border-l-2 border-l-neutral-900"

// Input focus
"focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200"

// Danger actions
"bg-red-600 text-white hover:bg-red-700"

// Status colours (preserved, not replaced with neutral):
// Green = active/paid, Amber = warning/overdue, Red = error/danger
```

---

## 14. Testing Strategy

### Current State

**There are zero automated tests in this codebase.** All testing is manual.

### Before Every Code Change

```bash
npx tsc --noEmit    # TypeScript must pass with zero errors
npm run tauri dev   # App must launch without errors
```

### Recommended Test Infrastructure

```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom
```

### Priority Order for Tests to Add

**Priority 1 — Business Logic (highest ROI)**

```typescript
// tests/businessLogic.test.ts
describe("calcGST", () => {
  it("same state → splits into CGST + SGST", () => {
    const { cgst, sgst, igst } = calcGST(100000, 18, "Maharashtra", "Maharashtra");
    expect(cgst).toBe(9000);
    expect(sgst).toBe(9000);
    expect(igst).toBe(0);
  });
  it("different state → full IGST", () => {
    const { cgst, sgst, igst } = calcGST(100000, 18, "Maharashtra", "Delhi");
    expect(igst).toBe(18000);
    expect(cgst).toBe(0);
  });
});

describe("TDS settlement", () => {
  it("cash + TDS = total → isPaid", () => {
    const totalSettled = 90000 + 10000;  // amount_paid + tds_amount
    expect(totalSettled >= 100000).toBe(true);
  });
});

describe("fmtRef", () => {
  it("pads to 3 digits", () => expect(fmtRef(7)).toBe("#007"));
  it("handles 4+ digits", () => expect(fmtRef(1234)).toBe("#1234"));
  it("handles null", () => expect(fmtRef(null)).toBe("—"));
});
```

**Priority 2 — Form Validation**

```typescript
// tests/MatterForm.test.tsx
it("Save disabled when case_title empty", async () => {
  render(<MatterForm onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText("Save Matter")).toBeDisabled();
});
it("Save enabled when required fields filled", async () => {
  // fill case_title and client_name
  expect(screen.getByText("Save Matter")).toBeEnabled();
});
```

**Priority 3 — Database Migrations**

```typescript
// tests/db.test.ts — use in-memory SQLite
it("insertMatter assigns sequential ref_number", async () => {
  const m1 = await insertMatter({ ...blankMatter });
  const m2 = await insertMatter({ ...blankMatter });
  expect(m1.ref_number).toBe(1);
  expect(m2.ref_number).toBe(2);
});
```

### Manual Test Checklist (run before any release)

- [ ] Launch on a Mac with an existing database (migration test)
- [ ] Launch on a fresh Mac / empty database (onboarding test)
- [ ] Create a matter, log appearances and time, generate invoice, record payment
- [ ] Test TDS: invoice ₹1,00,000, receive ₹90,000 + TDS ₹10,000 → shows green "Fully settled"
- [ ] Export backup → clear all data → import backup → verify data restored
- [ ] Test Contacts import (real macOS Contacts)
- [ ] Download PDF for each template (Modern, Classic, Minimal)
- [ ] Test all six invoice addressing options
- [ ] Test app lock: set → lock → unlock → remove
- [ ] TypeScript check: `npx tsc --noEmit` → zero errors

---

## 15. Deployment Process

### Step 1 — Pre-build checks

```bash
cd "/Volumes/Mac 1TB/Claude Code/Mac App/LegalBillTauri"
npx tsc --noEmit                          # must output nothing
```

### Step 2 — Version bump (if releasing)

Edit these three files:
```
src-tauri/tauri.conf.json         → "version": "1.x.x"
src/components/AboutModal.tsx     → "Version 1.x.x" text
src/components/SupportModal.tsx   → const APP_VERSION = "1.x.x"
```

### Step 3 — Build

```bash
npm run tauri build
```

Output:
```
src-tauri/target/release/bundle/dmg/Memo_1.x.x_aarch64.dmg   ← distribute this
src-tauri/target/release/bundle/macos/Memo.app
```

Build time: 3–8 min (first build); 1–3 min (incremental).

### Step 4 — Test the built app

- Open the DMG, drag to Applications
- Right-click → Open (Gatekeeper bypass, not code-signed)
- Test with existing database and fresh install

### Step 5 — Update docs and commit

```bash
git add .
git commit -m "Memo v1.x.x — description"
git push origin main
```

### Development mode

```bash
npm run tauri dev        # hot reload; Rust changes require restart
```

---

## 16. Safe To Modify

These areas have low risk of breaking other things:

| What | File(s) | Notes |
|---|---|---|
| UI text and labels | Any `.tsx` | String literals only |
| Tailwind CSS classes | Any `.tsx` | Visual only; test all states |
| About modal content | `AboutModal.tsx` | No data dependencies |
| Demo data content | `demoData.ts` | Only affects test data |
| Documentation | `docs/` | No code impact |
| New read-only DB query | `db.ts` | Add a new `fetch*` function; no schema change |
| New top-level nav section | `Sidebar.tsx`, `App.tsx`, new component | Add to `NavSection` type, `items[]` array, `renderContent()` |
| New standalone component | New file in `components/` | Import where needed |
| Error messages | Any component | Text only |
| Sidebar order/labels | `Sidebar.tsx` | Visual only |
| App icon | `app-icon.svg` → `npm run tauri icon app-icon.svg` | Regenerates all sizes |
| Support email address | `AboutModal.tsx` | String literal |
| Developer UPI VPA | `SupportModal.tsx:18` | String constant `DEVELOPER_UPI` |

---

## 17. Modify With Caution

These require careful testing. Follow the checklists.

| What | File(s) | Risk | Caution |
|---|---|---|---|
| Adding a new DB column | `db.ts`, `types.ts` | Medium | Use `addIfMissing`; update INSERT + UPDATE SQL; update TypeScript interface |
| Adding a new Tauri plugin call | `src-tauri/Cargo.toml`, `lib.rs`, `capabilities/default.json`, component | Medium | Check actual export names; add capability entry |
| `InvoicePDF.tsx` styles | `InvoicePDF.tsx` | Medium | PDF CSS ≠ web CSS; only built-in fonts; no ₹ glyph; test all 3 templates |
| Invoice addressing options | `types.ts`, `Invoices.tsx`, `InvoicePDF.tsx` | Medium | Must update type, UI grid, PDF render logic, and backward-compat check |
| GST calculation logic | `Invoices.tsx → calcGST()` | High | Affects all invoice amounts; test intra-state and inter-state cases |
| TDS reconciliation logic | `RecordPayment.tsx`, `Invoices.tsx`, `OutstandingDues.tsx` | High | Core billing correctness; test edge cases (partial payment + TDS) |
| Settings page sections | `SettingsPage.tsx` | Low-Medium | 785 lines; scroll deeply; many state variables |
| `demoData.ts` | `demoData.ts` | Low | `removeAllData()` deletes production data if called; confirm before editing |
| Backup / restore | `db.ts → importAllData()` | High | No transaction; partial state possible on failure; test with real backups |

---

## 18. Never Modify Without Review

These files/patterns are critical. Wrong changes here break the entire application or corrupt user data.

| What | File(s) | Why Never Touch Blindly |
|---|---|---|
| **`data-tauri-drag-region` attribute** | `App.tsx:189` | The drag bar MUST use this attribute. Using `startDragging()` API instead makes ALL inputs non-functional throughout the entire app (keyboard focus lost at OS level). This was a real production bug. |
| **`color-scheme: light` in index.css** | `src/index.css:5` | Removing this makes input text invisible when macOS is in Dark Mode (white text on white background). This was a real production bug that made the app unusable. |
| **`addIfMissing` in migrate()** | `src/db.ts → migrate()` | Never drop, rename, or reorder. Only append new calls. Existing user databases will be corrupted/broken otherwise. |
| **`insertMatter` return type** | `src/db.ts:236` | This is the ONLY insert function that returns `Promise<Matter>` instead of `Promise<void>`. It returns the matter with `ref_number` assigned. Every caller depends on this. Change the return type and you break `MatterForm.tsx` and any new callers. |
| **`importAllData` deletion order** | `src/db.ts:909` | Reverse-dependency order is critical for FK CASCADE. Wrong order causes SQLite constraint errors. |
| **`BACKUP_TABLES` array** | `src/db.ts:768` | Every new table MUST be added here or it won't be backed up. |
| **Tauri capabilities** | `capabilities/default.json` | Removing a permission silently breaks existing functionality. Only add; never remove without verifying nothing uses it. |
| **`generate_handler![]` in lib.rs** | `src-tauri/src/lib.rs:last lines` | Every custom Rust command must be registered here. Missing = 404 on invoke. |
| **TDS settlement formula** | `RecordPayment.tsx`, `Invoices.tsx` | `totalSettled = SUM(amount_paid) + SUM(tds_amount)`. This is a specific Indian tax accounting rule. Do not change it. |
| **`settings` key names** | `db.ts: 'profile'`, `'app_lock'` | These exact strings are used to look up profile and lock data. Change them and every existing user loses their profile and lock settings on next app launch. |
| **`src/index.css`** | `src/index.css` | Only 17 lines; every line matters. The `overflow: hidden` on body is intentional (prevents scroll-bounce). |

---

## 19. Critical Files Reference

| File | Lines | Purpose | Change Frequency |
|---|---|---|---|
| `src/db.ts` | 938 | **Entire data access layer.** Schema, migrations, all CRUD, backup. The single most important file. | Every feature that touches data |
| `src/types.ts` | 271 | **All shared TypeScript types.** Every interface used across the app. Changing anything here has cascading effects. | Every feature that adds/changes data |
| `src/App.tsx` | 239 | **Root layout and navigation.** All top-level state. Startup sequence. Render logic. | Adding new nav sections |
| `src-tauri/src/lib.rs` | ~150 | **All Rust logic.** Plugin registration. `search_contacts` command. Every new command goes here. | Adding new system capabilities |
| `src-tauri/tauri.conf.json` | ~40 | **App identity.** Name, version, bundle ID, window size, titleBarStyle. | Releases only |
| `src-tauri/capabilities/default.json` | ~22 | **IPC permission grants.** Every plugin call needs an entry. Silent failures without it. | Adding new plugin operations |
| `src/pdf/InvoicePDF.tsx` | 836 | **All three PDF templates.** Strict PDF CSS rules apply. Font limitations. Backward-compat addressing logic. | Invoice feature changes |
| `src/components/Invoices.tsx` | 858 | **Invoice creation, display, payment forms.** `calcGST()`, `buildAndSave()`, `InvoiceForm`, `InvoiceRow`. | Invoice/payment feature changes |
| `src/components/RecordPayment.tsx` | 815 | **Two-column payment screen.** TDS logic. `ReconciliationBanner`. | Payment feature changes |
| `src/components/ContactList.tsx` | 707 | **Client/Firm directory.** `ContactPickerModal`. `matchState`. `LinkedMattersPanel`. Contains duplicated `MacContact` interface. | Contact/entity changes |
| `src/components/MatterForm.tsx` | 673 | **New/edit matter form.** Sticky header. `EntityPicker`. Inline save-to-DB. Primary contact dropdowns. | Matter feature changes |
| `src/demoData.ts` | 255 | **`loadDemoData()` and `removeAllData()`.** Clears ALL production data. Handle with care. | Demo/data management features |
| `src-tauri/Info.plist` | 8 | macOS privacy strings. Add new keys here when requesting new permissions. | Adding new macOS permissions |

---

## 20. Common Mistakes to Avoid

These are mistakes that have caused real bugs or would cause them. Read every one.

---

### ❌ Mistake 1: Using `startDragging()` API for the title bar

```typescript
// WRONG — causes entire app to lose keyboard focus:
onMouseDown={(e) => { if (e.button === 0) getCurrentWindow().startDragging(); }}

// CORRECT — use the HTML attribute:
<div data-tauri-drag-region className="h-9 w-full shrink-0 select-none" />
```

**Why:** `startDragging()` tells macOS the window drag started. On macOS with `titleBarStyle: "Overlay"`, this causes `WKWebView` to cede OS-level keyboard focus. Every input field in the entire app becomes unresponsive to typing — the app appears to work visually but keyboard events don't reach React. This was a real production bug.

---

### ❌ Mistake 2: Removing `color-scheme: light` from index.css

```css
/* CORRECT — keep this exactly as-is */
:root {
  color-scheme: light;
}
```

**Why:** Without this, macOS Dark Mode causes `WKWebView` to inherit near-white as the default text color. All inputs have explicit `bg-white` but no explicit text color — resulting in white text on white background. Users cannot see what they're typing. This was a real production bug.

---

### ❌ Mistake 3: Not using the returned value from `insertMatter`

```typescript
// WRONG — misses the auto-assigned ref_number:
await insertMatter(matter);
onSave(matter);  // matter.ref_number is undefined

// CORRECT:
const saved = await insertMatter(matter);
onSave(saved);  // saved.ref_number is populated
```

**Why:** `insertMatter` is the only insert function that returns `Promise<Matter>` instead of `Promise<void>`. The returned object has `ref_number` filled in. All other insert functions return `void`.

---

### ❌ Mistake 4: Changing schema without `addIfMissing`

```typescript
// WRONG — breaks existing user databases on update:
CREATE TABLE IF NOT EXISTS matters (
  id TEXT PRIMARY KEY,
  new_column TEXT  // ← adding directly to CREATE TABLE
);

// CORRECT — add AFTER the existing CREATE TABLE:
await addIfMissing("matters", "new_column", "TEXT");
```

**Why:** The `CREATE TABLE IF NOT EXISTS` statement does nothing for users who already have the table. Only `ALTER TABLE ADD COLUMN` (via `addIfMissing`) will add the column to existing databases.

---

### ❌ Mistake 5: Wrong plugin export name

```typescript
// WRONG — 'open' is not exported:
import { open as openUrl } from "@tauri-apps/plugin-opener";

// CORRECT — the actual export name is 'openUrl':
import { openUrl } from "@tauri-apps/plugin-opener";
```

**Why:** Plugin export names don't always match what you'd expect. Always verify:
```bash
node -e "const m = require('./node_modules/@tauri-apps/plugin-opener'); console.log(Object.keys(m))"
```

---

### ❌ Mistake 6: Forgetting to add a capability permission

```typescript
// You added this plugin call in TypeScript:
import { readDir } from "@tauri-apps/plugin-fs";
const entries = await readDir("/some/path");

// But forgot to add to capabilities/default.json:
// "fs:allow-list-directory"  ← MISSING

// Result: call fails silently or throws a cryptic IPC error
```

**Rule:** Every `@tauri-apps/plugin-*` call needs a matching permission in `capabilities/default.json`. Check what permissions exist before writing plugin calls.

---

### ❌ Mistake 7: Blocking the Rust async executor

```rust
// WRONG — blocks Tokio; prevents other async tasks from running:
#[tauri::command]
async fn bad_command() -> Result<String, String> {
    let output = std::process::Command::new("osascript")
        .output()           // ← blocking call in async fn
        .unwrap();
    Ok(String::from_utf8(output.stdout).unwrap())
}

// CORRECT — move blocking work to thread pool:
#[tauri::command]
async fn good_command() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        std::process::Command::new("osascript").output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map(|o| String::from_utf8(o.stdout).unwrap())
    .map_err(|e| e.to_string())
}
```

---

### ❌ Mistake 8: Using wrong font names in PDF templates

```typescript
// WRONG — system fonts not available in @react-pdf/renderer:
{ fontFamily: "-apple-system" }
{ fontFamily: "SF Pro Display" }
{ fontFamily: "sans-serif" }

// CORRECT — only these built-in families work:
{ fontFamily: "Helvetica" }          // or "Helvetica-Bold", "Helvetica-Oblique"
{ fontFamily: "Times-Roman" }        // or "Times-Bold", "Times-Italic"
{ fontFamily: "Courier" }
```

Also: **never use the ₹ symbol in PDF text**. Built-in PDF fonts don't include it. Use `"Rs."` instead (already done throughout `InvoicePDF.tsx`).

---

### ❌ Mistake 9: Using mutable state pattern instead of functional update

```typescript
// WRONG — stale closure; may miss intermediate updates:
setForm({ ...form, name: "new name" });

// CORRECT — functional update; always uses latest state:
setForm(f => ({ ...f, name: "new name" }));
```

---

### ❌ Mistake 10: Treating `clients`/`firms` as having FK to `matters`

```typescript
// WRONG assumption:
// "If I delete a client, their matters are deleted too."

// REALITY:
// matters.client_name is a FREE TEXT STRING, not a foreign key.
// Deleting a client has ZERO effect on matters.
// The client name is duplicated (denormalised) in the matter row.

// CORRECT way to find matters for a client:
const matters = await fetchMattersByClientName(client.name);  // case-insensitive match
```

---

### ❌ Mistake 11: Expecting `useToast()` to show notifications

```typescript
// WRONG assumption:
import { useToast } from "./Toast";
const { showToast } = useToast();
showToast("Saved!");  // ← will compile but showToast doesn't exist on the hook

// REALITY:
// Toast.tsx exports useToast() but the hook doesn't have showToast.
// More importantly: no component in the entire app calls useToast().
// All user feedback is via inline state (saving/saved booleans, error divs).
```

If you want toast notifications: implement the `showToast` function in `Toast.tsx` and then wire it up. The context provider is already in place.

---

### ❌ Mistake 12: Adding a new table without updating `BACKUP_TABLES`

```typescript
// You added a new table:
await db.execute(`CREATE TABLE IF NOT EXISTS my_new_table (...)`);

// WRONG — forgot to add to backup:
const BACKUP_TABLES = [
  "settings", "clients", "firms", "matters", /* ... */
  // my_new_table is NOT here — won't be backed up!
];

// CORRECT:
const BACKUP_TABLES = [
  "settings", "clients", "firms", "matters", /* ... */
  "my_new_table",  // ← add here
] as const;
```

---

### ❌ Mistake 13: Modifying the restoration deletion order in `importAllData`

```typescript
// The deletion order in importAllData() is intentional:
const deletionOrder = [
  "advance_payments",  // ← no FK dependencies
  "payments",          // ← FK to invoices
  "invoices",          // ← FK to matters (CASCADE would handle but being explicit)
  "time_entries",      // ← FK to matters
  "appearances",       // ← FK to matters
  "matter_parties",    // ← FK to matters
  "matters",           // ← MUST come after all child tables
  "firms",
  "clients",
  "settings",          // ← last (profile needed for app to function)
];
```

Children before parents. Changing this order causes SQLite FK constraint errors during restore.

---

### ❌ Mistake 14: String-interpolating SQL values

```typescript
// WRONG — SQL injection risk (even in a local app, it's bad practice):
await db.execute(`SELECT * FROM matters WHERE client_name = '${name}'`);

// CORRECT — parameterised queries:
await db.execute("SELECT * FROM matters WHERE client_name = ?", [name]);
```

---

### ❌ Mistake 15: Adding navigation without updating `showMatterList`

```typescript
// In App.tsx there is this check:
const showMatterList = !["dashboard", "outstanding", "record_payment",
                          "clients", "firms", "settings"].includes(nav);
```

If you add a new `NavSection` that should be a full-screen view (no matter list panel), **add it to this array** or the matter list panel will unexpectedly appear alongside your new screen.

---

*End of AI Agent Guide — Read before writing a single line.*
