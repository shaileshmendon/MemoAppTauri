/**
 * InvoiceRegister — Report 1
 *
 * Full invoice list for a period. Used for GST filing and audit trail.
 */

import { useState, useCallback } from "react";
import { FileText, FileSpreadsheet, Printer } from "lucide-react";
import { format } from "date-fns";
import { fetchInvoiceRegister } from "../../lib/reports/engine";
import type { InvoiceRegisterRow, InvoiceRegisterSummary } from "../../lib/reports/engine";
import { formatINR } from "../../lib/currency";
import { objectsToCsv, saveCsvFile } from "../../lib/reports/csvExport";
import { exportSingleSheet } from "../../lib/reports/excelExport";
import type { ColDef } from "../../lib/reports/excelExport";
import { periodLabel } from "../../lib/reports/financialYear";
import { PeriodPicker, StatusFilter, defaultPeriod, resolvedRange } from "./ReportFilters";
import type { PeriodState } from "./ReportFilters";
import ReportShell, {
  ReportTable, ReportThead, Th, Td, TfootTotal,
  SummaryStrip, SummaryCard, StatusBadge,
} from "./ReportShell";
import type { ExportAction } from "./ReportShell";

const STATUS_OPTIONS = [
  { value: "sent",           label: "Sent" },
  { value: "paid",           label: "Paid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue",        label: "Overdue" },
  { value: "cancelled",      label: "Cancelled" },
];

const EXCEL_COLS: ColDef[] = [
  { key: "invoice_number", header: "Invoice No.",    type: "text",     width: 14 },
  { key: "invoice_date",   header: "Invoice Date",   type: "date",     width: 14 },
  { key: "due_date",       header: "Due Date",       type: "date",     width: 14 },
  { key: "client_name",    header: "Client",         type: "text",     width: 28 },
  { key: "case_title",     header: "Matter",         type: "text",     width: 36 },
  { key: "subtotal_amount",header: "Subtotal",       type: "currency", width: 14 },
  { key: "cgst",           header: "CGST",           type: "currency", width: 12 },
  { key: "sgst",           header: "SGST",           type: "currency", width: 12 },
  { key: "igst",           header: "IGST",           type: "currency", width: 12 },
  { key: "total_amount",   header: "Total",          type: "currency", width: 14 },
  { key: "status",         header: "Status",         type: "text",     width: 14 },
  { key: "amount_paid",    header: "Amount Received",type: "currency", width: 16 },
  { key: "tds_deducted",   header: "TDS Deducted",   type: "currency", width: 14 },
  { key: "balance_due",    header: "Outstanding",    type: "currency", width: 14 },
];

interface Props { onBack: () => void }

