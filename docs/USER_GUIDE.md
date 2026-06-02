# User Guide — Memo v1.0.0

**Last Updated:** 2026-06-02  
**Audience:** Advocates and law firm staff using the application

---

## Getting Started

### First Launch

When you open Memo for the first time, a setup screen appears. Fill in:

| Section | Fields | Notes |
|---|---|---|
| **Identity** | Full name, firm name, designation, Bar Council enrolment, GSTIN, PAN | At least name or firm name required |
| **Address & Contact** | Office address, phone, email | Appears on invoices |
| **Bank Details** | Bank name, branch, account number, IFSC, UPI ID | Shown on invoices |
| **Invoice Preferences** | Prefix (e.g. INV), default GST rate | GST rate pre-fills on every new invoice |

Click **Save** to complete setup. You can update everything later in **Settings**.

---

## Navigation

The sidebar on the left has all sections:

```
M Memo
─────────────
Dashboard
─────────────
WORK
  Matters
  Outstanding Dues
  Record Payment
─────────────
CONTACTS
  Clients
  AOR / Firms
─────────────
ACCOUNT
  Settings
─────────────
v1.0.0  ⓘ
```

- **Dashboard** — practice overview
- **Matters** — your main workspace
- **Outstanding Dues** — all unpaid invoices at a glance
- **Record Payment** — quickly log a payment
- **Clients / AOR / Firms** — contact directories
- **Settings** — profile, invoice design, backup, security
- **ⓘ (About)** — version, support email

---

## Matters

### Creating a New Matter

1. Click **Matters** in the sidebar
2. Click **+** at the top of the matter list
3. Fill in the **Case Title** — this is the required primary field, always visible at the top of the form
4. In the **Client** section, type to search saved clients or enter a new name
   - If typing a new name not in your directory, a blue "Save Client" prompt appears — click it to add to your Clients directory for future use
   - You can skip saving to the directory if this is a one-off client
5. In the **AOR / Firm** section (optional), same pattern
6. Set **Invoice Billing** — who invoices for this matter default to:
   - **AOR / Firm & Client** — both appear on invoice
   - **AOR / Firm only** — invoice goes to the engaging firm
   - **Client only** — invoice goes directly to the client
7. Optionally fill in handler (the advocate working the matter) and notes
8. Click **Save Matter** — either at the top or at the bottom of the form

