/**
 * AccountantPackage — Export all reports as a single Excel workbook
 *
 * Generates: Accountant_Package_[Period].xlsx with sheets:
 *   1. Invoice Register
 *   2. Outstanding Invoices
 *   3. Ageing Analysis
 *   4. Revenue Summary
 *   5. Payments Register
 *   6. Client Summary
 */

import { useState } from "react";
import { Package, Loader2, CheckCircle2 } from "lucide-react";
import ExcelJS from "exceljs";
import { save }      from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  fetchInvoiceRegister,
  fetchOutstandingInvoices,
  fetchRevenueSummary,
  fetchPaymentsRegister,
  fetchClientSummary,
} from "../../lib/reports/engine";
import { addReportSheet } from "../../lib/reports/excelExport";
import { periodLabel } from "../../lib/reports/financialYear";
import type { PeriodState } from "./ReportFilters";
import { PeriodPicker, defaultPeriod, resolvedRange } from "./ReportFilters";

// ── Column definitions (reused from individual reports) ───────────────────────

const COL_INVOICE_REGISTER = [
  { key: "invoice_number",  header: "Invoice No.",    type: "text"     as const, width: 14 },
  { key: "invoice_date",    header: "Invoice Date",   type: "date"     as const, width: 14 },
  { key: "due_date",        header: "Due Date",       type: "date"     as const, width: 14 },
  { key: "client_name",     header: "Client",         type: "text"     as const, width: 28 },
  { key: "case_title",      header: "Matter",         type: "text"     as const, width: 36 },
  { key: "subtotal_amount", header: "Subtotal",       type: "currency" as const, width: 14 },
  { key: "cgst",            header: "CGST",           type: "currency" as const, width: 12 },
  { key: "sgst",            header: "SGST",           type: "currency" as const, width: 12 },
  { key: "igst",            header: "IGST",           type: "currency" as const, width: 12 },
  { key: "total_amount",    header: "Total",          type: "currency" as const, width: 14 },
  { key: "status",          header: "Status",         type: "text"     as const, width: 14 },
  { key: "amount_paid",     header: "Amt Received",   type: "currency" as const, width: 14 },
  { key: "tds_deducted",    header: "TDS Deducted",   type: "currency" as const, width: 14 },
  { key: "balance_due",     header: "Outstanding",    type: "currency" as const, width: 14 },
];

const COL_OUTSTANDING = [
  { key: "invoice_number",    header: "Invoice No.",   type: "text"     as const, width: 14 },
  { key: "client_name",       header: "Client",        type: "text"     as const, width: 28 },
  { key: "case_title",        header: "Matter",        type: "text"     as const, width: 36 },
  { key: "invoice_date",      header: "Invoice Date",  type: "date"     as const, width: 14 },
  { key: "due_date",          header: "Due Date",      type: "date"     as const, width: 14 },
  { key: "days_overdue",      header: "Days Overdue",  type: "integer"  as const, width: 13 },
  { key: "total_amount",      header: "Invoice Amt",   type: "currency" as const, width: 14 },
  { key: "balance_due",       header: "Outstanding",   type: "currency" as const, width: 14 },
  { key: "ageing_bucket",     header: "Bucket",        type: "text"     as const, width: 12 },
  { key: "last_payment_date", header: "Last Payment",  type: "date"     as const, width: 14 },
];

const COL_REVENUE = [
  { key: "period_label",        header: "Month",              type: "text"     as const, width: 12 },
  { key: "invoice_count",       header: "Invoices",           type: "integer"  as const, width: 10 },
  { key: "amount_invoiced",     header: "Amount Invoiced",    type: "currency" as const, width: 16 },
  { key: "gst_collected",       header: "GST",                type: "currency" as const, width: 12 },
  { key: "amount_collected",    header: "Collected",          type: "currency" as const, width: 14 },
  { key: "tds_deducted",        header: "TDS",                type: "currency" as const, width: 12 },
  { key: "balance_outstanding", header: "Outstanding",        type: "currency" as const, width: 14 },
];

