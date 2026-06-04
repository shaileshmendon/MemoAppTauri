/**
 * updateService.ts — App update notification service
 *
 * Phase 1: Notification + manual download only (no auto-install).
 *
 * Flow:
 *   1. On app launch → checkForUpdates()
 *   2. Every 24 hours → checkForUpdates()
 *   3. If newer version found → return UpdateInfo for modal display
 *   4. User can: Download (opens browser), Remind Later (snooze 24h), Skip Version
 *
 * Preferences stored in the settings table (key → value):
 *   update_last_check      ISO timestamp of last successful check
 *   update_skipped_version Semver string the user chose to skip, e.g. "1.3.0"
 *   update_remind_after    ISO timestamp — suppress modal until this time
 */

import { getSettingValue, setSettingValue } from "../../db";
import { getVersion } from "@tauri-apps/api/app";

// ── Configuration ─────────────────────────────────────────────────────────────

const MANIFEST_URL   = "https://memoapp.in/releases/latest.json";
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms
const REMIND_SNOOZE  = 24 * 60 * 60 * 1000; // 24 hours snooze for "Remind Later"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateManifest {
  version:     string;
  releaseDate: string;
  downloadUrl: string;
  mandatory:   boolean;
  notes:       string[];
}

export interface UpdateInfo {
  currentVersion: string;
  manifest:       UpdateManifest;
}

// ── Semver comparison ─────────────────────────────────────────────────────────

/**
 * Returns true if `remote` is strictly greater than `local`.
 * Handles standard semver: "1.2.3" > "1.2.0"
 */
function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [la, lb, lc] = parse(local);
  const [ra, rb, rc] = parse(remote);
  if (ra !== la) return ra > la;
  if (rb !== lb) return rb > lb;
  return rc > lc;
}

/** Basic semver format validation: digits.digits.digits */
function isValidVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v.replace(/^v/, ""));
}

/** HTTPS-only URL validation */
function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

// ── Manifest fetching ─────────────────────────────────────────────────────────

/**
 * Fetches and validates the update manifest.
 * Returns null on network error, invalid JSON, or missing/invalid fields.
 */
export async function fetchManifest(): Promise<UpdateManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, {
      method:  "GET",
      headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
      signal:  AbortSignal.timeout(8000), // 8s timeout
    });

    if (!res.ok) return null;

    const data = await res.json() as Partial<UpdateManifest>;

    // Validate required fields
    if (
      typeof data.version     !== "string" || !isValidVersion(data.version) ||
      typeof data.releaseDate !== "string" ||
      typeof data.downloadUrl !== "string" || !isHttpsUrl(data.downloadUrl) ||
      !Array.isArray(data.notes)
    ) {
      console.warn("[UpdateService] Invalid manifest structure", data);
      return null;
    }

    return {
      version:     data.version,
      releaseDate: data.releaseDate,
      downloadUrl: data.downloadUrl,
      mandatory:   data.mandatory === true,
      notes:       data.notes.filter(n => typeof n === "string"),
    };
  } catch (err) {
    // Network failure, timeout, JSON parse error — all treated as "no update"
    console.info("[UpdateService] Manifest fetch failed (offline?):", err);
    return null;
  }
}

// ── User preferences ──────────────────────────────────────────────────────────

export async function getLastCheckDate(): Promise<Date | null> {
  const v = await getSettingValue("update_last_check");
  return v ? new Date(v) : null;
}

export async function getSkippedVersion(): Promise<string | null> {
  return getSettingValue("update_skipped_version");
}

export async function getRemindAfter(): Promise<Date | null> {
  const v = await getSettingValue("update_remind_after");
  return v ? new Date(v) : null;
}

export async function saveLastCheck(): Promise<void> {
  await setSettingValue("update_last_check", new Date().toISOString());
}

export async function skipVersion(version: string): Promise<void> {
  await setSettingValue("update_skipped_version", version);
}

export async function snoozeReminder(): Promise<void> {
  const until = new Date(Date.now() + REMIND_SNOOZE);
  await setSettingValue("update_remind_after", until.toISOString());
}

export async function clearUpdatePreferences(): Promise<void> {
  await setSettingValue("update_skipped_version", "");
  await setSettingValue("update_remind_after", "");
}

// ── Core check ────────────────────────────────────────────────────────────────

/**
 * Performs a full update check:
 * 1. Fetches manifest
 * 2. Compares to current version
 * 3. Applies user preferences (skipped version, snooze)
 * 4. Saves last-check timestamp
 *
 * Returns UpdateInfo if a new version should be shown to the user, else null.
 */
export async function checkForUpdates(options: {
  /** If true, bypasses snooze and skipped-version preferences (for manual check) */
  force?: boolean;
} = {}): Promise<UpdateInfo | null> {
  let currentVersion: string;
  try {
    currentVersion = await getVersion();
  } catch {
    currentVersion = "1.2.1"; // fallback if Tauri API unavailable (dev mode)
  }

  const manifest = await fetchManifest();
  await saveLastCheck();

  if (!manifest) return null;
  if (!isNewer(currentVersion, manifest.version)) return null;

  if (!options.force) {
    // User skipped this version
    const skipped = await getSkippedVersion();
    if (skipped === manifest.version) return null;

    // User snoozed — still in snooze window
    const remindAfter = await getRemindAfter();
    if (remindAfter && remindAfter > new Date()) return null;
  }

  return { currentVersion, manifest };
}

/**
 * Returns true if enough time has passed since the last check (24h).
 * Used by the periodic background checker in App.tsx.
 */
export async function isDueForCheck(): Promise<boolean> {
  const last = await getLastCheckDate();
  if (!last) return true;
  return Date.now() - last.getTime() > CHECK_INTERVAL;
}

export { CHECK_INTERVAL };
