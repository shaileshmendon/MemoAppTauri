# Memo App — Feature Catalog

> Last updated: 2026-06-03  
> App version: 1.0.2

---

## Core Features (v1.0.0)

### Matter Management
- Create, edit, delete matters (litigation, advisory, drafting, corporate, other)
- Sequential matter reference numbers (`#001`, `#002` …) auto-assigned at creation
- Matter status: active / closed / on-hold
- Linked client, AOR/firm, handler/advocate-in-charge
- GST-aware: client state, firm state, GSTIN stored per matter
- Invoice recipient preference per matter (client / firm / both)
- Primary contact per client and firm sides (FK → contact_persons)

### Client & Firm Directory
- Full CRUD for clients and AOR/firms
- Contact persons (multiple per entity) with Apple Contacts sync
- GSTIN, state, address, notes per entity

### Appearances (Work Log)
- Log court appearances and professional work (17 types across two categories)
- Fields: date, work type, court, fee, billed flag, notes
- Live total per matter
- Billable/billed state tracked for invoice generation

### Time Entries
- Log billable / non-billable time with live timer
- Fields: date, description, duration (minutes), rate/hr, billable flag
- Running timer → stop → auto-fills duration into new entry form

### Invoices
- Full invoice lifecycle: draft → sent → paid / partially_paid / overdue / cancelled
- GST calculation: CGST + SGST (intra-state) or IGST (inter-state)
- Three PDF templates: Modern, Classic, Minimal (via `@react-pdf/renderer`)
- Noto Sans font for ₹ glyph in PDFs
- Auto-numbered: `{prefix}-{YYYYMM}-{NNN}`, DB-enforced unique index
- Automatic overdue detection at read time (`effectiveStatus()`) — no DB writes
- Contact-person addressing (6 modes: org or named contact, client/firm/both)
- TDS recording on payments (Section 194J, 194C, custom rate)
- Partial payments tracked; outstanding balance computed

### Payments
- Record payments against invoices with mode (NEFT/RTGS/IMPS/UPI/cheque/cash)
- TDS deduction fields (section, rate, amount)
- Advance payments per matter (separate from invoice payments)

### Outstanding Dues
- Cross-matter view of all unpaid / overdue invoices
- Days overdue computed from `daysOverdue()` utility (timezone-safe)

### Dashboard
- Profile card with all advocate/firm details
- Summary stats: matters, invoices, revenue

### Settings
- Identity, address, bank details, GSTIN, PAN stored in profile
- Invoice preferences: prefix, template, GST rate, signature text
- Invoice Designer: accent colour, show/hide GST breakdown, bank details, signature, custom fields
- Backup (JSON export) & Restore
- App lock (PIN with SHA-256 hashing)

---

## v1.0.1 Additions

### Currency Formatting (`src/lib/currency.ts`)
- Single canonical `formatINR` / `formatCurrency` / `formatPDF` via `Intl.NumberFormat`
- Indian locale (lakhs grouping): ₹1,23,456

### Invoice Overdue Detection (`src/lib/invoiceUtils.ts`)
- `effectiveStatus()` — pure function, no DB writes
- `localDateString()` — YYYY-MM-DD in local timezone (IST-safe)
- Applied at fetch time in `fetchInvoices()` and `fetchAllUnpaidInvoices()`
- 26 Vitest tests covering all status transitions

### SupportModal enabled
- About dialog now shows the Support button unconditionally

---

## v1.1.0 — New Features (current release)

### Phase 1A — Standard Fee Schedules

**Purpose:** Eliminate repetitive fee entry. The advocate sets standard rates once; they are pre-filled on every new appearance or time entry.

**Location:** Settings → Fee Schedule

**Design:**
- Stored as JSON in `settings` table under key `fee_schedule`
- One amount per HearingType (17 appearance types) + one default hourly rate
- Zero-value entries are silently skipped (no auto-fill)
- Per-entry override always possible — the form value is fully editable after pre-fill

**Auto-fill behaviour:**
- `Appearances.tsx`: When work type changes, `fee_amount` is pre-filled from schedule **only if** the current fee is 0. User-entered values are never overwritten.
- `TimeEntries.tsx`: `rate_per_hour` is pre-filled from `hourly_rate` on blank new entries and timer-stopped entries.
- `QuickCapture`: Same logic — type change auto-fills fee/rate.

**Files changed:** `types.ts`, `db.ts`, `SettingsPage.tsx`, `Appearances.tsx`, `TimeEntries.tsx`

---

### Phase 1B — Quick Work Capture (⌘K)

**Purpose:** Capture an appearance or time entry in under 5 seconds from anywhere in the app, without selecting a matter first.

**Trigger:** `⌘K` from any screen (global `keydown` listener in `App.tsx`)

**Location:** Floating modal overlay (`QuickCapture.tsx`)

**Fields:**
- Work type toggle: Appearance | Time Entry
- Description (optional, focused on open)
- Date (defaults to today)
- For appearances: type (grouped dropdown), court, fee
- For time entries: duration (minutes), rate/hr, billable toggle
- Matter search (optional): fuzzy search across case_title, client_name, court, matter_number

**Save paths:**
1. **Save to Inbox** — stores to `work_captures` with `matter_id = NULL`. Item appears in Inbox for later assignment.
2. **Assign & Save** — stores to `work_captures` then immediately calls `assignWorkCapture()`, which creates the downstream `appearance` or `time_entry` and stamps `matter_id`, `assigned_at`, `converted_id` on the capture record.

