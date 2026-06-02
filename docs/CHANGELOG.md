# Changelog — Memo

All notable changes to Memo are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-06-02 · Initial Release

### Added

#### Application Foundation
- Tauri 2 + React 19 + TypeScript 5.8 + SQLite desktop app for macOS
- Custom black & white theme; M-logo icon; "Memo" app name and branding
- Overlay title bar with `data-tauri-drag-region` custom drag area
- Minimum window size: 900 × 600; default: 1280 × 800
- React StrictMode + ErrorBoundary + ToastProvider root structure
- `color-scheme: light` locked in CSS (prevents Dark Mode causing invisible input text)

#### Matter Management
- Create, edit, delete legal matters
- Auto-assigned sequential reference numbers (#001, #002…) — immutable after assignment
- Backfill of reference numbers for existing matters on migration
- Matter types: litigation, advisory, drafting, corporate, other
- Matter statuses: active, closed, on-hold
- Matter list with real-time search and grouping (by client / by firm)
- Matter detail with stat cards: time logged, appearances, invoices
- Matter parties (petitioner, respondent, etc.) displayed in overview
- Handler / associate-in-charge section on each matter
- Cascade deletion of all child records when matter is deleted

#### Client & AOR/Firm Directory
- Separate directories for Clients and AOR/Firms
- Searchable entity picker in matter form — create new clients/firms without leaving the form
- "Save to database" prompt when entering a new name not in the directory
- Linked Matters panel on each client/firm record (case-insensitive name matching)
- Import entity details from macOS Contacts app

#### Contact Persons
- Multiple named contact persons per client and per firm
- Fields: name, designation, company, email, phone, mobile, address, notes, Apple Contact ID (reserved)
- Import from macOS Contacts with one click
- `updated_at` timestamp maintained on every edit
- Selectable as primary contacts on matters

#### macOS Contacts Integration
- Rust `search_contacts` command using JXA (JavaScript for Automation) via `osascript`
- Async, non-blocking via `tauri::async_runtime::spawn_blocking`
- Two `app.people.whose()` queries: by name and by organisation
- Up to 40 results; duplicates removed by name key
- `NSContactsUsageDescription` in `Info.plist` for proper TCC prompt
- Graceful error handling for denied permission
- Indian state abbreviation mapping (MH → Maharashtra, DL → Delhi, etc.)

#### Appearances Tracking
- Log court appearances with: date, court, hearing type, fee amount, notes
- 17 hearing type options across court appearances and professional work
- `is_billed` tracking; unbilled items pre-selected in invoice form
- Billed badge shown after inclusion in sent invoice

#### Time Entry Tracking
- Log billable and non-billable time entries
- Computed billing amount: `(duration_minutes / 60) × rate_per_hour`
- `is_billed` tracking; same pattern as appearances

#### Invoice Generation
- GST-compliant invoice generation
- CGST + SGST for intra-state; IGST for inter-state (based on supplier and recipient state)
- Supported GST rates: 0%, 5%, 12%, 18%
- Auto-numbered invoices using configurable prefix (e.g. INV-202605-001)
- Pre-populated with all unbilled appearances and time entries
- Custom line items (expenses, etc.)
- Invoice statuses: draft, sent, paid, partially_paid, overdue, cancelled
- Sending a draft marks all selected work items as billed

#### Six Invoice Addressing Options (A–F)
- A: AOR/Firm organisation only
- B: Client organisation only  
- C: Both organisations
- D: Named contact person at AOR/Firm
- E: Named contact person at Client
- F: Named contact persons at both
- Contact person picker with pre-fill from matter's primary contacts

#### Invoice PDF Export
- `@react-pdf/renderer` client-side PDF generation (no server needed)
- Three professional templates: Modern, Classic, Minimal
- Amount in words (Indian numbering system: crore, lakh, thousand)
- "Rs." used instead of ₹ (built-in PDF fonts lack ₹ glyph)
- Native Save dialog via `tauri-plugin-dialog`
- Contact person addressing for Options D/E/F
- Backward-compatible rendering (older invoices use `recipient_type` field)

#### Invoice Designer
- Live PDF preview with 400ms debounce
- Template selection with thumbnail previews
- Accent colour (8 presets + custom hex)
- Toggles: GST breakdown, bank details, signature, matter info
- Header note, footer note, custom fields
- Settings saved to profile's `invoiceCustomization` object

#### Payment Recording & TDS Reconciliation
- Record payments against invoices with date, amount, mode
- Payment modes: NEFT, RTGS, IMPS, UPI, cheque, cash, other
- TDS recording with section (194J(b) 10%, 194J(a) 2%, 194C(1) 1%, 194C(2) 2%, custom)
- Three-state reconciliation banner: fully settled (green), TDS mismatch (amber), genuine shortfall (red)
- Invoice paid when `SUM(amount_paid) + SUM(tds_amount) >= total_amount`
- Advance/retainer payments per matter (not invoice-linked)
- Two-column Record Payment screen: matter list + payment form
- Quick payment from Outstanding Dues screen

#### Outstanding Dues Dashboard
- Cross-matter view of all unpaid/overdue invoices
- Per-invoice: total, paid, TDS, balance, days overdue
- Inline payment recording without navigating to matter

#### Backup & Restore
- Full JSON export of all 11 tables
- Backup file format: version 1 with counts and data per table
- Native file picker dialogs for save and load
- Preview before restore: validity check, record counts, export date
- Two-step confirmation for restore
- Forward-compatible restore (uses JSON column names, handles schema differences)
- `contact_persons` included in backup scope

#### App Security
- Optional PIN lock using SHA-256 (Web Crypto API)
- Lock screen on app launch when lock is enabled
- Manual lock via sidebar button
- Settings screen for set / change / remove lock

#### Profile & Settings
- Full advocate/firm profile: name, designation, Bar Council enrolment, GSTIN, PAN
- Office address, phone, email, website
- Bank details: account holder, bank, branch, account number, IFSC, UPI
- Invoice number prefix, signature text, default GST rate
- Per-profile invoice template and customisation settings

#### Developer Features
- Demo data loader (Settings → Demo Data)
- Clear All Data with two-step confirmation (keeps profile)
- Screenshot helper: ⌘⇧D in dev mode to toggle, seeds realistic sample data
- `demoData.ts` with `loadDemoData()` and `removeAllData()` utilities

#### About & Support
- About modal with M logo, version, "Free Forever" badge
- Support email: stripes_swoops_2b@icloud.com (mailto: link)
- Tip/support infrastructure built but hidden (UPI VPA: ssmendon@icici)
- SupportModal.tsx: ₹49/99/199/499/custom tip amounts, UPI deep-link, copy UPI ID

#### Documentation
- `/docs/README.md` — index and quick facts
- `/docs/PRODUCT_SPEC.md` — full product specification
- `/docs/FEATURE_CATALOG.md` — every feature documented
- `/docs/DATABASE_DOCUMENTATION.md` — schema, tables, ERD
- `/docs/ARCHITECTURE.md` — system design, tech stack
- `/docs/API_DOCUMENTATION.md` — all APIs and types
- `/docs/USER_GUIDE.md` — end user instructions
- `/docs/ADMIN_GUIDE.md` — installation and maintenance
- `/docs/DEPLOYMENT_GUIDE.md` — build and distribute
- `/docs/SECURITY.md` — security model and risks
- `/docs/CHANGELOG.md` — this file
- `/docs/AI_AGENT_GUIDE.md` — AI developer handoff
- `/docs/MASTER_DOCUMENTATION.md` — single-file complete reference

### Database Schema (v1.0.0)

Tables:
- `matters` (11 base + 4 migration columns)
- `clients`
- `firms`
- `contact_persons` (new in this version)
- `invoices` (13 base + 3 migration columns)
- `payments` (6 base + 3 migration columns)
- `advance_payments`
- `appearances`
- `time_entries`
- `matter_parties`
- `settings`

### Known Issues at Launch

- No invoice editing after creation (by design — invoices are accounting records)
- No invoice number uniqueness enforcement at DB level
- No brute-force protection on PIN lock
- Database stored unencrypted
- App not code-signed (Gatekeeper bypass required on first launch)
- No automated tests

---

## Upcoming (Planned)

### v1.1.0
- Activate "Support the Developer" tip flow
- Invoice editing for draft invoices
- Invoice number collision detection
- PIN brute-force lockout (5 attempts → 30 second delay)

### v1.2.0
- Email delivery of invoices (attachPDF + mailto: deep-link)
- Court date calendar view
- Matter closure summary report
- Bulk invoice status update

### Future
- iOS / iPad companion app
- Two-way Apple Contacts sync
- Multi-user / team mode with server backend
- GST e-invoicing (IRN generation)
- Tally / QuickBooks export
- Auto-update mechanism
- SQLite encryption (SQLCipher)
- Apple Developer code signing
