/**
 * ReportFilters.tsx — Shared filter widgets for the Reports module
 */

import { fyList, PERIOD_PRESETS, currentFY, periodDateRange } from "../../lib/reports/financialYear";
import type { PeriodPreset, DateRange } from "../../lib/reports/financialYear";

// ── Financial Year + Period picker ────────────────────────────────────────────

export interface PeriodState {
  fy:      string;       // e.g. "2025-26"
  preset:  PeriodPreset;
  custom:  DateRange;    // used only when preset === "custom"
}

export function defaultPeriod(): PeriodState {
  const fy     = currentFY();
  const preset: PeriodPreset = "full_fy";
  return { fy, preset, custom: periodDateRange(fy, preset) };
}

export function resolvedRange(p: PeriodState): DateRange {
  if (p.preset === "custom") return p.custom;
  return periodDateRange(p.fy, p.preset);
}

interface PeriodPickerProps {
  value:    PeriodState;
  onChange: (v: PeriodState) => void;
}

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const years = fyList(5);

  const setFy = (fy: string) =>
    onChange({ ...value, fy, custom: periodDateRange(fy, value.preset) });

  const setPreset = (preset: PeriodPreset) =>
    onChange({ ...value, preset, custom: periodDateRange(value.fy, preset) });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* FY selector */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-neutral-500 whitespace-nowrap">Financial Year</label>
        <select
          value={value.fy}
          onChange={e => setFy(e.target.value)}
          className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {years.map(y => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
      </div>

      {/* Period preset */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-neutral-500 whitespace-nowrap">Period</label>
        <select
          value={value.preset}
          onChange={e => setPreset(e.target.value as PeriodPreset)}
          className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PERIOD_PRESETS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Custom date inputs */}
      {value.preset === "custom" && (
        <>
          <input
            type="date"
            value={value.custom.from}
            onChange={e => onChange({ ...value, custom: { ...value.custom, from: e.target.value } })}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-neutral-400">to</span>
          <input
            type="date"
            value={value.custom.to}
            onChange={e => onChange({ ...value, custom: { ...value.custom, to: e.target.value } })}
            className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </>
      )}
    </div>
  );
}

// ── Client filter ─────────────────────────────────────────────────────────────

interface ClientFilterProps {
  clients:  string[];
  value:    string; // "" = all
  onChange: (v: string) => void;
}

export function ClientFilter({ clients, value, onChange }: ClientFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-neutral-500 whitespace-nowrap">Client</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
      >
        <option value="">All Clients</option>
        {clients.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}

// ── Status filter ─────────────────────────────────────────────────────────────

interface StatusFilterProps {
  value:    string;
  options:  { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function StatusFilter({ value, options, onChange }: StatusFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs text-neutral-500 whitespace-nowrap">Status</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Statuses</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
