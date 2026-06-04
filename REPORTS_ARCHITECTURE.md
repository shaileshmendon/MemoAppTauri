# Reports & Analytics — Architecture Design
> Memo v1.2.0 planning document  
> Status: **Draft — not yet implemented**

---

## 1. Overview

The Reports module gives Indian advocates a single place to answer the three questions their accountant asks every quarter:

1. *What did I invoice, and to whom?*
2. *What did I collect, and what is still outstanding?*
3. *What work have I done that I haven't billed yet?*

Every report is read-only. All data already lives in the SQLite database — no new tables are required for Phase 1. Reports are generated in-process (no server) and exported to CSV or PDF.

---

## 2. Navigation Placement

```
Sidebar (NavSection)
├── Dashboard
├── Matters
├── Clients
├── Firms
├── Outstanding          ← existing quick view (keep)
├── ── separator ──
├── Reports              ← NEW  (⌘6)
└── Settings
```

`NavSection` type gains `"reports"` value.  
Keyboard shortcut: `⌘6` (consistent with `⌘1–5` pattern).

### Reports Landing Page

A two-column card grid, each card showing:
- Report name
- One-line description
- Last-run timestamp ("Run 3 hours ago")
- **Run** button

No auto-run on navigation — reports run on demand to keep the UI snappy on large datasets.

---

## 3. Report Architecture

### 3.1 Rendering Pipeline

```
User picks filters
        │
        ▼
ReportEngine.run(reportId, filters)   ← pure async function, no React
        │   Executes parameterised SQL via tauri-plugin-sql
        ▼
ReportResult { columns, rows, summary, generatedAt }
        │
        ▼
ReportTable component (virtual scroll for large result sets)
        │
        ▼
ExportMenu → CSV (client-side) | PDF (Tauri print / html-to-pdf)
```

### 3.2 Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data fetch | Raw SQL via `tauri-plugin-sql` | Aggregations in SQL are faster than JS; avoids loading all rows into memory |
| State | `useState` inside `ReportsPage` component, one report at a time | No global state needed; reports are ephemeral views |
| Filters | Controlled form; **Apply** button triggers re-run | Avoids re-query on every keystroke |
| Currency | All amounts in paise (integer) in DB; display as `₹ X,XX,XXX` | Matches existing pattern in codebase |
| Financial year | April 1 – March 31; auto-detect current FY on first open | Standard for Indian practices |
| TDS | Shown as a separate column where relevant | Accountant requirement |

### 3.3 Shared Filter Components

```typescript
// src/components/reports/ReportFilters.tsx
interface DateRangeFilter  { from: string; to: string }          // YYYY-MM-DD
interface FinancialYearFilter { fy: string }                      // e.g. "2025-26"
interface MatterFilter     { matterId: string | "all" }
interface ClientFilter     { clientName: string | "all" }
interface StatusFilter<T>  { status: T | "all" }
```

A `FinancialYearPicker` component auto-populates `from`/`to` when the user picks a FY label — no manual date entry needed for the common case.

### 3.4 File Layout

```
src/
  components/
    reports/
      ReportsPage.tsx          ← landing cards + router
      ReportShell.tsx          ← filter bar + table + export toolbar
      ReportTable.tsx          ← virtualised table
      ReportFilters.tsx        ← shared filter widgets
      ExportMenu.tsx           ← CSV / PDF dropdown
      reports/
        InvoiceRegister.tsx
        OutstandingInvoices.tsx
        RevenueSummary.tsx
        ClientRevenue.tsx
        MatterRevenue.tsx
        UnbilledWork.tsx
        WorkInProgress.tsx
  lib/
    reports/
      engine.ts                ← ReportEngine.run(), SQL queries
      formatters.ts            ← Indian number format, date helpers
      csvExport.ts
      pdfExport.ts
      financialYear.ts         ← FY helpers (Apr–Mar)
```

---

## 4. Financial Year Helper

Indian financial year runs **1 April → 31 March**.

```
FY 2025-26  →  from: 2025-04-01  to: 2026-03-31
FY 2024-25  →  from: 2024-04-01  to: 2025-03-31
```

