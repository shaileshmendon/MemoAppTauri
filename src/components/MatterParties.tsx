/**
 * MatterParties — inline party-representation manager embedded in MatterDetail.
 *
 * Allows recording which specific party/parties the advocate is appearing for
 * in a matter, with optional numbering (e.g. "Respondent No. 2").
 */
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { v4 as uuid } from "uuid";
import {
  fetchMatterParties, insertMatterParty, updateMatterParty, deleteMatterParty,
} from "../db";
import type { MatterParty } from "../types";
import { formatParty } from "../types";
import { useToast } from "./Toast";

// ── Preset party types grouped by proceeding category ─────────────────────

const PARTY_PRESETS: { group: string; types: string[] }[] = [
  {
    group: "Civil / Writ",
    types: ["Petitioner", "Respondent", "Intervenor", "Applicant", "Opposite Party"],
  },
  {
    group: "Appeals",
    types: ["Appellant", "Respondent"],
  },
  {
    group: "Civil Suit",
    types: ["Plaintiff", "Defendant"],
  },
  {
    group: "Criminal",
    types: ["Complainant", "Accused", "Prosecution", "Defence"],
  },
  {
    group: "Arbitration / Tribunal",
    types: ["Claimant", "Respondent", "Applicant", "Opposite Party"],
  },
  {
    group: "Revenue / Tax",
    types: ["Assessee", "Department", "Revenue"],
  },
  {
    group: "Labour / Industrial",
    types: ["Workman", "Management", "Employer", "Employee"],
  },
  {
    group: "Recovery / Execution",
    types: ["Decree Holder", "Judgment Debtor"],
  },
  {
    group: "Property",
    types: ["Landlord", "Tenant", "Licensor", "Licensee"],
  },
  {
    group: "Company Law",
    types: ["Company", "Petitioner", "Respondent"],
  },
];

// Flat sorted unique list for the datalist autocomplete
const ALL_PRESET_TYPES = [...new Set(PARTY_PRESETS.flatMap((g) => g.types))].sort();

// Badge colour per common type (falls back to neutral)
const TYPE_COLOUR: Record<string, string> = {
  Petitioner:      "bg-neutral-200 text-neutral-900",
  Respondent:      "bg-indigo-100 text-indigo-700",
  Appellant:       "bg-violet-100 text-violet-700",
  Plaintiff:       "bg-sky-100 text-sky-700",
  Defendant:       "bg-rose-100 text-rose-700",
  Complainant:     "bg-orange-100 text-orange-700",
  Accused:         "bg-red-100 text-red-700",
  Applicant:       "bg-teal-100 text-teal-700",
  Claimant:        "bg-cyan-100 text-cyan-700",
  Intervenor:      "bg-amber-100 text-amber-700",
  Assessee:        "bg-lime-100 text-lime-700",
  Department:      "bg-slate-100 text-slate-700",
  Workman:         "bg-emerald-100 text-emerald-700",
  Management:      "bg-neutral-200 text-neutral-700",
  "Decree Holder": "bg-green-100 text-green-700",
  "Judgment Debtor": "bg-red-100 text-red-600",
};

function badgeClass(type: string): string {
  return TYPE_COLOUR[type] ?? "bg-neutral-100 text-neutral-600";
}

// ── Blank form ─────────────────────────────────────────────────────────────

function blankParty(matterId: string): MatterParty {
  return {
    id: uuid(), matter_id: matterId,
    party_type: "", party_number: undefined, party_name: "", notes: "",
  };
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  matterId: string;
}

