# API Documentation — Memo v1.0.0

**Last Updated:** 2026-06-02

Memo has no external HTTP API. This document covers:
1. **Tauri IPC Commands** — Rust functions callable from TypeScript via `invoke()`
2. **TypeScript Data Access Layer** — all exported functions from `src/db.ts`
3. **TypeScript Type Definitions** — all shared interfaces from `src/types.ts`

---

## Part 1 — Tauri IPC Commands

Commands are called using `invoke()` from `@tauri-apps/api/core`:

```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<ReturnType>("command_name", { param: value });
```

---

### `search_contacts`

**File:** `src-tauri/src/lib.rs`  
**Type:** `async fn` — executes on Tokio thread pool via `spawn_blocking`

**Purpose:** Search the user's macOS Contacts app by name or company and return matching contacts as structured JSON.

**Request:**
```typescript
invoke<MacContact[]>("search_contacts", { query: string })
```

**Parameters:**

| Parameter | Type | Required | Validation |
|---|---|---|---|
| `query` | `string` | Yes | Trimmed; empty string returns `[]` immediately. Single quotes stripped. Backslashes stripped. |

**Response (success):** `MacContact[]` — up to 40 results

```typescript
interface MacContact {
  name: string;            // Full display name ("Rajesh Kumar")
  givenName: string;       // First name ("Rajesh")
  familyName: string;      // Last name ("Kumar")
  organization: string;    // Company / firm
  jobTitle: string;        // Designation / title
  emails: string[];        // All email addresses in order
  phones: string[];        // All phone numbers in order
  addressStreet: string;   // Street address
  addressCity: string;
  addressState: string;    // Raw state string (may be abbreviation)
  addressPostal: string;   // PIN code / postal code
  addressCountry: string;
}
```

**Response (error):** `string` — error message thrown as rejection

| Error Condition | Message |
|---|---|
| Contacts TCC permission denied | "Contacts access was denied. Please grant access in System Settings → Privacy & Security → Contacts." |
| osascript execution error | "Contacts search error: {stderr}" |
| JSON parse failure | "Failed to parse contacts response: {error}" |
| osascript not found | "Failed to launch osascript: {io_error}" |

**Implementation Notes:**
- Two `app.people.whose()` JXA queries run (by name, by organisation)
- Results merged; duplicates eliminated by `name` key
- Hard cap: 40 results total
- Requires macOS TCC Contacts permission (prompted on first use)
- `NSContactsUsageDescription` in `Info.plist` provides prompt text

---

## Part 2 — TypeScript Data Access Layer (`src/db.ts`)

All functions are `async` and return Promises. All IDs are UUID v4 strings. All functions call `getDb()` internally to get the cached database connection.

**Error handling:** Functions throw on database errors. Callers should wrap in try/catch.

---

### Database Initialisation

#### `getDb(): Promise<Database>`
Returns the shared SQLite connection. Runs migrations on the first call.

**Do not call from components.** Use the specific CRUD functions below.

---

### Matters

#### `fetchMatters(): Promise<Matter[]>`
Returns all matters ordered by `created_at DESC`.

#### `fetchMatter(id: string): Promise<Matter | null>`
Returns a single matter by ID, or `null` if not found.

#### `fetchMattersByClientName(name: string): Promise<Matter[]>`
Returns all matters where `LOWER(client_name) = LOWER(name)`.  
Used by the Linked Matters panel on Client records.

#### `fetchMattersByFirmName(name: string): Promise<Matter[]>`
Returns all matters where `LOWER(firm_name) = LOWER(name)`.  
Used by the Linked Matters panel on Firm records.

#### `insertMatter(m: Matter): Promise<Matter>`
Inserts a new matter and auto-assigns the next `ref_number`.

**Returns the complete `Matter` object with `ref_number` filled in.** This is the only insert function that returns a value (callers need the assigned number).

**Implementation:**
```typescript
const [{ max }] = await db.select<{ max: number }[]>(
  "SELECT COALESCE(MAX(ref_number), 0) AS max FROM matters"
);
const ref_number = max + 1;
// INSERT ...
return { ...m, ref_number };
```

#### `updateMatter(m: Matter): Promise<void>`
Updates all editable fields. Never updates `id`, `ref_number`, or `created_at`.

#### `deleteMatter(id: string): Promise<void>`
Deletes the matter. CASCADE DELETE removes: appearances, time_entries, invoices (and their payments), advance_payments, matter_parties.

