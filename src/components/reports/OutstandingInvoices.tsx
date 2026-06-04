/**
 * OutstandingInvoices — Report 2
 *
 * Aged debtors report — unpaid invoices with ageing buckets.
 */

import { useState, useCallback } from "react";
import { FileText, FileSpreadsheet, Printer } from "lucide-react";
import { format } from "date-fns";
import { fetchOutstandingInvoices } from "../../lib/reports/engine";
import type { OutstandingRow, OutstandingSummary } from "../../lib/reports/engine";
import { formatINR } from "../../lib/currency";
import { objectsToCsv, saveCsvFile } from "../../lib/reports/csvExport";
import ExcelJS from "exceljs";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { addReportSheet } from "../../lib/reports/excelExport";
import type { ColDef } from "../../lib/reports/excelExport";
import ReportShell, {
  ReportTable, ReportThead, Th, Td, TfootTotal,
  SummaryStrip, SummaryCard,
} from "./ReportShell";
import type { ExportAction } from "./ReportShell";

type BucketFilter = "all" | "current" | "0-30" | "31-60" | "61-90" | "90+";

const EXCEL_COLS: ColDef[] = [
  { key: "invoice_number",    header: "Invoice No.",   type: "text",     width: 14 },
  { key: "client_name",       header: "Client",        type: "text",     width: 28 },
  { key: "case_title",        header: "Matter",        type: "text",     width: 36 },
  { key: "invoice_date",      header: "Invoice Date",  type: "date",     width: 14 },
  { key: "due_date",          header: "Due Date",      type: "date",     width: 14 },
  { key: "days_overdue",      header: "Days Overdue",  type: "integer",  width: 13 },
  { key: "total_amount",      header: "Invoice Amt",   type: "currency", width: 14 },
  { key: "amount_paid",       header: "Paid",          type: "currency", width: 12 },
  { key: "balance_due",       header: "Outstanding",   type: "currency", width: 14 },
  { key: "ageing_bucket",     header: "Ageing Bucket", type: "text",     width: 13 },
  { key: "last_payment_date", header: "Last Payment",  type: "date",     width: 14 },
];

interface Props { onBack: () => void }

