# Feature Catalog — Memo v1.0.0

**Last Updated:** 2026-06-02

Every implemented feature is documented here with its purpose, workflow, screens, data model, and dependencies.

---

## F-01 · Matter Management

**Status:** Implemented  
**Purpose:** Central record for each legal case or engagement. Every billing workflow begins here.

### User Workflow
1. Click + in the Matters panel (left sidebar)
2. Type case title in the sticky header input (required, always visible)
3. Search for an existing client using the combobox, or type a new client name
4. If typing a new client name, a "Save Client" prompt appears offering to add to the directory
5. Optionally add AOR/Firm details using the same pattern
6. Set default invoice recipient: AOR/Firm only / Client only / Both
7. Add handler (advocate) details, notes
8. Click Save Matter (also available at the bottom of the form)

### Key Screens
- `MatterList.tsx` — left-panel list with search, grouping, status dots, ref numbers
- `MatterForm.tsx` — create/edit form with sticky case title, inline entity pickers
- `MatterDetail.tsx` — overview with stats (time/appearances/invoices), parties, handler info
- `MatterTabs.tsx` — tab navigation: Overview / Time / Appearances / Invoices

### Auto-assigned Reference Number
- Format: `#001`, `#002`, `#003` … (zero-padded to 3 digits, grows beyond 999)
- Assigned at insert time: `SELECT COALESCE(MAX(ref_number), 0) + 1 FROM matters`
- Never changes; never reused even after deletion
- Existing matters backfilled in `created_at` ascending order on first migration

### Database Tables
- `matters` (primary)
- `matter_parties` (parties represented)

### APIs
- `insertMatter(m)` → returns `Matter` with `ref_number` populated
- `updateMatter(m)` → void
- `fetchMatters()` → `Matter[]` ordered by `created_at DESC`
- `fetchMatter(id)` → `Matter | null`
- `deleteMatter(id)` → CASCADE deletes all children

### Dependencies
- `clients` and `firms` tables (soft reference by name string, not FK)
- `contact_persons` (for primary contact dropdowns)

---

## F-02 · Client Directory

**Status:** Implemented  
**Purpose:** Reusable client records that can be linked to multiple matters.

### User Workflow
1. Navigate to Clients in sidebar
2. Click + to create new, or click existing client to view
3. Fill details manually or click "From Contacts" to import from macOS Contacts
4. Save

### Detail View Sections
1. Contact fields (email, phone, state, GSTIN, address, notes)
2. **Linked Matters** — auto-loaded from `matters` table by matching `client_name`
3. **Contact Persons** — named individuals within this client organisation

### Key Screens
- `ContactList.tsx` (type="client") — list, detail, form
- `ContactPersonsPanel.tsx` — embedded contact persons management

### Database Tables
- `clients`
- `contact_persons` (entity_type='client')

### APIs
- `fetchClients()`, `insertClient()`, `updateClient()`, `deleteClient()`
- `fetchMattersByClientName(name)` — for Linked Matters panel

---

## F-03 · AOR / Firm Directory

**Status:** Implemented  
**Purpose:** Reusable records for Advocates on Record and engaging law firms.

Functionally identical to the Client Directory. The key distinction:
- Clients are the end party the advocate represents
- AOR/Firms are the instructing party (another law firm, or an AOR who briefed the advocate)
- Invoices can be addressed to either or both

### Key Screens
- `ContactList.tsx` (type="firm")

### Database Tables
- `firms`
- `contact_persons` (entity_type='firm')

### APIs
- `fetchFirms()`, `insertFirm()`, `updateFirm()`, `deleteFirm()`
- `fetchMattersByFirmName(name)`

---

## F-04 · Contact Persons

**Status:** Implemented  
**Purpose:** Named individuals within a client or firm who can be designated as invoice recipients and primary contacts on matters.

### User Workflow
1. Open a Client or AOR/Firm record
2. Scroll to "Contact Persons" section
3. Click Add
4. Fill details manually or click "From Contacts" to import
5. Save

### Fields Per Contact Person
| Field | Notes |
|---|---|
| Name | Required |
| Designation | e.g. "Partner", "General Counsel" |
| Company | May differ from parent entity |
| Email | |
| Phone | Office line |
| Mobile | Mobile number |
| Address | Full postal address (used in invoice header for Options D/E/F) |
| Notes | |
| Apple Contact ID | Reserved for future Contacts sync |

