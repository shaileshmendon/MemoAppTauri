/**
 * engine.ts — Report query engine
 *
 * All SQL is run via tauri-plugin-sql (SQLite in-process).
 * Aggregations happen in SQL — we never load all rows into memory.
 * Every function is parameterised; no string interpolation of user data.
 */

import { getDb } from "../../db";
import type { InvoiceStatus } from "../../types";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ReportFilter {
  from: string;       // YYYY-MM-DD
  to:   string;       // YYYY-MM-DD
  clientName?: string; // exact match on matters.client_name; omit = all
  status?: InvoiceStatus | "all";
}

// ── 1. Invoice Register ───────────────────────────────────────────────────────

export interface InvoiceRegisterRow {
  invoice_id:     string;
  invoice_number: string;
  invoice_date:   string;
  due_date:       string;
  case_title:     string;
  client_name:    string;
  subtotal_amount: number;
  cgst:           number;
  sgst:           number;
  igst:           number;
  total_amount:   number;
  status:         InvoiceStatus;
  amount_paid:    number;
  tds_deducted:   number;
  balance_due:    number;
}

export interface InvoiceRegisterSummary {
  total_invoices:  number;
  amount_invoiced: number;
  total_gst:       number;
  amount_collected: number;
  balance_due:     number;
  tds_deducted:    number;
}

export async function fetchInvoiceRegister(
  filter: ReportFilter
): Promise<{ rows: InvoiceRegisterRow[]; summary: InvoiceRegisterSummary }> {
  const db = await getDb();

  const statusClause = (!filter.status || filter.status === "all")
    ? "i.status NOT IN ('draft')"
    : "i.status = ?";

  const clientClause = filter.clientName
    ? "AND m.client_name = ?"
    : "";

  const params: unknown[] = [filter.from, filter.to];
  if (filter.status && filter.status !== "all") params.push(filter.status);
  if (filter.clientName) params.push(filter.clientName);

  const sql = `
    SELECT
      i.id                AS invoice_id,
      i.invoice_number,
      i.invoice_date,
      i.due_date,
      m.case_title,
      m.client_name,
      i.subtotal_amount,
      i.cgst,
      i.sgst,
      i.igst,
      i.total_amount,
      i.status,
      COALESCE((
        SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.id
      ), 0) AS amount_paid,
      COALESCE((
        SELECT SUM(COALESCE(p.tds_amount,0)) FROM payments p WHERE p.invoice_id = i.id
      ), 0) AS tds_deducted,
      i.total_amount - COALESCE((
        SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.id
      ), 0) AS balance_due
    FROM invoices i
    JOIN matters m ON i.matter_id = m.id
    WHERE ${statusClause}
      AND i.invoice_date BETWEEN ? AND ?
      ${clientClause}
    ORDER BY i.invoice_date ASC, i.invoice_number ASC
  `;

  // Re-order params: status clause comes before date range
  const orderedParams: unknown[] = [];
  if (filter.status && filter.status !== "all") orderedParams.push(filter.status);
  orderedParams.push(filter.from, filter.to);
  if (filter.clientName) orderedParams.push(filter.clientName);

  const rows = await db.select<InvoiceRegisterRow[]>(sql, orderedParams);

  const summary: InvoiceRegisterSummary = {
    total_invoices:   rows.length,
    amount_invoiced:  rows.reduce((s, r) => s + r.total_amount, 0),
    total_gst:        rows.reduce((s, r) => s + r.cgst + r.sgst + r.igst, 0),
    amount_collected: rows.reduce((s, r) => s + r.amount_paid, 0),
    balance_due:      rows.reduce((s, r) => s + r.balance_due, 0),
    tds_deducted:     rows.reduce((s, r) => s + r.tds_deducted, 0),
  };

  return { rows, summary };
}

// ── 2. Outstanding Invoices ───────────────────────────────────────────────────

export interface OutstandingRow {
  invoice_id:        string;
  invoice_number:    string;
  invoice_date:      string;
  due_date:          string;
  case_title:        string;
  client_name:       string;
  total_amount:      number;
  amount_paid:       number;
  balance_due:       number;
  days_overdue:      number;
  ageing_bucket:     "current" | "0-30" | "31-60" | "61-90" | "90+";
  last_payment_date: string | null;
}

export interface OutstandingSummary {
  total_outstanding:        number;
  outstanding_count:        number;
  oldest_invoice_date:      string | null;
  avg_days_overdue:         number;
  bucket_current:           number;
  bucket_0_30:              number;
  bucket_31_60:             number;
  bucket_61_90:             number;
  bucket_90_plus:           number;
}

