# Memo App — AI Agent Guide

> For Claude Code and other AI agents working on this codebase.  
> Last updated: 2026-06-03

---

## What this app is

**Memo** is a macOS desktop app for Indian advocates (lawyers) to manage matters, log work, and generate GST-compliant invoices.

Stack: **Tauri 2 + React 19 + TypeScript 5.8 + SQLite** (via `tauri-plugin-sql`).

The frontend is a React SPA rendered in WKWebView. The Rust backend exposes Tauri commands (IPC). All business logic and data access live in the frontend — `src/db.ts` is the DB layer.

---

## Critical constraints

### SQLite migrations
- The app uses a single `migrate()` function called on DB open (`getDb()`).
- **Cannot** `DROP COLUMN` or `RENAME COLUMN` on existing tables without full table rebuild.
- New columns → `addIfMissing(table, column, type)` pattern — idempotent, swallows errors.
- New tables → `CREATE TABLE IF NOT EXISTS`.
- Unique indexes → `CREATE UNIQUE INDEX IF NOT EXISTS`.
- **Always** remediate existing duplicates before creating a unique index.

### Navigation
- Navigation is pure `useState` — no React Router. `NavSection` type in `types.ts` is the union of all valid nav keys.
- Adding a new top-level screen requires: (1) add to `NavSection` type, (2) add to `Sidebar.tsx` items array, (3) add render branch in `App.tsx renderContent()`, (4) add to `showMatterList` exclusion list.

### Timezone safety
- **Never** use `new Date().toISOString().slice(0,10)` for local date — it converts to UTC and breaks for IST (+5:30) users around midnight.
- Use `localDateString()` from `src/lib/invoiceUtils.ts` instead.

### INR formatting
- **Never** write inline currency formatting. Always import from `src/lib/currency.ts`:
  - `formatINR(n)` — ₹1,23,456 (0 decimals, sidebar/list display)
  - `formatCurrency(n)` — ₹1,23,456.00 (2 decimals, invoice totals)
  - `formatPDF(n)` — same as formatCurrency, for PDF renderer

### Invoice status
- **Never** write to `status = 'overdue'` in the DB.
- `effectiveStatus()` in `src/lib/invoiceUtils.ts` computes the correct status at read time.
- `fetchInvoices()` and `fetchAllUnpaidInvoices()` automatically apply it.

### Invoice numbering
- Use `nextInvoiceNumber(prefix?, date?)` from `db.ts` — queries DB for max existing sequence.
- The returned number is a **suggestion** — not yet saved. Uniqueness enforced by `idx_invoices_invoice_number`.
- Format: `{prefix}-{YYYYMM}-{NNN}` (e.g. `INV-202606-001`).

### PDF fonts
- `@react-pdf/renderer` cannot render ₹ with Helvetica/Times.
- Noto Sans fonts in `public/fonts/` are registered via `Font.register()` in `src/pdf/InvoicePDF.tsx`.
- All PDF text uses `"NotoSans"` or `"NotoSans-Bold"` font family.
- Both regular and italic variants must be registered explicitly (even if they point to the same file) to avoid the "Could not resolve font for italic" runtime crash.

### Dark mode
- `color-scheme: light` is forced in `src/index.css` to prevent WKWebView dark mode making text invisible.

### Window dragging
- The drag bar uses `data-tauri-drag-region` attribute. Do NOT use `startDragging()` — it causes WKWebView to cede keyboard focus.

---

## File structure

```
src/
  App.tsx                 ← Root: navigation state, ⌘K shortcut, layout
  db.ts                   ← All DB access: migrations, CRUD, fee schedule, work captures
  types.ts                ← All TypeScript types and enums
  main.tsx                ← Tauri app entry point
  index.css               ← Global styles (forces light mode)
  demoData.ts             ← Demo data loader

  components/
    Sidebar.tsx           ← Left nav with inbox badge + ⌘K button
    Dashboard.tsx         ← Profile card + stats
    MatterList.tsx        ← Left panel list of matters
    MatterDetail.tsx      ← Matter overview tab (stats, info, Bill Unbilled Work)
    MatterForm.tsx        ← Create / edit matter
    MatterTabs.tsx        ← Tab strip (Overview / Time / Appearances / Invoices)
    MatterParties.tsx     ← Respondent / Petitioner list within matter
    Appearances.tsx       ← Appearances tab (with fee schedule auto-fill)
    TimeEntries.tsx       ← Time entries tab (with fee schedule auto-fill)
    Invoices.tsx          ← Invoices tab (full CRUD, PDF generation)
    RecordPayment.tsx     ← Record payment against invoice
    OutstandingDues.tsx   ← Cross-matter unpaid invoice list
    ContactList.tsx       ← Client / Firm directory
    ContactPersonsPanel.tsx ← Contacts within a client / firm
    SettingsPage.tsx      ← Profile, fee schedule, invoice designer, backup, lock
    InvoiceDesigner.tsx   ← Invoice template + customisation preview
    QuickCapture.tsx      ← ⌘K palette (NEW v1.1.0)
    Inbox.tsx             ← Unassigned work captures (NEW v1.1.0)
    BillUnbilledWork.tsx  ← One-click invoice panel on MatterDetail (NEW v1.1.0)
    Toast.tsx             ← Toast notification system
    LockScreen.tsx        ← PIN lock screen
    LockSettings.tsx      ← PIN management UI
    AboutModal.tsx        ← About / Support modal
    SupportModal.tsx      ← Support contact form
    Onboarding.tsx        ← First-run profile setup
    ErrorBoundary.tsx     ← React error boundary
    ScreenshotHelper.tsx  ← Dev-only screenshot overlay (⌘⇧D)

  lib/
    currency.ts           ← INR formatting (single source of truth)
    invoiceUtils.ts       ← effectiveStatus(), localDateString(), daysOverdue()
    invoiceUtils.test.ts  ← 26 Vitest tests
    constants/
      states.ts           ← INDIAN_STATES array + matchState()

  types/
    contacts.ts           ← MacContact interface (Apple Contacts IPC result)

  pdf/
    InvoicePDF.tsx        ← @react-pdf/renderer invoice template

src-tauri/
  src/main.rs             ← Tauri commands including search_contacts (Apple Contacts IPC)
  Cargo.toml              ← Rust dependencies
  tauri.conf.json         ← App config, permissions, version
```