export default function OutstandingInvoices({ onBack }: Props) {
  const [rows,    setRows]    = useState<OutstandingRow[]>([]);
  const [summary, setSummary] = useState<OutstandingSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [ranAt,   setRanAt]   = useState<Date | null>(null);
  const [bucket,  setBucket]  = useState<BucketFilter>("all");

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const { rows: r, summary: s } = await fetchOutstandingInvoices();
      setRows(r);
      setSummary(s);
      setRanAt(new Date());
    } finally {
      setRunning(false);
    }
  }, []);

  const filtered = bucket === "all" ? rows : rows.filter(r => r.ageing_bucket === bucket);

  const exportCsv = async () => {
    const CSV_HEADERS = EXCEL_COLS.map(c => ({ key: c.key, label: c.header }));
    const csv = objectsToCsv(CSV_HEADERS, filtered as unknown as Record<string, unknown>[]);
    await saveCsvFile(`Outstanding_Invoices.csv`, csv);
  };

  const exportExcel = async () => {
    // Main sheet + Ageing Analysis sheet
    const wb = new ExcelJS.Workbook();
    wb.creator = "Memo"; wb.created = new Date(); wb.modified = new Date();

    // Sheet 1: Outstanding Invoices
    addReportSheet(wb, "Outstanding Invoices", EXCEL_COLS, filtered as unknown as Record<string, unknown>[]);

    // Sheet 2: Ageing Analysis
    if (summary) {
      const totalOutstanding = summary.total_outstanding || 1;
      const ageing = [
        { bucket: "Not Yet Due", amount: summary.bucket_current, count: filtered.filter(r => r.ageing_bucket === "current").length, pct: Math.round(summary.bucket_current / totalOutstanding * 100) },
        { bucket: "0–30 Days",   amount: summary.bucket_0_30,    count: filtered.filter(r => r.ageing_bucket === "0-30").length,   pct: Math.round(summary.bucket_0_30 / totalOutstanding * 100) },
        { bucket: "31–60 Days",  amount: summary.bucket_31_60,   count: filtered.filter(r => r.ageing_bucket === "31-60").length,  pct: Math.round(summary.bucket_31_60 / totalOutstanding * 100) },
        { bucket: "61–90 Days",  amount: summary.bucket_61_90,   count: filtered.filter(r => r.ageing_bucket === "61-90").length,  pct: Math.round(summary.bucket_61_90 / totalOutstanding * 100) },
        { bucket: "90+ Days",    amount: summary.bucket_90_plus, count: filtered.filter(r => r.ageing_bucket === "90+").length,    pct: Math.round(summary.bucket_90_plus / totalOutstanding * 100) },
      ];
      addReportSheet(wb, "Ageing Analysis", [
        { key: "bucket", header: "Ageing Bucket",   type: "text",     width: 16 },
        { key: "count",  header: "No. of Invoices", type: "integer",  width: 14 },
        { key: "amount", header: "Outstanding Amt", type: "currency", width: 16 },
        { key: "pct",    header: "% of Total",      type: "integer",  width: 12 },
      ], ageing as unknown as Record<string, unknown>[]);
    }

    const path = await save({ defaultPath: "Outstanding_Invoices.xlsx", filters: [{ name: "Excel", extensions: ["xlsx"] }] });
    if (!path) return;
    const buf = await wb.xlsx.writeBuffer();
    await writeFile(path, new Uint8Array(buf as ArrayBuffer));
  };

  const exports: ExportAction[] = [
    { label: "Download CSV",     icon: <FileText size={12} />,        onExport: exportCsv   },
    { label: "Download Excel",   icon: <FileSpreadsheet size={12} />, onExport: exportExcel },
    { label: "Print / Save PDF", icon: <Printer size={12} />,         onExport: () => window.print() },
  ];

  const summaryStrip = summary ? (
    <div className="space-y-3">
      {/* Totals row */}
      <SummaryStrip>
        <SummaryCard label="Total Outstanding" value={formatINR(summary.total_outstanding)} accent="red" />
        <SummaryCard label="Invoices"          value={String(summary.outstanding_count)}    />
        <SummaryCard label="Oldest Invoice"    value={summary.oldest_invoice_date ? format(new Date(summary.oldest_invoice_date), "dd-MMM-yyyy") : "—"} />
        <SummaryCard label="Avg Days Overdue"  value={`${summary.avg_days_overdue} days`}   accent={summary.avg_days_overdue > 60 ? "red" : summary.avg_days_overdue > 30 ? "amber" : undefined} />
      </SummaryStrip>

      {/* Ageing buckets row */}
      <div className="flex items-stretch gap-2 flex-wrap">
        {[
          { key: "current", label: "Not Yet Due", val: summary.bucket_current, color: "bg-neutral-50 border-neutral-200" },
          { key: "0-30",    label: "0–30 Days",   val: summary.bucket_0_30,    color: "bg-yellow-50 border-yellow-200" },
          { key: "31-60",   label: "31–60 Days",  val: summary.bucket_31_60,   color: "bg-orange-50 border-orange-200" },
          { key: "61-90",   label: "61–90 Days",  val: summary.bucket_61_90,   color: "bg-red-50    border-red-200" },
          { key: "90+",     label: "90+ Days",    val: summary.bucket_90_plus, color: "bg-red-100   border-red-300" },
        ].map(b => (
          <button
            key={b.key}
            onClick={() => setBucket(prev => prev === b.key as BucketFilter ? "all" : b.key as BucketFilter)}
            className={`flex-1 min-w-[100px] border rounded-lg px-3 py-2 text-left transition-all
              ${bucket === b.key ? "ring-2 ring-neutral-900 " + b.color : b.color + " hover:opacity-80"}`}
          >
            <p className="text-[10px] text-neutral-500">{b.label}</p>
            <p className="text-sm font-bold text-neutral-900 tabular-nums">{formatINR(b.val)}</p>
            <p className="text-[10px] text-neutral-400">
              {filtered.filter(r => r.ageing_bucket === b.key).length || rows.filter(r => r.ageing_bucket === b.key).length} inv.
            </p>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <ReportShell
      title="Outstanding Invoices"
      subtitle="Aged debtors — all unpaid invoices with overdue analysis"
      onBack={onBack}
      onRun={run}
      running={running}
      hasData={ranAt !== null}
      rowCount={filtered.length}
      generatedAt={ranAt}
      exports={exports}
      summary={summaryStrip}
      filters={
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Showing as of today.</span>
          {ranAt && (
            <span className="text-xs text-neutral-400">
              Click a bucket above to filter.
            </span>
          )}
        </div>
      }
    >
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">
          {ranAt ? "No outstanding invoices. 🎉" : "Run report to see outstanding invoices."}
        </div>
      ) : (
        <ReportTable>
          <ReportThead>
            <tr>
              <Th>Invoice No.</Th>
              <Th>Client</Th>
              <Th>Matter</Th>
              <Th>Invoice Date</Th>
              <Th>Due Date</Th>
              <Th right>Days Overdue</Th>
              <Th right>Invoice Amt</Th>
              <Th right>Paid</Th>
              <Th right>Outstanding</Th>
              <Th>Ageing</Th>
              <Th>Last Payment</Th>
            </tr>
          </ReportThead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.invoice_id} className="hover:bg-neutral-50 transition-colors">
                <Td className="font-medium">{r.invoice_number}</Td>
                <Td>{r.client_name}</Td>
                <Td muted className="max-w-[160px] truncate">{r.case_title}</Td>
                <Td muted>{format(new Date(r.invoice_date), "dd-MMM-yyyy")}</Td>
                <Td muted>{format(new Date(r.due_date), "dd-MMM-yyyy")}</Td>
                <Td right className={r.days_overdue > 90 ? "text-red-600 font-semibold" : r.days_overdue > 30 ? "text-orange-600" : ""}>
                  {r.days_overdue === 0 ? <span className="text-neutral-400">—</span> : `${r.days_overdue}d`}
                </Td>
                <Td right>{formatINR(r.total_amount)}</Td>
                <Td right muted>{r.amount_paid > 0 ? formatINR(r.amount_paid) : "—"}</Td>
                <Td right className="font-semibold text-red-600">{formatINR(r.balance_due)}</Td>
                <Td>
                  <AgeingBadge bucket={r.ageing_bucket} />
                </Td>
                <Td muted>
                  {r.last_payment_date ? format(new Date(r.last_payment_date), "dd-MMM-yyyy") : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
          <TfootTotal>
            <tr>
              <Td colSpan={6} className="font-semibold">Total ({filtered.length} invoices)</Td>
              <Td right className="font-bold">{formatINR(filtered.reduce((s, r) => s + r.total_amount, 0))}</Td>
              <Td right>{formatINR(filtered.reduce((s, r) => s + r.amount_paid, 0))}</Td>
              <Td right className="font-bold text-red-600">{formatINR(filtered.reduce((s, r) => s + r.balance_due, 0))}</Td>
              <Td colSpan={2}></Td>
            </tr>
          </TfootTotal>
        </ReportTable>
      )}
    </ReportShell>
  );
}

function AgeingBadge({ bucket }: { bucket: string }) {
  const styles: Record<string, string> = {
    "current": "bg-neutral-100 text-neutral-600",
    "0-30":    "bg-yellow-100  text-yellow-700",
    "31-60":   "bg-orange-100  text-orange-700",
    "61-90":   "bg-red-100     text-red-700",
    "90+":     "bg-red-200     text-red-800 font-semibold",
  };
  const labels: Record<string, string> = {
    "current": "Not Due",
    "0-30":    "0–30d",
    "31-60":   "31–60d",
    "61-90":   "61–90d",
    "90+":     "90d+",
  };
  const s = styles[bucket] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${s}`}>
      {labels[bucket] ?? bucket}
    </span>
  );
}
