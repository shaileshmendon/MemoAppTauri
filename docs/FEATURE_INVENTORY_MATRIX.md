# Feature Inventory Matrix — Memo v1.0.0

**Generated:** 2026-06-02  
**Method:** Full codebase analysis — `src/`, `src-tauri/`, all components, `db.ts`, `types.ts`

---

## Part 1 — Complete Feature Matrix

### Legend

| Status | Meaning |
|---|---|
| ✅ Complete | Fully implemented and connected to UI |
| ⚠️ Partial | Implemented but missing UI, connection, or behaviour |
| 🔒 Hidden | Code exists, UI deliberately hidden |
| 🗄️ Schema-only | DB column or type exists; no UI |

---

### F-01 · Matter Management

| Attribute | Detail |
|---|---|
| **Feature Name** | Matter Management |
| **Description** | Core record for each legal case. Create, view, edit, delete matters with case details, client info, AOR/firm info, handler, notes, and invoice defaults. |
| **Status** | ✅ Complete |
| **User Roles** | All users (single-user app) |
| **Screens** | `MatterList.tsx`, `MatterForm.tsx`, `MatterDetail.tsx`, `MatterTabs.tsx` |
| **Database Tables** | `matters` |
| **APIs** | `fetchMatters()`, `fetchMatter(id)`, `insertMatter(m)→Matter`, `updateMatter(m)`, `deleteMatter(id)` |
| **Permissions** | None |
| **Dependencies** | `clients`, `firms` (soft reference by name); `contact_persons` (for primary contact dropdowns) |
| **Related Features** | F-02 (Clients), F-03 (AOR/Firms), F-04 (Contact Persons), F-06 (Appearances), F-07 (Time), F-08 (Invoices), F-18 (Parties), F-19 (Ref Numbers) |

---

### F-02 · Client Directory

| Attribute | Detail |
|---|---|
| **Feature Name** | Client Directory |
| **Description** | Reusable directory of client organisations. Create, view, edit, delete. Shows linked matters and contact persons. Importable from macOS Contacts. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `ContactList.tsx` (type="client"), `ContactDetail`, `ContactForm`, `ContactPersonsPanel.tsx`, `LinkedMattersPanel` |
| **Database Tables** | `clients`, `contact_persons` |
| **APIs** | `fetchClients()`, `insertClient(c)`, `updateClient(c)`, `deleteClient(id)`, `fetchMattersByClientName(name)` |
| **Permissions** | macOS Contacts (optional, for import) |
| **Dependencies** | F-04 (Contact Persons), F-05 (Contacts Import), F-19 (Linked Matters panel) |
| **Related Features** | F-01 (Matters), F-03 (AOR/Firms), F-04 (Contact Persons), F-05 (macOS Contacts Import) |

---

### F-03 · AOR / Firm Directory

| Attribute | Detail |
|---|---|
| **Feature Name** | AOR / Firm Directory |
| **Description** | Reusable directory of Advocates on Record and engaging law firms. Identical structure to Client Directory. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `ContactList.tsx` (type="firm"), `ContactDetail`, `ContactForm`, `ContactPersonsPanel.tsx`, `LinkedMattersPanel` |
| **Database Tables** | `firms`, `contact_persons` |
| **APIs** | `fetchFirms()`, `insertFirm(f)`, `updateFirm(f)`, `deleteFirm(id)`, `fetchMattersByFirmName(name)` |
| **Permissions** | macOS Contacts (optional) |
| **Dependencies** | F-04 (Contact Persons), F-05 (Contacts Import) |
| **Related Features** | F-01 (Matters), F-02 (Clients), F-04 (Contact Persons) |

---

### F-04 · Contact Persons

| Attribute | Detail |
|---|---|
| **Feature Name** | Contact Persons |
| **Description** | Named individuals within a client or firm. Can be designated as invoice recipients (addressing options D/E/F). Has full CRUD with macOS Contacts import. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `ContactPersonsPanel.tsx` (embedded in `ContactDetail`) |
| **Database Tables** | `contact_persons` |
| **APIs** | `fetchContactPersons(type, entityId)`, `fetchContactPerson(id)`, `insertContactPerson(cp)`, `updateContactPerson(cp)`, `deleteContactPerson(id)` |
| **Permissions** | macOS Contacts (optional) |
| **Dependencies** | Requires a saved `clients` or `firms` record as parent |
| **Related Features** | F-05 (Contacts Import), F-09 (Invoice Addressing), F-20 (Primary Contact on Matter) |

---

### F-05 · macOS Contacts Import

