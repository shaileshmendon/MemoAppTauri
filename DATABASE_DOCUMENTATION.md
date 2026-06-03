# Memo App — Database Documentation

> SQLite via `tauri-plugin-sql`  
> DB file: `memoapp.db` (platform data directory)  
> Last updated: 2026-06-03

---

## Schema Overview

```
clients ──────────────────────────────────────────────────────────────────────┐
  └─ contact_persons (entity_type='client')                                   │
                                                                               │
firms ────────────────────────────────────────────────────────────────────────┤
  └─ contact_persons (entity_type='firm')                                     │
                                                                               │
matters ──────────────────────────────────────────────────────────────────────┘
  ├─ time_entries
  ├─ appearances
  ├─ matter_parties
  ├─ advance_payments
  └─ invoices
       └─ payments

work_captures                 ← staging table; matter_id nullable (inbox)
settings                      ← key-value store (profile, fee_schedule, app_lock)
```

---

## Tables

### `matters`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `ref_number` | INTEGER | Auto-assigned sequential number (#001…) |
| `case_title` | TEXT NOT NULL | |
| `client_name` | TEXT NOT NULL | Denormalised for display performance |
| `client_email` | TEXT | |
| `client_gstin` | TEXT | |
| `client_state` | TEXT | Used for GST (intra/inter-state) |
| `court` | TEXT | |
| `matter_number` | TEXT | Court-assigned number |
| `matter_type` | TEXT | `litigation\|advisory\|drafting\|corporate\|other` |
| `status` | TEXT | `active\|closed\|on-hold` |
| `firm_name` | TEXT | AOR / instructing firm |
| `firm_email` | TEXT | |
| `firm_gstin` | TEXT | |
| `firm_state` | TEXT | Used for GST |
| `handler_name` | TEXT | Partner / associate handling |
| `handler_designation` | TEXT | |
| `handler_email` | TEXT | |
| `handler_phone` | TEXT | |
| `notes` | TEXT | |
| `invoice_recipient` | TEXT | `client\|firm\|both` default |
| `primary_client_contact_id` | TEXT | FK → contact_persons.id |
| `primary_firm_contact_id` | TEXT | FK → contact_persons.id |
| `created_at` | TEXT | ISO timestamp |

**Migrations applied:**
- `handler_*` columns added via `addIfMissing` for users with pre-handler DBs
- `invoice_recipient`, `ref_number`, `primary_*_contact_id` added the same way
- `ref_number` backfill: existing rows assigned sequential numbers in `created_at` order

---

### `time_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `matter_id` | TEXT NOT NULL | FK → matters(id) ON DELETE CASCADE |
| `date` | TEXT | YYYY-MM-DD |
| `description` | TEXT | |
| `duration_minutes` | INTEGER | 0+ |
| `rate_per_hour` | REAL | Pre-filled from fee schedule if set |
| `is_billable` | INTEGER | 0\|1 |
| `is_billed` | INTEGER | 0 = unbilled · 1 = included in a sent invoice |

**`is_billed` lifecycle:** Set to 1 by `markTimeEntriesBilled()` when an invoice is marked Sent. NOT set during draft invoice creation.

---

### `appearances`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `matter_id` | TEXT NOT NULL | FK → matters(id) ON DELETE CASCADE |
| `date` | TEXT | YYYY-MM-DD |
| `court` | TEXT | |
| `hearing_type` | TEXT | See HearingType enum |
| `fee_amount` | REAL | Pre-filled from fee schedule if set |
| `is_billed` | INTEGER | 0\|1 |
| `notes` | TEXT | |

**HearingType values:**  
`mention`, `urgent_mention`, `hearing`, `adjournment`, `circulation`, `arguments`, `evidence`, `judgement`, `admission`, `caveat`, `board`, `conference`, `drafting`, `research`, `advice`, `retainer`, `filing`, `other`

---

### `invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `matter_id` | TEXT NOT NULL | FK → matters(id) ON DELETE CASCADE |
| `invoice_number` | TEXT NOT NULL | Format: `{prefix}-{YYYYMM}-{NNN}` |
| `invoice_date` | TEXT | YYYY-MM-DD |
| `due_date` | TEXT | YYYY-MM-DD |
| `recipient_type` | TEXT | `client\|firm\|both` |
| `address_mode` | TEXT | `org_firm\|org_client\|org_both\|contact_firm\|contact_client\|contact_both` |
| `client_contact_id` | TEXT | FK → contact_persons.id |
| `firm_contact_id` | TEXT | FK → contact_persons.id |
| `subtotal_amount` | REAL | |
| `gst_rate` | REAL | % applied (0/5/12/18) |
| `cgst` | REAL | |
| `sgst` | REAL | |
| `igst` | REAL | |
| `total_amount` | REAL | subtotal + cgst + sgst + igst |
| `status` | TEXT | `draft\|sent\|paid\|partially_paid\|overdue\|cancelled` |
| `notes` | TEXT | |
| `pdf_path` | TEXT | Local path of generated PDF |
| `line_items_data` | TEXT | JSON array of `LineItem[]` |

