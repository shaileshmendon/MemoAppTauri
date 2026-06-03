/**
 * useKeyboardShortcuts.ts
 *
 * Reusable hook for registering keyboard shortcut handlers.
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { key: SHORTCUTS.SAVE.key, handler: handleSave, allowInInputs: true },
 *     { key: SHORTCUTS.CLOSE.key, handler: handleClose },
 *   ]);
 *
 * The handlers array can be inline — a stable ref is used internally so the
 * event listener is only registered once, but always calls the latest handlers.
 */

import { useEffect, useRef, RefObject } from "react";
import { buildShortcutKey, isInputFocused } from "./shortcuts";

// ── ShortcutHandler ───────────────────────────────────────────────────────────

export interface ShortcutHandler {
  /** Normalized key string from SHORTCUTS registry, e.g. "meta+s" */
  key: string;
  /** Function to invoke when the shortcut fires */
  handler: () => void;
  /**
   * If true, the handler fires even when an input/textarea is focused.
   * Default: false.
   */
  allowInInputs?: boolean;
  /**
   * If false, the shortcut is temporarily disabled.
   * Default: true.
   */
  enabled?: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Registers a list of keyboard shortcut handlers on the window.
 * Safe to call with an inline array — uses a ref internally.
 * Cleans up the listener on unmount.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]): void {
  const ref = useRef<ShortcutHandler[]>(shortcuts);
  ref.current = shortcuts; // Always up to date, no effect re-run needed

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const pressed = buildShortcutKey(e);
      const inputActive = isInputFocused();

      for (const s of ref.current) {
        if (pressed !== s.key) continue;
        if (s.enabled === false) continue;
        if (inputActive && !s.allowInInputs) continue;

        e.preventDefault();
        s.handler();
        break; // First match wins
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // ← intentionally empty; ref handles dynamic updates
}

// ── useFocusTrap ──────────────────────────────────────────────────────────────

/**
 * Traps Tab / Shift+Tab focus within a container element.
 * Focus is sent to the first focusable element when `active` becomes true.
 *
 * Usage:
 *   const modalRef = useRef<HTMLDivElement>(null);
 *   useFocusTrap(modalRef, isOpen);
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const FOCUSABLE = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Move focus into the modal
    const focusable = getFocusable();
    focusable[0]?.focus();

    const trapTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = getFocusable();
      if (els.length === 0) { e.preventDefault(); return; }

      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", trapTab);
    return () => container.removeEventListener("keydown", trapTab);
  }, [active, containerRef]);
}