---

## Key patterns

### Adding a new DB table

1. Add `CREATE TABLE IF NOT EXISTS` in `migrate()` in `db.ts`
2. Add TypeScript interface in `types.ts`
3. Export CRUD functions from `db.ts`
4. Document in `DATABASE_DOCUMENTATION.md`

### Adding a new settings key

Store as JSON in the `settings` table:
```ts
await setSetting("my_key", JSON.stringify(myObject));
const raw = await getSetting("my_key");
const obj = raw ? JSON.parse(raw) : DEFAULT_VALUE;
```

### Adding a new nav section

1. Add the key to `NavSection` in `types.ts`
2. Add to `items` array in `Sidebar.tsx`
3. Add render branch in `App.tsx renderContent()`
4. Add to `showMatterList` exclusion array in `App.tsx`

### Toast notifications

Every save/update/delete should call `toast.success()` or `toast.error()`:
```ts
const toast = useToast(); // first line of component
try {
  await insertFoo(data);
  toast.success("Saved");
} catch {
  toast.error("Failed to save");
}
```

### Fee schedule auto-fill

When a new form entry is created, check the fee schedule:
```ts
const feeSchedule = await loadFeeSchedule();
// For appearances:
if (feeSchedule.mention > 0) entry.fee_amount = feeSchedule.mention;
// For time entries:
if (feeSchedule.hourly_rate > 0) entry.rate_per_hour = feeSchedule.hourly_rate;
```
**Rule:** Only auto-fill when the current value is 0. Never overwrite user-entered values.

---

## Work Capture flow (Phase 1B/1C)

```
User presses ⌘K
  → QuickCapture modal opens
  → User fills description, type, date, amount
  → [Save to Inbox] → insertWorkCapture(capture) with matter_id = null
                     → item appears in Inbox screen
  → [Assign & Save] → insertWorkCapture() then assignWorkCapture()
                     → creates appearance or time_entry in the target matter
                     → stamps matter_id, assigned_at, converted_id on capture

Inbox screen:
  → fetchInboxCaptures() — WHERE matter_id IS NULL
  → User clicks assign → assignWorkCapture(capture, matter)
  → Item disappears from inbox (filtered out), downstream record created
  → Audit: capture row remains with matter_id + converted_id set

Sidebar badge:
  → fetchInboxCount() — COUNT WHERE matter_id IS NULL
  → Updated after: QuickCapture save, Inbox assign, Inbox discard
```

---

## Bill Unbilled Work flow (Phase 2A)

```
MatterDetail mounts
  → BillUnbilledWork loads fetchAllBillableAppearances() + fetchAllBillableTimeEntries()
  → Filters to is_billed = 0 items
  → If none: component returns null (invisible)
  → If some: shows collapsible "Bill Unbilled Work" panel

User expands panel, optionally deselects items, clicks "Generate Draft Invoice"
  → nextInvoiceNumber() → suggested number
  → GST computed from matter.client_state vs matter.firm_state
  → insertInvoice() → status = 'draft', line_items_data = JSON
  → onTabChange('invoices') → switches to Invoices tab

Items remain is_billed = 0 until user marks invoice Sent
  → Invoices.tsx calls markAppearancesBilled() + markTimeEntriesBilled()
    when status transitions to 'sent'
```

---

## Testing

```bash
npm test          # runs 26 Vitest unit tests (invoiceUtils)
npx tsc --noEmit  # TypeScript check (zero warnings = clean)
npm run build     # Vite production build (must succeed before any release)
```

Test file: `src/lib/invoiceUtils.test.ts`

---

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| PDF shows `Rs.` instead of `₹` | Using Helvetica which has no ₹ glyph | Switch to NotoSans; use `formatPDF()` |
| PDF crashes with "Could not resolve font" | Italic variant not registered | Register `{ fontStyle: "italic" }` pointing to regular file |
| Overdue not showing | Writing to `status='overdue'` in DB | Never write overdue; use `effectiveStatus()` |
| Date off by one (IST) | `toISOString().slice(0,10)` | Use `localDateString()` |
| Invoice number collision | No unique index | Already enforced; `nextInvoiceNumber()` reads max from DB |
| New nav item not showing | Not in `showMatterList` exclusion | Add to the exclusion array in `App.tsx` |
| Fee not auto-filling | Fee schedule all zeros | User must set values in Settings → Fee Schedule |
| Inbox badge stale | `refreshInboxCount` not called | Call `onAssigned()` / `onSaved()` callback after every mutation |
