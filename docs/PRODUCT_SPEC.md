# Product Specification — Memo v1.0.0

**Last Updated:** 2026-06-02  
**Status:** Implemented / Shipped

---

## 1. Product Vision

**For** Indian advocates and law firm administrators  
**Who** need to manage legal matters, generate GST-compliant invoices, and track payments including TDS  
**Memo** is a native macOS desktop application  
**That** handles the complete billing lifecycle offline, without subscriptions or cloud dependencies  
**Unlike** generic invoicing tools (Zoho, QuickBooks, Tally) or manual spreadsheets  
**Our product** is purpose-built for Indian legal practice: it understands court appearances, TDS section 194J(b), GST intra/inter-state rules, and AOR billing relationships.

---

## 2. Target Users

### Primary Persona — Solo Advocate

**Profile:** Independent advocate with 10–40 active matters, handling their own billing.

**Goals:**
- Track which appearances are billed and which are pending
- Generate a GST invoice without manually calculating CGST/SGST/IGST
- Know at a glance how much is outstanding across all matters

**Pain points:**
- Forgetting to invoice appearances that happened months ago
- Making GST calculation errors
- Losing track of partial payments and TDS deductions

---

### Secondary Persona — Practice Manager at a Small Firm

**Profile:** Non-advocate administrator managing billing for 5–15 advocates.

**Goals:**
- Maintain a central directory of clients, AORs, and contact persons
- Generate invoices addressed to the correct contact at the instructing firm
- Reconcile payments including TDS deductions from corporate clients

**Pain points:**
- Corporate clients deduct TDS at 10% and pay 90% — need to distinguish this from non-payment
- Multiple billing contacts at the same firm (different partners for different matters)
- No existing tool designed for Indian legal billing

---

### Tertiary Persona — AOR (Advocate on Record)

**Profile:** Supreme Court / High Court AOR who receives briefs from outstation law firms and issues invoices back to the instructing firm.

**Goals:**
- Track which firm instructed which matter
- Issue invoices addressed to a specific partner at the instructing firm
- Manage the distinction between "instructing firm" (AOR/Firm) and "end client"

**Pain points:**
- Six different invoice addressing combinations needed depending on the relationship
- Contact person at instructing firm changes frequently
- Need to import contact details from macOS Contacts

---

## 3. Use Cases

### UC-01: Create a New Matter
**Actor:** Advocate / Practice Manager  
**Precondition:** App is set up with a profile  
**Flow:**
1. Click + in the Matters panel
2. Type case title (required)
3. Search for existing client or type a new client name; optionally save to directory
4. Optionally add AOR/Firm details
5. Set default billing recipient (Firm / Client / Both)
6. Save

