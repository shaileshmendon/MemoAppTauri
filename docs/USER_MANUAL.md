# User Manual

**App:** Memo v1.0.0  
**Last updated:** 2026-05-31  
**Audience:** Advocates and law firm staff using the app day-to-day

---

## Getting Started

### First Launch

When you open Memo for the first time, you'll see the **Setup** screen. Fill in:
- Your full name and firm name
- Your designation and Bar Council enrolment number
- Address, phone, email
- Bank details (shown on invoices)
- Invoice number prefix (e.g. `INV` → invoices numbered `INV-202605-001`)
- Default GST rate for your practice

Click **Save** to complete setup. You can update these details anytime from **Settings → Identity**.

---

## Navigation

The left sidebar has six sections:

| Section | What it does |
|---|---|
| **Dashboard** | Overview of your practice — stats, recent matters, your profile |
| **Matters** | Your main workspace — all legal cases and engagements |
| **Outstanding Dues** | All unpaid invoices across all matters |
| **Record Payment** | Quickly log a payment without opening a specific matter |
| **Clients** | Directory of your clients |
| **AOR / Firms** | Directory of Advocates on Record and engaging firms |
| **Settings** | Profile, invoice design, backup, security |

---

## Matters

### Creating a New Matter

1. Click **Matters** in the sidebar
2. Click **+** at the top of the matter list
3. Fill in the **Case Title** (required — always visible at the top of the form)
4. Fill in **Client** — search for an existing client or type a new name
5. Fill in **AOR / Firm** if applicable
6. Set the default billing recipient (who invoices go to)
7. Click **Save Matter**

**Tip:** If you type a client name that isn't saved yet, a blue prompt appears offering to save them to your Clients directory for future use — click it and they're added instantly.

### Matter Reference Numbers

