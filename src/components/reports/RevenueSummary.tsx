/**
 * RevenueSummary — Report 3
 *
 * Month-by-month invoiced vs collected for any FY / period.
 * Supports: Full Year, Quarter, Half-year, Month, Custom range.
 */

import { useState, useCallback } from "react";
import { FileText, FileSpreadsheet, Printer } from "lucide-react";
import ExcelJS from "exceljs";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetchRevenueSummary } from "../../lib/reports/engine";
import type { RevenuePeriodRow, RevenueSummary as RevenueSummaryType } from "../../lib/reports/engine";
import { formatINR } from "../../lib/currency";
import { objectsToCsv, saveCsvFile } from "../../lib/reports/csvExport";
import { addReportSheet } from "../../lib/reports/excelExport";
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
  { key: "period_label",        header: "Month",              type: "text",     width: 12 },
  { key: "invoice_count",       header: "Invoices",           type: "integer",  width: 10 },
  { key: "amount_invoiced",     header: "Amount Invoiced",    type: "currency", width: 16 },
  { key: "gst_collected",       header: "GST",                type: "currency", width: 12 },
  { key: "amount_collected",    header: "Amount Collected",   type: "currency", width: 16 },
  { key: "tds_deducted",        header: "TDS Deducted",       type: "currency", width: 14 },
  { key: "balance_outstanding", header: "Outstanding",        type: "currency", width: 14 },
];

interface Props { onBack: () => void }

