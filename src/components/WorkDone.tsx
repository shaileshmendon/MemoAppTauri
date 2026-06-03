/**
 * WorkDone.tsx
 *
 * Unified "Work Done" screen — combines Appearances and Time Entries into a
 * single chronological list, replacing the separate Time and Appearances tabs.
 *
 * Architecture:
 *   • Fetches from both `appearances` and `time_entries` tables (unchanged).
 *   • Merges into a unified WorkItem[] sorted by date descending.
 *   • Filter bar: All | Appearances | Time Entries.
 *   • Single "+ Add Work" toolbar button → type picker dropdown.
 *   • Inline forms for both types (fee schedule auto-fill included).
 *   • Live timer preserved.
 *   • Unbilled value summary + "Bill Unbilled Work" shortcut.
 *
 * DB tables: appearances, time_entries — NO changes.
 * Future: Quick Capture / Inbox items slot in as additional WorkItem kinds.
 */

import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Pencil, Play, Square, ChevronDown, Gavel, Clock,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import { format } from "date-fns";
import {
  fetchAppearances, insertAppearance, updateAppearance, deleteAppearance,
  fetchTimeEntries,  insertTimeEntry,  updateTimeEntry,  deleteTimeEntry,
  loadFeeSchedule,
} from "../db";
import type { Matter, Appearance, TimeEntry, HearingType, FeeSchedule } from "../types";
import {
  COURT_APPEARANCE_TYPES,
  PROFESSIONAL_WORK_TYPES,
  HEARING_TYPE_LABELS,
  getFeeForHearingType,
} from "../lib/feeSchedule";
import { formatINR as inr } from "../lib/currency";
import { useToast } from "./Toast";
import BillUnbilledWork from "./BillUnbilledWork";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkItem =
  | { kind: "appearance"; data: Appearance }
  | { kind: "time";       data: TimeEntry };

type Filter = "all" | "appearances" | "time";
type AddType = "appearance" | "time";

// ── Badge colours (Appearances) ───────────────────────────────────────────────