| Attribute | Detail |
|---|---|
| **Feature Name** | macOS Contacts Import |
| **Description** | Search the macOS Contacts app by name/company and import details into client, firm, or contact person forms. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `ContactPickerModal` (in `ContactList.tsx`), `ContactPickerModal` (in `ContactPersonsPanel.tsx`), `EntityPicker` in `MatterForm.tsx` |
| **Database Tables** | None (data flows to form fields only) |
| **APIs** | Tauri IPC: `invoke("search_contacts", { query })` → `MacContact[]` |
| **Permissions** | macOS TCC: Contacts (`NSContactsUsageDescription` in Info.plist) |
| **Dependencies** | `osascript`, JXA, macOS 13+ |
| **Related Features** | F-02, F-03, F-04 (all use this import flow) |

---

### F-06 · Appearances Tracking

| Attribute | Detail |
|---|---|
| **Feature Name** | Court Appearances Tracking |
| **Description** | Log court appearances per matter with hearing type, court, date, fee, and billing status. Unbilled items flow into invoice creation. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `Appearances.tsx` |
| **Database Tables** | `appearances` |
| **APIs** | `fetchAppearances(matterId)`, `fetchAllBillableAppearances(matterId)`, `markAppearancesBilled(ids[])`, `insertAppearance(a)`, `updateAppearance(a)`, `deleteAppearance(id)` |
| **Permissions** | None |
| **Dependencies** | Requires a matter |
| **Related Features** | F-08 (Invoice Generation — sources unbilled appearances) |

---

### F-07 · Time Entry Tracking

| Attribute | Detail |
|---|---|
| **Feature Name** | Time Entry Tracking |
| **Description** | Log billable and non-billable time entries per matter with description, duration, hourly rate, and billing status. Computed amount shown. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `TimeEntries.tsx` |
| **Database Tables** | `time_entries` |
| **APIs** | `fetchTimeEntries(matterId)`, `fetchAllBillableTimeEntries(matterId)`, `markTimeEntriesBilled(ids[])`, `insertTimeEntry(t)`, `updateTimeEntry(t)`, `deleteTimeEntry(id)` |
| **Permissions** | None |
| **Dependencies** | Requires a matter |
| **Related Features** | F-08 (Invoice Generation — sources unbilled time entries) |

---

### F-08 · Invoice Generation

| Attribute | Detail |
|---|---|
| **Feature Name** | GST Invoice Generation |
| **Description** | Create GST-compliant invoices from logged work. Auto-calculates CGST/SGST or IGST. Supports six addressing modes, three templates, and PDF export. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `Invoices.tsx` (InvoiceForm, InvoiceRow), `InvoicePDF.tsx` |
| **Database Tables** | `invoices`, `appearances` (is_billed update), `time_entries` (is_billed update) |
| **APIs** | `insertInvoice(inv)`, `fetchInvoices(matterId)`, `updateInvoice(inv)`, `deleteInvoice(id)`, `fetchAllBillableAppearances()`, `fetchAllBillableTimeEntries()`, `markAppearancesBilled()`, `markTimeEntriesBilled()` |
| **Permissions** | `dialog:allow-save`, `fs:allow-write-file` (for PDF export) |
| **Dependencies** | `@react-pdf/renderer`, `tauri-plugin-dialog`, `tauri-plugin-fs`, profile (for invoice header data) |
| **Related Features** | F-06, F-07 (work item sources), F-09 (addressing), F-10 (templates), F-11 (payments) |

---

### F-09 · Invoice Addressing (Six Options A–F)

| Attribute | Detail |
|---|---|
| **Feature Name** | Invoice Addressing Options |
| **Description** | Six modes for addressing invoices: org-level (A/B/C) or named contact person (D/E/F). Controls who appears in the "Bill To" block on the PDF. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `Invoices.tsx` (InvoiceForm addressing grid), `InvoicePDF.tsx` (Bill To rendering) |
| **Database Tables** | `invoices` (`address_mode`, `client_contact_id`, `firm_contact_id`), `contact_persons` |
| **APIs** | `fetchContactPersons()` (to populate dropdowns), `insertInvoice()` (saves mode + contact IDs) |
| **Permissions** | None |
| **Dependencies** | F-04 (contact persons must exist for options D/E/F), F-08 (invoice creation) |
| **Related Features** | F-04 (Contact Persons), F-08 (Invoice Generation), F-10 (PDF Templates) |

---

### F-10 · Invoice PDF Templates