**Files changed:** `types.ts`, `db.ts`, `App.tsx`, `Sidebar.tsx`, `QuickCapture.tsx` (new)

---

### Phase 1C — Work Inbox

**Purpose:** View and act on all unassigned quick-captures. Nothing is lost; everything can be assigned or discarded from one screen.

**Location:** Sidebar → Inbox (between Dashboard and Matters)

**Sidebar badge:** Amber count badge shows number of unassigned captures. Updates after every save/assign/discard.

**Inbox card features:**
- Type badge (Appearance / Time Entry)
- Description, date, work-type details, fee / billable amount
- Inline edit: description, date, court / fee (appearances), duration / rate (time)
- Matter search → assign (converts to `appearance` or `time_entry`, removes from inbox list, stamps audit fields)
- Discard (with confirmation) — permanently deletes the capture

**Audit trail:** Assigned captures remain in `work_captures` table with `matter_id`, `assigned_at`, and `converted_id` set. They are removed from the inbox view only (filtered by `matter_id IS NULL`).

**Files changed:** `types.ts`, `db.ts`, `App.tsx`, `Sidebar.tsx`, `Inbox.tsx` (new)

---

### Phase 2A — One-Click Invoice Creation

**Purpose:** Generate a draft invoice from all unbilled appearances and time entries with a single click, eliminating manual line-item reconstruction.

**Location:** Matter Overview → "Bill Unbilled Work" panel (appears automatically when unbilled items exist)

**Flow:**
1. Panel auto-discovers all `is_billed = 0` appearances and `is_billable = 1, is_billed = 0` time entries for the matter.
2. Shows a collapsible checklist — user can deselect individual items before generating.
3. On "Generate Draft Invoice":
   - Calls `nextInvoiceNumber()` for the auto-numbered invoice number
   - Computes GST (CGST+SGST for intra-state, IGST for inter-state) using profile's default rate
   - Sets due date to today + 30 days
   - Creates invoice in `draft` status with `line_items_data` JSON
   - Switches to the Invoices tab for review
4. **Items are NOT marked `is_billed = 1` here.** That happens only when the invoice is explicitly marked Sent. The lawyer can edit the invoice, remove line items, or cancel before sending.

**GST logic:** Compares `matter.client_state` vs `matter.firm_state`. If they differ → IGST only. If same (or either blank) → CGST + SGST split.

**Files changed:** `MatterDetail.tsx`, `BillUnbilledWork.tsx` (new)

---

## Keyboard Shortcuts

| Shortcut | Action | Available from |
|---|---|---|
| `⌘K` | Open Quick Capture palette | Any screen |
| `Esc` | Close Quick Capture / any modal | Modals |

---

## Planned (not yet implemented)

- Phase 2B: Matter-level fee schedule override
- Phase 3: Per-client fee schedules
- Phase 3: Batch invoice across multiple matters for one client
- Menu bar quick entry (requires Tauri menu bar plugin)

---

## v1.0.2 — Unified Work Done Workflow

### Navigation Change

**Before:** Overview · Time · Appearances · Invoices  
**After:** Overview · **Work Done** · Invoices

The "Work Done" tab replaces the separate Time and Appearances tabs. All functionality is preserved — only the navigation structure changes.

### Work Done Screen (`WorkDone.tsx`)

A unified interface that merges all work types into a single chronological list.

**Filter bar:** All | Appearances | Time Entries — filters the view without affecting data.

**Unified list columns:**

| Column | Description |
|---|---|
| Date | Entry date (YYYY-MM-DD, displayed as "3 Jun 2026") |
| Type icon | ⚖ Gavel (Appearance) · 🕐 Clock (Time Entry) |
| Description | Hearing type + court (appearances) · text description (time entries) |
| Duration | Time entries: h/m · Appearances: — |
| Amount | Fee or billable value |
| Billing status | "Unbilled" (amber) or "Billed" (green) |

**+ Add Work button:** Dropdown showing Appearance / Time Entry. Opens the appropriate inline form with fee schedule auto-fill.

**Live timer:** Preserved — Start Timer / Stop in toolbar, auto-fills duration into new Time Entry form.

**Bill Unbilled Work panel:** Appears at the bottom when unbilled items exist. Connects to the existing invoice generation workflow.

**Toolbar summary:** Shows total entry count, total time (if any), and total unbilled value.

### WorkItem abstraction

Entries are represented as `WorkItem`:

```ts
type WorkItem =
  | { kind: "appearance"; data: Appearance }
  | { kind: "time";       data: TimeEntry }
```

Sorted by `date` descending. Future work types (Expenses, Quick Capture items) slot in by adding a new `kind`.

### Matter Overview changes

Old: Three stat cards — Time Logged · Appearances · Invoices  
New: Two stat cards — **Work Done** (combined count + unbilled value) · Invoices

Both cards click through to their respective tabs.

### Files changed

| File | Change |
|---|---|
| `src/types.ts` | `MatterTab = "overview" \| "work_done" \| "invoices"` |
| `src/components/MatterTabs.tsx` | 4 tabs → 3 tabs; Work Done replaces Time + Appearances |
| `src/components/WorkDone.tsx` | **New** — unified Work Done screen |
| `src/components/MatterDetail.tsx` | 3 stat cards → 2; `onTabChange` updated |
| `src/App.tsx` | Routing updated; WorkDone wired in |

### Preserved (not deleted)

`TimeEntries.tsx` and `Appearances.tsx` are kept intact — they are no longer routed as direct tabs but remain available for future reuse.
