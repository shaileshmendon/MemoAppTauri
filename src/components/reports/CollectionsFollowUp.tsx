/**
 * CollectionsFollowUp — Report 4
 *
 * Overdue invoices with contact details for follow-up calls.
 */

import { useState, useCallback } from "react";
import { FileText, FileSpreadsheet, Printer, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { fetchCollectionsFollowUp } from "../../lib/reports/engine";
import type { CollectionsRow } from "../../lib/reports/engine";
import { formatINR } from "../../lib/currency";
import { objectsToCsv, saveCsvFile } from "../../lib/reports/csvExport";
import { exportSingleSheet } from "../../lib/reports/excelExport";
import type { ColDef } from "../../lib/reports/excelExport";
import { periodLabel } from "../../lib/reports/financialYear";
import { PeriodPicker, defaultPeriod, resolvedRange } from "./ReportFilters";
import type { PeriodState } from "./ReportFilters";
import ReportShell, {
  ReportTable, ReportThead, Th, Td, TfootTotal,
  SummaryStrip, SummaryCard,
} from "./ReportShell";
import type { ExportAction } from "./ReportShell";

const EXCEL_COLS: ColDef[] = [
  { key: "client_name",       header: "Client",           type: "text",     width: 28 },
  { key: "case_title",        header: "Matter",           type: "text",     width: 36 },
  { key: "invoice_number",    header: "Invoice No.",      type: "text",     width: 14 },
  { key: "invoice_date",      header: "Invoice Date",     type: "date",     width: 14 },
  { key: "due_date",          header: "Due Date",         type: "date",     width: 14 },
  { key: "days_overdue",      header: "Days Overdue",     type: "integer",  width: 13 },
  { key: "total_amount",      header: "Invoice Amount",   type: "currency", width: 14 },
  { key: "balance_due",       header: "Outstanding",      type: "currency", width: 14 },
  { key: "last_payment_date", header: "Last Payment",     type: "date",     width: 14 },
  { key: "contact_person",    header: "Contact Person",   type: "text",     width: 22 },
  { key: "contact_phone",     header: "Phone",            type: "text",     width: 16 },
  { key: "contact_email",     header: "Email",            type: "text",     width: 28 },
];

interface Props { onBack: () => void }

export default function CollectionsFollowUp({ onBack }: Props) {
  const [period,  setPeriod]  = useState<PeriodState>(defaultPeriod());
  const [rows,    setRows]    = useState<CollectionsRow[]>([]);
  const [running, setRunning] = useState(false);
  const [ranAt,   setRanAt]   = useState<Date | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const range = resolvedRange(period);
      const r = await fetchCollectionsFollowUp({ from: range.from, to: range.to });
      setRows(r);
      setRanAt(new Date());
    } finally {
      setRunning(false);
    }
  }, [period]);

  const fileLabel = periodLabel(period.fy, period.preset, period.custom.from, period.custom.to);

  const exportCsv = async () => {
    const csv = objectsToCsv(
      EXCEL_COLS.map(c => ({ key: c.key, label: c.header })),
      rows as unknown as Record<string, unknown>[]
    );
    await saveCsvFile(`Collections_FollowUp_${fileLabel}.csv`, csv);
  };

  const exportExcel = async () => {
    await exportSingleSheet(
      `Collections_FollowUp_${fileLabel}.xlsx`,
      "Collections Follow-Up",
      EXCEL_COLS,
      rows as unknown as Record<string, unknown>[]
    );
  };

  const exports: ExportAction[] = [
    { label: "Download CSV",     icon: <FileText size={12} />,        onExport: exportCsv   },
    { label: "Download Excel",   icon: <FileSpreadsheet size={12} />, onExport: exportExcel },
    { label: "Print / Save PDF", icon: <Printer size={12} />,         onExport: () => window.print() },
  ];

  const totalBalance = rows.reduce((s, r) => s + r.balance_due, 0);
  const criticalRows = rows.filter(r => r.days_overdue > 90);

  const summaryStrip = ranAt ? (
    <SummaryStrip>
      <SummaryCard label="Overdue Invoices"    value={String(rows.length)}                                                     />
      <SummaryCard label="Total Outstanding"   value={formatINR(totalBalance)}                 accent="red"                    />
      <SummaryCard label="Critical (90d+)"     value={String(criticalRows.length)}
        accent={criticalRows.length > 0 ? "red" : undefined}                                                                   />
      <SummaryCard label="Critical Amount"     value={formatINR(criticalRows.reduce((s, r) => s + r.balance_due, 0))}
        accent={criticalRows.length > 0 ? "red" : undefined}                                                                   />
    </SummaryStrip>
  ) : null;

  return (
    <ReportShell
      title="Collections Follow-Up"
      subtitle="Overdue invoices with client contact details for follow-up calls and emails"
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
          <span className="text-xs text-neutral-400">(filters on invoice due date)</span>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">
          {ranAt ? "No overdue invoices. 🎉" : "Run report to see overdue invoices."}
        </div>
      ) : (
        <ReportTable>
          <ReportThead>
            <tr>
              <Th>Client</Th>
              <Th>Matter</Th>
              <Th>Invoice No.</Th>
              <Th>Invoice Date</Th>
              <Th>Due Date</Th>
              <Th right>Days Overdue</Th>
              <Th right>Invoice Amt</Th>
              <Th right>Outstanding</Th>
              <Th>Last Payment</Th>
              <Th>Contact</Th>
            </tr>
          </ReportThead>
          <tbody>
            {rows.map(r => (
              <tr key={r.invoice_id}
                className={`hover:bg-neutral-50 transition-colors ${r.days_overdue > 90 ? "bg-red-50/30" : ""}`}>
                <Td className="font-medium">{r.client_name}</Td>
                <Td muted className="max-w-[160px] truncate">{r.case_title}</Td>
                <Td>{r.invoice_number}</Td>
                <Td muted>{format(new Date(r.invoice_date), "dd-MMM-yyyy")}</Td>
                <Td muted>{format(new Date(r.due_date), "dd-MMM-yyyy")}</Td>
                <Td right className={
                  r.days_overdue > 90 ? "text-red-600 font-bold" :
                  r.days_overdue > 60 ? "text-red-500 font-semibold" :
                  r.days_overdue > 30 ? "text-orange-600" : ""
                }>
                  {r.days_overdue}d
                </Td>
                <Td right>{formatINR(r.total_amount)}</Td>
                <Td right className="font-semibold text-red-600">{formatINR(r.balance_due)}</Td>
                <Td muted>
                  {r.last_payment_date ? format(new Date(r.last_payment_date), "dd-MMM-yyyy") : "—"}
                </Td>
                <Td>
                  {r.contact_person ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-neutral-700">{r.contact_person}</p>
                      <div className="flex items-center gap-2">
                        {r.contact_phone && (
                          <span className="flex items-center gap-0.5 text-[10px] text-neutral-400">
                            <Phone size={9} /> {r.contact_phone}
                          </span>
                        )}
                        {r.contact_email && (
                          <span className="flex items-center gap-0.5 text-[10px] text-neutral-400">
                            <Mail size={9} /> {r.contact_email}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-neutral-300 text-xs">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
          <TfootTotal>
            <tr>
              <Td colSpan={6} className="font-semibold">Total ({rows.length} invoices)</Td>
              <Td right className="font-bold">{formatINR(rows.reduce((s, r) => s + r.total_amount, 0))}</Td>
              <Td right className="font-bold text-red-600">{formatINR(totalBalance)}</Td>
              <Td colSpan={2}></Td>
            </tr>
          </TfootTotal>
        </ReportTable>
      )}
    </ReportShell>
  );
}