const COL_PAYMENTS = [
  { key: "payment_date",    header: "Date",           type: "date"     as const, width: 14 },
  { key: "invoice_number",  header: "Invoice No.",    type: "text"     as const, width: 14 },
  { key: "invoice_date",    header: "Invoice Date",   type: "date"     as const, width: 14 },
  { key: "client_name",     header: "Client",         type: "text"     as const, width: 28 },
  { key: "case_title",      header: "Matter",         type: "text"     as const, width: 36 },
  { key: "amount_paid",     header: "Amount Paid",    type: "currency" as const, width: 14 },
  { key: "tds_amount",      header: "TDS",            type: "currency" as const, width: 12 },
  { key: "tds_section",     header: "TDS Section",    type: "text"     as const, width: 14 },
  { key: "mode",            header: "Mode",           type: "text"     as const, width: 10 },
  { key: "notes",           header: "Notes",          type: "text"     as const, width: 24 },
];

const COL_CLIENT = [
  { key: "client_name",      header: "Client",            type: "text"     as const, width: 28 },
  { key: "matter_count",     header: "Matters",           type: "integer"  as const, width: 10 },
  { key: "invoice_count",    header: "Invoices",          type: "integer"  as const, width: 10 },
  { key: "amount_invoiced",  header: "Amount Invoiced",   type: "currency" as const, width: 16 },
  { key: "amount_collected", header: "Collected",         type: "currency" as const, width: 14 },
  { key: "balance_due",      header: "Outstanding",       type: "currency" as const, width: 14 },
  { key: "tds_deducted",     header: "TDS",               type: "currency" as const, width: 12 },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose?: () => void;
}

type Step = "idle" | "fetching" | "writing" | "done" | "error";

interface StepStatus {
  label: string;
  done:  boolean;
}