Every matter gets an automatic reference number (#001, #002, …) shown in the matter list and on the matter detail screen. This is separate from the court's case number.

### Matter Detail

Click any matter to open its detail view. The tabs across the top let you switch between:
- **Overview** — key information and summary stats
- **Time** — billable time entries
- **Appearances** — court appearances
- **Invoices** — invoices for this matter

### Matter Status

Change a matter's status (Active / Closed / On Hold) by editing the matter (pencil icon).

---

## Clients & AOR / Firms

### Adding a Client or Firm

1. Click **Clients** or **AOR / Firms** in the sidebar
2. Click **+**
3. Fill in the details — or click **From Contacts** to import from your macOS Contacts app
4. Click **Save**

### Importing from macOS Contacts

Click **From Contacts** on any client, firm, or contact person form. A search panel opens — type a name or company. Click a result to import their name, email, phone, and address automatically.

*On first use, macOS will ask permission to access your Contacts. Click OK.*

### Contact Persons

Each client or firm can have multiple named contact persons — for example, the specific partner or in-house counsel who instructed you.

On any client or firm record, scroll down to **Contact Persons** → click **Add**. Fill in their details (or import from Contacts). Contact persons can be designated as the default invoice recipient for their organisation.

### Linked Matters

On any client or firm record, you'll see a **Linked Matters** section showing all matters associated with that entity, with active matters highlighted in green.

---

## Time Entries

1. Open a matter → click **Time** tab
2. Click **+ Add Entry**
3. Enter: date, description, duration, hourly rate, and whether it's billable
4. Click **Save**

Time entries marked as billable and not yet invoiced will appear in the invoice creation form for selection.

---

## Appearances

1. Open a matter → click **Appearances** tab
2. Click **+ Add Appearance**
3. Enter: date, court, hearing type, fee amount, and notes
4. Click **Save**

Like time entries, unbilled appearances appear in the invoice creation form.

---

## Invoices

### Creating an Invoice

1. Open a matter → click **Invoices** tab
2. Click **New Invoice**
3. Set the invoice number, dates, and GST rate
4. Choose **Invoice Addressed To** — six options:
   - **A — AOR / Firm**: addressed to the firm organisation
   - **B — Client**: addressed to the client organisation
   - **C — Both**: both organisations shown
   - **D — Firm Contact**: addressed to a named person at the firm
   - **E — Client Contact**: addressed to a named person at the client
   - **F — Both Contacts**: named persons at both
5. Select unbilled work items (appearances and time entries) to include
6. Add any custom line items if needed
7. Click **Save as Draft** or **Save as Sent**

### Downloading a PDF

On any invoice row, click the **Download** (↓) button. A Save dialog opens — choose where to save the PDF.

### Recording a Payment

Expand an invoice by clicking it, then click **+ Record Payment**. Enter:
- Date and amount received
- Payment mode (NEFT, UPI, cheque, etc.)
- **TDS** — toggle on if the payer deducted tax at source; select the section (194J(b) for professional fees) and amount

The app shows a reconciliation banner:
- 🟢 **Fully settled** — cash received + TDS equals the invoice total
- 🟡 **TDS mismatch** — the deduction rate doesn't match the expected section
- 🔴 **Shortfall** — genuine outstanding balance remains

---

## Invoice Design

Go to **Settings → Invoice Designer** to customise how your invoices look:

- Choose template: **Modern**, **Classic**, or **Minimal**
- Set accent colour
- Toggle GST breakdown, bank details, signature line, matter information
- Add a header note and footer note
- Add custom fields (e.g. "PAN: XXXXX")

Changes preview in real-time on the right side.

---

## Outstanding Dues

**Outstanding Dues** in the sidebar shows all unpaid invoices across every matter — sent, overdue, and partially paid. Use this as your daily collection tracker.

---

## Record Payment (Quick Access)

Use **Record Payment** in the sidebar to log a payment without navigating to a specific matter:

- Left panel: all matters with unpaid invoices — click one to select
- Right panel: payment form with TDS support

---

## Backup & Restore

### Creating a Backup

1. Go to **Settings → Backup & Restore**
2. Click **Export Backup**
3. Choose where to save the file (Desktop, iCloud Drive, etc.)
4. The file is named `MemoApp-backup-YYYY-MM-DD.json`

**Recommended:** Back up before loading demo data, clearing data, or before any major update.

### Restoring from a Backup

1. Go to **Settings → Backup & Restore**
2. Click **Choose Backup File** and select your `.json` backup
3. Review the preview — it shows what's in the backup (matter count, invoice count, etc.)
4. Click **Restore This Backup** → confirm
5. The app reloads with your restored data

*Warning: Restoring replaces all current data.*

---

## App Lock

Set a PIN to protect the app:

1. **Settings → Security & Lock → Set App Lock**
2. Enter and confirm your PIN
3. Click **Enable Lock**

When the lock is active, the lock icon appears in the sidebar footer. Click it to lock immediately. The PIN screen appears on next launch.

To remove the lock: **Settings → Security & Lock → Remove Lock**.

---

## Settings Reference

| Setting | Location | Description |
|---|---|---|
| Profile (identity, address, bank) | Settings → Identity / Address & Contact / Bank Details | Your details that appear on invoices |
| Invoice prefix | Settings → Invoice Settings | Prefix for auto-numbered invoices |
| Default GST rate | Settings → Invoice Settings | Pre-fills on every new invoice |
| Invoice template | Settings → Invoice Settings | Modern / Classic / Minimal |
| Invoice customisation | Settings → Invoice Designer | Colours, layout toggles, notes |
| Backup | Settings → Backup & Restore | Export and import data |
| App lock | Settings → Security | PIN lock |
| Demo data | Settings → Demo Data | Load sample data or clear all data |

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Toggle Screenshot Helper (dev only) | ⌘ ⇧ D |

---

## Support

For help, email: **stripes_swoops_2b@icloud.com**

You can also reach the support link from **About** (ⓘ icon at the bottom of the sidebar).
