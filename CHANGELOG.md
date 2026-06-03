# Changelog — Memo App

All notable changes to this project are documented here.  
Format: [Semantic Versioning](https://semver.org). Dates are YYYY-MM-DD.

---

## [1.0.2] — 2026-06-03

### Unified Work Done Workflow

#### Navigation change
Replaced the four-tab matter navigation (Overview · Time · Appearances · Invoices) with three tabs (Overview · **Work Done** · Invoices).

"Work Done" is a UI-only abstraction. The `appearances` and `time_entries` tables are unchanged.

#### Added

- **`src/components/WorkDone.tsx`** — Unified Work Done screen
  - Chronological merged list of appearances + time entries
  - Filter bar: All | Appearances | Time Entries
  - `+ Add Work` dropdown → Appearance or Time Entry inline form
  - Fee schedule auto-fill wired into both forms
  - Duration input in hours (step 0.5) with minutes stored internally
  - Live timer: Start / Stop → auto-fills duration into new Time Entry form
  - Billing summary bar: total entry count, total time, total unbilled value
  - `BillUnbilledWork` panel at bottom when unbilled items exist
  - Empty state per filter selection
  - WorkItem union type (`kind: "appearance" | "time"`) for future extensibility

- **`MatterTab` type** updated: `"overview" | "work_done" | "invoices"`

#### Changed

- **`src/components/MatterTabs.tsx`** — 4 tabs → 3; `Briefcase` icon for Work Done
- **`src/components/MatterDetail.tsx`** — 3 stat cards → 2 (Work Done + Invoices); `onTabChange("time"/"appearances")` → `onTabChange("work_done")`
- **`src/App.tsx`** — routing updated; `<TimeEntries>` + `<Appearances>` replaced by `<WorkDone>`; `MatterTab` imported from `types.ts` instead of `MatterTabs.tsx`
- **Version**: 1.0.1 → 1.0.2 across Sidebar, AboutModal, SupportModal, `tauri.conf.json`, `Cargo.toml`

#### Preserved (not removed)

- `src/components/TimeEntries.tsx` — kept, not routed as a tab
- `src/components/Appearances.tsx` — kept, not routed as a tab

---

## [1.1.0] — 2026-06-03

### Added

#### Phase 1A — Standard Fee Schedules
- **`FeeSchedule` type** (`src/types.ts`): Maps all 17 HearingType values + `hourly_rate` to INR amounts.
- **`DEFAULT_FEE_SCHEDULE`** (`src/types.ts`): All-zero defaults (no auto-fill until configured).
- **`loadFeeSchedule()` / `saveFeeSchedule()`** (`src/db.ts`): Load/persist as JSON in `settings` table under key `fee_schedule`.
- **Settings → Fee Schedule tab** (`src/components/SettingsPage.tsx`): Full UI to set standard fees for all appearance types and the default hourly rate. Own Save button, own toast feedback.
- **Auto-fill in Appearances** (`src/components/Appearances.tsx`): When work type changes in the form, `fee_amount` is pre-filled from the schedule if the current value is 0.
- **Auto-fill in TimeEntries** (`src/components/TimeEntries.tsx`): New blank entries and timer-stopped entries pre-fill `rate_per_hour` from `hourly_rate` in schedule.

#### Phase 1B — Quick Work Capture (⌘K)
- **`work_captures` table** (DB migration in `src/db.ts`): Staging table for quick captures. `matter_id` is nullable — `NULL` means "in inbox."
- **`WorkCapture` type** (`src/types.ts`): Full capture schema with `converted_id` for audit trail.
- **`insertWorkCapture()`, `fetchInboxCaptures()`, `fetchInboxCount()`, `updateWorkCapture()`, `deleteWorkCapture()`, `assignWorkCapture()`** (`src/db.ts`): Full CRUD + assignment logic.
- **`assignWorkCapture(capture, matterId)`**: Creates the downstream `appearance` or `time_entry`, then stamps `matter_id`, `assigned_at`, and `converted_id` on the capture.
- **`QuickCapture.tsx`** (new component): Floating modal with Appearance/Time Entry toggle, description, date, type-specific fields, matter search, "Save to Inbox" and "Assign & Save" actions.
- **`⌘K` global shortcut** (`src/App.tsx`): Opens/closes `QuickCapture` from any screen. Implemented as a `keydown` listener on `window`.
- **Quick Capture button** in sidebar: Visible shortcut showing `⌘K` hint.
- **Fee schedule seeded in QuickCapture**: Same auto-fill logic as Appearances/TimeEntries.

#### Phase 1C — Work Inbox
- **`NavSection` updated** (`src/types.ts`): Added `"inbox"` to the nav union type.
- **`Inbox` sidebar item** (`src/components/Sidebar.tsx`): Between Dashboard and Matters in the "Work" group.
- **Inbox badge** (`src/components/Sidebar.tsx`): Amber badge showing unassigned capture count. Updates after every save/assign/discard.
- **`Inbox.tsx`** (new component): Full-page screen showing all unassigned captures as cards. Each card supports inline edit, matter-search-and-assign, and discard-with-confirmation.
- **`App.tsx`** wiring: `fetchInboxCount()` on mount; `refreshInboxCount()` callback passed to Inbox and QuickCapture; `inbox` branch in `renderContent()`.

#### Phase 2A — One-Click Invoice Creation
- **`BillUnbilledWork.tsx`** (new component): Collapsible panel on Matter Overview. Auto-discovers `is_billed=0` appearances and `is_billable=1, is_billed=0` time entries. Shows a per-item checklist with individual deselection. "Generate Draft Invoice" button creates a `draft` invoice with auto-numbered invoice number, GST computation (intra/inter-state), 30-day due date, and full `line_items_data`. Panel is invisible when no unbilled items exist.
- **`MatterDetail.tsx`**: Imports and renders `BillUnbilledWork`. Invoice stat card refreshes after invoice creation via `invoiceRefresh` counter.
- **GST logic in `BillUnbilledWork`**: Compares `matter.client_state` vs `matter.firm_state`; produces CGST+SGST (same state) or IGST (different states). Falls back to CGST+SGST when either state is blank.
- **Items NOT auto-billed**: `is_billed` flags are set only when the invoice is explicitly marked Sent in the Invoices tab.

### Changed
- `Sidebar.tsx`: Accepts `inboxCount` and `onQuickCapture` props. Lucide icon changed to `Inbox` (replacing the unavailable `Tray`).
- `App.tsx`: Imports `useCallback`; adds `showCapture` and `inboxCount` state; adds `⌘K` listener; renders `QuickCapture` overlay.
- `SettingsPage.tsx`: Added `fee_schedule` section key to `SECTIONS` constant. Left nav now includes "Fee Schedule" between Invoice Settings and Invoice Designer. Imports `IndianRupee` icon, `FeeSchedule`/`DEFAULT_FEE_SCHEDULE` types, `loadFeeSchedule`/`saveFeeSchedule` DB functions.
- `Appearances.tsx`: Loads fee schedule on mount; `AppearanceForm` accepts `feeSchedule` prop; `handleTypeChange` auto-fills fee.
- `TimeEntries.tsx`: Loads fee schedule on mount; `newBlankEntry()` helper pre-fills `rate_per_hour`.
- `db.ts`: Static `import { v4 as uuid } from "uuid"` (replaced dynamic import inside `assignWorkCapture` to avoid Vite chunk-split warning).

### Database migrations (auto-applied on next app launch)
- `CREATE TABLE IF NOT EXISTS work_captures` — new inbox staging table.
  - **Risk:** None — new table, zero impact on existing data.
  - **Rollback:** `DROP TABLE IF EXISTS work_captures;`
- `fee_schedule` key in `settings` — added via `saveFeeSchedule()` when user first saves. No schema change.
  - **Risk:** None.
  - **Rollback:** `DELETE FROM settings WHERE key = 'fee_schedule';`

---

## [1.0.1] — 2026-05-XX

### Added
- **`src/lib/currency.ts`**: Single canonical INR formatting with `formatINR`, `formatCurrency`, `formatPDF`. Pre-instantiated `Intl.NumberFormat` objects.
- **`src/lib/constants/states.ts`**: Deduplicated canonical `INDIAN_STATES` array (34 entries) + `matchState()` helper.
- **`src/types/contacts.ts`**: Shared `MacContact` interface (mirrors Rust IPC output).
- **`src/lib/invoiceUtils.ts`**: `effectiveStatus()`, `applyEffectiveStatus()`, `isOverdue()`, `daysOverdue()`, `localDateString()`.
- **`src/lib/invoiceUtils.test.ts`**: 26 Vitest tests — all passing.
- **Vitest**: Added to `vite.config.ts` with `environment: "node"`.
- **Primary contacts on MatterDetail**: `primaryClientContact` and `primaryFirmContact` fetched and displayed.
- **Toast notifications**: Added to 11 components (59 total call sites).
- **SupportModal enabled**: Removed `{false && ...}` guard from About dialog.
- **Invoice overdue detection**: `applyEffectiveStatus` applied in `fetchInvoices()` and `fetchAllUnpaidInvoices()`.
- **Invoice number uniqueness**: `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number`. Duplicate remediation in migrate (appends `-DUP-{n}`).
- **`nextInvoiceNumber()`**: Queries DB for max existing sequence; returns next suggested number.
- **Noto Sans fonts**: `public/fonts/NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` for PDF ₹ rendering.

### Changed
- `InvoicePDF.tsx`: Replaced Helvetica/Times-Roman with NotoSans throughout. `formatPDF()` now produces `₹` not `Rs.`.
- `Invoices.tsx`: Uses `nextInvoiceNumber()` on form open; removed dead `setRecipient` state.
- `OutstandingDues.tsx`: Uses `daysOverdue()` from invoiceUtils (removed date-fns `differenceInDays`).
- `MatterDetail.tsx`: Uses `fetchContactPersonById()`.
- `db.ts`: Removed dead exports; added `fetchContactPersonById()`; added `fetchInboxCount()` (placeholder for v1.1.0 migration).
- Version: `1.0.1` in `tauri.conf.json`, `Cargo.toml`, `Sidebar.tsx`, `SupportModal.tsx`, `AboutModal.tsx`.

---

## [1.0.0] — 2026-XX-XX

### Initial release
- Matter management (CRUD, ref numbers, status)
- Client & Firm directory with contact persons and Apple Contacts sync
- Appearances (17 work types)
- Time entries with live timer
- Invoices (3 PDF templates, GST computation, TDS, partial payments)
- Outstanding dues cross-matter view
- Advance payments
- Dashboard with profile card
- Settings: profile, bank details, invoice preferences, Invoice Designer
- Backup & Restore (JSON export/import)
- App lock (PIN with SHA-256)
- Demo data loader
- Onboarding for first-run setup
