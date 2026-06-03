import { Scale, AlertCircle, LayoutDashboard, Users, Building2, Settings, Info, Lock, ReceiptText, Inbox, Zap } from "lucide-react";
import type { NavSection } from "../types";

interface Props {
  active: NavSection;
  onChange: (s: NavSection) => void;
  onAbout: () => void;
  onLock?: () => void;
  inboxCount?: number;
  onQuickCapture?: () => void;
}

const items: { id: NavSection; label: string; icon: React.ReactNode; group?: string }[] = [
  { id: "dashboard",      label: "Dashboard",       icon: <LayoutDashboard size={18} /> },
  { id: "inbox",          label: "Inbox",           icon: <Inbox size={18} />,           group: "Work" },
  { id: "matters",        label: "Matters",         icon: <Scale size={18} />,            group: "Work" },
  { id: "outstanding",    label: "Outstanding Dues", icon: <AlertCircle size={18} />,     group: "Work" },
  { id: "record_payment", label: "Record Payment",  icon: <ReceiptText size={18} />,      group: "Work" },
  { id: "clients",        label: "Clients",         icon: <Users size={18} />,            group: "Contacts" },
  { id: "firms",          label: "AOR / Firms",     icon: <Building2 size={18} />,        group: "Contacts" },
  { id: "settings",       label: "Settings",        icon: <Settings size={18} />,         group: "Account" },
];

export default function Sidebar({ active, onChange, onAbout, onLock, inboxCount = 0, onQuickCapture }: Props) {
  let lastGroup: string | undefined;

  return (
    <aside className="w-52 bg-neutral-900 text-neutral-200 flex flex-col h-full shrink-0 select-none">
      {/* App logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/5">
        <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0">
          <span className="text-black font-bold text-sm leading-none">M</span>
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">Memo</span>
      </div>

      {/* Quick Capture button */}
      {onQuickCapture && (
        <div className="px-2 pt-2">
          <button
            onClick={onQuickCapture}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/15 transition-colors mb-1"
          >
            <Zap size={14} className="text-yellow-400 shrink-0" />
            <span className="flex-1 text-left">Quick Capture</span>
            <kbd className="text-[10px] text-neutral-500 bg-neutral-800 rounded px-1 py-0.5">⌘K</kbd>
          </button>
        </div>
      )}

      <nav className="flex-1 px-2 py-1 overflow-y-auto">
        {items.map(({ id, label, icon, group }) => {
          const showGroupHeader = group && group !== lastGroup;
          lastGroup = group;
          return (
            <div key={id}>
              {showGroupHeader && (
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600 px-3 pt-3 pb-1">
                  {group}
                </p>
              )}
              <button
                onClick={() => onChange(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-default mb-0.5 ${
                  active === id
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                }`}
              >
                {icon}
                <span className="truncate flex-1 text-left">{label}</span>
                {/* Inbox badge */}
                {id === "inbox" && inboxCount > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                    {inboxCount > 99 ? "99+" : inboxCount}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-neutral-600">v1.0.2</span>
        <div className="flex items-center gap-1">
          {onLock && (
            <button onClick={onLock}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-amber-400 hover:bg-white/5 transition-colors"
              title="Lock App">
              <Lock size={14} />
            </button>
          )}
          <button onClick={onAbout}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-colors"
            title="About Memo">
            <Info size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
