# Change Log

All notable changes to **Memo** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-05-31 · Initial Release

### Added

#### Core Application
- Tauri 2 + React + TypeScript + SQLite desktop app for macOS
- Black & white theme; custom M-logo icon and "Memo" branding
- Overlay title bar with custom drag region; min window 900 × 600

#### Matter Management
- Create, edit, and delete legal matters with auto-assigned reference numbers (#001, #002 …)
- Fields: case title, court, case number, matter type, status (active / closed / on-hold)
- Group matters in the sidebar by client or AOR / Firm
- Matter detail with stat cards (time, appearances, invoices)
- Matter parties (petitioner, respondent, etc.)

#### Client & AOR / Firm Records
- Dedicated Clients and AOR / Firms directories
- Searchable entity picker inside the New Matter form — create a new client/firm and save it to the database without leaving the form
- Linked Matters panel on each client/firm record — all active and closed matters shown at a glance
- Import entity details directly from macOS Contacts app

#### Contact Persons
- Multiple named contact persons per client or firm
- Fields: name, designation, company, email, phone, mobile, address, notes
- Import from macOS Contacts with one click
- Contact persons selectable as primary contacts on each matter

#### Invoicing
- Generate GST-compliant invoices (CGST + SGST or IGST depending on state)
- Three invoice templates: Modern, Classic, Minimal
- Invoice Designer with live PDF preview and customisation (accent colour, GST breakdown, bank details, signature, matter info, header/footer notes, custom fields)
- Six invoice addressing options (A–F): organisation only, named contact person, or both
- PDF export via native Save dialog
- Invoice statuses: Draft → Sent → Paid / Partially Paid / Overdue / Cancelled

#### Payments & TDS
- Record payments against invoices with mode (NEFT, RTGS, IMPS, UPI, cheque, cash)
- TDS deduction support — section 194J(b) (10%), 194J(a) (2%), 194C(1) (1%), 194C(2) (2%), custom rate
- Reconciliation banner distinguishes legitimate TDS deductions from genuine shortfalls
- Advance payment recording per matter
- Outstanding Dues dashboard with per-invoice payment breakdown

#### Time & Appearance Tracking
- Log court appearances with hearing type, court name, fee amount
- Log billable / non-billable time entries with duration and hourly rate
- Unbilled items auto-populate the New Invoice form for selection

#### Profile & Settings
- Advocate / firm profile: name, designation, bar enrolment, GSTIN, PAN, address, contact, bank details, UPI, invoice preferences
- Default GST rate selection (0 / 5 / 12 / 18 %)
- Invoice number prefix (e.g. INV-202605-001)
- Invoice template and customisation settings

#### Backup & Restore
- Export full database to a dated JSON file via native Save dialog
- Import / restore from a backup file with preview (record counts, export date)
- Two-step confirmation before restore to prevent accidental data loss
- Backup included in Settings → Backup & Restore

#### Security
- Optional app lock with SHA-256 hashed PIN/password
- Lock screen shown on launch when lock is enabled
- Lock / unlock from sidebar footer

#### macOS Contacts Integration
- Rust command (`search_contacts`) using JXA / osascript
- Async, non-blocking — results appear within ~300 ms
- Privacy permission prompt attributed to Memo (via `NSContactsUsageDescription`)
- Used in: Client form, Firm form, Contact Person form

#### Developer / Admin
- Demo data loader (Settings → Demo Data)
- Clear All Data option (keeps profile, wipes transactional data)
- Screenshot helper (⌘⇧D in dev mode)
- Support contact: stripes_swoops_2b@icloud.com
- UPI tip infrastructure (hidden pending activation): ssmendon@icici

---

## Upcoming / Planned

- Activate "Support the Developer" tip flow
- Two-way Apple Contacts synchronisation
- Exchange / Google Contacts integration
- Automated invoice recipient suggestions
- Contact activity history
- Email integration