export async function fetchOutstandingInvoices(): Promise<{
  rows: OutstandingRow[];
  summary: OutstandingSummary;
}> {
  const db = await getDb();

  const rows = await db.select<OutstandingRow[]>(`
    SELECT
      i.id                AS invoice_id,
      i.invoice_number,
      i.invoice_date,
      i.due_date,
      m.case_title,
      m.client_name,
      i.total_amount,
      COALESCE((
        SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.id
      ), 0) AS amount_paid,
      i.total_amount - COALESCE((
        SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.id
      ), 0) AS balance_due,
      MAX(0, CAST(julianday('now') - julianday(i.due_date) AS INTEGER)) AS days_overdue,
      CASE
        WHEN julianday('now') - julianday(i.due_date) <= 0  THEN 'current'
        WHEN julianday('now') - julianday(i.due_date) <= 30 THEN '0-30'
        WHEN julianday('now') - julianday(i.due_date) <= 60 THEN '31-60'
        WHEN julianday('now') - julianday(i.due_date) <= 90 THEN '61-90'
        ELSE '90+'
      END AS ageing_bucket,
      (
        SELECT MAX(p.payment_date) FROM payments p WHERE p.invoice_id = i.id
      ) AS last_payment_date
    FROM invoices i
    JOIN matters m ON i.matter_id = m.id
    WHERE i.status IN ('sent', 'partially_paid', 'overdue')
    ORDER BY i.due_date ASC
  `);

  const positiveBalance = rows.filter(r => r.balance_due > 0);
  const summary: OutstandingSummary = {
    total_outstanding:   positiveBalance.reduce((s, r) => s + r.balance_due, 0),
    outstanding_count:   positiveBalance.length,
    oldest_invoice_date: positiveBalance.length > 0 ? positiveBalance[0].invoice_date : null,
    avg_days_overdue:    positiveBalance.length > 0
      ? Math.round(positiveBalance.reduce((s, r) => s + r.days_overdue, 0) / positiveBalance.length)
      : 0,
    bucket_current:  positiveBalance.filter(r => r.ageing_bucket === "current").reduce((s, r) => s + r.balance_due, 0),
    bucket_0_30:     positiveBalance.filter(r => r.ageing_bucket === "0-30").reduce((s, r) => s + r.balance_due, 0),
    bucket_31_60:    positiveBalance.filter(r => r.ageing_bucket === "31-60").reduce((s, r) => s + r.balance_due, 0),
    bucket_61_90:    positiveBalance.filter(r => r.ageing_bucket === "61-90").reduce((s, r) => s + r.balance_due, 0),
    bucket_90_plus:  positiveBalance.filter(r => r.ageing_bucket === "90+").reduce((s, r) => s + r.balance_due, 0),
  };

  return { rows: positiveBalance, summary };
}

// ── 3. Revenue Summary ────────────────────────────────────────────────────────

export interface RevenuePeriodRow {
  period:              string;  // "2025-04" (month) or "2025-Q1" etc.
  period_label:        string;  // "Apr 2025"
  invoice_count:       number;
  amount_invoiced:     number;
  gst_collected:       number;
  amount_collected:    number;
  tds_deducted:        number;
  balance_outstanding: number;
}

export interface RevenueSummary {
  total_invoiced:     number;
  total_collected:    number;
  total_outstanding:  number;
  total_gst:          number;
  total_tds:          number;
  invoice_count:      number;
  collection_rate:    number; // %
}

export async function fetchRevenueSummary(filter: ReportFilter): Promise<{
  rows: RevenuePeriodRow[];
  summary: RevenueSummary;
}> {
  const db = await getDb();

  // Monthly aggregation from SQL; grouping into quarters/halves done in JS
  const monthlyRaw = await db.select<{
    period: string;
    invoice_count: number;
    amount_invoiced: number;
    gst_collected: number;
    amount_collected: number;
    tds_deducted: number;
  }[]>(`
    SELECT
      strftime('%Y-%m', i.invoice_date)   AS period,
      COUNT(*)                             AS invoice_count,
      SUM(i.total_amount)                  AS amount_invoiced,
      SUM(i.cgst + i.sgst + i.igst)       AS gst_collected,
      COALESCE(SUM(p_agg.amount_paid), 0) AS amount_collected,
      COALESCE(SUM(p_agg.tds_total),   0) AS tds_deducted
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id,
             SUM(amount_paid)             AS amount_paid,
             SUM(COALESCE(tds_amount, 0)) AS tds_total
      FROM payments
      GROUP BY invoice_id
    ) p_agg ON p_agg.invoice_id = i.id
    WHERE i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date BETWEEN ? AND ?
    GROUP BY strftime('%Y-%m', i.invoice_date)
    ORDER BY period ASC
  `, [filter.from, filter.to]);

  const rows: RevenuePeriodRow[] = monthlyRaw.map(r => ({
    ...r,
    period_label:        formatMonthLabel(r.period),
    balance_outstanding: r.amount_invoiced - r.amount_collected,
  }));

  const summary: RevenueSummary = {
    total_invoiced:    rows.reduce((s, r) => s + r.amount_invoiced, 0),
    total_collected:   rows.reduce((s, r) => s + r.amount_collected, 0),
    total_outstanding: rows.reduce((s, r) => s + r.balance_outstanding, 0),
    total_gst:         rows.reduce((s, r) => s + r.gst_collected, 0),
    total_tds:         rows.reduce((s, r) => s + r.tds_deducted, 0),
    invoice_count:     rows.reduce((s, r) => s + r.invoice_count, 0),
    collection_rate:   0,
  };
  if (summary.total_invoiced > 0)
    summary.collection_rate = Math.round((summary.total_collected / summary.total_invoiced) * 100);

  return { rows, summary };
}