const BADGE: Partial<Record<HearingType, string>> = {
  mention:        "bg-neutral-200 text-neutral-900",
  urgent_mention: "bg-red-100 text-red-700",
  hearing:        "bg-indigo-100 text-indigo-700",
  adjournment:    "bg-orange-100 text-orange-700",
  circulation:    "bg-cyan-100 text-cyan-700",
  arguments:      "bg-violet-100 text-violet-700",
  evidence:       "bg-purple-100 text-purple-700",
  judgement:      "bg-emerald-100 text-emerald-700",
  admission:      "bg-teal-100 text-teal-700",
  caveat:         "bg-rose-100 text-rose-700",
  board:          "bg-slate-100 text-slate-700",
  conference:     "bg-amber-100 text-amber-700",
  drafting:       "bg-lime-100 text-lime-700",
  research:       "bg-sky-100 text-sky-700",
  advice:         "bg-pink-100 text-pink-700",
  retainer:       "bg-green-100 text-green-700",
  filing:         "bg-neutral-100 text-neutral-600",
  other:          "bg-neutral-100 text-neutral-500",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function blankAppearance(matterId: string, court?: string): Appearance {
  return {
    id: uuid(), matter_id: matterId, date: todayStr(),
    court: court ?? "", hearing_type: "mention",
    fee_amount: 0, is_billed: 0, notes: "",
  };
}

function blankTimeEntry(matterId: string): TimeEntry {
  return {
    id: uuid(), matter_id: matterId, date: todayStr(),
    description: "", duration_minutes: 0,
    rate_per_hour: 0, is_billable: 1, is_billed: 0,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  matter: Matter;
  onInvoiceCreated?: (invoiceId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkDone({ matter, onInvoiceCreated }: Props) {
  const toast = useToast();

  // Data
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);

  // Filter
  const [filter, setFilter] = useState<Filter>("all");

  // Editing state
  const [editingApp,  setEditingApp]  = useState<Appearance | null>(null);
  const [editingTime, setEditingTime] = useState<TimeEntry  | null>(null);
  const [isNewApp,    setIsNewApp]    = useState(false);
  const [isNewTime,   setIsNewTime]   = useState(false);

  // Add Work dropdown
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Live timer
  const [timerActive,  setTimerActive]  = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAppearances(matter.id).then(setAppearances);
    fetchTimeEntries(matter.id).then(setTimeEntries);
    loadFeeSchedule().then(setFeeSchedule);
  }, [matter.id]);

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (timerActive) {
      intervalRef.current = window.setInterval(
        () => setTimerSeconds(s => s + 1), 1000
      );
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerActive]);

  const fmtTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const stopTimer = () => {
    setTimerActive(false);
    const mins = Math.ceil(timerSeconds / 60);
    const entry = blankTimeEntry(matter.id);
    entry.duration_minutes = mins;
    if (feeSchedule && feeSchedule.default_hourly_rate > 0) {
      entry.rate_per_hour = feeSchedule.default_hourly_rate;
    }
    setEditingTime(entry);
    setIsNewTime(true);
    setTimerSeconds(0);
  };

  // ── Close add menu on outside click ───────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── CRUD — Appearances ─────────────────────────────────────────────────────

  const handleSaveApp = async (a: Appearance) => {
    try {
      if (isNewApp) {
        await insertAppearance(a);
        setAppearances(prev => [a, ...prev]);
        toast.success("Appearance saved");
      } else {
        await updateAppearance(a);
        setAppearances(prev => prev.map(x => x.id === a.id ? a : x));
        toast.success("Appearance updated");
      }
      setEditingApp(null); setIsNewApp(false);
    } catch { toast.error("Failed to save appearance"); }
  };

  const handleDeleteApp = async (id: string) => {
    try {
      await deleteAppearance(id);
      setAppearances(prev => prev.filter(x => x.id !== id));
      if (editingApp?.id === id) { setEditingApp(null); setIsNewApp(false); }
      toast.success("Entry deleted");
    } catch { toast.error("Failed to delete entry"); }
  };

  // ── CRUD — Time Entries ────────────────────────────────────────────────────

  const handleSaveTime = async (t: TimeEntry) => {
    try {
      if (isNewTime) {
        await insertTimeEntry(t);
        setTimeEntries(prev => [t, ...prev]);
        toast.success("Time entry saved");
      } else {
        await updateTimeEntry(t);
        setTimeEntries(prev => prev.map(x => x.id === t.id ? t : x));
        toast.success("Time entry updated");
      }
      setEditingTime(null); setIsNewTime(false);
    } catch { toast.error("Failed to save time entry"); }
  };

  const handleDeleteTime = async (id: string) => {
    try {
      await deleteTimeEntry(id);
      setTimeEntries(prev => prev.filter(x => x.id !== id));
      if (editingTime?.id === id) { setEditingTime(null); setIsNewTime(false); }
      toast.success("Entry deleted");
    } catch { toast.error("Failed to delete entry"); }
  };

  // ── Start adding ───────────────────────────────────────────────────────────

  const startAdd = (type: AddType) => {
    setShowAddMenu(false);
    // Clear any current editing
    setEditingApp(null);  setIsNewApp(false);
    setEditingTime(null); setIsNewTime(false);

    if (type === "appearance") {
      const entry = blankAppearance(matter.id, matter.court);
      const defaultFee = getFeeForHearingType("mention", feeSchedule);
      if (defaultFee > 0) entry.fee_amount = defaultFee;
      setEditingApp(entry);
      setIsNewApp(true);
    } else {
      const entry = blankTimeEntry(matter.id);
      if (feeSchedule && feeSchedule.default_hourly_rate > 0) {
        entry.rate_per_hour = feeSchedule.default_hourly_rate;
      }
      setEditingTime(entry);
      setIsNewTime(true);
    }
  };

  // ── Unified list ───────────────────────────────────────────────────────────

  const allItems: WorkItem[] = [
    ...appearances.map(a => ({ kind: "appearance" as const, data: a })),
    ...timeEntries.map(t => ({ kind: "time" as const, data: t })),
  ].sort((a, b) => b.data.date.localeCompare(a.data.date));

  const filteredItems = allItems.filter(item => {
    if (filter === "appearances") return item.kind === "appearance";
    if (filter === "time")        return item.kind === "time";
    return true;
  });

  // ── Billing summary ───────────────────────────────────────────────────────

  const unbilledApps  = appearances.filter(a => !a.is_billed && a.fee_amount > 0);
  const unbilledTimes = timeEntries.filter(t => !t.is_billed && t.is_billable && t.duration_minutes > 0);
  const unbilledValue =
    unbilledApps.reduce((s, a) => s + a.fee_amount, 0) +
    unbilledTimes.reduce((s, t) => s + (t.duration_minutes / 60) * t.rate_per_hour, 0);

  const totalTimeMins = timeEntries.reduce((s, t) => s + t.duration_minutes, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-100 shrink-0">

        {/* Filter pills */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
          {(["all", "appearances", "time"] as Filter[]).map(f => (
            <button key={f} type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}>
              {f === "all" ? "All" : f === "appearances" ? "Appearances" : "Time Entries"}
            </button>
          ))}
        </div>

        {/* Summary */}
        <span className="text-xs text-neutral-400">
          {allItems.length} entries
          {totalTimeMins > 0 && ` · ${fmtDuration(totalTimeMins)}`}
          {unbilledValue > 0 && (
            <span className="text-amber-600 font-medium ml-1">· {inr(unbilledValue)} unbilled</span>
          )}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {/* Timer */}
          {timerActive ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-medium text-neutral-800">{fmtTimer(timerSeconds)}</span>
              <button onClick={stopTimer}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Square size={12} /> Stop
              </button>
            </div>
          ) : (
            <button onClick={() => setTimerActive(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600">
              <Play size={12} /> Start Timer
            </button>
          )}

          {/* + Add Work dropdown */}
          <div className="relative" ref={addMenuRef}>
            <button
              type="button"
              onClick={() => setShowAddMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors"
            >
              <Plus size={12} /> Add Work <ChevronDown size={11} className={`transition-transform ${showAddMenu ? "rotate-180" : ""}`} />
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden z-10 w-44">
                <button type="button"
                  onClick={() => startAdd("appearance")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 text-left">
                  <Gavel size={14} className="text-indigo-500 shrink-0" />
                  Appearance
                </button>
                <button type="button"
                  onClick={() => startAdd("time")}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 text-left border-t border-neutral-100">
                  <Clock size={14} className="text-blue-500 shrink-0" />
                  Time Entry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Inline forms ──────────────────────────────────────────────────── */}
      {editingApp && (
        <AppearanceForm
          entry={editingApp}
          feeSchedule={feeSchedule}
          onSave={handleSaveApp}
          onCancel={() => { setEditingApp(null); setIsNewApp(false); }}
        />
      )}
      {editingTime && (
        <TimeEntryForm
          entry={editingTime}
          onSave={handleSaveTime}
          onCancel={() => { setEditingTime(null); setIsNewTime(false); }}
        />
      )}

      {/* ── Unified list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 && !editingApp && !editingTime && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <p className="text-sm text-neutral-400">
              {filter === "all"
                ? "No work recorded yet. Click \"Add Work\" to get started."
                : filter === "appearances"
                ? "No appearances recorded yet."
                : "No time entries yet."}
            </p>
          </div>
        )}

        {filteredItems.map(item => (
          item.kind === "appearance"
            ? <AppearanceRow
                key={item.data.id}
                entry={item.data}
                onEdit={() => { setEditingApp(item.data); setIsNewApp(false); setEditingTime(null); }}
                onDelete={() => handleDeleteApp(item.data.id)}
              />
            : <TimeRow
                key={item.data.id}
                entry={item.data}
                onEdit={() => { setEditingTime(item.data); setIsNewTime(false); setEditingApp(null); }}
                onDelete={() => handleDeleteTime(item.data.id)}
              />
        ))}
      </div>

      {/* ── Bill Unbilled Work ────────────────────────────────────────────── */}
      {(unbilledApps.length + unbilledTimes.length) > 0 && (
        <div className="shrink-0 border-t border-neutral-100">
          <BillUnbilledWork
            matter={matter}
            onInvoiceCreated={id => onInvoiceCreated?.(id)}
          />
        </div>
      )}
    </div>
  );
}

// ── Appearance row ────────────────────────────────────────────────────────────

function AppearanceRow({ entry: a, onEdit, onDelete }: {
  entry: Appearance;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-6 py-3 border-b border-neutral-100 flex items-center gap-4 hover:bg-neutral-50 group">
      {/* Date */}
      <div className="w-24 shrink-0">
        <p className="text-xs text-neutral-500">{format(new Date(a.date), "d MMM yyyy")}</p>
      </div>

      {/* Type badge */}
      <div className="w-6 flex items-center justify-center shrink-0">
        <Gavel size={13} className="text-indigo-400" />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${BADGE[a.hearing_type] ?? "bg-neutral-100 text-neutral-500"}`}>
          {HEARING_TYPE_LABELS[a.hearing_type] ?? a.hearing_type}
        </span>
        {a.court && <span className="text-xs text-neutral-500 truncate">{a.court}</span>}
        {a.notes && <span className="text-xs text-neutral-400 truncate">— {a.notes}</span>}
      </div>

      {/* Duration — n/a for appearances */}
      <div className="w-16 text-right shrink-0">
        <span className="text-xs text-neutral-300">—</span>
      </div>

      {/* Amount */}
      <div className="w-24 text-right shrink-0">
        <p className="text-sm font-medium tabular-nums text-neutral-800">{inr(a.fee_amount)}</p>
        <p className={`text-xs ${a.is_billed ? "text-emerald-600" : "text-amber-600"}`}>
          {a.is_billed ? "Billed" : "Unbilled"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700" title="Edit">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Time entry row ────────────────────────────────────────────────────────────

function TimeRow({ entry: t, onEdit, onDelete }: {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const amount = (t.duration_minutes / 60) * t.rate_per_hour;
  return (
    <div className="px-6 py-3 border-b border-neutral-100 flex items-center gap-4 hover:bg-neutral-50 group">
      {/* Date */}
      <div className="w-24 shrink-0">
        <p className="text-xs text-neutral-500">{format(new Date(t.date), "d MMM yyyy")}</p>
      </div>

      {/* Type icon */}
      <div className="w-6 flex items-center justify-center shrink-0">
        <Clock size={13} className="text-blue-400" />
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-800 truncate">{t.description || <span className="text-neutral-400 italic">No description</span>}</p>
      </div>

      {/* Duration */}
      <div className="w-16 text-right shrink-0">
        <p className="text-xs font-medium text-neutral-600">{fmtDuration(t.duration_minutes)}</p>
      </div>

      {/* Amount */}
      <div className="w-24 text-right shrink-0">
        {t.is_billable ? (
          <>
            <p className="text-sm font-medium tabular-nums text-neutral-800">{inr(amount)}</p>
            <p className={`text-xs ${t.is_billed ? "text-emerald-600" : "text-amber-600"}`}>
              {t.is_billed ? "Billed" : "Unbilled"}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-300">—</p>
            <p className="text-xs text-neutral-400">Non-billable</p>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="p-1.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700" title="Edit">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500" title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Appearance inline form ────────────────────────────────────────────────────

function AppearanceForm({ entry, feeSchedule, onSave, onCancel }: {
  entry: Appearance;
  feeSchedule: FeeSchedule | null;
  onSave: (a: Appearance) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(entry);
  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";
  const isCourtWork = COURT_APPEARANCE_TYPES.some(x => x.value === form.hearing_type);

  const handleTypeChange = (newType: HearingType) => {
    const scheduledFee = getFeeForHearingType(newType, feeSchedule);
    setForm(f => ({ ...f, hearing_type: newType, fee_amount: scheduledFee }));
  };

  return (
    <div className="px-6 py-4 bg-indigo-50/60 border-b border-indigo-100 space-y-3 shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <Gavel size={13} className="text-indigo-500" />
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Appearance</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Date</p>
          <input type="date" className={inp} value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="min-w-48">
          <p className="text-xs text-neutral-500 mb-1">Type of Work</p>
          <select className={inp + " w-full"} value={form.hearing_type}
            onChange={e => handleTypeChange(e.target.value as HearingType)}>
            <optgroup label="── Court Appearances ──">
              {COURT_APPEARANCE_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
            <optgroup label="── Professional Work ──">
              {PROFESSIONAL_WORK_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
          </select>
        </div>
        {isCourtWork && (
          <div className="flex-1 min-w-36">
            <p className="text-xs text-neutral-500 mb-1">Court</p>
            <input className={inp + " w-full"} value={form.court ?? ""}
              onChange={e => setForm(f => ({ ...f, court: e.target.value }))} />
          </div>
        )}
        <div>
          <p className="text-xs text-neutral-500 mb-1">Fee (₹)</p>
          <input type="number" min="0" className={inp + " w-28"} value={form.fee_amount}
            onChange={e => setForm(f => ({ ...f, fee_amount: +e.target.value }))} />
        </div>
        <div className="flex items-center gap-1.5 pb-1">
          <input type="checkbox" id="billed-app-wd" checked={!!form.is_billed}
            onChange={e => setForm(f => ({ ...f, is_billed: e.target.checked ? 1 : 0 }))} />
          <label htmlFor="billed-app-wd" className="text-sm text-neutral-600 cursor-pointer">Billed</label>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <p className="text-xs text-neutral-500 mb-1">Notes</p>
          <input className={inp + " w-full"} placeholder="Optional notes…"
            value={form.notes ?? ""}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <button onClick={() => onSave(form)}
          className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">Save</button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600">Cancel</button>
      </div>
    </div>
  );
}

// ── Time entry inline form ────────────────────────────────────────────────────

function TimeEntryForm({ entry, onSave, onCancel }: {
  entry: TimeEntry;
  onSave: (t: TimeEntry) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(entry);
  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";
  const durationHours = form.duration_minutes > 0
    ? parseFloat((form.duration_minutes / 60).toFixed(2))
    : "";

  const handleDurationChange = (v: string) => {
    const hrs = parseFloat(v);
    const mins = isNaN(hrs) ? 0 : Math.round(hrs * 60);
    setForm(f => ({ ...f, duration_minutes: mins }));
  };

  return (
    <div className="px-6 py-4 bg-blue-50/60 border-b border-blue-100 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={13} className="text-blue-500" />
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Time Entry</p>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Date</p>
          <input type="date" className={inp} value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="flex-1 min-w-40">
          <p className="text-xs text-neutral-500 mb-1">Description</p>
          <input className={inp + " w-full"} placeholder="What did you work on?"
            value={form.description ?? ""}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">Duration (hrs)</p>
          <input type="number" min="0" step="0.5" className={inp + " w-24"}
            value={durationHours} placeholder="e.g. 1.5"
            onChange={e => handleDurationChange(e.target.value)} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">Rate / hr (₹)</p>
          <input type="number" min="0" className={inp + " w-28"} value={form.rate_per_hour}
            onChange={e => setForm(f => ({ ...f, rate_per_hour: +e.target.value }))} />
        </div>
        <div className="flex items-center gap-1.5 pb-1">
          <input type="checkbox" id="billable-wd" checked={!!form.is_billable}
            onChange={e => setForm(f => ({ ...f, is_billable: e.target.checked ? 1 : 0 }))} />
          <label htmlFor="billable-wd" className="text-sm text-neutral-600 cursor-pointer">Billable</label>
        </div>
        <button onClick={() => onSave(form)}
          className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">Save</button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600">Cancel</button>
      </div>
    </div>
  );
}