| Attribute | Detail |
|---|---|
| **Feature Name** | Invoice PDF Templates |
| **Description** | Three professional PDF templates: Modern (coloured header), Classic (letterhead), Minimal (clean two-column). All support full customisation. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `InvoicePDF.tsx`, `InvoiceDesigner.tsx` (preview) |
| **Database Tables** | `settings` (profile.invoiceTemplate, profile.invoiceCustomization) |
| **APIs** | `loadProfile()`, `saveProfile()` |
| **Permissions** | None |
| **Dependencies** | `@react-pdf/renderer` (only Helvetica/Times/Courier built-in fonts supported) |
| **Related Features** | F-08 (Invoice Generation), F-11 (Invoice Designer) |

---

### F-11 · Invoice Designer

| Attribute | Detail |
|---|---|
| **Feature Name** | Invoice Designer |
| **Description** | Live-preview customisation UI for invoice templates. Accent colour, section toggles (GST, bank details, signature, matter info), header/footer notes, custom fields. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `InvoiceDesigner.tsx` (Settings → Invoice Designer) |
| **Database Tables** | `settings` (profile.invoiceCustomization) |
| **APIs** | `saveProfile()`, `loadProfile()` |
| **Permissions** | None |
| **Dependencies** | `@react-pdf/renderer` (live preview), sample data hardcoded in `InvoiceDesigner.tsx` |
| **Related Features** | F-10 (PDF Templates), F-22 (Profile & Settings) |

---

### F-12 · Payment Recording

| Attribute | Detail |
|---|---|
| **Feature Name** | Payment Recording |
| **Description** | Record payments against invoices with date, amount, and payment mode. Inline within invoice detail or via dedicated two-column Record Payment screen. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `RecordPayment.tsx` (two-column), `Invoices.tsx` (inline PaymentForm), `OutstandingDues.tsx` (inline) |
| **Database Tables** | `payments` |
| **APIs** | `insertPayment(p)`, `fetchPayments(invoiceId)` |
| **Permissions** | None |
| **Dependencies** | Requires an invoice |
| **Related Features** | F-13 (TDS Reconciliation), F-14 (Outstanding Dues), F-16 (Advance Payments) |

---

### F-13 · TDS Reconciliation

| Attribute | Detail |
|---|---|
| **Feature Name** | TDS Deduction & Reconciliation |
| **Description** | Record TDS (Tax Deducted at Source) alongside cash payments. App classifies invoice as: fully settled (green), TDS mismatch (amber), genuine shortfall (red). |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `RecordPayment.tsx` (TDS panel + ReconciliationBanner), `Invoices.tsx` (payment form), `OutstandingDues.tsx` (TDS panel) |
| **Database Tables** | `payments` (`tds_amount`, `tds_rate`, `tds_section`) |
| **APIs** | `insertPayment(p)` (includes TDS fields), `fetchPayments(invoiceId)` |
| **Permissions** | None |
| **Dependencies** | F-12 (Payment Recording) |
| **Related Features** | F-12 (Payments), F-14 (Outstanding Dues) |

---

### F-14 · Outstanding Dues Dashboard

| Attribute | Detail |
|---|---|
| **Feature Name** | Outstanding Dues Dashboard |
| **Description** | Cross-matter view of all unpaid and overdue invoices. Shows summary strip, per-invoice breakdown by overdue age bands, and inline payment recording. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `OutstandingDues.tsx` |
| **Database Tables** | `invoices`, `payments`, `matters` (via join in `fetchAllUnpaidInvoices`) |
| **APIs** | `fetchAllUnpaidInvoices()`, `insertPayment()`, `fetchAllPaymentsLog()` |
| **Permissions** | None |
| **Dependencies** | F-12, F-13 (payment recording with TDS) |
| **Related Features** | F-12, F-13, F-15 (Record Payment screen) |

---

### F-15 · Record Payment Screen

| Attribute | Detail |
|---|---|
| **Feature Name** | Record Payment (Dedicated Screen) |
| **Description** | Two-column dedicated screen: left panel shows all matters with unpaid invoices; right panel shows full payment form for selected item. Also supports advance payments. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `RecordPayment.tsx` |
| **Database Tables** | `payments`, `advance_payments`, `invoices` (read), `matters` (read) |
| **APIs** | `fetchAllUnpaidInvoices()`, `insertPayment()`, `insertAdvancePayment()`, `fetchAdvancePayments()`, `deleteAdvancePayment()`, `fetchAllPaymentsLog()`, `updateInvoice()` |
| **Permissions** | None |
| **Dependencies** | F-12 (payments), F-13 (TDS), F-16 (advance payments) |
| **Related Features** | F-12, F-13, F-14, F-16 |

---

### F-16 · Advance Payments

