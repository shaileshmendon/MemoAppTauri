/**
 * ReportShell.tsx — Common chrome for every report
 *
 * Renders:
 *  - Filter bar (slot for report-specific filters)
 *  - Run / Apply button
 *  - Loading / empty / error states
 *  - Export toolbar (CSV, Excel, Print)
 *  - Children (the report table itself)
 */

import { type ReactNode } from "react";
import { FileDown, FileSpreadsheet, Printer, RefreshCw, Loader2, ChevronLeft } from "lucide-react";

export interface ExportAction {
  label:   string;
  icon:    ReactNode;
  onExport: () => void;
}

interface Props {
  title:        string;
  subtitle?:    string;
  /** Filter bar content — rendered left of the Run button */
  filters?:     ReactNode;
  /** Called when user clicks Apply / Run */
  onRun:        () => void;
  running:      boolean;
  /** Has the report been run at least once? */
  hasData:      boolean;
  rowCount?:    number;
  generatedAt?: Date | null;
  onBack:       () => void;
  /** Export actions shown in the Export dropdown */
  exports?:     ExportAction[];
  /** Summary strip (cards) rendered between filters and table */
  summary?:     ReactNode;
  children:     ReactNode;
}

export default function ReportShell({
  title, subtitle, filters, onRun, running, hasData, rowCount,
  generatedAt, onBack, exports = [], summary, children,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-neutral-100 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onBack}
            className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-neutral-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {filters}

          <button
            onClick={onRun}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {running
              ? <Loader2 size={12} className="animate-spin" />
              : <RefreshCw size={12} />
            }
            {running ? "Running…" : "Run Report"}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export dropdown */}
          {hasData && exports.length > 0 && (
            <ExportMenu exports={exports} />
          )}

          {/* Meta */}
          {hasData && (
            <span className="text-xs text-neutral-400 whitespace-nowrap">
              {rowCount !== undefined ? `${rowCount.toLocaleString()} row${rowCount !== 1 ? "s" : ""}` : ""}
              {generatedAt && (
                <> · {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {hasData && summary && (
        <div className="px-6 py-3 border-b border-neutral-100 bg-neutral-50 shrink-0">
          {summary}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {running && (
          <div className="flex items-center justify-center h-48 text-neutral-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            Running report…
          </div>
        )}
        {!running && !hasData && (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-400 text-sm gap-1">
            <RefreshCw size={20} className="mb-2 opacity-40" />
            <p>Select filters and click <strong className="text-neutral-600">Run Report</strong> to view results.</p>
          </div>
        )}
        {!running && hasData && children}
      </div>
    </div>
  );
}

// ── Export dropdown ───────────────────────────────────────────────────────────

function ExportMenu({ exports }: { exports: ExportAction[] }) {
  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-50 transition-colors"
      >
        <FileDown size={12} />
        Export
        <svg className="ml-0.5 h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 4l4 4 4-4"/>
        </svg>
      </button>

      {/* Dropdown — visible on hover */}
      <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[160px] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
        {exports.map((ex, i) => (
          <button
            key={i}
            onClick={ex.onExport}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
          >
            {ex.icon}
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Shared table primitives ───────────────────────────────────────────────────

export function ReportTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full text-xs border-collapse">
      {children}
    </table>
  );
}

export function ReportThead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-neutral-50 border-b border-neutral-200">
      {children}
    </thead>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap
        ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, right, muted, className = "", colSpan }: {
  children?: ReactNode; right?: boolean; muted?: boolean; className?: string; colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 border-b border-neutral-100 whitespace-nowrap
        ${right ? "text-right tabular-nums" : "text-left"}
        ${muted ? "text-neutral-400" : "text-neutral-800"}
        ${className}`}
    >
      {children}
    </td>
  );
}

export function TfootTotal({ children }: { children: ReactNode }) {
  return (
    <tfoot className="bg-neutral-50 border-t-2 border-neutral-200 font-semibold">
      {children}
    </tfoot>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft:           "bg-neutral-100 text-neutral-600",
  sent:            "bg-blue-100   text-blue-700",
  paid:            "bg-green-100  text-green-700",
  partially_paid:  "bg-amber-100  text-amber-700",
  overdue:         "bg-red-100    text-red-700",
  cancelled:       "bg-neutral-100 text-neutral-400 line-through",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${style}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ── Summary card strip ────────────────────────────────────────────────────────

export function SummaryStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-stretch gap-3 flex-wrap">
      {children}
    </div>
  );
}

export function SummaryCard({
  label, value, sub, accent,
}: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: "blue" | "green" | "amber" | "red";
}) {
  const ring = accent === "green" ? "border-green-200 bg-green-50"
             : accent === "amber" ? "border-amber-200 bg-amber-50"
             : accent === "red"   ? "border-red-200   bg-red-50"
             : "border-neutral-200 bg-white";
  return (
    <div className={`flex-1 min-w-[120px] border rounded-xl px-3 py-2 ${ring}`}>
      <p className="text-[11px] text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-neutral-900 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Export icon helpers (re-exported for consistency) ─────────────────────────
export { FileSpreadsheet, Printer };