**Unique constraint:** `CREATE UNIQUE INDEX idx_invoices_invoice_number ON invoices (invoice_number)`  
Applied in migration with duplicate remediation (appends `-DUP-{n}` to all but oldest duplicate).

**Effective status:** `status` in DB may be `sent` but `effectiveStatus()` returns `overdue` if today > due_date. No DB writes on read.

---

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `invoice_id` | TEXT NOT NULL | FK → invoices(id) ON DELETE CASCADE |
| `payment_date` | TEXT | YYYY-MM-DD |
| `amount_paid` | REAL | |
| `mode` | TEXT | `NEFT\|RTGS\|IMPS\|UPI\|cheque\|cash\|other` |
| `notes` | TEXT | |
| `tds_amount` | REAL | Optional TDS deducted |
| `tds_rate` | REAL | e.g. 10.0 |
| `tds_section` | TEXT | e.g. `194J(b)` |

---

### `clients` / `firms`

| Column | Type |
|---|---|
| `id` | TEXT PK |
| `name` | TEXT NOT NULL |
| `email` | TEXT |
| `phone` | TEXT |
| `gstin` | TEXT |
| `state` | TEXT |
| `address` | TEXT |
| `notes` | TEXT |
| `created_at` | TEXT |

---

### `contact_persons`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `entity_type` | TEXT | `client\|firm` |
| `entity_id` | TEXT | FK → clients.id or firms.id |
| `name` | TEXT NOT NULL | |
| `designation` | TEXT | |
| `company` | TEXT | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `mobile` | TEXT | |
| `address` | TEXT | |
| `notes` | TEXT | |
| `apple_contact_id` | TEXT | Apple Contacts identifier |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

---

### `matter_parties`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `matter_id` | TEXT NOT NULL | FK → matters(id) ON DELETE CASCADE |
| `party_type` | TEXT | e.g. "Respondent", "Defendant" (free text) |
| `party_number` | INTEGER | e.g. 2 → "Respondent No. 2" |
| `party_name` | TEXT | e.g. "ABC Corporation" |
| `notes` | TEXT | |

---

### `advance_payments`

| Column | Type |
|---|---|
| `id` | TEXT PK |
| `matter_id` | TEXT NOT NULL |
| `payment_date` | TEXT |
| `amount` | REAL |
| `mode` | TEXT |
| `notes` | TEXT |
| `created_at` | TEXT |

---

### `work_captures` ← NEW in v1.1.0

Staging table for Quick Capture entries. Items with `matter_id IS NULL` are "in the inbox." Items with `matter_id IS NOT NULL` have been converted and are retained for audit.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `captured_at` | TEXT NOT NULL | ISO timestamp — when user pressed Save |
| `work_date` | TEXT NOT NULL | YYYY-MM-DD — date the work actually happened |
| `work_type` | TEXT NOT NULL | `appearance\|time` |
| `description` | TEXT | |
| `hearing_type` | TEXT | Populated when `work_type = 'appearance'` |
| `court` | TEXT | |
| `fee_amount` | REAL DEFAULT 0 | |
| `duration_minutes` | INTEGER DEFAULT 0 | Populated when `work_type = 'time'` |
| `rate_per_hour` | REAL DEFAULT 0 | |
| `is_billable` | INTEGER DEFAULT 1 | |
| `matter_id` | TEXT | NULL = inbox; set when assigned |
| `assigned_at` | TEXT | ISO timestamp; set when assigned |
| `converted_id` | TEXT | ID of created `appearance` or `time_entry` |

**Migration SQL (run once in `migrate()`):**
```sql
CREATE TABLE IF NOT EXISTS work_captures (
  id               TEXT PRIMARY KEY,
  captured_at      TEXT NOT NULL,
  work_date        TEXT NOT NULL,
  work_type        TEXT NOT NULL,
  description      TEXT,
  hearing_type     TEXT,
  court            TEXT,
  fee_amount       REAL NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  rate_per_hour    REAL NOT NULL DEFAULT 0,
  is_billable      INTEGER NOT NULL DEFAULT 1,
  matter_id        TEXT,
  assigned_at      TEXT,
  converted_id     TEXT
);
```