| Attribute | Detail |
|---|---|
| **Feature Name** | Advance / Retainer Payments |
| **Description** | Record advance or retainer fees per matter, not linked to a specific invoice. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `RecordPayment.tsx` ("Record Advance" button on each matter row) |
| **Database Tables** | `advance_payments` |
| **APIs** | `insertAdvancePayment(p)`, `fetchAdvancePayments(matterId)`, `deleteAdvancePayment(id)` |
| **Permissions** | None |
| **Dependencies** | Requires a matter |
| **Related Features** | F-12 (Payments), F-15 (Record Payment Screen) |

---

### F-17 · Backup & Restore

| Attribute | Detail |
|---|---|
| **Feature Name** | Backup & Restore |
| **Description** | Export all data to a dated JSON file; import and restore from a backup with preview and two-step confirmation. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `SettingsPage.tsx` (Backup & Restore section) |
| **Database Tables** | All 11 tables (read on export; delete + re-insert on restore) |
| **APIs** | `exportAllData()`, `importAllData(jsonStr)`, `dialogSave()`, `dialogOpen()`, `writeTextFile()`, `readTextFile()` |
| **Permissions** | `dialog:allow-save`, `dialog:allow-open`, `fs:allow-write-text-file`, `fs:allow-read-text-file` |
| **Dependencies** | `tauri-plugin-dialog`, `tauri-plugin-fs` |
| **Related Features** | F-22 (Settings), all data-producing features |

---

### F-18 · Matter Parties

| Attribute | Detail |
|---|---|
| **Feature Name** | Matter Parties |
| **Description** | Track parties represented in a matter (petitioner, respondent, etc.). Displayed in matter overview and on invoice PDFs in "Appearing for" section. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `MatterParties.tsx` (embedded in `MatterDetail.tsx`) |
| **Database Tables** | `matter_parties` |
| **APIs** | `fetchMatterParties(matterId)`, `insertMatterParty(p)`, `updateMatterParty(p)`, `deleteMatterParty(id)` |
| **Permissions** | None |
| **Dependencies** | Requires a matter |
| **Related Features** | F-01 (Matters), F-08 (Invoice PDF shows parties) |

---

### F-19 · Matter Reference Numbers

