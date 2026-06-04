/**
 * shortcuts.ts — Centralized keyboard shortcut registry
 *
 * ALL shortcut key definitions live here.
 * Components and hooks import from this file; they never hardcode key strings.
 *
 * Key format: [meta+][shift+][alt+]<key_lowercase>
 *   meta  = ⌘ Command (macOS) / Ctrl (Windows/Linux)
 *   shift = ⇧ Shift
 *   alt   = ⌥ Option / Alt
 *
 * Examples: "meta+k"  "meta+shift+w"  "escape"  "meta+,"
 */

// ── Type definitions ──────────────────────────────────────────────────────────

export type ShortcutGroup =
  | "Global Navigation"
  | "Matter Navigation"
  | "List Navigation"
  | "Quick Actions"
  | "Form";

export interface ShortcutDef {
  /** Normalized key string. Must be unique within a scope. */
  key: string;
  /** Human-readable description shown in documentation and future UI. */
  description: string;
  /** Grouping for documentation. */
  group: ShortcutGroup;
  /**
   * If true, the shortcut fires even when a text input, textarea or select
   * is focused. Default false (shortcuts are suppressed while typing).
   *
   * ⌘S (save) must be true — users save mid-form.
   * Navigation shortcuts must be false — let users type digits freely.
   */
  allowInInputs?: boolean;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const SHORTCUTS = {
  // ── Global navigation ────────────────────────────────────────────────────
  DASHBOARD:       { key: "meta+1",       description: "Go to Dashboard",         group: "Global Navigation" },
  MATTERS:         { key: "meta+2",       description: "Go to Matters",           group: "Global Navigation" },
  CLIENTS:         { key: "meta+3",       description: "Go to Clients",           group: "Global Navigation" },
  FIRMS:           { key: "meta+4",       description: "Go to Firms",             group: "Global Navigation" },
  OUTSTANDING:     { key: "meta+5",       description: "Go to Outstanding Dues",  group: "Global Navigation" },
  REPORTS:         { key: "meta+6",       description: "Go to Reports",           group: "Global Navigation" },
  SETTINGS:        { key: "meta+,",       description: "Open Settings",           group: "Global Navigation" },

  // ── Quick actions ─────────────────────────────────────────────────────────
  QUICK_CAPTURE:   { key: "meta+k",       description: "Quick Capture",           group: "Quick Actions" },
  HELP:            { key: "meta+/",       description: "Keyboard Shortcut Help",  group: "Quick Actions" },

  // ── Matter tab navigation (only active when a matter is open) ─────────────
  TAB_OVERVIEW:    { key: "meta+shift+o", description: "Matter → Overview tab",   group: "Matter Navigation" },
  TAB_WORK_DONE:   { key: "meta+shift+w", description: "Matter → Work Done tab",  group: "Matter Navigation" },
  TAB_INVOICES:    { key: "meta+shift+i", description: "Matter → Invoices tab",   group: "Matter Navigation" },

  // ── Matter tab cycling (← →) ─────────────────────────────────────────────
  TAB_PREV:        { key: "arrowleft",    description: "Previous matter tab",     group: "Matter Navigation" },
  TAB_NEXT:        { key: "arrowright",   description: "Next matter tab",         group: "Matter Navigation" },

  // ── List navigation ───────────────────────────────────────────────────────
  LIST_UP:         { key: "arrowup",      description: "Move up",                 group: "List Navigation" },
  LIST_DOWN:       { key: "arrowdown",    description: "Move down",               group: "List Navigation" },
  LIST_FIRST:      { key: "home",         description: "Jump to first item",      group: "List Navigation" },
  LIST_LAST:       { key: "end",          description: "Jump to last item",       group: "List Navigation" },
  LIST_OPEN:       { key: "enter",        description: "Open / select item",      group: "List Navigation" },
  SEARCH:          { key: "/",            description: "Focus search",            group: "List Navigation" },

  // ── Form actions ──────────────────────────────────────────────────────────
  SAVE:            { key: "meta+s",       description: "Save current form",       group: "Form", allowInInputs: true },
  CLOSE:           { key: "escape",       description: "Close / Cancel",          group: "Form", allowInInputs: false },

  // ── Reserved — do not implement yet ──────────────────────────────────────
  // COMMAND_PALETTE: { key: "meta+k" }    // Reserved for future command palette
  // NEW_ITEM:        { key: "meta+n" }    // Reserved for context-sensitive new
  // SEARCH:          { key: "meta+f" }    // Reserved for in-screen search
} as const satisfies Record<string, ShortcutDef>;

export type ShortcutName = keyof typeof SHORTCUTS;

/** Canonical display order for the shortcut help modal. */
export const SHORTCUT_GROUP_ORDER: ShortcutGroup[] = [
  "Global Navigation",
  "Matter Navigation",
  "List Navigation",
  "Quick Actions",
  "Form",
];

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Build a normalized shortcut key string from a KeyboardEvent.
 * This is the inverse of the key strings in SHORTCUTS above.
 */
export function buildShortcutKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("meta");
  if (e.shiftKey)              parts.push("shift");
  if (e.altKey)                parts.push("alt");
  // Use e.key in lowercase, but map some special cases
  const key = e.key === "," ? "," : e.key.toLowerCase();
  parts.push(key);
  return parts.join("+");
}

/**
 * Returns true if a form element is currently focused (user is typing).
 * Used to suppress navigation shortcuts while the user types.
 */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input"    ||
    tag === "textarea" ||
    tag === "select"   ||
    el.getAttribute("contenteditable") === "true"
  );
}

/**
 * Returns a display string for a shortcut key (e.g. "meta+shift+w" → "⌘⇧W").
 */
export function displayKey(key: string): string {
  return key
    .split("+")
    .map(part => {
      switch (part) {
        case "meta":   return "⌘";
        case "shift":  return "⇧";
        case "alt":    return "⌥";
        case "escape": return "Esc";
        case ",":      return ",";
        default:       return part.toUpperCase();
      }
    })
    .join("");
}