### Key Screens
- `ContactPersonsPanel.tsx` — embedded in ContactDetail

### Database Tables
- `contact_persons`

### APIs
- `fetchContactPersons(entityType, entityId)`
- `insertContactPerson()`, `updateContactPerson()`, `deleteContactPerson()`

---

## F-05 · macOS Contacts Import

**Status:** Implemented  
**Purpose:** Import contact details from the macOS Contacts app to eliminate manual data entry.

### Technical Implementation
- Rust command `search_contacts` in `src-tauri/src/lib.rs`
- Runs `osascript -l JavaScript -e <JXA_script>` in a background thread (`spawn_blocking`)
- JXA makes two `app.people.whose()` queries (by name, by organisation)
- Returns up to 40 results as JSON
- Parsing happens in Rust; `Vec<MacContact>` returned to TypeScript

### JXA Search Logic
```javascript
app.people.whose({ name: { _contains: query } })         // search by name
app.people.whose({ organization: { _contains: query } }) // search by org
```
Results merged; duplicates removed by name key.

### macOS Permission
- `NSContactsUsageDescription` in `src-tauri/Info.plist`
- TCC prompt attributed to Memo (not osascript) on modern macOS
- User grants once; stored in System Settings → Privacy & Security → Contacts

### Available in
- Client form
- Firm form  
- Contact Person form

### Fields Imported
| Contacts Field | → App Field |
|---|---|
| Full name | Name |
| Job title | Designation |
| Organization | Company |
| First email | Email |
| First phone | Phone |
| Second phone | Mobile |
| Street + City + Postal + Country | Address (combined) |
| State | State (matched to INDIAN_STATES list including abbreviations) |

### Key Screens
- `ContactPickerModal` (inline in `ContactList.tsx`)
- `ContactPickerModal` (inline in `ContactPersonsPanel.tsx`)
- `EntityPicker` + "From Contacts" button in `MatterForm.tsx`

---

## F-06 · Appearances Tracking

**Status:** Implemented  
**Purpose:** Log court appearances with hearing type and fee for billing purposes.

### Hearing Types
**Court appearances:** mention, urgent_mention, hearing, adjournment, circulation, arguments, evidence, judgement, admission, caveat, board  
**Professional work:** conference, drafting, research, advice, retainer, filing, other

### Workflow
1. Open matter → Appearances tab
2. Click + Add Appearance
3. Enter: date (date picker), court name, hearing type (dropdown), fee amount (₹), notes
4. Save

### Billing Integration
- `is_billed = 0` — unbilled; appears in New Invoice form
- `is_billed = 1` — set when included in a Sent invoice; shown with "Billed" badge
- There is no unmark-as-billed UI (intentional: invoices are accounting records)

### Key Screens
- `Appearances.tsx`

### Database Tables
- `appearances`

### APIs
- `fetchAppearances(matterId)`
- `fetchAllBillableAppearances(matterId)` — returns all (billed + unbilled) for invoice form
- `markAppearancesBilled(ids[])`
- `insertAppearance()`, `updateAppearance()`, `deleteAppearance()`

---

## F-07 · Time Entry Tracking

**Status:** Implemented  
**Purpose:** Log billable and non-billable time with duration and hourly rate.

### Computed Amount
```
amount = (duration_minutes / 60) × rate_per_hour
```
Shown inline on each row; recalculated live when editing.

### Workflow
1. Open matter → Time tab
2. Click + Add Entry
3. Enter: date, description, duration (hours/minutes), rate per hour, billable toggle
4. Save

### Key Screens
- `TimeEntries.tsx`

### Database Tables
- `time_entries`

### APIs
- `fetchTimeEntries(matterId)`
- `fetchAllBillableTimeEntries(matterId)`
- `markTimeEntriesBilled(ids[])`
- `insertTimeEntry()`, `updateTimeEntry()`, `deleteTimeEntry()`

---

## F-08 · Invoice Generation

**Status:** Implemented  
**Purpose:** Generate GST-compliant PDF invoices from logged work.

### Invoice Creation Workflow
1. Open matter → Invoices tab → New Invoice
2. Set: invoice number (auto-filled from prefix), invoice date, due date, GST rate
3. Choose addressing option (see F-09)
4. Select unbilled work items (pre-selected by default)
5. Add optional custom line items
6. Add notes
7. Save as Draft or Save as Sent