| Attribute | Detail |
|---|---|
| **Feature Name** | Auto-assigned Matter Reference Numbers |
| **Description** | Every matter gets a sequential reference number (#001, #002…) on creation. Immutable. Backfilled for existing matters on migration. Displayed in list and detail views. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `MatterList.tsx` (badge), `MatterDetail.tsx` (badge), `Dashboard.tsx` (recent matters list) |
| **Database Tables** | `matters` (`ref_number` column) |
| **APIs** | `insertMatter(m)` (auto-assigns via `MAX(ref_number)+1`), `fmtRef(ref)` utility |
| **Permissions** | None |
| **Dependencies** | None |
| **Related Features** | F-01 (Matters) |

---

### F-20 · Primary Contact Assignment on Matter

| Attribute | Detail |
|---|---|
| **Feature Name** | Primary Contact Assignment (per Matter) |
| **Description** | On each matter, designate a primary contact person for the client side and for the AOR/firm side. These pre-fill the invoice contact pickers. |
| **Status** | ⚠️ Partial |
| **User Roles** | All users |
| **Screens** | `MatterForm.tsx` (dropdowns appear when a saved entity has contact persons), **NOT shown in `MatterDetail.tsx`** |
| **Database Tables** | `matters` (`primary_client_contact_id`, `primary_firm_contact_id`) |
| **APIs** | `fetchContactPersons()`, `updateMatter()`, `insertMatter()` |
| **Permissions** | None |
| **Dependencies** | F-04 (Contact Persons must exist), F-02/F-03 (linked entity must be saved) |
| **Related Features** | F-04, F-09 (Invoice Addressing), F-08 (Invoices) |

> **Gap:** The assigned primary contacts are **not displayed in `MatterDetail.tsx`**. Users can set them in the form but have no way to see the current value without re-editing. Also: contact person dropdowns only appear when a saved entity is used — free-typed client/firm names never show the dropdown.

---

### F-21 · Onboarding

| Attribute | Detail |
|---|---|
| **Feature Name** | First-Run Onboarding |
| **Description** | Full-screen profile setup wizard shown when `isProfileSetup()` returns false. Collects identity, address, bank details, invoice preferences. |
| **Status** | ✅ Complete |
| **User Roles** | New users only |
| **Screens** | `Onboarding.tsx` (fixed, z-50 overlay) |
| **Database Tables** | `settings` (key: `profile`) |
| **APIs** | `saveProfile(p)`, `isProfileSetup()` |
| **Permissions** | None |
| **Dependencies** | None |
| **Related Features** | F-22 (Settings — same profile data) |

---

### F-22 · Profile & Settings

| Attribute | Detail |
|---|---|
| **Feature Name** | Profile & Application Settings |
| **Description** | Five profile sections (identity, address, bank, invoice prefs, designer) plus security, backup, and demo data sections. Saved to `settings` table. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `SettingsPage.tsx`, `InvoiceDesigner.tsx`, `LockSettings.tsx` |
| **Database Tables** | `settings` |
| **APIs** | `loadProfile()`, `saveProfile()`, `getLock()`, `setLock()`, `removeLock()`, `verifyLock()` |
| **Permissions** | None |
| **Dependencies** | All features that use profile data (invoice header, GST rate, prefix) |
| **Related Features** | All features that use profile (F-08, F-10, F-11, F-21, F-23) |

---

### F-23 · App Lock

| Attribute | Detail |
|---|---|
| **Feature Name** | PIN-based App Lock |
| **Description** | Optional PIN lock screen on every app launch. Stores SHA-256 hash. Supports set, change, remove. Manual lock via sidebar button. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `LockScreen.tsx`, `LockSettings.tsx` (Settings → Security) |
| **Database Tables** | `settings` (key: `lock`) |
| **APIs** | `getLock()`, `setLock(username, password)`, `verifyLock(username, password)`, `removeLock()` |
| **Permissions** | None |
| **Dependencies** | Web Crypto API (`crypto.subtle.digest`) |
| **Related Features** | F-22 (Settings) |

---

### F-24 · Dashboard

| Attribute | Detail |
|---|---|
| **Feature Name** | Practice Dashboard |
| **Description** | Home screen showing: active matters count, total invoiced, total received, outstanding balance, appearances count, time logged. Plus profile card and recent matters list. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `Dashboard.tsx` |
| **Database Tables** | `matters`, `invoices`, `payments`, `appearances`, `time_entries` (aggregate queries) |
| **APIs** | `fetchMatters()`, raw `db.select` aggregates (SUM, COUNT) |
| **Permissions** | None |
| **Dependencies** | All data-producing features |
| **Related Features** | All |

---

### F-25 · Demo Data

| Attribute | Detail |
|---|---|
| **Feature Name** | Demo Data Loader & Clear All Data |
| **Description** | Load realistic sample data (3 matters, 4 appearances, 4 time entries, 1 invoice, 1 payment) for testing. Clear All Data removes all transactional data while keeping profile. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `SettingsPage.tsx` (Demo Data section), `ScreenshotHelper.tsx` (dev-only ⌘⇧D) |
| **Database Tables** | All 11 tables |
| **APIs** | `loadDemoData()`, `removeAllData()` (from `demoData.ts`) |
| **Permissions** | None |
| **Dependencies** | None |
| **Related Features** | F-17 (Backup — recommended before clearing) |

---

### F-26 · Toast Notifications

| Attribute | Detail |
|---|---|
| **Feature Name** | Toast Notification System |
| **Description** | Context-based toast notification provider (`ToastProvider`) and hook (`useToast`). Infrastructure for transient UI notifications. |
| **Status** | ⚠️ Partial — **infrastructure exists; `useToast` is never called in any component** |
| **User Roles** | All users |
| **Screens** | `Toast.tsx` (provider only; no toast messages rendered anywhere) |
| **Database Tables** | None |
| **APIs** | `useToast()` hook (exported but unused) |
| **Permissions** | None |
| **Dependencies** | React Context |
| **Related Features** | All features that should show success/error feedback |

---

### F-27 · Developer Tip / Support the Developer

| Attribute | Detail |
|---|---|
| **Feature Name** | Developer Tip (UPI Payment) |
| **Description** | Pricing screen showing "Free Forever" plan and "Support the Creator" card with tip amounts (₹49/99/199/499/custom). UPI deep-link opens GPay/PhonePe/Paytm. |
| **Status** | 🔒 Hidden — code complete; button wrapped in `{false && ...}` in AboutModal |
| **User Roles** | All users |
| **Screens** | `SupportModal.tsx`, `AboutModal.tsx` (button hidden) |
| **Database Tables** | None |
| **APIs** | `openUrl("upi://pay?pa=ssmendon@icici&am=...")` via `@tauri-apps/plugin-opener` |
| **Permissions** | `opener:default` (already granted) |
| **Dependencies** | User's UPI app installed; `tauri-plugin-opener` |
| **Related Features** | F-28 (About Modal) |

---

### F-28 · About Modal

| Attribute | Detail |
|---|---|
| **Feature Name** | About Modal |
| **Description** | Shows app identity (M logo, version, "Free Forever" badge), profile fields, support email link, and close button. Accessible via ⓘ in sidebar. |
| **Status** | ✅ Complete |
| **User Roles** | All users |
| **Screens** | `AboutModal.tsx` |
| **Database Tables** | None |
| **APIs** | `mailto:` link via browser |
| **Permissions** | None |
| **Dependencies** | None |
| **Related Features** | F-27 (Tip screen, currently hidden) |

---

### F-29 · Invoice `overdue` Status Detection

| Attribute | Detail |
|---|---|
| **Feature Name** | Invoice Overdue Detection |
| **Description** | Invoices past their `due_date` should automatically transition to `overdue` status. Age bands (0–15, 15–30, 30–60, 60+ days) shown in Outstanding Dues. |
| **Status** | ⚠️ Partial — **overdue status must be set manually** (dropdown in UI); no automatic transition |
| **User Roles** | All users |
| **Screens** | `Invoices.tsx` (status dropdown includes `overdue`), `OutstandingDues.tsx` (age bands defined) |
| **Database Tables** | `invoices` (`status`, `due_date`) |
| **APIs** | `updateInvoice()` |
| **Permissions** | None |
| **Dependencies** | None |
| **Related Features** | F-08 (Invoices), F-14 (Outstanding Dues) |

---

### F-30 · Invoice PDF Path Storage

| Attribute | Detail |
|---|---|
| **Feature Name** | Invoice PDF Path Storage |
| **Description** | `invoices.pdf_path` column exists to store the file path of a saved PDF for re-opening. |
| **Status** | 🗄️ Schema-only — **column exists and is read/written in SQL; never set to a real value in code; never used in UI** |
| **User Roles** | All users |
| **Screens** | None |
| **Database Tables** | `invoices` (`pdf_path`) |
| **APIs** | `insertInvoice()`, `updateInvoice()` (passes `inv.pdf_path ?? null` but it's always null) |
| **Permissions** | None |
| **Dependencies** | Would need file system integration to set |
| **Related Features** | F-08 (Invoice Generation) |

---

### F-31 · Apple Contacts Sync (Contact Persons)

| Attribute | Detail |
|---|---|
| **Feature Name** | Apple Contacts ID Tracking |
| **Description** | `contact_persons.apple_contact_id` column reserved for future two-way Apple Contacts sync. Currently stores `undefined` / `null` on all records. |
| **Status** | 🗄️ Schema-only — **column exists; always set to `null`; no sync logic implemented** |
| **User Roles** | All users |
| **Screens** | None |
| **Database Tables** | `contact_persons` (`apple_contact_id`) |
| **APIs** | `insertContactPerson()`, `updateContactPerson()` (passes `cp.apple_contact_id ?? null`) |
| **Permissions** | None |
| **Dependencies** | Would need Contacts write permission + background sync logic |
| **Related Features** | F-04 (Contact Persons), F-05 (Contacts Import) |

---

## Part 2 — Gap Analysis

---

### 2A · Features Partially Implemented

| # | Feature | What's Missing | File / Location |
|---|---|---|---|
| 1 | **F-20 · Primary Contact Assignment** | • Contacts only appear when a saved entity is linked (free-typed names skip the picker) • Assigned contacts not displayed in `MatterDetail.tsx` overview | `MatterForm.tsx`, `MatterDetail.tsx` |
| 2 | **F-26 · Toast Notifications** | `ToastProvider` and `useToast` hook are in place but `useToast()` is never called anywhere — no component shows toast messages. All user feedback is via inline state (saving/saved labels, error divs). | `Toast.tsx` is complete; every component that needs feedback is missing the hook |
| 3 | **F-29 · Invoice Overdue Detection** | `OutstandingDues.tsx` defines age bands (0–15, 15–30, 30–60, 60+ days) and counts overdue invoices at runtime. However, invoice `status` is not automatically updated to `overdue` — users must manually change the status. No scheduled job or startup scan exists. | `Invoices.tsx` status dropdown, `db.ts` (no auto-update query) |
| 4 | **App Lock — Username field** | `setLock(username, password)` takes two parameters. The UI in `LockSettings.tsx` exposes a `username` field alongside the password. Most single-user lock implementations are PIN-only. The username creates confusion — is this meant to be a proper credential or just a display name? The architecture is inconsistently documented as "PIN-based" but implemented as username+password. | `db.ts:636`, `LockSettings.tsx:42` |

---

### 2B · Features Not Connected to UI

| # | Item | Type | Evidence |
|---|---|---|---|
| 1 | `fetchUnbilledTimeEntries(matterId)` | DB function | Exported in `db.ts`; zero imports in any component |
| 2 | `fetchUnbilledAppearances(matterId)` | DB function | Exported in `db.ts`; zero imports in any component |
| 3 | `fetchInvoiceSettlement(invoiceId)` | DB function | Exported in `db.ts`; zero imports in any component (settlement is computed inline in other functions) |
| 4 | `deletePayment(id)` | DB function | Exported in `db.ts`; zero imports in any component — once recorded, payments cannot be deleted via UI |
| 5 | `useToast()` hook | React hook | Exported from `Toast.tsx`; never imported by any component |
| 6 | `SupportModal.tsx` (tip screen) | Component | Imported in `AboutModal.tsx` but wrapped in `{false && ...}` — never rendered to user |
| 7 | `invoice.pdf_path` field | DB column + TypeScript | Persisted in SQL; interface has `pdf_path?: string`; always `null`; never used by any UI action |
| 8 | `contact_persons.apple_contact_id` | DB column | Stored as `null` everywhere; no UI reads or writes to it meaningfully |
| 9 | `MatterDetail.tsx` showing primary contacts | UI gap | `primary_client_contact_id` and `primary_firm_contact_id` are set in `MatterForm`; never displayed in `MatterDetail` |

---

### 2C · Unused Database Tables

All 11 tables are actively used. No table is completely unused. However:

| Table | Status | Notes |
|---|---|---|
| `matters` | ✅ Active | |
| `clients` | ✅ Active | |
| `firms` | ✅ Active | |
| `contact_persons` | ✅ Active | `apple_contact_id` column unused |
| `invoices` | ✅ Active | `pdf_path` column unused |
| `payments` | ✅ Active | No delete UI (orphaned rows can't be removed) |
| `advance_payments` | ✅ Active | |
| `appearances` | ✅ Active | |
| `time_entries` | ✅ Active | |
| `matter_parties` | ✅ Active | |
| `settings` | ✅ Active | |

**Unused columns (not tables):**

| Column | Table | Issue |
|---|---|---|
| `pdf_path` | `invoices` | Always null; no code ever sets it to a real path |
| `apple_contact_id` | `contact_persons` | Always null; reserved for future sync |

---

### 2D · Unused / Disconnected APIs

| Function | File | Issue |
|---|---|---|
| `fetchUnbilledTimeEntries(matterId)` | `db.ts` | Exported; never imported; `fetchAllBillableTimeEntries` is used instead |
| `fetchUnbilledAppearances(matterId)` | `db.ts` | Exported; never imported; `fetchAllBillableAppearances` is used instead |
| `fetchInvoiceSettlement(invoiceId)` | `db.ts` | Exported; never imported; settlement computed inline in `fetchAllUnpaidInvoices` |
| `deletePayment(id)` | `db.ts` | Exported; never imported in any component |
| `useToast()` | `Toast.tsx` | Exported; never called in any component |

---

### 2E · Duplicate Functionality

| # | Duplicated Item | Locations | Impact |
|---|---|---|---|
| 1 | **`function inr(n)`** — INR currency formatter | `Appearances.tsx`, `Dashboard.tsx`, `MatterDetail.tsx`, `Invoices.tsx`, `TimeEntries.tsx`, `OutstandingDues.tsx`, `RecordPayment.tsx`, `InvoicePDF.tsx` — **8 copies** | Any change to formatting (e.g. decimal places, Rs. prefix) must be made in 8 places |
| 2 | **`const INDIAN_STATES`** — 35-item array | `ContactList.tsx`, `MatterForm.tsx`, `Onboarding.tsx`, `SettingsPage.tsx` — **4 copies** | Adding/removing a state requires editing 4 files |
| 3 | **`interface MacContact`** — macOS Contacts result type | `ContactList.tsx:28`, `ContactPersonsPanel.tsx:22` — **2 copies** | Must stay in sync; should be in `types.ts` |
| 4 | **`function ContactPickerModal`** — macOS Contacts search modal | `ContactList.tsx:80`, `ContactPersonsPanel.tsx:32` — **2 complete copies** (~100 lines each) | Bug fixes must be applied twice |
| 5 | **`recipient` / `setRecipient` state** | `Invoices.tsx:437` — state exists as `const [, setRecipient]` (value discarded); kept only to satisfy the `useEffect` that calls `setRecipient()` | Dead state — the value is set but never read; the new `addressMode` state replaced it |
| 6 | **`calcGST` function** | Only in `Invoices.tsx` — not duplicated, but `OutstandingDues.tsx` and `RecordPayment.tsx` do their own inline total calculations | Inconsistent calculation sites |
| 7 | **`function matchState`** | Only in `ContactList.tsx` — works for entity form import; `ContactPersonsPanel.tsx` does NOT have it, so contact person address state import doesn't auto-map | Inconsistent behaviour between two Contacts import flows |

---

### 2F · Technical Debt

| # | Item | Severity | Detail | Recommended Fix |
|---|---|---|---|---|
| 1 | **`inr()` duplicated 8×** | Medium | Any formatting change breaks silently across files | Extract to `src/utils.ts`; import everywhere |
| 2 | **`INDIAN_STATES` duplicated 4×** | Medium | Adding a state/UT requires editing 4 files | Extract to `src/constants.ts` |
| 3 | **`MacContact` interface duplicated** | Low | Two definitions that must stay in sync | Move to `src/types.ts` |
| 4 | **`ContactPickerModal` duplicated** | Medium | ~200 lines of identical code in two files; bugs fixed in one won't apply to the other | Extract to `src/components/shared/ContactPickerModal.tsx` |
| 5 | **`pdf_path` column — dead code** | Low | Column exists in schema, SQL, interface, and CRUD functions; always `null`; no UI | Remove from SQL inserts/updates or implement the feature (PDF path saving on export) |
| 6 | **`apple_contact_id` — reserved but never set** | Low | Column in schema; interface has it; always `null` | Document as explicitly reserved; add comment; or remove until feature is built |
| 7 | **Dead `recipient`/`setRecipient` state** | Low | `const [, setRecipient]` in `Invoices.tsx:437` — value is set in `useEffect` but discarded; `addressMode` replaced it | Remove the state and the `setRecipient` calls |
| 8 | **`fetchUnbilledTimeEntries` / `fetchUnbilledAppearances` — never called** | Low | These were superseded by `fetchAllBillable*` variants but never removed | Remove unused functions or document their intended use |
| 9 | **`fetchInvoiceSettlement` — never called** | Low | Exported function that computes payment totals; same logic is inline elsewhere | Remove or wire up to the invoice detail view to replace inline calculation |
| 10 | **`deletePayment` — no UI** | Medium | Payments can be recorded but never deleted. Incorrect payments become permanent | Implement a delete confirmation on expanded payment rows |
| 11 | **Invoice `overdue` is manual** | High | No automatic detection or nightly scan; `OutstandingDues.tsx` computes overdue days dynamically but never updates `status` | Add startup scan: `UPDATE invoices SET status='overdue' WHERE status='sent' AND due_date < date('now')` in `migrate()` or app startup |
| 12 | **Toast system installed but unused** | Low | `ToastProvider` wraps the entire app; `useToast()` is never called; all feedback is via inline state | Either remove `ToastProvider` and `Toast.tsx`, or wire `useToast()` into key actions (save, delete, export) |
| 13 | **Primary contact not shown in `MatterDetail`** | Medium | Users set primary contacts in the form but can't see the assigned value without re-opening the form | Add a "Primary Contacts" row in the MatterDetail info grid |
| 14 | **`matchState` missing from `ContactPersonsPanel`** | Low | When importing a contact person from Contacts, the address state is imported as raw text (e.g. "MH") but not auto-mapped to INDIAN_STATES. The same flow in `ContactList.tsx` DOES auto-map. | Copy `matchState` logic to `ContactPersonsPanel.tsx` or extract to `utils.ts` |
| 15 | **App Lock uses username+password, not PIN** | Medium | Documentation says "PIN-based" but implementation is username+password with SHA-256. The UI shows a username field, which is confusing for a single-user app. | Simplify to PIN-only (remove username), or update all documentation to say "username+password" |
| 16 | **`insertAllData` in backup is not transactional** | High | `importAllData()` deletes all rows then re-inserts. If an insert fails midway, the database is left in a partial state. | Wrap in `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` |
| 17 | **No invoice number uniqueness constraint** | Medium | Two invoices can have the same number; SQLite has no UNIQUE constraint on `invoice_number` | Add `UNIQUE` constraint (via migration) and handle the error gracefully in UI |
| 18 | **`ScreenshotHelper` has hardcoded future dates** | Low | The seed data in `ScreenshotHelper.tsx` uses `subDays(today, N)` which always works, but the hardcoded invoice numbers (INV-202605-001) embed a month that will look stale | Update to dynamic date formatting or make it irrelevant |

---

## Summary Counts

| Category | Count |
|---|---|
| Total features identified | 31 |
| ✅ Complete | 26 |
| ⚠️ Partially implemented | 4 |
| 🔒 Hidden (code complete, UI disabled) | 1 |
| 🗄️ Schema-only (no UI) | 2 |
| APIs exported but never called | 5 |
| Duplicate code blocks | 7 |
| Technical debt items | 18 |
| Unused DB columns | 2 |
| Unused DB tables | 0 |