**Postcondition:** Matter created with sequential reference number (#001, #002…)

---

### UC-02: Log a Court Appearance
**Actor:** Advocate  
**Flow:**
1. Open matter → Appearances tab
2. Click + Add Appearance
3. Enter date, court name, hearing type, fee amount
4. Save

**Postcondition:** Appearance marked as unbilled; available for invoice selection

---

### UC-03: Generate a GST Invoice
**Actor:** Advocate / Practice Manager  
**Flow:**
1. Open matter → Invoices tab
2. Click New Invoice
3. Confirm invoice number and dates
4. Select unbilled appearances and time entries to include
5. Choose addressing option (A through F)
6. Click Save as Sent

**Postcondition:** Invoice created; selected work items marked as billed; invoice PDF downloadable

---

### UC-04: Record a Payment with TDS
**Actor:** Practice Manager  
**Flow:**
1. Open matter → Invoices → expand invoice
2. Click + Record Payment
3. Enter date, amount received (e.g. ₹90,000 against ₹1,00,000 invoice)
4. Toggle TDS on
5. Select section 194J(b), rate auto-fills at 10%
6. TDS amount auto-calculates as ₹10,000
7. Save

**Postcondition:** Invoice shows as "Paid" (settled = ₹90,000 cash + ₹10,000 TDS = ₹1,00,000); reconciliation banner shows green

---

### UC-05: Import Contact from macOS Contacts
**Actor:** Any  
**Flow:**
1. Click "From Contacts" button on any client/firm/contact person form
2. Type name in search box
3. Click result
4. Fields auto-fill (name, email, phone, address)
5. Continue editing or save

**Postcondition:** Contact details imported; macOS Contacts data not modified

---

### UC-06: Backup Data
**Actor:** Any  
**Flow:**
1. Settings → Backup & Restore → Export Backup
2. Choose save location (Desktop, iCloud Drive, etc.)
3. File saved as `MemoApp-backup-YYYY-MM-DD.json`

---

### UC-07: Restore from Backup
**Actor:** Any  
**Flow:**
1. Settings → Backup & Restore → Choose Backup File
2. Preview shows: record counts, export date
3. Click Restore This Backup
4. Confirm in second dialog
5. App reloads with restored data

---

## 4. Functional Requirements

### FR-MATTER: Matter Management
- FR-MATTER-01: User shall be able to create a matter with: case title (required), client name (required), court, court case number, matter type, status, AOR/Firm details, handler details, notes
- FR-MATTER-02: System shall auto-assign a sequential reference number on matter creation
- FR-MATTER-03: Matter reference numbers shall never change after assignment
- FR-MATTER-04: System shall support matter types: litigation, advisory, drafting, corporate, other
- FR-MATTER-05: System shall support matter statuses: active, closed, on-hold
- FR-MATTER-06: Deleting a matter shall cascade-delete all appearances, time entries, invoices, payments, advance payments, and matter parties
- FR-MATTER-07: User shall be able to search matters by case title, client name, or firm name
- FR-MATTER-08: User shall be able to group matters by client or by firm

### FR-CONTACT: Contact Directory
- FR-CONTACT-01: System shall maintain a reusable directory of clients separate from matter records
- FR-CONTACT-02: System shall maintain a reusable directory of AOR/Firms separate from matter records
- FR-CONTACT-03: Each client and firm shall support multiple named contact persons
- FR-CONTACT-04: Contact persons shall have: name, designation, company, email, phone, mobile, address, notes
- FR-CONTACT-05: System shall display all linked matters on a client or firm record
- FR-CONTACT-06: System shall support importing contact details from macOS Contacts app

### FR-WORK: Work Logging
- FR-WORK-01: User shall be able to log court appearances with: date, court, hearing type (from defined list), fee amount, notes
- FR-WORK-02: User shall be able to log time entries with: date, description, duration (minutes), rate per hour, billable flag
- FR-WORK-03: Work items shall be marked as billed when included in a sent invoice
- FR-WORK-04: Billed work items shall still be visible but distinguished from unbilled items

### FR-INVOICE: Invoice Generation
- FR-INVOICE-01: System shall generate invoices with CGST+SGST for same-state transactions or IGST for inter-state
- FR-INVOICE-02: System shall support GST rates: 0%, 5%, 12%, 18%
- FR-INVOICE-03: System shall auto-generate invoice numbers using a configurable prefix
- FR-INVOICE-04: System shall support six invoice addressing modes (A through F)
- FR-INVOICE-05: System shall export invoices as PDF in one of three professional templates
- FR-INVOICE-06: Invoices shall include amount in words (Indian numbering system)
- FR-INVOICE-07: System shall support invoice statuses: draft, sent, paid, partially_paid, overdue, cancelled
- FR-INVOICE-08: Sending a draft invoice shall mark all selected work items as billed
- FR-INVOICE-09: User shall be able to customise invoice templates (accent colour, section toggles, custom fields, header/footer notes)

### FR-PAYMENT: Payment & TDS
- FR-PAYMENT-01: User shall be able to record multiple payments against a single invoice
- FR-PAYMENT-02: System shall support payment modes: NEFT, RTGS, IMPS, UPI, cheque, cash, other
- FR-PAYMENT-03: System shall support TDS recording with: section (194J(b), 194J(a), 194C(1), 194C(2), custom), rate, amount
- FR-PAYMENT-04: System shall classify invoice settlement as: fully settled, TDS mismatch, or genuine shortfall
- FR-PAYMENT-05: An invoice is fully settled when `SUM(amount_paid) + SUM(tds_amount) >= total_amount`
- FR-PAYMENT-06: User shall be able to record advance/retainer payments not tied to an invoice

### FR-BACKUP: Data Persistence
- FR-BACKUP-01: User shall be able to export all application data to a JSON file
- FR-BACKUP-02: User shall be able to restore data from a JSON backup with a preview step
- FR-BACKUP-03: Restore shall require two explicit confirmations before executing
- FR-BACKUP-04: All data shall be stored locally; no data shall be sent to external servers

### FR-SECURITY: Authentication
- FR-SECURITY-01: User shall be able to enable an optional PIN-based app lock
- FR-SECURITY-02: App lock PIN shall be stored as a SHA-256 hash, never in plaintext
- FR-SECURITY-03: Lock screen shall be shown on every app launch when lock is enabled
- FR-SECURITY-04: User shall be able to manually lock the app from the sidebar

---

## 5. Non-Functional Requirements

| Requirement | Target |
|---|---|
| **Startup time** | < 3 seconds to interactive on Apple Silicon |
| **PDF generation** | < 5 seconds for any invoice |
| **Contacts search** | < 5 seconds for address books up to 5,000 contacts |
| **Database** | Supports up to 50,000 total rows without noticeable degradation |
| **Offline** | 100% functionality with no internet connection |
| **macOS compatibility** | macOS 13 Ventura and later |
| **Architecture** | Apple Silicon (arm64) and Intel (x86_64) |
| **Storage** | App bundle < 20 MB; database < 100 MB for typical practice |

---

## 6. Out of Scope

| Feature | Reason excluded |
|---|---|
| Cloud sync | Complexity; privacy; offline-first design |
| Multi-user / team mode | Requires server; out of scope for v1.0 |
| Email delivery of invoices | Requires mail server or SMTP integration |
| GST e-invoicing (IRN) | Complex compliance requirement; future enhancement |
| Tally / QuickBooks export | Future enhancement |
| Court calendar / reminders | Future enhancement |
| iOS / iPad companion app | Future enhancement |
| Auto-update mechanism | Future enhancement |
| Invoice editing (post-creation) | Intentional: invoices are accounting records |

---

## 7. Pricing

**Free forever.** No subscription. No per-invoice fee. No feature tiers.

An optional tip mechanism is built into the codebase (`SupportModal.tsx`) but is currently hidden. When activated, it uses a UPI deep-link (`ssmendon@icici`) — no payment processing server is involved.