### GST Calculation
```
if firm_state == client_state (intra-state):
    CGST = subtotal × (rate / 2 / 100)
    SGST = subtotal × (rate / 2 / 100)
    IGST = 0
else (inter-state):
    CGST = 0
    SGST = 0
    IGST = subtotal × (rate / 100)

total = subtotal + CGST + SGST + IGST
```

### Supported GST Rates
- 0% (exempt / composition dealers)
- 5%
- 12%
- 18% (standard for legal services)

### Invoice Statuses
| Status | Description |
|---|---|
| `draft` | Created but not sent; work items NOT marked as billed |
| `sent` | Issued to client; work items marked as billed |
| `paid` | Fully settled (cash + TDS = total) |
| `partially_paid` | Some payment received but genuine shortfall remains |
| `overdue` | `due_date < today` and unpaid |
| `cancelled` | Voided |

### PDF Export
- Triggers: Download (↓) button on expanded invoice row
- Process: `@react-pdf/renderer` renders `InvoicePDF` React component → Blob → `tauri-plugin-dialog.save()` → `tauri-plugin-fs.writeFile()`
- Default filename: `{invoice_number}.pdf`

### Key Screens
- `Invoices.tsx` (InvoiceForm, InvoiceRow, PaymentForm)
- `InvoicePDF.tsx` (PDF templates)

### Database Tables
- `invoices`, `appearances` (is_billed update), `time_entries` (is_billed update)

### Dependencies
- `@react-pdf/renderer`
- `tauri-plugin-dialog` (`dialog:allow-save`)
- `tauri-plugin-fs` (`fs:allow-write-file`)

---

## F-09 · Invoice Addressing (Six Options)

**Status:** Implemented  
**Purpose:** Address the invoice to the appropriate party/person based on the billing relationship.

| Option | Code | Addressed To | PDF Shows |
|---|---|---|---|
| A | `org_firm` | AOR/Firm organisation | Firm name, GSTIN, state, email |
| B | `org_client` | Client organisation | Client name, GSTIN, state, email |
| C | `org_both` | Both organisations | Both columns |
| D | `contact_firm` | Named person at AOR/Firm | Person name, designation, firm name, email, address |
| E | `contact_client` | Named person at Client | Person name, designation, client name, email, address |
| F | `contact_both` | Named persons at both | Both person columns |

Options D/E/F require contact persons to be set up on the relevant entity. If no contact persons exist, those options are greyed out with a tooltip.

### Contact Selection
When D/E/F is selected, a dropdown appears:
- "AOR/Firm Contact Person" dropdown (from `contact_persons` where entity=firm)
- "Client Contact Person" dropdown (from `contact_persons` where entity=client)
- Pre-filled from `matter.primary_firm_contact_id` / `matter.primary_client_contact_id`

### PDF Backward Compatibility
Older invoices (without `address_mode`) fall back to rendering based on `recipient_type` (firm/client/both).

---

## F-10 · Invoice Templates

**Status:** Implemented  
**Purpose:** Professional PDF invoice design.

### Three Templates

**Modern** (`invoiceTemplate = "modern"`)
- Coloured header band (customisable accent colour)
- Helvetica font
- Two-column Bill To section
- Table with alternating row shading
- Blue (or custom colour) total row

**Classic** (`invoiceTemplate = "classic"`)
- Times-Roman letterhead style
- Traditional legal document appearance
- Black-and-white
- Bordered sections

**Minimal** (`invoiceTemplate = "minimal"`)
- Clean, spacious two-column layout
- Minimal borders
- Invoice details in the right column of the Bill To row
- Modern sans-serif

### All Templates Support
| Toggle | Default |
|---|---|
| GST breakdown (CGST/SGST/IGST rows) | On |
| Bank details section | On |
| Signature line | On |
| Matter information (case title, matter no.) | On |
| Header note | Empty |
| Footer note | Empty |
| Custom fields (label:value pairs) | Empty |
| Accent colour | `#1e40af` (blue) |

### Invoice Designer
Live preview in Settings → Invoice Designer. Changes visible in real-time via debounced `pdf().toBlob()` → iframe rendering.

### PDF Limitations
- Only built-in fonts render correctly: Helvetica, Times-Roman, Courier (and their Bold/Italic variants)
- The ₹ symbol is not available in built-in PDF fonts — "Rs." is used instead
- No custom fonts without adding font registration to `@react-pdf/renderer`

---

## F-11 · Payment Recording

