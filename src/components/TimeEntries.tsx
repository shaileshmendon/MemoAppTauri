import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Play, Square } from "lucide-react";
import { v4 as uuid } from "uuid";
import { format } from "date-fns";
import {
  fetchTimeEntries, insertTimeEntry, updateTimeEntry, deleteTimeEntry,
} from "../db";
import type { Matter, TimeEntry } from "../types";
import { formatINR as inr } from "../lib/currency";

interface Props {
  matter: Matter;
}

const today = () => format(new Date(), "yyyy-MM-dd");

const blank = (matterId: string): TimeEntry => ({
  id: uuid(),
  matter_id: matterId,
  date: today(),
  description: "",
  duration_minutes: 0,
  rate_per_hour: 0,
  is_billable: 1,
  is_billed: 0,
});

export default function TimeEntries({ matter }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetchTimeEntries(matter.id).then(setEntries);
  }, [matter.id]);

  // Live timer
  useEffect(() => {
    if (timerActive) {
      intervalRef.current = window.setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerActive]);

  const stopTimer = () => {
    setTimerActive(false);
    const mins = Math.ceil(timerSeconds / 60);
    const entry = blank(matter.id);
    entry.duration_minutes = mins;
    setEditing(entry);
    setIsNew(true);
    setTimerSeconds(0);
  };

  const handleSave = async (t: TimeEntry) => {
    if (isNew) {
      await insertTimeEntry(t);
      setEntries((e) => [t, ...e]);
    } else {
      await updateTimeEntry(t);
      setEntries((e) => e.map((x) => (x.id === t.id ? t : x)));
    }
    setEditing(null);
    setIsNew(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTimeEntry(id);
    setEntries((e) => e.filter((x) => x.id !== id));
  };

  const totalMins = entries.reduce((s, t) => s + t.duration_minutes, 0);
  const totalBillable = entries.filter((t) => t.is_billable).reduce((s, t) => {
    return s + (t.duration_minutes / 60) * t.rate_per_hour;
  }, 0);

  const fmtTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-700 flex-1">Time Entries</h2>
        <span className="text-xs text-neutral-400">
          {Math.floor(totalMins / 60)}h {totalMins % 60}m · {inr(totalBillable)} billable
        </span>

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

        <button
          onClick={() => { setEditing(blank(matter.id)); setIsNew(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
          <Plus size={12} /> Add Entry
        </button>
      </div>

      {/* Form */}
      {editing && (
        <EntryForm
          entry={editing}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsNew(false); }}
        />
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && !editing && (
          <p className="text-sm text-neutral-400 text-center mt-12">No time entries yet.</p>
        )}
        {entries.map((t) => (
          <div key={t.id}
            className="px-6 py-3 border-b border-neutral-100 flex items-center gap-4 hover:bg-neutral-50 group">
            <div className="w-24 shrink-0">
              <p className="text-xs text-neutral-500">{format(new Date(t.date), "d MMM yyyy")}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-800 truncate">{t.description || "—"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-neutral-800">
                {Math.floor(t.duration_minutes / 60)}h {t.duration_minutes % 60}m
              </p>
              {t.is_billable ? (
                <p className="text-xs text-emerald-600">
                  {inr((t.duration_minutes / 60) * t.rate_per_hour)}
                </p>
              ) : (
                <p className="text-xs text-neutral-400">Non-billable</p>
              )}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditing(t); setIsNew(false); }}
                className="p-1.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-600">
                <Plus size={13} className="rotate-45" />
              </button>
              <button onClick={() => handleDelete(t.id)}
                className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryForm({
  entry, onSave, onCancel,
}: { entry: TimeEntry; onSave: (t: TimeEntry) => void; onCancel: () => void }) {
  const [form, setForm] = useState(entry);

  const input = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";

  return (
    <div className="px-6 py-3 bg-neutral-100 border-b border-neutral-200 flex flex-wrap gap-3 items-end">
      <div>
        <p className="text-xs text-neutral-500 mb-1">Date</p>
        <input type="date" className={input} value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
      </div>
      <div className="flex-1 min-w-40">
        <p className="text-xs text-neutral-500 mb-1">Description</p>
        <input className={input + " w-full"} placeholder="What did you work on?"
          value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </div>
      <div>
        <p className="text-xs text-neutral-500 mb-1">Duration (min)</p>
        <input type="number" min="0" className={input + " w-24"} value={form.duration_minutes}
          onChange={(e) => setForm((f) => ({ ...f, duration_minutes: +e.target.value }))} />
      </div>
      <div>
        <p className="text-xs text-neutral-500 mb-1">Rate / hr (₹)</p>
        <input type="number" min="0" className={input + " w-28"} value={form.rate_per_hour}
          onChange={(e) => setForm((f) => ({ ...f, rate_per_hour: +e.target.value }))} />
      </div>
      <div className="flex items-center gap-1.5">
        <input type="checkbox" id="billable" checked={!!form.is_billable}
          onChange={(e) => setForm((f) => ({ ...f, is_billable: e.target.checked ? 1 : 0 }))} />
        <label htmlFor="billable" className="text-sm text-neutral-600">Billable</label>
      </div>
      <button onClick={() => onSave(form)}
        className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">Save</button>
      <button onClick={onCancel}
        className="px-4 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600">Cancel</button>
    </div>
  );
}
