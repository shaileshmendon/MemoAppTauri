# Memo — Reports User Guide

> v1.2.0 · Last updated: 2026-06-04

---

## Overview

Memo's Reports module gives you financial visibility into your practice. All reports are read-only, generated on-demand, and exportable.

**Navigate to Reports:** Click **Reports** in the sidebar, or press `⌘6`.

---

## Financial Year

All reports support the **Indian Financial Year** (April 1 → March 31).

The **FY selector** defaults to the current financial year. You can also select:

| Preset | Period |
|---|---|
| Full Year | Apr 1 → Mar 31 |
| Q1 | Apr 1 → Jun 30 |
| Q2 | Jul 1 → Sep 30 |
| Q3 | Oct 1 → Dec 31 |
| Q4 | Jan 1 → Mar 31 |
| H1 | Apr 1 → Sep 30 |
| H2 | Oct 1 → Mar 31 |
| This Month | Calendar month |
| Custom Range | Pick any start/end date |

---

## Reports

### 1. Invoice Register

**Use for:** GST filing, audit trail, handing to accountant at year-end.

**What it shows:** Every invoice raised in the selected period (excluding drafts by default). One row per invoice.

**Columns:**
- Invoice Number, Invoice Date, Due Date
- Client, Matter
- Subtotal, CGST, SGST, IGST, Total
- Status (Sent / Paid / Partially Paid / Overdue / Cancelled)
- Amount Received, TDS Deducted, Outstanding Balance

**Summary strip:**
- Total invoices, Amount Invoiced, GST Collected, Amount Received, Outstanding

**Filters:**
- Financial Year + Period
- Status (filter to just Paid, just Overdue, etc.)

**Tip:** To generate a GST register for your CA, set Status = "All" and export to Excel or CSV.

---

### 2. Outstanding Invoices

**Use for:** Chasing payments, collections tracking, monthly AR review.

**What it shows:** All invoices that have a balance due (status: Sent, Partially Paid, Overdue). As of today.

**Ageing Buckets:** Click a bucket card to filter the table.

| Bucket | Days past due date |
|---|---|
| Not Yet Due | 0 |
| 0–30 Days | 1–30 |
| 31–60 Days | 31–60 |
| 61–90 Days | 61–90 |
| 90+ Days | Over 90 |

**Summary strip:**
- Total Outstanding, Invoice Count, Oldest Invoice Date, Avg Days Overdue

**Excel export** includes a second sheet: **Ageing Analysis** — bucket totals with percentages.

---

### 3. Revenue Summary

**Use for:** Monthly practice P&L review, tracking growth, presenting to partners.

**What it shows:** One row per month showing invoiced vs collected, with a mini bar chart above.

**Columns:**
- Month, Invoices (count), Amount Invoiced, GST, Amount Collected, TDS, Outstanding, Collection %

**Collection %** indicator:
- 🟢 Green bar = 90%+
- 🟡 Amber bar = 60–89%
- 🔴 Red bar = below 60%

**Excel export** includes a second sheet: **Summary** — single-page totals for sharing with stakeholders.

---

### 4. Collections Follow-Up

**Use for:** Making follow-up calls. Share with billing staff.

**What it shows:** Overdue invoices with the primary contact's name, phone, and email (from the Clients module).

> **Note:** Contact details appear only for matters where a Primary Client Contact is set. Go to **Clients → Contact Persons** to add contacts.

**Rows highlighted red** = 90+ days overdue.

**Export to Excel or CSV** to share with a billing staff member as a call list.

---

## Accountant Package

The Accountant Package generates a **single Excel workbook** with 6 sheets — ready to send to your CA at quarter-end or year-end.

**Sheets included:**

| Sheet | Contents |
|---|---|
| Invoice Register | All invoices for the period |
| Outstanding Invoices | Current unpaid invoices |
| Ageing Analysis | Bucket totals and percentages |
| Revenue Summary | Month-by-month revenue |
| Payments Register | All payments received |
| Client Summary | Per-client invoiced / collected totals |

**File name:** `Accountant_Package_FY2025_26.xlsx` (period auto-fills)

**How to use:**
1. Click **Generate Accountant Package** on the Reports landing page
2. Select the financial year / period
3. Click **Generate Package**
4. A save dialog will appear — choose where to save

---

## Exports

Every report supports three export formats:

### CSV
- UTF-8 BOM encoding (₹ symbol displays correctly in Excel)
- Raw numeric values (not formatted) — Excel can re-aggregate
- Dates in ISO format (`YYYY-MM-DD`) — sorts correctly in spreadsheets
- Named: `Invoice_Register_FY2025_26.csv`

### Excel (.xlsx)
- Frozen header row
- Auto-filters on all columns
- INR currency format (`₹1,23,456.00`)
- Date format (`DD-MMM-YYYY`)
- Bold total row at the bottom
- Named: `Invoice_Register_FY2025_26.xlsx`

### Print / Save PDF
- Click **Print / Save PDF** in the Export dropdown
- macOS Print dialog opens
- Select **Save as PDF** in the PDF dropdown at the bottom-left

---

## Naming Convention

Files are auto-named based on the selected period:

| Period | File name |
|---|---|
| Full FY 2025-26 | `Invoice_Register_FY2025_26.xlsx` |
| Q1 of FY 2025-26 | `Invoice_Register_Q1_FY2025_26.xlsx` |
| April 2025 | `Invoice_Register_Apr_2025.xlsx` |
| Accountant Package | `Accountant_Package_FY2025_26.xlsx` |

---

## Performance

Reports use SQL aggregation — they do not load all rows into JavaScript. A practice with 10,000+ invoices will generate reports in under 1 second.

Reports run **on demand** — they do not auto-run when you navigate to Reports. Click **Run Report** after setting your filters.

---

## Limitations (Phase 1)

- No bar charts on individual report pages (planned for v1.3.0)
- No saved filter preferences — filters reset on every visit
- Revenue Summary groups by calendar month only (quarterly grouping: select Q1/Q2/Q3/Q4 preset)
- Outstanding Invoices always shows current state (no historical as-of-date queries)
- Contact details in Collections Follow-Up require a Primary Client Contact set on the matter

---

*Memo Reports — built for Indian advocates · v1.2.0*
