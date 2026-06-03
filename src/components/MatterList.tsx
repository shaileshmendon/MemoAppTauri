import { useState, useEffect, useRef } from "react";
import { useListNavigation } from "../lib/keyboard/useListNavigation";
import { Plus, Search, Users, Building2, List } from "lucide-react";
import { fetchMatters } from "../db";
import type { Matter } from "../types";
import { fmtRef } from "../types";

interface Props {
  selectedId: string | null;
  onSelect: (m: Matter) => void;
  onNew: () => void;
  refresh: number;
  isKeyboardActive?: boolean;
}

const statusColor: Record<string, string> = {
  active:   "bg-green-500",
  closed:   "bg-neutral-400",
  "on-hold":"bg-amber-400",
};

type GroupBy = "none" | "client" | "firm";

const GROUP_OPTS: { id: GroupBy; label: string; icon: React.ReactNode }[] = [
  { id: "none",   label: "All",    icon: <List      size={12} /> },
  { id: "client", label: "Client", icon: <Users     size={12} /> },
  { id: "firm",   label: "AOR / Firm", icon: <Building2 size={12} /> },
];

export default function MatterList({ selectedId, onSelect, onNew, refresh, isKeyboardActive = false }: Props) {
  const [matters, setMatters]   = useState<Matter[]>([]);
  const [query, setQuery]       = useState("");
  const [groupBy, setGroupBy]   = useState<GroupBy>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMatters().then(setMatters);
  }, [refresh]);

  const filtered = matters.filter(m =>
    m.case_title.toLowerCase().includes(query.toLowerCase()) ||
    m.client_name.toLowerCase().includes(query.toLowerCase()) ||
    (m.firm_name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const { activeIndex, getItemRef } = useListNavigation({
    items: filtered,
    onActivate: onSelect,
    enabled: isKeyboardActive,
  });

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Build grouped structure
  const grouped: { key: string; label: string; matters: Matter[] }[] = [];
  if (groupBy === "none") {
    grouped.push({ key: "__all__", label: "", matters: filtered });
  } else {
    const map = new Map<string, Matter[]>();
    for (const m of filtered) {
      const key =
        groupBy === "client"
          ? (m.client_name || "Unknown Client")
          : (m.firm_name   || "No AOR / Firm");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // Sort groups alphabetically
    Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, ms]) => grouped.push({ key, label: key, matters: ms }));
  }

  return (
    <div className="w-64 border-r border-neutral-200 flex flex-col h-full bg-neutral-50 shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-neutral-800 flex-1">Matters</h2>
        <button onClick={onNew}
          className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 transition-colors"
          title="New Matter">
          <Plus size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
          <Search size={13} className="text-neutral-400 shrink-0" />
          <input
            ref={searchRef}
            data-search-input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") { setQuery(""); searchRef.current?.blur(); }
            }}
            placeholder="Search matters…"
            className="flex-1 text-sm outline-none bg-transparent text-neutral-800 placeholder-neutral-400 min-w-0"
          />
        </div>
      </div>

      {/* Group-by toggle */}
      <div className="px-3 pb-2">
        <div className="flex items-center bg-neutral-200 rounded-lg p-0.5 gap-0.5">
          {GROUP_OPTS.map(opt => (
            <button key={opt.id} onClick={() => { setGroupBy(opt.id); setCollapsed(new Set()); }}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-xs font-medium transition-all ${
                groupBy === opt.id
                  ? "bg-white text-neutral-800 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-neutral-400 text-center mt-8 px-4">
            {query ? "No matches found." : "No matters yet.\nClick + to add one."}
          </p>
        )}

        {(() => {
          let flatIdx = 0; // tracks position in the flat filtered[] array for keyboard ref assignment
          return grouped.map(group => (
            <div key={group.key}>
              {/* Group header */}
              {groupBy !== "none" && (
                <button
                  onClick={() => toggleCollapse(group.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-neutral-100 border-b border-neutral-200 hover:bg-neutral-150 transition-colors">
                  <span className="text-neutral-400">
                    {groupBy === "client"
                      ? <Users size={11} />
                      : <Building2 size={11} />}
                  </span>
                  <span className="text-xs font-semibold text-neutral-600 flex-1 text-left truncate">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-neutral-400 shrink-0">
                    {group.matters.length} {group.matters.length === 1 ? "matter" : "matters"}
                  </span>
                  <span className="text-neutral-400 text-xs shrink-0">
                    {collapsed.has(group.key) ? "›" : "⌄"}
                  </span>
                </button>
              )}

              {/* Matters in this group */}
              {!collapsed.has(group.key) && group.matters.map(m => {
                const idx = filtered.indexOf(m);
                const isKeyActive = activeIndex === idx;
                flatIdx++;
                return (
                  <button
                    key={m.id}
                    ref={getItemRef(idx)}
                    onClick={() => onSelect(m)}
                    className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 transition-colors cursor-default ${
                      groupBy !== "none" ? "pl-5" : ""
                    } ${
                      selectedId === m.id
                        ? "bg-neutral-100 border-l-2 border-l-neutral-900"
                        : isKeyActive
                        ? "bg-blue-50 border-l-2 border-l-blue-500"
                        : "hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor[m.status] ?? "bg-neutral-400"}`} />
                      <span className="text-sm font-medium text-neutral-800 truncate flex-1">{m.case_title}</span>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">{fmtRef(m.ref_number)}</span>
                    </div>
                    {groupBy === "firm" && (
                      <p className="text-xs text-neutral-500 mt-0.5 pl-3.5 truncate">{m.client_name}</p>
                    )}
                    {groupBy === "client" && m.firm_name && (
                      <p className="text-xs text-neutral-500 mt-0.5 pl-3.5 truncate">{m.firm_name}</p>
                    )}
                    {groupBy === "none" && (
                      <>
                        <p className="text-xs text-neutral-500 mt-0.5 pl-3.5 truncate">{m.client_name}</p>
                        {m.firm_name && (
                          <p className="text-xs text-neutral-400 pl-3.5 truncate">{m.firm_name}</p>
                        )}
                      </>
                    )}
                    {m.court && groupBy === "none" && (
                      <p className="text-xs text-neutral-400 pl-3.5 truncate">{m.court}</p>
                    )}
                  </button>
                );
              })}
            </div>
          ));
        })()}
      </div>

      {/* Footer count */}
      <div className="px-3 py-2 border-t border-neutral-200">
        <p className="text-xs text-neutral-400">
          {filtered.length} {filtered.length === 1 ? "matter" : "matters"}
          {groupBy !== "none" && ` · ${grouped.length} ${groupBy === "client" ? "clients" : "AOR / firms"}`}
        </p>
      </div>
    </div>
  );
}