export default function MatterParties({ matterId }: Props) {
  const toast = useToast();
  const [parties, setParties] = useState<MatterParty[]>([]);
  const [editing, setEditing] = useState<MatterParty | null>(null);
  const [isNew, setIsNew]     = useState(false);

  useEffect(() => {
    fetchMatterParties(matterId).then(setParties);
  }, [matterId]);

  const handleSave = async (p: MatterParty) => {
    if (!p.party_type.trim()) return;
    try {
      if (isNew) {
        await insertMatterParty(p);
        setParties((prev) => [...prev, p].sort(sortParties));
        toast.success("Party saved");
      } else {
        await updateMatterParty(p);
        setParties((prev) => prev.map((x) => (x.id === p.id ? p : x)).sort(sortParties));
        toast.success("Party updated");
      }
      setEditing(null);
      setIsNew(false);
    } catch {
      toast.error("Failed to save party");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMatterParty(id);
      setParties((prev) => prev.filter((x) => x.id !== id));
      if (editing?.id === id) { setEditing(null); setIsNew(false); }
      toast.success("Party removed");
    } catch {
      toast.error("Failed to remove party");
    }
  };

  const startNew = () => {
    setEditing(blankParty(matterId));
    setIsNew(true);
  };

  return (
    <div className="px-6 mt-5">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-neutral-400" />
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex-1">
          Appearing For
        </p>
        <button
          onClick={startNew}
          className="flex items-center gap-1 text-xs text-neutral-800 hover:text-neutral-900 font-medium"
        >
          <Plus size={12} /> Add Party
        </button>
      </div>

      {/* Inline form */}
      {editing && (
        <PartyForm
          party={editing}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsNew(false); }}
        />
      )}

      {/* Party list */}
      {parties.length === 0 && !editing ? (
        <p className="text-xs text-neutral-400 italic mb-2">
          No parties recorded. Click "Add Party" to specify who you are appearing for.
        </p>
      ) : (
        <div className="space-y-2">
          {parties.map((p) => (
            <PartyRow
              key={p.id}
              party={p}
              onEdit={() => { setEditing(p); setIsNew(false); }}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Party row ──────────────────────────────────────────────────────────────

function PartyRow({
  party, onEdit, onDelete,
}: {
  party: MatterParty;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const roleLabel = party.party_number
    ? `${party.party_type} No. ${party.party_number}`
    : party.party_type;

  return (
    <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 group hover:border-neutral-300 transition-colors">
      {/* Role badge */}
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badgeClass(party.party_type)}`}>
        {roleLabel}
      </span>

      {/* Name + notes */}
      <div className="flex-1 min-w-0">
        {party.party_name ? (
          <p className="text-sm font-medium text-neutral-800 truncate">{party.party_name}</p>
        ) : (
          <p className="text-xs text-neutral-400 italic">No party name recorded</p>
        )}
        {party.notes && (
          <p className="text-xs text-neutral-400 truncate">{party.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirmDel ? (
          <>
            <button onClick={onDelete}
              className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Delete
            </button>
            <button onClick={() => setConfirmDel(false)}
              className="text-xs px-2 py-1 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={onEdit}
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
              title="Edit">
              <Pencil size={12} />
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500"
              title="Delete">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Party form ─────────────────────────────────────────────────────────────

function PartyForm({
  party, onSave, onCancel,
}: {
  party: MatterParty;
  onSave: (p: MatterParty) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MatterParty>(party);
  const [useCustomType, setUseCustomType] = useState(
    !!party.party_type && !ALL_PRESET_TYPES.includes(party.party_type)
  );

  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white w-full";

  const handleTypeChange = (val: string) => {
    if (val === "__custom__") {
      setUseCustomType(true);
      setForm((f) => ({ ...f, party_type: "" }));
    } else {
      setUseCustomType(false);
      setForm((f) => ({ ...f, party_type: val }));
    }
  };

  const valid = form.party_type.trim().length > 0;

  return (
    <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-4 mb-3 space-y-3">
      <p className="text-xs font-semibold text-neutral-900">
        {party.party_name || party.party_type ? "Edit Party" : "Add Party"}
      </p>

      <div className="flex flex-wrap gap-3">
        {/* Party type — preset grouped select or custom text */}
        <div className="min-w-48 flex-1">
          <p className="text-xs text-neutral-500 mb-1">Party Role / Designation</p>
          {useCustomType ? (
            <div className="flex gap-1">
              <input
                autoFocus
                className={inp}
                placeholder="e.g. Co-Respondent, Interpleader…"
                value={form.party_type}
                onChange={(e) => setForm((f) => ({ ...f, party_type: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => { setUseCustomType(false); setForm((f) => ({ ...f, party_type: "" })); }}
                className="text-xs text-neutral-500 hover:text-neutral-700 whitespace-nowrap px-2"
              >
                ← Presets
              </button>
            </div>
          ) : (
            <select
              autoFocus
              className={inp}
              value={form.party_type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              <option value="">— Select party role —</option>
              {PARTY_PRESETS.map(({ group, types }) => (
                <optgroup key={group} label={group}>
                  {types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </optgroup>
              ))}
              <option value="__custom__">✎ Enter custom role…</option>
            </select>
          )}
        </div>

        {/* Party number */}
        <div className="w-28">
          <p className="text-xs text-neutral-500 mb-1">No. <span className="font-normal">(optional)</span></p>
          <input
            type="number"
            min="1"
            max="999"
            placeholder="e.g. 2"
            className={inp}
            value={form.party_number ?? ""}
            onChange={(e) => setForm((f) => ({
              ...f,
              party_number: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
            }))}
          />
        </div>
      </div>

      {/* Party name */}
      <div>
        <p className="text-xs text-neutral-500 mb-1">
          Party Name <span className="font-normal">(optional — the actual person or entity)</span>
        </p>
        <input
          className={inp}
          placeholder="e.g. ABC Corporation, John Doe…"
          value={form.party_name ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, party_name: e.target.value }))}
        />
      </div>

      {/* Preview */}
      {form.party_type && (
        <div className="text-xs text-neutral-800 font-medium">
          Preview: <span className="font-normal text-neutral-700">{formatParty(form)}</span>
        </div>
      )}

      {/* Notes */}
      <div>
        <p className="text-xs text-neutral-500 mb-1">Notes <span className="font-normal">(optional)</span></p>
        <input
          className={inp}
          placeholder="Any additional context…"
          value={form.notes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!valid}
          className="px-4 py-1.5 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 font-medium"
        >
          Save
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-sm border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────

function sortParties(a: MatterParty, b: MatterParty): number {
  if (a.party_type < b.party_type) return -1;
  if (a.party_type > b.party_type) return 1;
  return (a.party_number ?? 0) - (b.party_number ?? 0);
}

/** Returns a short summary string of all parties, for use in PDFs / list views */
export function partiesSummary(parties: MatterParty[]): string {
  return parties.map(formatParty).join(", ");
}