---

### Clients

#### `fetchClients(): Promise<Client[]>`
Returns all clients ordered by name.

#### `insertClient(c: Client): Promise<void>`

#### `updateClient(c: Client): Promise<void>`

#### `deleteClient(id: string): Promise<void>`
Does **not** cascade-delete matters (matters store client name as text, not FK).

---

### Firms

#### `fetchFirms(): Promise<Firm[]>`

#### `insertFirm(f: Firm): Promise<void>`

#### `updateFirm(f: Firm): Promise<void>`

#### `deleteFirm(id: string): Promise<void>`

---

### Contact Persons

#### `fetchContactPersons(entityType: "client" | "firm", entityId: string): Promise<ContactPerson[]>`
Returns all contact persons for the given entity, ordered by `created_at ASC`.

**Both parameters required.** Passing only `entityId` without `entityType` will not filter correctly.

#### `fetchContactPerson(id: string): Promise<ContactPerson | null>`
Returns a single contact person by ID.

#### `insertContactPerson(cp: ContactPerson): Promise<void>`

#### `updateContactPerson(cp: ContactPerson): Promise<void>`
Also sets `updated_at` to `new Date().toISOString()` automatically.

#### `deleteContactPerson(id: string): Promise<void>`
Note: does not update `primary_client_contact_id` or `primary_firm_contact_id` on any matter that references this person. Application handles stale references gracefully (treats as null).

---

### Invoices

#### `fetchInvoices(matterId: string): Promise<Invoice[]>`
Returns all invoices for a matter, ordered by `invoice_date DESC`.

#### `insertInvoice(inv: Invoice): Promise<void>`

#### `updateInvoice(inv: Invoice): Promise<void>`

#### `deleteInvoice(id: string): Promise<void>`
CASCADE DELETE removes all related payments.

#### `fetchAllUnpaidInvoices(): Promise<UnpaidInvoiceRow[]>`
Returns all invoices with status NOT IN ('paid', 'cancelled', 'draft') across all matters.  
Joins with `matters` to include case context.

**`UnpaidInvoiceRow` interface:**
```typescript
interface UnpaidInvoiceRow extends Invoice {
  case_title: string;
  client_name: string;
  firm_name?: string;
  total_paid: number;      // SUM(payments.amount_paid)
  total_tds: number;       // SUM(payments.tds_amount)
  total_settled: number;   // total_paid + total_tds
}
```

#### `fetchInvoiceSettlement(invoiceId: string): Promise<{ totalPaid: number; totalTds: number; totalSettled: number }>`
Returns payment summary for a single invoice.  
`totalSettled = totalPaid + totalTds`

---

### Payments

#### `fetchPayments(invoiceId: string): Promise<Payment[]>`
Returns all payments for an invoice, ordered by `payment_date ASC`.

#### `insertPayment(p: Payment): Promise<void>`

#### `deletePayment(id: string): Promise<void>`

#### `fetchAllPaymentsLog(): Promise<PaymentLogRow[]>`
Returns all payments (both invoice payments and advance payments) across all matters, ordered by `payment_date DESC`.

**`PaymentLogRow` interface:**
```typescript
interface PaymentLogRow {
  id: string;
  payment_date: string;
  amount_paid: number;
  mode: string;
  notes?: string;
  tds_amount?: number;
  tds_rate?: number;
  tds_section?: string;
  type: "invoice" | "advance";
  // Invoice payment fields:
  invoice_number?: string;
  invoice_id?: string;
  // Matter context:
  matter_id: string;
  case_title: string;
  client_name: string;
  firm_name?: string;
}
```

---

### Appearances

#### `fetchAppearances(matterId: string): Promise<Appearance[]>`
Returns all appearances for a matter, ordered by `date DESC`.

#### `fetchAllBillableAppearances(matterId: string): Promise<Appearance[]>`
Returns ALL appearances (billed and unbilled). Used by the invoice creation form to show all items with billed status indicated.

#### `markAppearancesBilled(ids: string[]): Promise<void>`
Sets `is_billed = 1` for the given IDs. Called when a draft invoice is set to "sent".

#### `insertAppearance(a: Appearance): Promise<void>`
#### `updateAppearance(a: Appearance): Promise<void>`
#### `deleteAppearance(id: string): Promise<void>`

---

### Time Entries

#### `fetchTimeEntries(matterId: string): Promise<TimeEntry[]>`
Returns all time entries for a matter, ordered by `date DESC`.