function formatMonthLabel(period: string): string {
  const [y, m] = period.split("-");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

// ── 4. Collections Follow-Up ──────────────────────────────────────────────────

export interface CollectionsRow {
  invoice_id:        string;
  client_name:       string;
  case_title:        string;
  invoice_number:    string;
  invoice_date:      string;
  due_date:          string;
  days_overdue:      number;
  total_amount:      number;
  balance_due:       number;
  last_payment_date: string | null;
  contact_person:    string | null;
  contact_phone:     string | null;
  contact_email:     string | null;
}

export async function fetchCollectionsFollowUp(filter: ReportFilter): Promise<CollectionsRow[]> {
  const db = await getDb();

  const clientClause = filter.clientName ? "AND m.client_name = ?" : "";
  const params: unknown[] = [filter.from, filter.to];
  if (filter.clientName) params.push(filter.clientName);

  const rows = await db.select<CollectionsRow[]>(`
    SELECT
      i.id                  AS invoice_id,
      m.client_name,
      m.case_title,
      i.invoice_number,
      i.invoice_date,
      i.due_date,
      MAX(0, CAST(julianday('now') - julianday(i.due_date) AS INTEGER)) AS days_overdue,
      i.total_amount,
      i.total_amount - COALESCE((
        SELECT SUM(p.amount_paid) FROM payments p WHERE p.invoice_id = i.id
      ), 0) AS balance_due,
      (
        SELECT MAX(p.payment_date) FROM payments p WHERE p.invoice_id = i.id
      ) AS last_payment_date,
      cp.name   AS contact_person,
      cp.mobile AS contact_phone,
      cp.email  AS contact_email
    FROM invoices i
    JOIN matters m ON i.matter_id = m.id
    LEFT JOIN contact_persons cp ON cp.id = m.primary_client_contact_id
    WHERE i.status IN ('sent', 'partially_paid', 'overdue')
      AND i.due_date BETWEEN ? AND ?
      ${clientClause}
    ORDER BY i.due_date ASC
  `, params);

  return rows.filter(r => r.balance_due > 0);
}

// ── 5. Payments Register (for Accountant Package) ─────────────────────────────

export interface PaymentsRegisterRow {
  payment_id:     string;
  payment_date:   string;
  invoice_number: string;
  invoice_date:   string;
  case_title:     string;
  client_name:    string;
  amount_paid:    number;
  tds_amount:     number;
  tds_section:    string | null;
  mode:           string;
  notes:          string | null;
}

export async function fetchPaymentsRegister(filter: ReportFilter): Promise<PaymentsRegisterRow[]> {
  const db = await getDb();

  return db.select<PaymentsRegisterRow[]>(`
    SELECT
      p.id             AS payment_id,
      p.payment_date,
      i.invoice_number,
      i.invoice_date,
      m.case_title,
      m.client_name,
      p.amount_paid,
      COALESCE(p.tds_amount, 0) AS tds_amount,
      p.tds_section,
      p.mode,
      p.notes
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN matters  m ON m.id = i.matter_id
    WHERE p.payment_date BETWEEN ? AND ?
    ORDER BY p.payment_date ASC
  `, [filter.from, filter.to]);
}

// ── 6. Client Summary (for Accountant Package) ────────────────────────────────

export interface ClientSummaryRow {
  client_name:      string;
  matter_count:     number;
  invoice_count:    number;
  amount_invoiced:  number;
  amount_collected: number;
  balance_due:      number;
  tds_deducted:     number;
}

export async function fetchClientSummary(filter: ReportFilter): Promise<ClientSummaryRow[]> {
  const db = await getDb();

  return db.select<ClientSummaryRow[]>(`
    SELECT
      m.client_name,
      COUNT(DISTINCT m.id)                           AS matter_count,
      COUNT(DISTINCT i.id)                           AS invoice_count,
      COALESCE(SUM(i.total_amount), 0)               AS amount_invoiced,
      COALESCE(SUM(p_agg.amount_paid), 0)            AS amount_collected,
      COALESCE(SUM(i.total_amount), 0) -
        COALESCE(SUM(p_agg.amount_paid), 0)          AS balance_due,
      COALESCE(SUM(p_agg.tds_total),  0)             AS tds_deducted
    FROM matters m
    LEFT JOIN invoices i ON i.matter_id = m.id
      AND i.status NOT IN ('draft', 'cancelled')
      AND i.invoice_date BETWEEN ? AND ?
    LEFT JOIN (
      SELECT invoice_id,
             SUM(amount_paid)             AS amount_paid,
             SUM(COALESCE(tds_amount, 0)) AS tds_total
      FROM payments GROUP BY invoice_id
    ) p_agg ON p_agg.invoice_id = i.id
    GROUP BY m.client_name
    HAVING invoice_count > 0
    ORDER BY amount_invoiced DESC
  `, [filter.from, filter.to]);
}