**Your matter gets an automatic reference number** (#001, #002, etc.) that never changes.

### Finding a Matter

- Type in the **Search** box to filter by case title, client, or firm
- Use the **All / Client / AOR & Firm** toggle to group matters

### Matter Detail View

Click a matter to open it. The header shows:
- Reference number badge (`#001`)
- Case title, client, court
- Status badge (Active / Closed / On Hold)
- Stats: time logged, appearances, invoices

Use the tabs to navigate: **Overview → Time → Appearances → Invoices**

### Editing or Deleting a Matter

On the matter detail header, click the **pencil** to edit, or the **trash** icon to delete.

> ⚠️ Deleting a matter permanently removes all its appearances, time entries, invoices, payments, and parties.

---

## Logging Work

### Court Appearances

1. Open a matter → **Appearances** tab
2. Click **+ Add Appearance**
3. Fill in: date, court name, hearing type, fee amount (₹), notes
4. Click **Save**

**Hearing types available:**
- Mention, Urgent Mention, Hearing, Adjournment, Circulation, Arguments, Evidence, Judgement, Admission, Caveat, Board (Directorial)
- Professional: Conference, Drafting, Research, Advice, Retainer, Filing, Other

Appearances show as **Unbilled** until included in a sent invoice.

### Time Entries

1. Open a matter → **Time** tab
2. Click **+ Add Entry**
3. Fill in: date, description, duration, hourly rate, and whether it's billable
4. Click **Save**

The billing amount (`(duration ÷ 60) × rate`) is calculated and shown on each row.

---

## Invoices

### Creating an Invoice

1. Open a matter → **Invoices** tab
2. Click **New Invoice**

**Step 1 — Header fields:**
- Invoice number (auto-filled as `PREFIX-YYYYMM-001` — edit if needed)
- Invoice date and due date
- GST rate (defaults to your Settings preference)

**Step 2 — Invoice Addressing (who receives the invoice):**

| Option | Addressed To |
|---|---|
| A — AOR / Firm | Firm organisation (name, GSTIN, state) |
| B — Client | Client organisation |
| C — Both | Both organisations |
| D — Firm Contact | Named person at AOR / Firm |
| E — Client Contact | Named person at Client |
| F — Both Contacts | Named persons at both |

Options D, E, F require contact persons to be set up on the relevant client/firm. See the [Contact Persons](#contact-persons) section.

**Step 3 — Select work items:**
- Unbilled appearances and time entries are pre-selected
- Uncheck items to exclude them
- Add custom line items (e.g. filing fees, out-of-pocket expenses)

**Step 4 — Save:**
- **Save as Draft** — creates the invoice; work items NOT marked as billed yet
- **Save as Sent** — creates the invoice; work items marked as billed (cannot be double-invoiced)

### Downloading the PDF

Expand any invoice row → click the **Download (↓)** button → choose where to save.

### Invoice Statuses

| Status | Meaning |
|---|---|
| Draft | Not yet sent to client |
| Sent | Issued; awaiting payment |
| Paid | Fully settled |
| Partially Paid | Some payment received; genuine balance remains |
| Overdue | Due date passed; not paid |
| Cancelled | Voided |

### Changing Invoice Status

Expand the invoice row → use the status dropdown next to the invoice number.

---

## Recording Payments

### Against a Specific Invoice

1. Open a matter → **Invoices** tab
2. Expand the invoice by clicking it
3. Click **+ Record Payment**
4. Enter:
   - Payment date
   - Amount received (the actual cash / bank transfer received)
   - Payment mode (NEFT, UPI, cheque, etc.)
5. **If TDS was deducted:**
   - Toggle **TDS** on
   - Select the applicable section (usually **194J(b) — 10%** for advocates)
   - The TDS rate auto-fills; the TDS amount is calculated automatically
   - Or enter a custom amount
6. Click **Save**

**How the app classifies the payment:**
- 🟢 **Fully settled** — cash received + TDS = invoice total
- 🟡 **TDS mismatch** — the deduction rate doesn't match the expected section
- 🔴 **Shortfall** — genuine unpaid balance remains

### Quick Payment (from Record Payment screen)

1. Click **Record Payment** in the sidebar
2. Left panel: click the matter / invoice you received payment for
3. Right panel: fill in the payment form (same as above)

### Advance / Retainer Payments

In the Record Payment screen, each matter row has a **Record Advance** button for retainer fees not linked to a specific invoice.

---

## Outstanding Dues

Click **Outstanding Dues** in the sidebar to see **all unpaid invoices** across every matter in one place:

- Summary strip shows total outstanding amount
- Each invoice shows: matter, invoice number, due date, total, amount paid, TDS, balance
- Invoices past their due date are highlighted in red
- You can record a payment directly from this screen

---

## Clients & AOR / Firms

### Adding a Client or Firm

1. Click **Clients** or **AOR / Firms** in the sidebar
2. Click **+**
3. Fill in details manually, or click **From Contacts** to import from your macOS Contacts app
4. Click **Save**

### Importing from macOS Contacts

Click **From Contacts** on any client, firm, or contact person form.

1. A search panel opens
2. Type a name or company name
3. Click a result to import: name, email, phone, address
4. Review and edit before saving

*On first use, macOS will ask: "Memo would like to access your Contacts." Click OK. This is a one-time permission stored in your System Settings.*

### Viewing a Client or Firm

Click any entry to see:
1. Contact details (email, phone, GSTIN, address)
2. **Linked Matters** — all matters associated with this client/firm
3. **Contact Persons** — named individuals at this organisation

### Contact Persons

Add named individuals who can be designated as invoice recipients (for addressing Options D/E/F):

1. Open the client or firm record
2. Scroll to **Contact Persons**
3. Click **Add**
4. Fill in name, designation, company, email, phone, mobile, address
5. Or click **From Contacts** to import from macOS
6. Click **Save**

Set a contact person as the **Primary Contact** on a matter by editing the matter and choosing from the dropdown that appears after selecting a saved client or firm.

---

## Invoice Design

Customise how your invoices look:

1. **Settings → Invoice Designer**
2. Choose a template:
   - **Modern** — coloured header, clean sans-serif
   - **Classic** — letterhead style, Times Roman font
   - **Minimal** — clean two-column layout
3. Adjust:
   - Accent colour (colour of header, table header, total row)
   - Toggle GST breakdown, bank details, signature, matter info
   - Header note and footer note
   - Custom fields (e.g. "PAN: AAAAA0000A")
4. Preview updates in real-time on the right
5. Click **Save Changes**

---

## Settings

| Section | What You Can Set |
|---|---|
| **Identity** | Your name, firm, designation, Bar Council No., GSTIN, PAN |
| **Address & Contact** | Office address, phone, email, website |
| **Bank Details** | Bank name, branch, account number, IFSC, UPI ID |
| **Invoice Settings** | Invoice number prefix, signature text, default GST rate, template |
| **Invoice Designer** | Visual customisation with live preview |
| **Backup & Restore** | Export / import data |
| **Security & Lock** | Set, change, or remove PIN lock |
| **Demo Data** | Load sample data; clear all data |

---

## Backup & Restore

### Creating a Backup

**Always back up before:**
- Loading demo data
- Clearing all data
- Installing a new version of the app

Steps:
1. **Settings → Backup & Restore → Export Backup**
2. Choose save location (Desktop, iCloud Drive, external drive recommended)
3. File saved as `MemoApp-backup-2026-06-02.json`

### Restoring a Backup

1. **Settings → Backup & Restore → Choose Backup File**
2. Select your `.json` backup file
3. A preview shows: backup date, and counts (matters, invoices, etc.)
4. Click **Restore This Backup**
5. A second confirmation dialog appears — click **Yes, Restore Now**
6. App reloads with restored data

> ⚠️ Restoring permanently replaces ALL current data with the backup contents.

---

## App Lock

Protect the app with a PIN:

1. **Settings → Security & Lock → Set App Lock**
2. Enter your chosen PIN and confirm it
3. Click **Enable Lock**

From now on, the lock screen appears every time you open Memo. Enter your PIN to unlock.

**Manual lock:** Click the 🔒 icon at the bottom of the sidebar.

**Remove lock:** Settings → Security & Lock → Remove Lock (requires current PIN).

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Screenshot helper (dev only) | ⌘ ⇧ D |

---

## Getting Help

Email: **stripes_swoops_2b@icloud.com**

Click the **ⓘ** icon at the bottom of the sidebar → About → support email link.