#### `fetchAllBillableTimeEntries(matterId: string): Promise<TimeEntry[]>`
Returns ALL time entries (billed and unbilled). Used by invoice creation form.

#### `markTimeEntriesBilled(ids: string[]): Promise<void>`
Sets `is_billed = 1` for given IDs.

#### `insertTimeEntry(t: TimeEntry): Promise<void>`
#### `updateTimeEntry(t: TimeEntry): Promise<void>`
#### `deleteTimeEntry(id: string): Promise<void>`

---

### Matter Parties

#### `fetchMatterParties(matterId: string): Promise<MatterParty[]>`
#### `insertMatterParty(p: MatterParty): Promise<void>`
#### `updateMatterParty(p: MatterParty): Promise<void>`
#### `deleteMatterParty(id: string): Promise<void>`

---

### Advance Payments

#### `fetchAdvancePayments(matterId: string): Promise<AdvancePayment[]>`
#### `insertAdvancePayment(ap: AdvancePayment): Promise<void>`
#### `deleteAdvancePayment(id: string): Promise<void>`

---

### Profile & Settings

#### `loadProfile(): Promise<Profile | null>`
Reads `settings` where `key = 'profile'`, parses JSON, returns `Profile` or `null`.

#### `saveProfile(profile: Profile): Promise<void>`
Upserts the profile: `INSERT INTO settings ... ON CONFLICT DO UPDATE SET value = excluded.value`

#### `isProfileSetup(): Promise<boolean>`
Returns `true` if a profile exists AND (`advocateName.trim() !== ""` OR `firmName.trim() !== ""`).  
Used on app startup to decide whether to show Onboarding.

---

### Authentication / App Lock

#### `getLock(): Promise<AppLock | null>`
Returns the lock configuration or `null` if no lock is set.

```typescript
interface AppLock {
  hash: string;   // SHA-256 hex of PIN
}
```

#### `setLock(pin: string): Promise<void>`
Hashes PIN using `crypto.subtle.digest("SHA-256", ...)` and stores result in `settings`.

#### `verifyLock(pin: string): Promise<boolean>`
Hashes the input PIN and compares with stored hash. Returns `true` if match.

#### `removeLock(): Promise<void>`
Deletes `settings` row where `key = 'lock'`.

---

### Backup & Restore

#### `exportAllData(): Promise<string>`
Reads all 11 tables and returns a JSON string conforming to `BackupManifest`.

```typescript
interface BackupManifest {
  version: number;           // 1
  exportedAt: string;        // ISO 8601 timestamp
  appVersion: string;        // "1.0.0"
  counts: Record<string, number>;  // { matters: 42, invoices: 156, ... }
  data: Record<string, Record<string, unknown>[]>;
}
```

#### `importAllData(jsonStr: string): Promise<BackupManifest>`
1. Parses and validates the JSON (throws if invalid)
2. Deletes all rows from all tables in safe dependency order
3. Re-inserts every row from the backup using column names from JSON keys
4. Returns the parsed manifest

**Destructive operation.** All current data is permanently deleted before restore begins. There is no transaction wrapping — if insert fails midway, the database may be in a partial state. (Future improvement: wrap in a transaction.)

---

## Part 3 — TypeScript Type Definitions (`src/types.ts`)

### Enum Types

```typescript
type MatterType     = "litigation" | "advisory" | "drafting" | "corporate" | "other";
type MatterStatus   = "active" | "closed" | "on-hold";
type HearingType    = "mention" | "urgent_mention" | "hearing" | "adjournment" |
                      "circulation" | "arguments" | "evidence" | "judgement" |
                      "admission" | "caveat" | "board" | "conference" |
                      "drafting" | "research" | "advice" | "retainer" |
                      "filing" | "other";
type InvoiceStatus  = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
type PaymentMode    = "NEFT" | "RTGS" | "IMPS" | "UPI" | "cheque" | "cash" | "other";
type RecipientType  = "firm" | "client" | "both";  // Legacy
type InvoiceAddressMode =
  | "org_firm" | "org_client" | "org_both"          // Options A, B, C
  | "contact_firm" | "contact_client" | "contact_both"; // Options D, E, F
type InvoiceTemplate = "classic" | "modern" | "minimal";
type TdsSection     = "194J(b)" | "194J(a)" | "194C(1)" | "194C(2)" | "custom";
type NavSection     = "matters" | "outstanding" | "record_payment" |
                      "dashboard" | "clients" | "firms" | "settings";
```

