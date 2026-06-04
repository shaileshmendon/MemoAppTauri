/**
 * financialYear.ts — Indian Financial Year helpers (April 1 → March 31)
 *
 * FY label convention: "2025-26"  (start year dash 2-digit end year)
 */

import { format, startOfMonth, endOfMonth } from "date-fns";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to:   string; // YYYY-MM-DD
}

export interface FYOption {
  label: string;   // "FY 2025-26"
  value: string;   // "2025-26"
  from:  string;
  to:    string;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/** Returns the current FY label, e.g. "2025-26". */
export function currentFY(): string {
  const now   = new Date();
  const year  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(-2)}`;
}

/** Returns the start/end dates for a given FY label. */
export function fyDateRange(fy: string): DateRange {
  const startYear = parseInt(fy.split("-")[0], 10);
  return {
    from: `${startYear}-04-01`,
    to:   `${startYear + 1}-03-31`,
  };
}

/** Returns a list of FY options for a dropdown (most recent first). */
export function fyList(yearsBack = 5): FYOption[] {
  const base = parseInt(currentFY().split("-")[0], 10);
  return Array.from({ length: yearsBack }, (_, i) => {
    const y     = base - i;
    const value = `${y}-${String(y + 1).slice(-2)}`;
    return { label: `FY ${value}`, value, from: `${y}-04-01`, to: `${y + 1}-03-31` };
  });
}

// ── Period types ──────────────────────────────────────────────────────────────

export type PeriodPreset =
  | "full_fy"
  | "q1" | "q2" | "q3" | "q4"
  | "h1"  | "h2"
  | "this_month"
  | "custom";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "full_fy",    label: "Full Year" },
  { value: "q1",         label: "Q1 (Apr–Jun)" },
  { value: "q2",         label: "Q2 (Jul–Sep)" },
  { value: "q3",         label: "Q3 (Oct–Dec)" },
  { value: "q4",         label: "Q4 (Jan–Mar)" },
  { value: "h1",         label: "H1 (Apr–Sep)" },
  { value: "h2",         label: "H2 (Oct–Mar)" },
  { value: "this_month", label: "This Month" },
  { value: "custom",     label: "Custom Range" },
];

/**
 * Given a FY label and a period preset, return the concrete date range.
 * Quarter / Half-year / Full are relative to the chosen FY.
 * "this_month" always uses the current calendar month.
 */
export function periodDateRange(fy: string, preset: PeriodPreset): DateRange {
  if (preset === "custom")     return fyDateRange(fy); // caller replaces this
  if (preset === "this_month") {
    const now = new Date();
    return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
  }

  const startYear = parseInt(fy.split("-")[0], 10);
  const endYear   = startYear + 1;

  switch (preset) {
    case "full_fy": return { from: `${startYear}-04-01`, to: `${endYear}-03-31` };
    case "q1":      return { from: `${startYear}-04-01`, to: `${startYear}-06-30` };
    case "q2":      return { from: `${startYear}-07-01`, to: `${startYear}-09-30` };
    case "q3":      return { from: `${startYear}-10-01`, to: `${startYear}-12-31` };
    case "q4":      return { from: `${endYear}-01-01`,   to: `${endYear}-03-31` };
    case "h1":      return { from: `${startYear}-04-01`, to: `${startYear}-09-30` };
    case "h2":      return { from: `${startYear}-10-01`, to: `${endYear}-03-31` };
    default:        return fyDateRange(fy);
  }
}

/**
 * Returns a human-readable label for a period, used in export file names.
 * e.g. "FY2025_26", "Q1_FY2025_26", "Apr_2025"
 */
export function periodLabel(fy: string, preset: PeriodPreset, from?: string, to?: string): string {
  const fyTag = `FY${fy.replace("-", "_")}`;
  switch (preset) {
    case "full_fy":    return fyTag;
    case "q1":         return `Q1_${fyTag}`;
    case "q2":         return `Q2_${fyTag}`;
    case "q3":         return `Q3_${fyTag}`;
    case "q4":         return `Q4_${fyTag}`;
    case "h1":         return `H1_${fyTag}`;
    case "h2":         return `H2_${fyTag}`;
    case "this_month": return format(new Date(), "MMM_yyyy");
    case "custom":     return `${from ?? "from"}_to_${to ?? "to"}`;
    default:           return fyTag;
  }
}
