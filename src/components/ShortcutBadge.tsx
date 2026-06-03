/**
 * ShortcutBadge.tsx
 *
 * Reusable keyboard shortcut display components.
 *
 * ShortcutBadge  — inline pill showing a keyboard shortcut (e.g. ⌘K)
 * Tooltip        — hover tooltip showing action label + optional shortcut
 *
 * All shortcut strings must come from the SHORTCUTS registry in shortcuts.ts.
 * Never hardcode key strings here.
 */

import { useState, useRef, useEffect, type ReactNode } from "react";
import { displayKey } from "../lib/keyboard/shortcuts";

// ── ShortcutBadge ─────────────────────────────────────────────────────────────

interface BadgeProps {
  /** Normalized shortcut key from SHORTCUTS registry, e.g. SHORTCUTS.SAVE.key */
  shortcutKey: string;
  /** "dark"  — white text on dark bg (for dark sidebars, dark buttons)
   *  "light" — muted text on light bg (for forms, settings)
   *  "ghost" — very subtle, for secondary labels                          */
  variant?: "dark" | "light" | "ghost";
}

export function ShortcutBadge({ shortcutKey, variant = "light" }: BadgeProps) {
  const styles = {
    dark:  "bg-white/15 text-white/70 border border-white/20",
    light: "bg-neutral-100 text-neutral-500 border border-neutral-200",
    ghost: "text-neutral-400",
  } as const;

  return (
    <kbd
      className={`inline-flex items-center text-[10px] font-mono rounded px-1 py-0.5 leading-none select-none ${styles[variant]}`}
      aria-label={`Keyboard shortcut: ${displayKey(shortcutKey)}`}
    >
      {displayKey(shortcutKey)}
    </kbd>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  children: ReactNode;
  /** Main label shown in the tooltip */
  label: string;
  /** Optional shortcut key from SHORTCUTS registry */
  shortcutKey?: string;
  /** Tooltip position relative to the child element */
  position?: "top" | "bottom" | "left" | "right";
  /** Delay before showing in ms (default 500 — feels natural, not instant) */
  delay?: number;
}

export function Tooltip({
  children,
  label,
  shortcutKey,
  position = "bottom",
  delay = 500,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const show = () => {
    timerRef.current = window.setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const posClass = {
    top:    "bottom-full mb-1.5 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-1.5 left-1/2 -translate-x-1/2",
    left:   "right-full mr-1.5 top-1/2 -translate-y-1/2",
    right:  "left-full ml-1.5 top-1/2 -translate-y-1/2",
  } as const;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute ${posClass[position]} z-50 pointer-events-none whitespace-nowrap`}
        >
          <div className="bg-neutral-900 text-white rounded-lg px-2.5 py-1.5 shadow-lg">
            <p className="text-xs font-medium">{label}</p>
            {shortcutKey && (
              <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                {displayKey(shortcutKey)}
              </p>
            )}
          </div>
          {/* Arrow */}
          <div className={`absolute ${
            position === "bottom" ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1 border-l-transparent border-r-transparent border-t-transparent border-b-neutral-900 border-4" :
            position === "top"    ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-1 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-900 border-4" :
            ""
          }`} />
        </div>
      )}
    </div>
  );
}