export default function RevenueSummary({ onBack }: Props) {
  const [period,  setPeriod]  = useState<PeriodState>(defaultPeriod());
  const [rows,    setRows]    = useState<RevenuePeriodRow[]>([]);
  const [summary, setSummary] = useState<RevenueSummaryType | null>(null);
  const [running, setRunning] = useState(false);
  const [ranAt,   setRanAt]   = useState<Date | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const range = resolvedRange(period);
      const { rows: r, summary: s } = await fetchRevenueSummary({ from: range.from, to: range.to });
      setRows(r);
      setSummary(s);
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
    await saveCsvFile(`Revenue_Summary_${fileLabel}.csv`, csv);
  };

  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Memo"; wb.created = new Date(); wb.modified = new Date();

    // Sheet 1: Monthly breakdown
    addReportSheet(wb, "Monthly Revenue", EXCEL_COLS, rows as unknown as Record<string, unknown>[]);

    // Sheet 2: Summary
    if (summary) {
      const summaryData = [
        { metric: "Total Invoiced",      value: summary.total_invoiced      },
        { metric: "Total Collected",     value: summary.total_collected     },
        { metric: "Total Outstanding",   value: summary.total_outstanding   },
        { metric: "Total GST Collected", value: summary.total_gst           },
        { metric: "Total TDS Deducted",  value: summary.total_tds           },
        { metric: "Invoice Count",       value: summary.invoice_count       },
        { metric: "Collection Rate (%)", value: summary.collection_rate     },
      ];
      addReportSheet(wb, "Summary", [
        { key: "metric", header: "Metric", type: "text",     width: 24 },
        { key: "value",  header: "Value",  type: "currency", width: 16 },
      ], summaryData as unknown as Record<string, unknown>[]);
    }

    const path = await save({
      defaultPath: `Revenue_Summary_${fileLabel}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
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
    <SummaryStrip>
      <SummaryCard label="Invoices"          value={String(summary.invoice_count)}          />
      <SummaryCard label="Total Invoiced"    value={formatINR(summary.total_invoiced)}    accent="blue" />
      <SummaryCard label="Total Collected"   value={formatINR(summary.total_collected)}   accent="green" />
      <SummaryCard label="Outstanding"       value={formatINR(summary.total_outstanding)} accent={summary.total_outstanding > 0 ? "amber" : undefined} />
      <SummaryCard label="Collection Rate"   value={`${summary.collection_rate}%`}
        accent={summary.collection_rate >= 90 ? "green" : summary.collection_rate >= 60 ? "amber" : "red"} />
      <SummaryCard label="GST Collected"     value={formatINR(summary.total_gst)}           />
      {summary.total_tds > 0 && (
        <SummaryCard label="TDS Deducted"    value={formatINR(summary.total_tds)}            />
      )}
    </SummaryStrip>
  ) : null;

  // Bar chart scale
  const maxInvoiced = Math.max(...rows.map(r => r.amount_invoiced), 1);

  return (
    <ReportShell
      title="Revenue Summary"
      subtitle="Month-by-month invoiced vs collected — track practice growth and collection efficiency"
      onBack={onBack}
      onRun={run}
      running={running}
      hasData={ranAt !== null}
      rowCount={rows.length}
      generatedAt={ranAt}
      exports={exports}
      summary={summaryStrip}
      filters={<PeriodPicker value={period} onChange={setPeriod} />}
    >
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-neutral-400 text-sm">
          No invoice data found for the selected period.
        </div>
      ) : (
        <div>
          {/* Mini bar chart */}
          <div className="px-6 py-4 border-b border-neutral-100">
            <p className="text-xs text-neutral-500 mb-3">Monthly Comparison — Invoiced vs Collected</p>
            <div className="flex items-end gap-1.5 h-20">
              {rows.map(r => (
                <div key={r.period} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <div className="w-full flex items-end gap-0.5" style={{ height: "60px" }}>
                    <div
                      title={`Invoiced: ${formatINR(r.amount_invoiced)}`}
                      className="flex-1 bg-blue-400 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${(r.amount_invoiced / maxInvoiced) * 60}px` }}
                    />
                    <div
                      title={`Collected: ${formatINR(r.amount_collected)}`}
                      className="flex-1 bg-green-400 rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${(r.amount_collected / maxInvoiced) * 60}px` }}
                    />
                  </div>
                  <span className="text-[9px] text-neutral-400 truncate w-full text-center">
                    {r.period_label.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <div className="w-2.5 h-2.5 bg-blue-400 rounded-sm" /> Invoiced
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <div className="w-2.5 h-2.5 bg-green-400 rounded-sm" /> Collected
              </div>
            </div>
          </div>

          {/* Table */}
          <ReportTable>
            <ReportThead>
              <tr>
                <Th>Month</Th>
                <Th right>Invoices</Th>
                <Th right>Amount Invoiced</Th>
                <Th right>GST</Th>
                <Th right>Collected</Th>
                <Th right>TDS</Th>
                <Th right>Outstanding</Th>
                <Th right>Collection %</Th>
              </tr>
            </ReportThead>
            <tbody>
              {rows.map(r => {
                const pct = r.amount_invoiced > 0
                  ? Math.round((r.amount_collected / r.amount_invoiced) * 100)
                  : 0;
                return (
                  <tr key={r.period} className="hover:bg-neutral-50 transition-colors">
                    <Td className="font-medium">{r.period_label}</Td>
                    <Td right muted>{r.invoice_count}</Td>
                    <Td right>{formatINR(r.amount_invoiced)}</Td>
                    <Td right muted>{r.gst_collected > 0 ? formatINR(r.gst_collected) : "—"}</Td>
                    <Td right className="text-green-700">{r.amount_collected > 0 ? formatINR(r.amount_collected) : "—"}</Td>
                    <Td right muted>{r.tds_deducted > 0 ? formatINR(r.tds_deducted) : "—"}</Td>
                    <Td right className={r.balance_outstanding > 0 ? "text-amber-600" : "text-neutral-400"}>
                      {r.balance_outstanding > 0 ? formatINR(r.balance_outstanding) : "—"}
                    </Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 90 ? "bg-green-400" : pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs tabular-nums ${pct >= 90 ? "text-green-700" : pct >= 60 ? "text-amber-700" : "text-red-700"}`}>
                          {pct}%
                        </span>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            {summary && (
              <TfootTotal>
                <tr>
                  <Td className="font-semibold">Total ({rows.length} months)</Td>
                  <Td right className="font-bold">{summary.invoice_count}</Td>
                  <Td right className="font-bold">{formatINR(summary.total_invoiced)}</Td>
                  <Td right>{formatINR(summary.total_gst)}</Td>
                  <Td right className="font-bold text-green-700">{formatINR(summary.total_collected)}</Td>
                  <Td right>{summary.total_tds > 0 ? formatINR(summary.total_tds) : "—"}</Td>
                  <Td right className="font-bold text-amber-600">{formatINR(summary.total_outstanding)}</Td>
                  <Td right className="font-bold">{summary.collection_rate}%</Td>
                </tr>
              </TfootTotal>
            )}
          </ReportTable>
        </div>
      )}
    </ReportShell>
  );
}
