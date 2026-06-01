# Database Schema Documentation

**App:** Memo v1.0.0  
**Database engine:** SQLite  
**Database file:** `~/Library/Application Support/com.memoapp.app/memoapp.db`  
**Last updated:** 2026-05-31

---

## Migration Policy

All schema changes are applied automatically on first launch using safe `ALTER TABLE … ADD COLUMN` statements (the `addIfMissing` pattern). This means:
- Existing data is **never deleted** during an upgrade
- New columns default to `NULL` for existing rows unless a `DEFAULT` is specified
- Backfills (e.g. assigning `ref_number` to old matters) run once automatically

---

## Tables

### `matters`

The central table. Every legal case or engagement is one row.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `ref_number` | INTEGER | App-assigned sequential matter number (#001, #002 …). Backfilled for existing rows on migration. |
| `case_title` | TEXT NOT NULL | e.g. "Siemens vs. Maharashtra — Writ Petition" |
| `client_name` | TEXT NOT NULL | Free text; matched against `clients.name` |
| `client_email` | TEXT | |
| `client_gstin` | TEXT | 15-character GST Identification Number |
| `client_state` | TEXT | Indian state name |
| `court` | TEXT | Court / forum name |
| `matter_number` | TEXT | Court-assigned case number |
| `matter_type` | TEXT NOT NULL | `litigation` \| `advisory` \| `drafting` \| `corporate` \| `other` |
| `status` | TEXT NOT NULL | `active` \| `closed` \| `on-hold` |
| `firm_name` | TEXT | AOR / engaging firm name |
| `firm_email` | TEXT | |
| `firm_gstin` | TEXT | |
| `firm_state` | TEXT | |
| `handler_name` | TEXT | Partner / associate handling the matter |
| `handler_designation` | TEXT | e.g. "Partner", "Senior Associate" |
| `handler_email` | TEXT | |
| `handler_phone` | TEXT | |
| `notes` | TEXT | Free-form notes |
| `invoice_recipient` | TEXT | `firm` \| `client` \| `both` — default billing party |
| `primary_client_contact_id` | TEXT | FK → `contact_persons.id` (soft reference) |
| `primary_firm_contact_id` | TEXT | FK → `contact_persons.id` (soft reference) |
| `created_at` | TEXT NOT NULL | ISO 8601 timestamp |

---

### `clients`

Directory of client organisations or individuals.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `name` | TEXT NOT NULL | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `gstin` | TEXT | |
| `state` | TEXT | |
| `address` | TEXT | |
| `notes` | TEXT | |
| `created_at` | TEXT NOT NULL | |

---

### `firms`

Directory of AOR (Advocates on Record) or engaging law firms.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `name` | TEXT NOT NULL | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `gstin` | TEXT | |
| `state` | TEXT | |
| `address` | TEXT | |
| `notes` | TEXT | |
| `created_at` | TEXT NOT NULL | |

---

### `contact_persons`

Named individuals associated with a client or firm.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `entity_type` | TEXT NOT NULL | `client` \| `firm` |
| `entity_id` | TEXT NOT NULL | ID of the parent client or firm |
| `name` | TEXT NOT NULL | Full name |
| `designation` | TEXT | e.g. "Partner", "General Counsel" |
| `company` | TEXT | Company / firm name (may differ from parent) |
| `email` | TEXT | |
| `phone` | TEXT | |
| `mobile` | TEXT | |
| `address` | TEXT | |
| `notes` | TEXT | |
| `apple_contact_id` | TEXT | Reserved for future Apple Contacts sync |
| `created_at` | TEXT NOT NULL | |
| `updated_at` | TEXT NOT NULL | |

---

### `invoices`

One row per invoice.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `matter_id` | TEXT NOT NULL | FK → `matters.id` (CASCADE DELETE) |
| `invoice_number` | TEXT NOT NULL | e.g. "INV-202605-001" |
| `invoice_date` | TEXT NOT NULL | YYYY-MM-DD |
| `due_date` | TEXT NOT NULL | YYYY-MM-DD |
| `recipient_type` | TEXT NOT NULL | `firm` \| `client` \| `both` (legacy; see `address_mode`) |
| `address_mode` | TEXT | `org_firm` \| `org_client` \| `org_both` \| `contact_firm` \| `contact_client` \| `contact_both` |
| `client_contact_id` | TEXT | FK → `contact_persons.id` for invoice addressing |
| `firm_contact_id` | TEXT | FK → `contact_persons.id` for invoice addressing |
| `subtotal_amount` | REAL NOT NULL | Fees before GST |
| `gst_rate` | REAL NOT NULL | Percentage (0 / 5 / 12 / 18) |
| `cgst` | REAL NOT NULL | Central GST amount |
| `sgst` | REAL NOT NULL | State GST amount |
| `igst` | REAL NOT NULL | Integrated GST amount (inter-state) |
| `total_amount` | REAL NOT NULL | subtotal + all GST |
| `status` | TEXT NOT NULL | `draft` \| `sent` \| `paid` \| `partially_paid` \| `overdue` \| `cancelled` |
| `notes` | TEXT | |
| `pdf_path` | TEXT | Reserved (not currently used) |
| `line_items_data` | TEXT | JSON array of `LineItem` objects |

**`LineItem` JSON structure:**
```json
{
  "description": "15 Apr 26 — Hearing — Bombay High Court",
  "amount": 20000,
  "type": "appearance" | "time" | "expense" | "other",
  "sourceId": "<appearance_id or time_entry_id>"
}
```

---

### `payments`

Payments received against an invoice.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `invoice_id` | TEXT NOT NULL | FK → `invoices.id` (CASCADE DELETE) |
| `payment_date` | TEXT NOT NULL | YYYY-MM-DD |
| `amount_paid` | REAL NOT NULL | Cash / bank amount received |
| `mode` | TEXT NOT NULL | `NEFT` \| `RTGS` \| `IMPS` \| `UPI` \| `cheque` \| `cash` \| `other` |
| `notes` | TEXT | |
| `tds_amount` | REAL | TDS deducted by payer |
| `tds_rate` | REAL | TDS rate % applied |
| `tds_section` | TEXT | e.g. "194J(b)", "194C(1)", "custom" |

**TDS reconciliation:** An invoice is considered paid when `SUM(amount_paid) + SUM(tds_amount) >= total_amount`.

---

### `advance_payments`

Advance / retainer fees received against a matter (not a specific invoice).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `matter_id` | TEXT NOT NULL | FK → `matters.id` (CASCADE DELETE) |
| `payment_date` | TEXT NOT NULL | YYYY-MM-DD |
| `amount` | REAL NOT NULL | |
| `mode` | TEXT NOT NULL | Same values as `payments.mode` |
| `notes` | TEXT | |
| `created_at` | TEXT NOT NULL | |

---

### `appearances`

Court appearances and hearings logged per matter.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `matter_id` | TEXT NOT NULL | FK → `matters.id` (CASCADE DELETE) |
| `date` | TEXT NOT NULL | YYYY-MM-DD |
| `court` | TEXT | Court / forum name |
| `hearing_type` | TEXT NOT NULL | `mention` \| `urgent_mention` \| `hearing` \| `adjournment` \| `circulation` \| `arguments` \| `evidence` \| `judgement` \| `admission` \| `caveat` \| `board` \| `conference` \| `drafting` \| `research` \| `advice` \| `retainer` \| `filing` \| `other` |
| `fee_amount` | REAL NOT NULL | Fee for this appearance |
| `is_billed` | INTEGER NOT NULL | 0 = unbilled, 1 = included in an invoice |
| `notes` | TEXT | |

---

### `time_entries`

Billable and non-billable time entries per matter.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `matter_id` | TEXT NOT NULL | FK → `matters.id` (CASCADE DELETE) |
| `date` | TEXT NOT NULL | YYYY-MM-DD |
| `description` | TEXT | Work description |
| `duration_minutes` | INTEGER NOT NULL | Duration in minutes |
| `rate_per_hour` | REAL NOT NULL | Hourly rate in INR |
| `is_billable` | INTEGER NOT NULL | 0 = non-billable, 1 = billable |
| `is_billed` | INTEGER NOT NULL | 0 = not yet invoiced, 1 = included in an invoice |

**Computed billing amount:** `(duration_minutes / 60) × rate_per_hour`

---

### `matter_parties`

Parties represented in a matter (petitioner, respondent, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID v4 |
| `matter_id` | TEXT NOT NULL | FK → `matters.id` (CASCADE DELETE) |
| `party_type` | TEXT NOT NULL | e.g. "Petitioner", "Respondent", "Applicant" |
| `party_number` | INTEGER | e.g. 2 for "Respondent No. 2" |
| `party_name` | TEXT | Name of the party |
| `notes` | TEXT | |

---

### `settings`

Key-value store for application configuration.

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | Setting identifier |
| `value` | TEXT NOT NULL | JSON-serialised value |

**Known keys:**

| Key | Value type | Description |
|---|---|---|
| `profile` | JSON object (`Profile`) | Advocate/firm profile, bank details, invoice preferences |
| `lock` | JSON object (`AppLock`) | Hashed PIN and salt for app lock |

---

## Entity Relationships

```
clients ──┐
           ├── contact_persons (entity_type='client')
firms   ──┘    contact_persons (entity_type='firm')

matters ──┬── time_entries
           ├── appearances
           ├── invoices ──── payments
           ├── advance_payments
           ├── matter_parties
           └── (references contact_persons via primary_*_contact_id)

settings (standalone key-value)
```

---

## Backup Format

The JSON backup file contains all 11 tables:

```json
{
  "version": 1,
  "exportedAt": "2026-05-31T10:00:00.000Z",
  "appVersion": "1.0.0",
  "counts": { "matters": 42, "invoices": 156, ... },
  "data": {
    "settings": [ ... ],
    "clients": [ ... ],
    "firms": [ ... ],
    "matters": [ ... ],
    "matter_parties": [ ... ],
    "contact_persons": [ ... ],
    "appearances": [ ... ],
    "time_entries": [ ... ],
    "invoices": [ ... ],
    "payments": [ ... ],
    "advance_payments": [ ... ]
  }
}
```