`financialYear.ts` exports:
- `currentFY()` → `"2025-26"` (based on today's date)
- `fyDateRange(fy)` → `{ from, to }`
- `fyList(yearsBack = 5)` → last N financial years for the picker

---

## 5. Report Catalogue

---

### Report 1 — Invoice Register

**Purpose:** Complete list of all invoices in a period. The primary document an accountant needs for GST filing (GSTR-1 equivalent for advocates under composition/exemption).

**Data sources:** `invoices` JOIN `matters`

**Default filter:** Current financial year

**Filters:**
| Filter | Type | Values |
|---|---|---|
| Date range | Date picker / FY picker | Invoice date |
| Status | Multi-select | Draft, Sent, Paid, Partially Paid, Overdue, Cancelled |
| Client | Searchable dropdown | All clients from `matters.client_name` |
| Matter | Searchable dropdown | All matters |
| GST rate | Select | 0%, 5%, 12%, 18% |

**Columns:**

| # | Column | Source | Notes |
|---|---|---|---|
| 1 | Invoice No. | `invoices.invoice_number` | |
| 2 | Invoice Date | `invoices.invoice_date` | dd-MMM-yyyy |
| 3 | Due Date | `invoices.due_date` | |
| 4 | Matter | `matters.case_title` | |
| 5 | Client / Firm | `matters.client_name` or `firm_name` | Based on `recipient_type` |
| 6 | Subtotal | `invoices.subtotal_amount` | ₹ formatted |
| 7 | CGST | `invoices.cgst` | — if 0 |
| 8 | SGST | `invoices.sgst` | — if 0 |
| 9 | IGST | `invoices.igst` | — if 0 |
| 10 | Total | `invoices.total_amount` | **Bold** |
| 11 | Status | `invoices.status` | Colour badge |
| 12 | Amount Paid | SUM(`payments.amount_paid`) | |
| 13 | Balance Due | Total − Paid | |
| 14 | TDS Deducted | SUM(`payments.tds_amount`) | Blank if nil |

**Summary row (footer):**
- Total invoiced, Total GST collected, Total paid, Total balance, Total TDS

**Export:** CSV (all columns), PDF (print layout matching summary row at bottom)

---

### Report 2 — Outstanding Invoices

**Purpose:** Aged debtors report. Shows which invoices are unpaid and by how many days. Used to chase payments.

**Data sources:** `invoices` JOIN `matters` LEFT JOIN `payments`

**Default filter:** All unpaid (Sent + Partially Paid + Overdue), as of today

**Filters:**
| Filter | Type |
|---|---|
| As-of date | Date picker (defaults to today) |
| Client | Searchable dropdown |
| Ageing bucket | 0–30 / 31–60 / 61–90 / 90+ / All |
| Status | Sent, Partially Paid, Overdue |

**Columns:**

| # | Column | Notes |
|---|---|---|
| 1 | Invoice No. | |
| 2 | Invoice Date | |
| 3 | Due Date | |
| 4 | Matter | |
| 5 | Client | |
| 6 | Invoice Total | |
| 7 | Amount Paid | |
| 8 | Balance Due | Highlighted red if > 90 days |
| 9 | Days Overdue | (as-of date) − due_date; 0 if not yet due |
| 10 | Ageing Bucket | 0–30 / 31–60 / 61–90 / 90+ |

**Ageing Summary panel (above table):**

```
  0–30 days    31–60 days    61–90 days    90+ days    Total Outstanding
  ₹ 45,000     ₹ 12,000      ₹ 8,000      ₹ 25,000    ₹ 90,000
```

**Calculations:**
- `days_overdue = MAX(0, as_of_date − due_date)`
- Bucket assigned server-side in SQL using `CASE WHEN`

**Export:** CSV, PDF

---

### Report 3 — Revenue Summary

**Purpose:** Month-by-month and FY total of invoiced vs collected amounts. The first thing an advocate looks at to understand practice health.

**Data sources:** `invoices`, `payments`

**Default filter:** Current financial year

**Filters:**
| Filter | Type |
|---|---|
| Financial year | FY picker |
| Custom date range | Override FY picker |
| Group by | Month / Quarter |

**Columns (grouped by Month/Quarter):**

| # | Column |
|---|---|
| 1 | Period (e.g. "Apr 2025") |
| 2 | Invoices Raised (count) |
| 3 | Amount Invoiced |
| 4 | Amount Collected |
| 5 | Balance Outstanding |
| 6 | GST Collected (total tax) |
| 7 | TDS Deducted |

**Summary row:** FY totals for each column

**Visualisation (Phase 2):** Simple bar chart (invoiced vs collected per month) — skip in Phase 1, data structure supports it.

**Export:** CSV, PDF

---

### Report 4 — Client Revenue

**Purpose:** Ranked list of clients by revenue billed/collected. Helps identify top clients and dormant relationships.

**Data sources:** `invoices` JOIN `matters` JOIN `payments`

**Default filter:** Current financial year

**Filters:**
| Filter | Type |
|---|---|
| Financial year | FY picker |
| Custom date range | Override |
| Status | Paid / All |
| Sort by | Amount Invoiced ↓ / Amount Collected ↓ / Matters count ↓ |

**Columns:**

| # | Column |
|---|---|
| 1 | Rank |
| 2 | Client Name |
| 3 | Active Matters (count) |
| 4 | Invoices Raised (count) |
| 5 | Amount Invoiced |
| 6 | Amount Collected |
| 7 | Balance Due |
| 8 | Collection Rate (%) |
| 9 | TDS Deducted |

**Calculations:**
- `collection_rate = amount_collected / amount_invoiced * 100`
- Client name sourced from `matters.client_name` (denormalised in schema); group by exact string

**Export:** CSV, PDF

---

### Report 5 — Matter Revenue

**Purpose:** Per-matter breakdown of all financial activity. Used when closing a matter or reviewing profitability.

**Data sources:** `matters`, `invoices`, `payments`, `appearances`, `time_entries`

**Default filter:** All active matters, current FY

**Filters:**
| Filter | Type |
|---|---|
| Financial year | FY picker |
| Matter status | Active / Closed / All |
| Client | Searchable dropdown |
| Matter type | Litigation / Advisory / Drafting / Corporate / Other |

**Columns:**

| # | Column |
|---|---|
| 1 | Matter Ref |
| 2 | Case Title |
| 3 | Client |
| 4 | Type |
| 5 | Status |
| 6 | Appearances (count) |
| 7 | Time Entries (hours) |
| 8 | Total Work Value* |
| 9 | Amount Invoiced |
| 10 | Amount Collected |
| 11 | Unbilled Value* |
| 12 | Balance Due |

*Work Value = sum of appearance fees + (duration_minutes / 60 × rate_per_hour) for unbilled work  
*Unbilled Value = Work Value where `is_billed = 0`

**Export:** CSV, PDF

---

### Report 6 — Unbilled Work

**Purpose:** All appearances and time entries that have not yet been included in an invoice. The primary input for billing decisions at month-end.

**Data sources:** `appearances` WHERE `is_billed = 0`, `time_entries` WHERE `is_billed = 0` AND `is_billable = 1`; both JOIN `matters`

**Default filter:** All unbilled work, all time (no date cap — unbilled items can be old)

**Filters:**
| Filter | Type |
|---|---|
| Date range | Date picker (work date) |
| Matter | Searchable dropdown |
| Client | Searchable dropdown |
| Work type | Appearances / Time Entries / Both |
| Matter type | All / Litigation / Advisory… |

**Columns:**

| # | Column |
|---|---|
| 1 | Date |
| 2 | Matter |
| 3 | Client |
| 4 | Work Type | Appearance / Time Entry |
| 5 | Description | Hearing type or time entry description |
| 6 | Duration | — for appearances; "2h 30m" for time |
| 7 | Rate | Appearance fee or hourly rate |
| 8 | Value | fee_amount or (minutes/60 × rate) |
| 9 | Days Since Work | Today − work_date |

**Summary footer:** Total unbilled value (appearances + time)

**Action:** "Bill Selected" button — pre-fills the Bill Unbilled Work modal with checked rows. (Phase 2 integration)

**Export:** CSV, PDF

---

### Report 7 — Work In Progress (WIP)

**Purpose:** Aggregated unbilled value per matter. The practitioner's "what do I have in the pipeline" view. Different from Report 6: grouped by matter, not individual work items.

**Data sources:** `appearances` + `time_entries` WHERE `is_billed = 0`, JOIN `matters`

**Default filter:** All active matters with any unbilled work

**Filters:**
| Filter | Type |
|---|---|
| Matter status | Active / All |
| Client | Searchable dropdown |
| Minimum value | Number input (e.g. only show WIP > ₹5,000) |
| Sort by | WIP Value ↓ / Oldest Work ↑ / Matter ↑ |

**Columns:**

| # | Column |
|---|---|
| 1 | Matter Ref |
| 2 | Case Title |
| 3 | Client |
| 4 | Oldest Unbilled Date |
| 5 | Appearances (count unbilled) |
| 6 | Appearance Value |
| 7 | Time Entries (unbilled hours) |
| 8 | Time Value |
| 9 | **Total WIP Value** |
| 10 | Last Invoiced Date |

**Summary footer:** Total WIP across all matters

**Visualisation (Phase 2):** Horizontal bar per matter showing WIP value.

**Export:** CSV, PDF

---

## 6. Export Formats

### 6.1 CSV Export

- Generated entirely client-side (no Tauri command needed)
- Uses `Blob` + Tauri `save` dialog (`dialog.save`) for file picker
- Header row: human-readable column names
- Numbers: plain numeric (not formatted) so spreadsheet can re-aggregate
- Dates: `YYYY-MM-DD` (ISO, sorts correctly in Excel)
- Encoding: UTF-8 with BOM (required for Excel on Windows/Mac to show ₹ correctly)

### 6.2 PDF Export

- Use `window.print()` with a print-specific CSS stylesheet
- Print layout: landscape for wide reports, portrait for narrow
- Header: Report name, filter summary, generated date, advocate name from Profile
- Footer: Page X of Y, "Generated by Memo"
- Tauri `window.print()` triggers the native macOS Print dialog
- User can then "Save as PDF" using macOS's built-in capability

### 6.3 Export Toolbar (UI)

```
[ Run Report ]          [ ↓ Export ▾ ]
                              ├─ Download CSV
                              └─ Print / Save PDF
```

---

## 7. UI Design

### 7.1 ReportsPage (Landing)

```
┌─────────────────────────────────────────────────────────┐
│  Reports                               FY 2025–26 ▾    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ 📄 Invoice Register│  │ ⏰ Outstanding    │            │
│  │ All invoices in   │  │ Aged debtors     │            │
│  │ a period          │  │ report           │            │
│  │ [Run]             │  │ [Run]            │            │
│  └──────────────────┘  └──────────────────┘            │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ 📈 Revenue Summary│  │ 👥 Client Revenue │            │
│  │ Month-by-month   │  │ Top clients by   │            │
│  │ invoiced/collected│  │ revenue          │            │
│  │ [Run]             │  │ [Run]            │            │
│  └──────────────────┘  └──────────────────┘            │
│  ... (3 more cards)                                      │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Report View (after Run)

```
┌─────────────────────────────────────────────────────────┐
│  ← Reports   Invoice Register                           │
├─────────────────────────────────────────────────────────┤
│  [FY 2025-26 ▾]  [Status: All ▾]  [Client: All ▾]      │
│  [Apply]                                  [↓ Export ▾]  │
├─────────────────────────────────────────────────────────┤
│  Summary strip:  Invoices: 34   Total: ₹4,25,000  ...  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │ Invoice No. │ Date │ Matter │ Total │ Status │ … │   │
│  ├──────────────────────────────────────────────────┤   │
│  │ INV-001     │ ...  │ ...    │ ...   │  Paid  │ … │   │
│  │ INV-002     │ ...  │ ...    │ ...   │  Sent  │ … │   │
│  └──────────────────────────────────────────────────┘   │
│  Footer: 34 rows | Total ₹4,25,000 | GST ₹63,814       │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Design Tokens (consistent with existing app)

- Table header: `bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide`
- Row hover: `hover:bg-neutral-50`
- Currency cells: `text-right tabular-nums`
- Status badges: reuse existing `InvoiceStatusBadge` component
- Summary strip: `bg-blue-50 border border-blue-100 rounded-xl` (matches Outstanding Dues page)
- Overdue highlight: `text-red-600` on balance/days columns

---

## 8. SQL Query Patterns

All queries are parameterised (`?` placeholders). Key patterns:

### Amount Paid sub-query (used in Reports 1, 2, 3)
```sql
COALESCE((
  SELECT SUM(p.amount_paid)
  FROM payments p
  WHERE p.invoice_id = i.id
), 0) AS amount_paid,
COALESCE((
  SELECT SUM(p.tds_amount)
  FROM payments p
  WHERE p.invoice_id = i.id
), 0) AS tds_deducted
```

### Ageing bucket (Report 2)
```sql
CASE
  WHEN julianday('now') - julianday(i.due_date) <= 0  THEN 'current'
  WHEN julianday('now') - julianday(i.due_date) <= 30 THEN '0-30'
  WHEN julianday('now') - julianday(i.due_date) <= 60 THEN '31-60'
  WHEN julianday('now') - julianday(i.due_date) <= 90 THEN '61-90'
  ELSE '90+'
END AS ageing_bucket
```

### WIP value (Reports 6, 7)
```sql
-- Appearances
SELECT
  a.matter_id,
  COUNT(*) AS appearance_count,
  SUM(a.fee_amount) AS appearance_value
FROM appearances a
WHERE a.is_billed = 0
  AND a.date BETWEEN ? AND ?
GROUP BY a.matter_id

-- Time entries
SELECT
  t.matter_id,
  SUM(t.duration_minutes) / 60.0 AS hours,
  SUM(t.duration_minutes / 60.0 * t.rate_per_hour) AS time_value
FROM time_entries t
WHERE t.is_billed = 0
  AND t.is_billable = 1
  AND t.date BETWEEN ? AND ?
GROUP BY t.matter_id
```

### Financial year filter
```sql
WHERE i.invoice_date >= ? AND i.invoice_date <= ?
-- params: fyDateRange(fy).from, fyDateRange(fy).to
```

---

## 9. Implementation Order

### Phase 1 — Core Billing Reports (v1.2.0)

Highest accountant value, least query complexity.

| Priority | Report | Rationale |
|---|---|---|
| 1 | **Invoice Register** | GST filing dependency; most-requested by accountants |
| 2 | **Outstanding Invoices** | Replaces the existing `OutstandingDues` page (can be merged) |
| 3 | **Revenue Summary** | Monthly P&L overview; simple aggregation |

Deliverables:
- `ReportsPage` landing
- `ReportShell` + `ReportTable` + `ReportFilters` shared components
- `FinancialYearPicker` component
- CSV export
- PDF via `window.print()`
- `⌘6` shortcut

### Phase 2 — Practice Analytics (v1.3.0)

| Priority | Report |
|---|---|
| 4 | **Unbilled Work** (with "Bill Selected" action) |
| 5 | **Work In Progress** |
| 6 | **Client Revenue** |
| 7 | **Matter Revenue** |

### Phase 3 — Enhancements (v1.4.0+)

- Bar charts on Revenue Summary and WIP (using a lightweight chart library — `recharts` or hand-rolled SVG)
- Dashboard widgets pulling from report engine (replace static dashboard cards)
- "Saved filters" — remember last-used FY per report
- Scheduled PDF export to a folder (for accountant file drops)

---

## 10. Open Questions

| # | Question | Suggested Default |
|---|---|---|
| 1 | Should cancelled invoices be excluded from Revenue Summary by default? | Yes — show toggle |
| 2 | Draft invoices in Invoice Register? | Include with grey "Draft" badge; exclude from revenue totals |
| 3 | Multi-client matters (where `client_name` is in Matter, not Clients table)? | Group by `matters.client_name` string |
| 4 | Outstanding Dues page: migrate into Reports, or keep as a separate sidebar entry? | Keep as sidebar shortcut; Reports version adds ageing + export |
| 5 | WIP: include non-billable time entries? | No — `is_billable = 1` only |
| 6 | TDS net-of-collection display? | Show gross collected + TDS as separate column |

---

*Document owner: Shailesh Mendon*  
*Last updated: 2026-06-04*
