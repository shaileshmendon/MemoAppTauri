import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { v4 as uuid } from "uuid";
import { format } from "date-fns";
import {
  fetchAppearances, insertAppearance, updateAppearance, deleteAppearance,
} from "../db";
import type { Matter, Appearance, HearingType } from "../types";
import { formatINR as inr } from "../lib/currency";
import { useToast } from "./Toast";

interface Props { matter: Matter; }

const today = () => format(new Date(), "yyyy-MM-dd");

const blank = (matterId: string, court?: string): Appearance => ({
  id: uuid(), matter_id: matterId, date: today(),
  court: court ?? "", hearing_type: "mention", fee_amount: 0, is_billed: 0, notes: "",
});

// ── Work type definitions ──────────────────────────────────────────────────

const COURT_APPEARANCES: { value: HearingType; label: string }[] = [
  { value: "mention",        label: "Mention" },
  { value: "urgent_mention", label: "Urgent Mention" },
  { value: "hearing",        label: "Hearing" },
  { value: "adjournment",    label: "Adjournment" },
  { value: "circulation",    label: "Circulation" },
  { value: "arguments",      label: "Arguments" },
  { value: "evidence",       label: "Evidence" },
  { value: "judgement",      label: "Judgment / Order" },
  { value: "admission",      label: "Admission" },
  { value: "caveat",         label: "Caveat" },
  { value: "board",          label: "Board / NCLT" },
];

const PROFESSIONAL_WORK: { value: HearingType; label: string }[] = [
  { value: "conference",  label: "Conference" },
  { value: "drafting",    label: "Drafting" },
  { value: "research",    label: "Research" },
  { value: "advice",      label: "Advice / Opinion" },
  { value: "retainer",    label: "Retainer" },
  { value: "filing",      label: "Filing" },
  { value: "other",       label: "Other" },
];

const ALL_TYPES = [...COURT_APPEARANCES, ...PROFESSIONAL_WORK];

const LABEL_MAP: Record<HearingType, string> = Object.fromEntries(
  ALL_TYPES.map(({ value, label }) => [value, label])
) as Record<HearingType, string>;

// badge colour per category
const BADGE: Record<HearingType, string> = {
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

// ── Component ──────────────────────────────────────────────────────────────

export default function Appearances({ matter }: Props) {
  const toast = useToast();
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [editing, setEditing] = useState<Appearance | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchAppearances(matter.id).then(setAppearances);
  }, [matter.id]);

  const handleSave = async (a: Appearance) => {
    try {
      if (isNew) {
        await insertAppearance(a);
        setAppearances((prev) => [a, ...prev]);
        toast.success("Appearance saved");
      } else {
        await updateAppearance(a);
        setAppearances((prev) => prev.map((x) => (x.id === a.id ? a : x)));
        toast.success("Appearance updated");
      }
      setEditing(null);
      setIsNew(false);
    } catch {
      toast.error("Failed to save appearance");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAppearance(id);
      setAppearances((prev) => prev.filter((x) => x.id !== id));
      if (editing?.id === id) { setEditing(null); setIsNew(false); }
      toast.success("Appearance deleted");
    } catch {
      toast.error("Failed to delete appearance");
    }
  };

  const total = appearances.reduce((s, a) => s + a.fee_amount, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-700 flex-1">
          Work &amp; Appearances
        </h2>
        <span className="text-xs text-neutral-400">
          {appearances.length} entries · {inr(total)} total
        </span>
        <button
          onClick={() => { setEditing(blank(matter.id, matter.court)); setIsNew(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
          <Plus size={12} /> Add Entry
        </button>
      </div>

      {/* Inline form */}
      {editing && (
        <AppearanceForm
          entry={editing}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsNew(false); }}
        />
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {appearances.length === 0 && !editing && (
          <p className="text-sm text-neutral-400 text-center mt-12">
            No entries yet. Click "Add Entry" to record work done.
          </p>
        )}
        {appearances.map((a) => (
          <div
            key={a.id}
            className="px-6 py-3 border-b border-neutral-100 flex items-center gap-4 hover:bg-neutral-50 group"
          >
            <div className="w-24 shrink-0">
              <p className="text-xs text-neutral-500">
                {format(new Date(a.date), "d MMM yyyy")}
              </p>
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${BADGE[a.hearing_type] ?? "bg-neutral-100 text-neutral-500"}`}>
                {LABEL_MAP[a.hearing_type] ?? a.hearing_type}
              </span>
              {a.court && (
                <span className="text-xs text-neutral-500 truncate">{a.court}</span>
              )}
              {a.notes && (
                <span className="text-xs text-neutral-400 truncate">— {a.notes}</span>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-neutral-800">{inr(a.fee_amount)}</p>
              <p className="text-xs text-neutral-400">{a.is_billed ? "Billed" : "Unbilled"}</p>
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditing(a); setIsNew(false); }}
                className="p-1.5 rounded hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700"
                title="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleDelete(a.id)}
                className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500"
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline form ────────────────────────────────────────────────────────────

function AppearanceForm({
  entry, onSave, onCancel,
}: {
  entry: Appearance;
  onSave: (a: Appearance) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(entry);
  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";

  // Determine whether to show "Court" field — only relevant for actual court appearances
  const isCourtWork = COURT_APPEARANCES.some((x) => x.value === form.hearing_type);

  return (
    <div className="px-6 py-4 bg-neutral-100 border-b border-neutral-200 space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Date */}
        <div>
          <p className="text-xs text-neutral-500 mb-1">Date</p>
          <input type="date" className={inp} value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>

        {/* Work Type — grouped dropdown */}
        <div className="min-w-48">
          <p className="text-xs text-neutral-500 mb-1">Type of Work</p>
          <select
            className={inp + " w-full"}
            value={form.hearing_type}
            onChange={(e) => setForm((f) => ({ ...f, hearing_type: e.target.value as HearingType }))}
          >
            <optgroup label="── Court Appearances ──">
              {COURT_APPEARANCES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
            <optgroup label="── Professional Work ──">
              {PROFESSIONAL_WORK.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Court — only for court appearances */}
        {isCourtWork && (
          <div className="flex-1 min-w-36">
            <p className="text-xs text-neutral-500 mb-1">Court</p>
            <input className={inp + " w-full"} value={form.court ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, court: e.target.value }))} />
          </div>
        )}

        {/* Fee */}
        <div>
          <p className="text-xs text-neutral-500 mb-1">Fee (₹)</p>
          <input type="number" min="0" className={inp + " w-28"} value={form.fee_amount}
            onChange={(e) => setForm((f) => ({ ...f, fee_amount: +e.target.value }))} />
        </div>

        {/* Billed toggle */}
        <div className="flex items-center gap-1.5 pb-1">
          <input type="checkbox" id="billed-app" checked={!!form.is_billed}
            onChange={(e) => setForm((f) => ({ ...f, is_billed: e.target.checked ? 1 : 0 }))} />
          <label htmlFor="billed-app" className="text-sm text-neutral-600 cursor-pointer">Billed</label>
        </div>
      </div>

      {/* Notes — full width row */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <p className="text-xs text-neutral-500 mb-1">Notes</p>
          <input className={inp + " w-full"} placeholder="Optional description…"
            value={form.notes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <button onClick={() => onSave(form)}
          className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
          Save
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
