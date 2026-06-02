/**
 * states.ts — canonical list of Indian states and UTs for Memo
 *
 * Single source of truth used by:
 *   - Onboarding.tsx   (state picker)
 *   - SettingsPage.tsx (state picker)
 *   - MatterForm.tsx   (client state + firm state pickers)
 *   - ContactList.tsx  (state picker + matchState() for Contacts import)
 *
 * Exports:
 *   INDIAN_STATES   — ordered string array of state/UT names + "Other"
 *   matchState(raw) — resolve a raw string or 2-letter abbreviation → canonical name
 */

export const INDIAN_STATES: string[] = [
  // 28 states
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union territories
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
  "Puducherry",
  "Chandigarh",
  // Catch-all
  "Other",
];

/** ISO 3166-2:IN abbreviations + common variants → canonical state name */
const ABBREV_MAP: Record<string, string> = {
  mh: "Maharashtra",
  dl: "Delhi",
  ka: "Karnataka",
  tn: "Tamil Nadu",
  kl: "Kerala",
  gj: "Gujarat",
  rj: "Rajasthan",
  up: "Uttar Pradesh",
  wb: "West Bengal",
  ap: "Andhra Pradesh",
  ts: "Telangana",
  mp: "Madhya Pradesh",
  pb: "Punjab",
  hr: "Haryana",
  br: "Bihar",
  jh: "Jharkhand",
  or: "Odisha",
  od: "Odisha",
  ga: "Goa",
  hp: "Himachal Pradesh",
  uk: "Uttarakhand",
  ua: "Uttarakhand",
  cg: "Chhattisgarh",
  ct: "Chhattisgarh",
  jk: "Jammu & Kashmir",
  la: "Ladakh",
  py: "Puducherry",
  ch: "Chandigarh",
  mn: "Manipur",
  ml: "Meghalaya",
  mz: "Mizoram",
  nl: "Nagaland",
  ar: "Arunachal Pradesh",
  sk: "Sikkim",
  tr: "Tripura",
  as: "Assam",
};

/**
 * Resolve a raw state string to a canonical name in INDIAN_STATES.
 * Handles: exact match (case-insensitive), 2-letter ISO abbreviations,
 * and partial prefix matches.
 * Returns "" if no match is found.
 *
 * Used when importing contact details from macOS Contacts.
 */
export function matchState(raw: string): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  const direct = INDIAN_STATES.find(s => s.toLowerCase() === lower);
  if (direct) return direct;

  // 2. Abbreviation lookup
  if (ABBREV_MAP[lower]) return ABBREV_MAP[lower];

  // 3. Prefix match (e.g. "maha" → "Maharashtra")
  const partial = INDIAN_STATES.find(s => s.toLowerCase().startsWith(lower));
  return partial ?? "";
}
