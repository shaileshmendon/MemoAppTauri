# API Documentation

**App:** Memo v1.0.0  
**Last updated:** 2026-05-31

> Memo has no external HTTP API. This document covers the two internal API surfaces:
> 1. The **Tauri IPC command** exposed by the Rust backend
> 2. The **TypeScript data-access functions** in `src/db.ts`

---

## Part 1 — Tauri IPC Commands (Rust → JS)

These are called from TypeScript using `invoke("command_name", { args })`.

---

### `search_contacts`

Searches the macOS Contacts app for people matching a query string.

**Caller:** `invoke<MacContact[]>("search_contacts", { query: string })`

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `query` | string | Name or company to search for. Min 1 character. Single quotes are stripped. |

**Returns:** `Promise<MacContact[]>` — up to 40 results

**`MacContact` shape:**
```typescript
interface MacContact {
  name: string;           // Full display name
  givenName: string;      // First name
  familyName: string;     // Last name
  organization: string;   // Company / firm
  jobTitle: string;       // Designation
  emails: string[];       // All email addresses
  phones: string[];       // All phone numbers
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPostal: string;
  addressCountry: string;
}
```

**How it works:**
1. Runs `osascript -l JavaScript -e <JXA script>` as a background thread
2. JXA queries `app.people.whose({name: {_contains: query}})` and `app.people.whose({organization: {_contains: query}})` — Contacts app does the filtering
3. Result JSON is parsed and returned

**Error cases:**
- `"Contacts access was denied …"` — user denied TCC permission
- Any other string — osascript execution error

**macOS permission required:** Contacts access (prompted once; manageable in System Settings → Privacy & Security → Contacts)

---

## Part 2 — TypeScript Data Access Functions (`src/db.ts`)

All functions are `async` and return Promises. All IDs are UUID v4 strings.

---

### Database Initialisation

#### `getDb(): Promise<Database>`
Returns the shared SQLite connection, running migrations on first call.
Never call this directly from components — use the specific CRUD functions below.

---

### Matters

#### `fetchMatters(): Promise<Matter[]>`
Returns all matters ordered by `created_at DESC`.

#### `fetchMatter(id: string): Promise<Matter | null>`
Returns a single matter by ID, or `null` if not found.

#### `fetchMattersByClientName(name: string): Promise<Matter[]>`
Returns all matters where `client_name` matches (case-insensitive).
Used to display linked matters on a Client record.

#### `fetchMattersByFirmName(name: string): Promise<Matter[]>`
Returns all matters where `firm_name` matches (case-insensitive).
Used to display linked matters on a Firm record.

#### `insertMatter(m: Matter): Promise<Matter>`
Inserts a new matter and auto-assigns the next `ref_number`.
Returns the matter with `ref_number` filled in.

#### `updateMatter(m: Matter): Promise<void>`
Updates all fields except `id`, `ref_number`, and `created_at`.

#### `deleteMatter(id: string): Promise<void>`
Deletes a matter and all related records (CASCADE: time entries, appearances, invoices, payments, advance payments, matter parties).

---

### Clients

#### `fetchClients(): Promise<Client[]>`
#### `insertClient(c: Client): Promise<void>`
#### `updateClient(c: Client): Promise<void>`
#### `deleteClient(id: string): Promise<void>`

---

### Firms

#### `fetchFirms(): Promise<Firm[]>`
#### `insertFirm(f: Firm): Promise<void>`
#### `updateFirm(f: Firm): Promise<void>`
#### `deleteFirm(id: string): Promise<void>`

---

### Contact Persons

#### `fetchContactPersons(entityType: "client" | "firm", entityId: string): Promise<ContactPerson[]>`
Returns all contact persons for a given client or firm, ordered by `created_at ASC`.

#### `fetchContactPerson(id: string): Promise<ContactPerson | null>`

#### `insertContactPerson(cp: ContactPerson): Promise<void>`

#### `updateContactPerson(cp: ContactPerson): Promise<void>`
Also updates `updated_at` to the current timestamp.

#### `deleteContactPerson(id: string): Promise<void>`

---

### Invoices

#### `fetchInvoices(matterId: string): Promise<Invoice[]>`
Returns all invoices for a matter, ordered by `invoice_date DESC`.

#### `insertInvoice(inv: Invoice): Promise<void>`