export default function AccountantPackage({ onClose }: Props) {
  const [period,   setPeriod]   = useState<PeriodState>(defaultPeriod());
  const [step,     setStep]     = useState<Step>("idle");
  const [steps,    setSteps]    = useState<StepStatus[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const generate = async () => {
    setStep("fetching");
    setErrorMsg("");
    const range = resolvedRange(period);

    const progress: StepStatus[] = [
      { label: "Invoice Register",  done: false },
      { label: "Outstanding",       done: false },
      { label: "Revenue Summary",   done: false },
      { label: "Payments Register", done: false },
      { label: "Client Summary",    done: false },
      { label: "Building workbook", done: false },
    ];
    setSteps([...progress]);

    try {
      // Fetch all data
      const [invReg, outstanding, revenue, payments, clients] = await Promise.all([
        fetchInvoiceRegister({ from: range.from, to: range.to }).then(r => { progress[0].done = true; setSteps([...progress]); return r; }),
        fetchOutstandingInvoices().then(r                                  => { progress[1].done = true; setSteps([...progress]); return r; }),
        fetchRevenueSummary({ from: range.from, to: range.to }).then(r     => { progress[2].done = true; setSteps([...progress]); return r; }),
        fetchPaymentsRegister({ from: range.from, to: range.to }).then(r   => { progress[3].done = true; setSteps([...progress]); return r; }),
        fetchClientSummary({ from: range.from, to: range.to }).then(r      => { progress[4].done = true; setSteps([...progress]); return r; }),
      ]);

      setStep("writing");
      progress[5].done = false;
      setSteps([...progress]);

      // Build workbook
      const wb = new ExcelJS.Workbook();
      wb.creator = "Memo"; wb.created = new Date(); wb.modified = new Date();

      // Sheet 1: Invoice Register
      addReportSheet(wb, "Invoice Register", COL_INVOICE_REGISTER,
        invReg.rows as unknown as Record<string, unknown>[]);

      // Sheet 2: Outstanding Invoices
      addReportSheet(wb, "Outstanding Invoices", COL_OUTSTANDING,
        outstanding.rows as unknown as Record<string, unknown>[]);

      // Sheet 3: Ageing Analysis
      const { summary: outSummary } = outstanding;
      const totalOut = outSummary.total_outstanding || 1;
      addReportSheet(wb, "Ageing Analysis", [
        { key: "bucket", header: "Bucket",          type: "text"     as const, width: 16 },
        { key: "count",  header: "Invoices",        type: "integer"  as const, width: 12 },
        { key: "amount", header: "Outstanding Amt", type: "currency" as const, width: 16 },
        { key: "pct",    header: "% of Total",      type: "integer"  as const, width: 12 },
      ], [
        { bucket: "Not Yet Due", amount: outSummary.bucket_current,  count: outstanding.rows.filter(r => r.ageing_bucket === "current").length, pct: Math.round(outSummary.bucket_current  / totalOut * 100) },
        { bucket: "0–30 Days",   amount: outSummary.bucket_0_30,     count: outstanding.rows.filter(r => r.ageing_bucket === "0-30").length,    pct: Math.round(outSummary.bucket_0_30     / totalOut * 100) },
        { bucket: "31–60 Days",  amount: outSummary.bucket_31_60,    count: outstanding.rows.filter(r => r.ageing_bucket === "31-60").length,   pct: Math.round(outSummary.bucket_31_60    / totalOut * 100) },
        { bucket: "61–90 Days",  amount: outSummary.bucket_61_90,    count: outstanding.rows.filter(r => r.ageing_bucket === "61-90").length,   pct: Math.round(outSummary.bucket_61_90    / totalOut * 100) },
        { bucket: "90+ Days",    amount: outSummary.bucket_90_plus,  count: outstanding.rows.filter(r => r.ageing_bucket === "90+").length,     pct: Math.round(outSummary.bucket_90_plus  / totalOut * 100) },
      ] as unknown as Record<string, unknown>[]);

      // Sheet 4: Revenue Summary
      addReportSheet(wb, "Revenue Summary", COL_REVENUE,
        revenue.rows as unknown as Record<string, unknown>[]);

      // Sheet 5: Payments Register
      addReportSheet(wb, "Payments Register", COL_PAYMENTS,
        payments as unknown as Record<string, unknown>[]);

      // Sheet 6: Client Summary
      addReportSheet(wb, "Client Summary", COL_CLIENT,
        clients as unknown as Record<string, unknown>[]);

      progress[5].done = true;
      setSteps([...progress]);

      // Save
      const fileLabel = periodLabel(period.fy, period.preset, period.custom.from, period.custom.to);
      const path = await save({
        defaultPath: `Accountant_Package_${fileLabel}.xlsx`,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      });
      if (!path) { setStep("idle"); return; }
      const buf = await wb.xlsx.writeBuffer();
      await writeFile(path, new Uint8Array(buf as ArrayBuffer));
      setStep("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Export failed");
      setStep("error");
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 max-w-md">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-neutral-900 rounded-xl">
          <Package size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Accountant Package</h3>
          <p className="text-xs text-neutral-500">Single Excel workbook with 6 sheets</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-neutral-500 mb-2">Select period:</p>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="text-xs text-neutral-500 mb-4 space-y-1">
        {["Invoice Register", "Outstanding Invoices", "Ageing Analysis",
          "Revenue Summary", "Payments Register", "Client Summary"
        ].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {steps[i]?.done
              ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
              : <div className="w-3 h-3 rounded-full border border-neutral-200 shrink-0" />
            }
            {s}
          </div>
        ))}
      </div>

      {step === "error" && (
        <p className="text-xs text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
      )}

      {step === "done" ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={14} />
          Package exported successfully!
          <button onClick={() => setStep("idle")} className="ml-auto text-xs text-neutral-500 hover:text-neutral-700">
            Export again
          </button>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={step === "fetching" || step === "writing"}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {(step === "fetching" || step === "writing") && <Loader2 size={14} className="animate-spin" />}
          {step === "fetching" ? "Fetching data…" : step === "writing" ? "Building workbook…" : "Generate Package"}
        </button>
      )}

      {onClose && (
        <button onClick={onClose} className="w-full mt-2 text-xs text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>
      )}
    </div>
  );
}
