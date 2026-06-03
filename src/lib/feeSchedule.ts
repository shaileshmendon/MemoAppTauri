/**
 * feeSchedule.ts
 *
 * Single source of truth for:
 *   1. The canonical map of HearingType enum value → display label
 *   2. The ordered list of appearance types used in Settings and form dropdowns
 *   3. The `getFeeForHearingType()` lookup helper
 *
 * All components that need to display hearing type labels OR look up fee
 * schedule amounts must import from here — never maintain their own copy.
 */

import type { HearingType, FeeSchedule } from "../types";

// ── Canonical label map ───────────────────────────────────────────────────────

/**
 * Maps every HearingType enum value to its human-readable display label.
 * The display label is also the key used inside FeeSchedule.appearance_fees.
 */
export const HEARING_TYPE_LABELS: Record<HearingType, string> = {
  // Court Appearances
  mention:        "Mention",
  urgent_mention: "Urgent Mention",
  hearing:        "Hearing",
  adjournment:    "Adjournment",
  circulation:    "Circulation",
  arguments:      "Arguments",
  evidence:       "Evidence",
  judgement:      "Judgment / Order",
  admission:      "Admission",
  caveat:         "Caveat",
  board:          "Board / NCLT",
  // Professional Work
  conference:     "Conference",
  drafting:       "Drafting",
  research:       "Research",
  advice:         "Advice / Opinion",
  retainer:       "Retainer",
  filing:         "Filing",
  other:          "Other",
};

// ── Ordered groups (for Settings UI and dropdowns) ────────────────────────────

export interface AppearanceTypeEntry {
  value: HearingType;
  label: string;
  group: "Court Appearances" | "Professional Work";
}

export const APPEARANCE_TYPES: AppearanceTypeEntry[] = [
  // Court Appearances
  { value: "mention",        label: "Mention",           group: "Court Appearances" },
  { value: "urgent_mention", label: "Urgent Mention",    group: "Court Appearances" },
  { value: "hearing",        label: "Hearing",           group: "Court Appearances" },
  { value: "adjournment",    label: "Adjournment",       group: "Court Appearances" },
  { value: "circulation",    label: "Circulation",       group: "Court Appearances" },
  { value: "arguments",      label: "Arguments",         group: "Court Appearances" },
  { value: "evidence",       label: "Evidence",          group: "Court Appearances" },
  { value: "judgement",      label: "Judgment / Order",  group: "Court Appearances" },
  { value: "admission",      label: "Admission",         group: "Court Appearances" },
  { value: "caveat",         label: "Caveat",            group: "Court Appearances" },
  { value: "board",          label: "Board / NCLT",      group: "Court Appearances" },
  // Professional Work
  { value: "conference",     label: "Conference",        group: "Professional Work" },
  { value: "drafting",       label: "Drafting",          group: "Professional Work" },
  { value: "research",       label: "Research",          group: "Professional Work" },
  { value: "advice",         label: "Advice / Opinion",  group: "Professional Work" },
  { value: "retainer",       label: "Retainer",          group: "Professional Work" },
  { value: "filing",         label: "Filing",            group: "Professional Work" },
  { value: "other",          label: "Other",             group: "Professional Work" },
];

export const COURT_APPEARANCE_TYPES = APPEARANCE_TYPES.filter(
  t => t.group === "Court Appearances"
);

export const PROFESSIONAL_WORK_TYPES = APPEARANCE_TYPES.filter(
  t => t.group === "Professional Work"
);

// ── Fee lookup ────────────────────────────────────────────────────────────────

/**
 * Returns the scheduled fee (in INR) for a given HearingType.
 * Returns 0 if no fee is configured for that type.
 *
 * Looks up by display label (the key stored in appearance_fees), using
 * HEARING_TYPE_LABELS to convert from the HearingType enum value.
 */
export function getFeeForHearingType(
  hearingType: HearingType,
  schedule: FeeSchedule | null,
): number {
  if (!schedule) return 0;
  const label = HEARING_TYPE_LABELS[hearingType];
  if (!label) return 0;
  return schedule.appearance_fees[label] ?? 0;
}