#### `updateInvoice(inv: Invoice): Promise<void>`

#### `deleteInvoice(id: string): Promise<void>`
Also deletes related payments (CASCADE).

#### `fetchAllUnpaidInvoices(): Promise<UnpaidInvoiceRow[]>`
Returns all non-draft, non-cancelled, non-paid invoices across all matters.
Joins with `matters` to include `case_title`, `client_name`, `firm_name`.

**`UnpaidInvoiceRow`** extends `Invoice` with: `case_title`, `client_name`, `firm_name`, `total_paid`, `total_tds`, `total_settled`.

---

### Payments

#### `fetchPayments(invoiceId: string): Promise<Payment[]>`
#### `insertPayment(p: Payment): Promise<void>`
#### `deletePayment(id: string): Promise<void>`

#### `fetchInvoiceSettlement(invoiceId: string): Promise<{ totalPaid: number; totalTds: number; totalSettled: number }>`
Returns the sum of cash received, TDS deducted, and effective total settlement for an invoice.

#### `fetchAllPaymentsLog(): Promise<PaymentLogRow[]>`
Returns all payments (invoice and advance) across all matters, ordered by date DESC.

---

### Appearances

#### `fetchAppearances(matterId: string): Promise<Appearance[]>`
#### `fetchAllBillableAppearances(matterId: string): Promise<Appearance[]>`
Returns all appearances (billed and unbilled) for use in the invoice creation form.
#### `markAppearancesBilled(ids: string[]): Promise<void>`
Sets `is_billed = 1` for the given appearance IDs.
#### `insertAppearance(a: Appearance): Promise<void>`
#### `updateAppearance(a: Appearance): Promise<void>`
#### `deleteAppearance(id: string): Promise<void>`

---

### Time Entries

#### `fetchTimeEntries(matterId: string): Promise<TimeEntry[]>`
#### `fetchAllBillableTimeEntries(matterId: string): Promise<TimeEntry[]>`
#### `markTimeEntriesBilled(ids: string[]): Promise<void>`
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
Reads the `profile` key from the `settings` table, parses the JSON, and returns the `Profile` object, or `null` if not set up yet.

#### `saveProfile(profile: Profile): Promise<void>`
Serialises the profile to JSON and upserts the `profile` key in `settings`.

#### `isProfileSetup(): Promise<boolean>`
Returns `true` if a profile exists and has a non-empty `advocateName` or `firmName`.

---

### Authentication / Lock

#### `getLock(): Promise<AppLock | null>`
Returns the current app lock configuration (hashed PIN), or `null` if no lock is set.

#### `setLock(pin: string): Promise<void>`
Hashes the PIN using SHA-256 (via Web Crypto API) and stores it in `settings`.

#### `verifyLock(pin: string): Promise<boolean>`
Hashes the input PIN and compares it against the stored hash.

#### `removeLock(): Promise<void>`
Deletes the `lock` key from `settings`.

---

### Backup & Restore

#### `exportAllData(): Promise<string>`
Reads all 11 tables and returns a JSON string (`BackupManifest`) ready to write to disk.

#### `importAllData(jsonStr: string): Promise<BackupManifest>`
Parses and validates the JSON string, deletes all current data (in safe dependency order), then re-inserts every row. Returns the parsed manifest.
**Warning:** This is destructive — all current data is replaced.

---

## Part 3 — Key TypeScript Types

```typescript
// src/types.ts (summary)

type MatterType     = "litigation" | "advisory" | "drafting" | "corporate" | "other";
type MatterStatus   = "active" | "closed" | "on-hold";
type InvoiceStatus  = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
type PaymentMode    = "NEFT" | "RTGS" | "IMPS" | "UPI" | "cheque" | "cash" | "other";
type RecipientType  = "firm" | "client" | "both";
type InvoiceAddressMode =
  "org_firm" | "org_client" | "org_both" |        // A, B, C — organisation-level
  "contact_firm" | "contact_client" | "contact_both"; // D, E, F — named contact person
type TdsSection     = "194J(b)" | "194J(a)" | "194C(1)" | "194C(2)" | "custom";

// Utility
fmtRef(ref?: number | null): string   // 7 → "#007"
formatParty(p: MatterParty): string   // "Respondent No. 2 — ABC Corp"
```