**Status:** Implemented  
**Purpose:** Record cash received against invoices and advance payments per matter.

### Inline Payment (from Invoices tab)
1. Expand invoice row
2. Click + Record Payment
3. Enter: date, amount, payment mode
4. Save

### Two-Column Record Payment Screen (from sidebar)
- Left panel: search bar + list of all matters with unpaid invoices
- Right panel: payment form for selected item
- Also supports advance payments (retainers)

### Payment Modes
`NEFT | RTGS | IMPS | UPI | cheque | cash | other`

### Key Screens
- `RecordPayment.tsx`
- `Invoices.tsx` (inline PaymentForm)
- `OutstandingDues.tsx` (inline payment)

### Database Tables
- `payments`
- `advance_payments`

---

## F-12 · TDS Reconciliation

**Status:** Implemented  
**Purpose:** Correctly handle Tax Deducted at Source by payers, distinguishing legitimate deductions from genuine payment shortfalls.

### Background
Corporate clients in India are legally required to deduct TDS at 10% on advocate fees (Section 194J(b)) before paying. This means an advocate invoicing ₹1,00,000 receives only ₹90,000 in cash; the ₹10,000 is credited via Form 16A.

### Supported TDS Sections
| Section | Rate | Application |
|---|---|---|
| 194J(b) | 10% | Professional fees — advocate, doctor |
| 194J(a) | 2% | Technical services |
| 194C(1) | 1% | Contractor — individual / HUF |
| 194C(2) | 2% | Contractor — company / firm |
| custom | user-defined | Any other rate |

### Settlement Calculation
```
total_settled = SUM(payments.amount_paid) + SUM(payments.tds_amount)

if total_settled >= invoice.total_amount → PAID (green banner)
if cash < total but cash + expected_tds >= total → TDS MISMATCH (amber banner)
if genuine shortfall → PARTIALLY PAID (red banner)
```

### UI
- Toggle to enable TDS on each payment
- Section dropdown (auto-fills rate)
- Amount field with "Auto-calculate" button
- Reconciliation Banner shows current status

---

## F-13 · Outstanding Dues Dashboard

**Status:** Implemented  
**Purpose:** Cross-matter view of all unpaid invoices for daily collection tracking.

### Data Shown
- Summary strip: total outstanding amount, total TDS
- Per invoice: matter name, invoice number, due date, total, paid, TDS deducted, balance
- Overdue detection: `due_date < today && status != paid`

### Inline Payment Recording
Payment can be recorded directly from this screen without navigating to the matter.

### Key Screens
- `OutstandingDues.tsx`

### Database Tables
- `invoices`, `payments`, `matters` (joined via `fetchAllUnpaidInvoices()`)

---

## F-14 · Advance Payments

**Status:** Implemented  
**Purpose:** Record retainer fees or advance payments not tied to a specific invoice.

### Key Screens
- `RecordPayment.tsx` — "Record Advance" button on each matter row

### Database Tables
- `advance_payments`

### APIs
- `insertAdvancePayment()`, `fetchAdvancePayments()`, `deleteAdvancePayment()`

---

## F-15 · Invoice Designer

**Status:** Implemented  
**Purpose:** Live customisation of invoice templates with real-time PDF preview.

### Controls
- Template selector (Modern / Classic / Minimal) with thumbnail previews
- Accent colour picker (8 preset swatches + hex input)
- Toggles: GST breakdown, bank details, signature, matter info
- Header note (text)
- Footer note (text)
- Custom fields (up to N label:value pairs)

### Live Preview
- 400ms debounced render
- Uses sample invoice/matter data (hardcoded in `InvoiceDesigner.tsx`)
- Rendered as `pdf().toBlob()` → `URL.createObjectURL()` → `<iframe>`
- Blob URLs are revoked on component unmount

### Saving
- Saved to `profile.invoiceCustomization` in `settings` table
- Applied to all subsequent PDF exports

### Key Screens
- `InvoiceDesigner.tsx` (Settings → Invoice Designer)

---

## F-16 · Backup & Restore

**Status:** Implemented  
**Purpose:** Export full database to JSON; import and restore from backup.

### Export
1. Settings → Backup & Restore → Export Backup
2. Native Save dialog (`tauri-plugin-dialog`)
3. Default filename: `MemoApp-backup-YYYY-MM-DD.json`
4. Writes JSON string via `tauri-plugin-fs`