**Risk:** None — new table, zero impact on existing data.  
**Rollback:** `DROP TABLE IF EXISTS work_captures;`

---

### `settings`

Key-value store. Keys:

| Key | Value format | Description |
|---|---|---|
| `profile` | JSON string | `Profile` object |
| `fee_schedule` | JSON string | `FeeSchedule` object — NEW in v1.1.0 |
| `app_lock` | JSON string | `{ username, passwordHash }` |

**`fee_schedule` JSON structure:**
```json
{
  "mention": 5000,
  "urgent_mention": 10000,
  "hearing": 15000,
  "adjournment": 3000,
  "circulation": 0,
  "arguments": 20000,
  "evidence": 15000,
  "judgement": 5000,
  "admission": 8000,
  "caveat": 5000,
  "board": 15000,
  "conference": 5000,
  "drafting": 0,
  "research": 0,
  "advice": 5000,
  "retainer": 0,
  "filing": 2000,
  "other": 0,
  "hourly_rate": 1500
}
```

Zero values mean "no auto-fill for this type."

---

## Migration Strategy

The app uses an **addIfMissing pattern** — all schema changes are idempotent:

```ts
const addIfMissing = async (table, column, type) => {
  try { await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`); }
  catch { /* already exists — safe to ignore */ }
};
```

**Rules for new migrations:**
1. Use `CREATE TABLE IF NOT EXISTS` for new tables
2. Use `addIfMissing` for new columns on existing tables
3. Never DROP or RENAME columns (SQLite limitation in older versions)
4. For UNIQUE constraints: `CREATE UNIQUE INDEX IF NOT EXISTS`
5. Detect and remediate existing duplicates before adding unique indexes

---

## DB Function Reference (`src/db.ts`)

### Matters
- `fetchMatters()` → `Matter[]`
- `fetchMattersByClientName(name)` → `Matter[]`
- `fetchMattersByFirmName(name)` → `Matter[]`
- `fetchMatter(id)` → `Matter | null`
- `insertMatter(m)` → `Matter` (auto-assigns `ref_number`)
- `updateMatter(m)` → `void`
- `deleteMatter(id)` → `void`

### Time Entries
- `fetchTimeEntries(matterId)` → `TimeEntry[]`
- `fetchAllBillableTimeEntries(matterId)` → unbilled billable entries
- `markTimeEntriesBilled(ids[])` → `void`
- `insertTimeEntry(t)` / `updateTimeEntry(t)` / `deleteTimeEntry(id)`

### Appearances
- `fetchAppearances(matterId)` → `Appearance[]`
- `fetchAllBillableAppearances(matterId)` → entries with `fee_amount > 0`
- `markAppearancesBilled(ids[])` → `void`
- `insertAppearance(a)` / `updateAppearance(a)` / `deleteAppearance(id)`

### Invoices
- `fetchInvoices(matterId)` → `Invoice[]` (with effective status applied)
- `fetchAllUnpaidInvoices()` → `UnpaidInvoiceRow[]` (with effective status applied)
- `nextInvoiceNumber(prefix?, date?)` → `string` (suggestion only, not saved)
- `insertInvoice(inv)` / `updateInvoice(inv)` / `deleteInvoice(id)`

### Work Captures ← NEW
- `insertWorkCapture(w)` → `void`
- `fetchInboxCaptures()` → `WorkCapture[]` (matter_id IS NULL)
- `fetchInboxCount()` → `number` (for sidebar badge)
- `updateWorkCapture(w)` → `void`
- `deleteWorkCapture(id)` → `void`
- `assignWorkCapture(capture, matterId)` → `string` (converted_id)

### Fee Schedule ← NEW
- `loadFeeSchedule()` → `FeeSchedule` (returns DEFAULT_FEE_SCHEDULE if not set)
- `saveFeeSchedule(schedule)` → `void`

### Profile
- `loadProfile()` → `Profile | null`
- `saveProfile(p)` → `void`
- `isProfileSetup()` → `boolean`

### Clients / Firms
- Standard CRUD: `fetchClients()`, `insertClient()`, `updateClient()`, `deleteClient()` (same pattern for firms)

### Contact Persons
- `fetchContactPersons(entityType, entityId)` → `ContactPerson[]`
- `fetchContactPersonById(id)` → `ContactPerson | null`
- `insertContactPerson()` / `updateContactPerson()` / `deleteContactPerson(id)`

### Payments / Advance Payments
- Standard CRUD per invoice / matter

### Backup
- `exportAllData()` → `string` (JSON)
- `importAllData(json)` → `void`

### Lock
- `getLock()` / `setLock(username, password)` / `removeLock()` / `verifyLock(username, password)`