### Core Interfaces

```typescript
interface Matter {
  id: string;
  ref_number?: number;
  primary_client_contact_id?: string;
  primary_firm_contact_id?: string;
  case_title: string;
  client_name: string;
  client_email?: string;
  client_gstin?: string;
  client_state?: string;
  court?: string;
  matter_number?: string;
  matter_type: MatterType;
  status: MatterStatus;
  firm_name?: string;
  firm_email?: string;
  firm_gstin?: string;
  firm_state?: string;
  handler_name?: string;
  handler_designation?: string;
  handler_email?: string;
  handler_phone?: string;
  notes?: string;
  invoice_recipient?: RecipientType;
  created_at: string;
}

interface Invoice {
  id: string;
  matter_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  recipient_type: RecipientType;
  address_mode?: InvoiceAddressMode;
  client_contact_id?: string;
  firm_contact_id?: string;
  subtotal_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  status: InvoiceStatus;
  notes?: string;
  pdf_path?: string;
  line_items_data?: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount_paid: number;
  mode: PaymentMode;
  notes?: string;
  tds_amount?: number;
  tds_rate?: number;
  tds_section?: string;
}

interface ContactPerson {
  id: string;
  entity_type: "client" | "firm";
  entity_id: string;
  name: string;
  designation?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  notes?: string;
  apple_contact_id?: string;
  created_at: string;
  updated_at: string;
}

interface Client {
  id: string; name: string; email?: string; phone?: string;
  gstin?: string; state?: string; address?: string;
  notes?: string; created_at: string;
}

interface Firm { /* identical to Client */ }

interface LineItem {
  description: string;
  amount: number;
  type: "appearance" | "time" | "expense" | "other";
  sourceId?: string;
}

interface MatterParty {
  id: string; matter_id: string;
  party_type: string; party_number?: number;
  party_name?: string; notes?: string;
}

interface TimeEntry {
  id: string; matter_id: string; date: string;
  description?: string; duration_minutes: number;
  rate_per_hour: number; is_billable: number; is_billed: number;
}

interface Appearance {
  id: string; matter_id: string; date: string;
  court?: string; hearing_type: HearingType;
  fee_amount: number; is_billed: number; notes?: string;
}

interface InvoiceCustomization {
  accentColor: string;        // hex colour, default "#1e40af"
  showGstBreakdown: boolean;
  showBankDetails: boolean;
  showSignature: boolean;
  showMatterInfo: boolean;
  headerNote: string;
  footerNote: string;
  customFields: Array<{ label: string; value: string }>;
}

interface Profile {
  advocateName: string; firmName: string; designation: string;
  barCouncilNumber: string; addressLine1: string; addressLine2: string;
  city: string; state: string; pincode: string;
  phone: string; email: string; website: string;
  gstin: string; pan: string;
  bankName: string; bankBranch: string; accountNumber: string;
  ifscCode: string; accountHolder: string; upiId: string;
  invoicePrefix: string; invoiceTemplate: InvoiceTemplate;
  signatureText: string; defaultGstRate: number;
  invoiceCustomization: InvoiceCustomization;
}
```

### Constants

```typescript
const TDS_SECTIONS: { value: TdsSection; label: string; rate: number }[] = [
  { value: "194J(b)", label: "194J(b) — Professional Fees (Advocate / Doctor)", rate: 10 },
  { value: "194J(a)", label: "194J(a) — Technical Services", rate: 2 },
  { value: "194C(1)", label: "194C(1) — Contractor (Individual / HUF)", rate: 1 },
  { value: "194C(2)", label: "194C(2) — Contractor (Company / Firm)", rate: 2 },
  { value: "custom",  label: "Custom rate", rate: 10 },
];

const DEFAULT_CUSTOMIZATION: InvoiceCustomization = {
  accentColor: "#1e40af", showGstBreakdown: true, showBankDetails: true,
  showSignature: true, showMatterInfo: true,
  headerNote: "", footerNote: "", customFields: [],
};
```

### Utility Functions

```typescript
// Format ref_number: 7 → "#007", 1234 → "#1234"
function fmtRef(ref?: number | null): string

// Format party: { party_type: "Respondent", party_number: 2, party_name: "ABC Corp" }
// → "Respondent No. 2 — ABC Corp"
function formatParty(p: MatterParty): string
```