### Backup File Format
```json
{
  "version": 1,
  "exportedAt": "2026-06-02T10:00:00.000Z",
  "appVersion": "1.0.0",
  "counts": { "matters": 42, "invoices": 156 },
  "data": {
    "settings": [...], "clients": [...], "firms": [...],
    "matters": [...], "matter_parties": [...], "contact_persons": [...],
    "appearances": [...], "time_entries": [...],
    "invoices": [...], "payments": [...], "advance_payments": [...]
  }
}
```

### Import / Restore
1. Settings → Backup & Restore → Choose Backup File
2. Select `.json` file via native Open dialog
3. Preview shown: validity check, export date, record counts
4. Click Restore → second confirmation dialog
5. All tables deleted (reverse-dependency order), all rows re-inserted
6. App reloads

### Schema Forward-compatibility
Import uses column names from the JSON keys to build `INSERT OR REPLACE` statements. Missing columns (from older backups) are simply omitted — existing columns restore correctly.

### Database Tables
All 11 tables included.

### Permissions Required
- `dialog:allow-save`, `dialog:allow-open`
- `fs:allow-write-text-file`, `fs:allow-read-text-file`

---

## F-17 · App Lock

**Status:** Implemented  
**Purpose:** PIN protection for sensitive client and billing data.

### Setup
1. Settings → Security & Lock → Set App Lock
2. Enter PIN (any length)
3. Confirm PIN
4. Enable Lock

### Lock Behaviour
- Lock screen shown on every app launch when lock is enabled
- Manual lock via 🔒 icon in sidebar footer
- Correct PIN → `setUnlocked(true)` in memory; app renders
- Wrong PIN → error message shown; no lockout timer (no brute-force protection)

### Technical Implementation
- `SHA-256(pin)` computed via Web Crypto API
- Hash stored in `settings` table as hex string (key: `lock`)
- Session state: `unlocked: boolean` in `App.tsx`; resets on every restart
- No salt (acceptable for single-user, personal-device application)

### Key Screens
- `LockScreen.tsx`
- `LockSettings.tsx` (Settings → Security)

---

## F-18 · Matter Parties

**Status:** Implemented  
**Purpose:** Track all parties represented in a matter for PDF invoices.

### Examples
- "Petitioner No. 1 — Siemens India Ltd."
- "Respondent No. 2 — State of Maharashtra"

### Display
Shown on invoice PDFs in an "Appearing for" strip.

### Key Screens
- `MatterParties.tsx` (embedded in MatterDetail overview)

### Database Tables
- `matter_parties`

---

## F-19 · Developer Support Tip (Inactive)

**Status:** Implemented but hidden  
**Purpose:** One-time optional tip to support the developer.

### Technical Implementation
- UPI deep-link: `upi://pay?pa=ssmendon@icici&pn=Memo&am={amount}&tn=Tip+for+Memo+v1.0.0&cu=INR`
- Opened via `@tauri-apps/plugin-opener → openUrl()`
- Opens user's UPI app (GPay, PhonePe, Paytm, etc.)
- Payment goes peer-to-peer to developer's ICICI account
- Memo has no visibility into the payment

### Activation
Remove `{false && (...)}` wrapper in `AboutModal.tsx` around the "Support the Developer" button.

### Tip Amounts
₹49 / ₹99 / ₹199 / ₹499 / Custom

### Key Screens
- `SupportModal.tsx`
- `AboutModal.tsx` (button, currently hidden)

---

## F-20 · Onboarding

**Status:** Implemented  
**Purpose:** First-run profile setup to ensure invoices have the advocate's correct details.

### Trigger
`isProfileSetup()` returns `false` on app launch (no profile, or profile has empty name and firm name).

### Fields Collected
Identity, address, phone/email, GSTIN, PAN, bank details, invoice prefix, GST rate.

### Key Screens
- `Onboarding.tsx` (full-screen overlay, z-50)

---

## F-21 · Demo Data

**Status:** Implemented (developer/testing use)  
**Purpose:** Load realistic sample data for screenshots and testing.

### Access
Settings → Demo Data → Load Demo Data

### What it creates
- 3 sample matters (corporate, litigation, arbitration)
- 4 appearances
- 4 time entries
- 1 invoice (sent status)
- 1 payment

### Clear All Data
Settings → Demo Data → Clear All Data
- Deletes all transactional data (matters, clients, firms, invoices, payments, etc.)
- Preserves profile and settings
- Requires two confirmations