export default function InvoiceRegister({ onBack }: Props) {
  const [period,     setPeriod]   = useState<PeriodState>(defaultPeriod());
  const [statusFilter, setStatus] = useState("all");
  const [rows,       setRows]     = useState<InvoiceRegisterRow[]>([]);
  const [summary,    setSummary]  = useState<InvoiceRegisterSummary | null>(null);
  const [running,    setRunning]  = useState(false);
  const [ranAt,      setRanAt]    = useState<Date | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const range = resolvedRange(period);
      const { rows: r, summary: s } = await fetchInvoiceRegister({
        from: range.from,
        to:   range.to,
        status: statusFilter === "all" ? "all" : statusFilter as never,
      });
      setRows(r);
      setSummary(s);
      setRanAt(new Date());
    } finally {
      setRunning(false);
    }
  }, [period, statusFilter]);

  const fileLabel = periodLabel(period.fy, period.preset, period.custom.from, period.custom.to);

  const exportCsv = async () => {
    const CSV_HEADERS = EXCEL_COLS.map(c => ({ key: c.key, label: c.header }));
    const csv = objectsToCsv(CSV_HEADERS, rows as unknown as Record<string, unknown>[]);
    await saveCsvFile(`Invoice_Register_${fileLabel}.csv`, csv);
  };

  const exportExcel = async () => {
    await exportSingleSheet(
      `Invoice_Register_${fileLabel}.xlsx`,
      "Invoice Register",
      EXCEL_COLS,
      rows as unknown as Record<string, unknown>[]
    );
  };

  const exportPrint = () => window.print();

  const exports: ExportAction[] = [
    { label: "Download CSV",       icon: <FileText size={12} />,        onExport: exportCsv   },
    { label: "Download Excel",     icon: <FileSpreadsheet size={12} />, onExport: exportExcel },
    { label: "Print / Save PDF",   icon: <Printer size={12} />,         onExport: exportPrint },
  ];

  const summaryStrip = summary ? (
    <SummaryStrip>
      <SummaryCard label="Invoices"         value={String(summary.total_invoices)}         />
      <SummaryCard label="Amount Invoiced"  value={formatINR(summary.amount_invoiced)}  accent="blue" />
      <SummaryCard label="GST Collected"    value={formatINR(summary.total_gst)}          />
      <SummaryCard label="Amount Received"  value={formatINR(summary.amount_collected)} accent="green" />
      <SummaryCard label="Outstanding"      value={formatINR(summary.balance_due)}      accent={summary.balance_due > 0 ? "amber" : undefined} />
      {summary.tds_deducted > 0 && (
        <SummaryCard label="TDS Deducted"   value={formatINR(summary.tds_deducted)}       />
      )}
    </SummaryStrip>
  ) : null;

  return (
    <ReportShell
      title="Invoice Register"
      subtitle="Complete list of invoices for accounting, GST filing, and audit trail"
      onBack={onBack}
      onRun={run}
      running={running}
      hasData={ranAt !== null}
      rowCount={rows.length}
      generatedAt={ranAt}
      exports={exports}
      summary={summaryStrip}
      filters={
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodPicker value={period} onChange={setPeriod} />
          <StatusFilter
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">
          No invoices found for the selected filters.
        </div>
      ) : (
        <ReportTable>
          <ReportThead>
            <tr>
              <Th>Invoice No.</Th>
              <Th>Date</Th>
              <Th>Client</Th>
              <Th>Matter</Th>
              <Th right>Subtotal</Th>
              <Th right>CGST</Th>
              <Th right>SGST</Th>
              <Th right>IGST</Th>
              <Th right>Total</Th>
              <Th>Status</Th>
              <Th right>Received</Th>
              <Th right>TDS</Th>
              <Th right>Outstanding</Th>
            </tr>
          </ReportThead>
          <tbody>
            {rows.map(r => (
              <tr key={r.invoice_id} className="hover:bg-neutral-50 transition-colors">
                <Td className="font-medium">{r.invoice_number}</Td>
                <Td muted>{format(new Date(r.invoice_date), "dd-MMM-yyyy")}</Td>
                <Td>{r.client_name}</Td>
                <Td muted className="max-w-[200px] truncate">{r.case_title}</Td>
                <Td right>{formatINR(r.subtotal_amount)}</Td>
                <Td right muted>{r.cgst > 0 ? formatINR(r.cgst) : "—"}</Td>
                <Td right muted>{r.sgst > 0 ? formatINR(r.sgst) : "—"}</Td>
                <Td right muted>{r.igst > 0 ? formatINR(r.igst) : "—"}</Td>
                <Td right className="font-semibold">{formatINR(r.total_amount)}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td right>{r.amount_paid > 0 ? formatINR(r.amount_paid) : "—"}</Td>
                <Td right muted>{r.tds_deducted > 0 ? formatINR(r.tds_deducted) : "—"}</Td>
                <Td right className={r.balance_due > 0 ? "text-red-600 font-medium" : "text-neutral-400"}>
                  {r.balance_due > 0 ? formatINR(r.balance_due) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
          {summary && (
            <TfootTotal>
              <tr>
                <Td className="font-semibold" colSpan={4}>Total ({rows.length} invoices)</Td>
                <Td right>{formatINR(summary.amount_invoiced - summary.total_gst)}</Td>
                <Td right>{formatINR(rows.reduce((s, r) => s + r.cgst, 0))}</Td>
                <Td right>{formatINR(rows.reduce((s, r) => s + r.sgst, 0))}</Td>
                <Td right>{formatINR(rows.reduce((s, r) => s + r.igst, 0))}</Td>
                <Td right className="font-bold">{formatINR(summary.amount_invoiced)}</Td>
                <Td></Td>
                <Td right>{formatINR(summary.amount_collected)}</Td>
                <Td right>{summary.tds_deducted > 0 ? formatINR(summary.tds_deducted) : "—"}</Td>
                <Td right className="text-red-600">{formatINR(summary.balance_due)}</Td>
              </tr>
            </TfootTotal>
          )}
        </ReportTable>
      )}
    </ReportShell>
  );
}
