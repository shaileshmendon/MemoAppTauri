/**
 * ShortcutHelpModal.tsx
 *
 * Opened by ⌘/ — shows all keyboard shortcuts grouped from the registry.
 * Data comes exclusively from SHORTCUTS in shortcuts.ts.
 * No hardcoded shortcut strings.
 */

import { X, Keyboard } from "lucide-react";
import { SHORTCUTS, SHORTCUT_GROUP_ORDER, displayKey } from "../lib/keyboard/shortcuts";
import { useKeyboardShortcuts, useFocusTrap } from "../lib/keyboard/useKeyboardShortcuts";
import { useRef } from "react";

interface Props {
  onClose: () => void;
}

export default function ShortcutHelpModal({ onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts([{ key: "escape", handler: onClose }]);
  useFocusTrap(modalRef, true);

  // Build grouped shortcut list from the registry
  const grouped = SHORTCUT_GROUP_ORDER.map(group => ({
    group,
    shortcuts: Object.values(SHORTCUTS).filter(s => s.group === group),
  })).filter(g => g.shortcuts.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
            <Keyboard size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">Keyboard Shortcuts</p>
            <p className="text-xs text-neutral-400">Press ⌘/ to show or hide this panel</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {grouped.map(({ group, shortcuts }) => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                {group}
              </p>
              <div className="space-y-0.5">
                {shortcuts.map(s => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-neutral-50"
                  >
                    <span className="text-sm text-neutral-700">{s.description}</span>
                    <kbd className="text-[11px] font-mono bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-md px-2 py-0.5 ml-4 shrink-0">
                      {displayKey(s.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-100 bg-neutral-50 shrink-0">
          <p className="text-[11px] text-neutral-400 text-center">
            Shortcuts are suppressed while typing in text fields
          </p>
        </div>
      </div>
    </div>
  );
}
