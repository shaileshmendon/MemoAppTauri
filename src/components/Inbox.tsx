/**
 * Inbox.tsx
 *
 * Displays all unassigned work_captures (matter_id IS NULL).
 * Allows the lawyer to:
 *   - Edit capture details before assigning
 *   - Assign to a matter (converts to appearance / time_entry)
 *   - Discard (permanently delete from inbox)
 *
 * Once assigned, the capture's matter_id and converted_id are stamped and the
 * item disappears from this list — it is NOT deleted (audit trail preserved).
 */

import { useState, useEffect } from "react";
import { Inbox as InboxIcon, Search, Trash2, ArrowRight, Clock, Scale, X, Check } from "lucide-react";
import { format } from "date-fns";
import {
  fetchInboxCaptures,
  fetchMatters,
  assignWorkCapture,
  deleteWorkCapture,
  updateWorkCapture,
} from "../db";
import type { WorkCapture, Matter, HearingType } from "../types";
import { formatINR as inr } from "../lib/currency";
import { useToast } from "./Toast";

// ── Hearing type label map (mirrors Appearances.tsx) ─────────────────────────

const HEARING_LABELS: Partial<Record<HearingType, string>> = {
  mention:        "Mention",
  urgent_mention: "Urgent Mention",
  hearing:        "Hearing",
  adjournment:    "Adjournment",
  circulation:    "Circulation",
  arguments:      "Arguments",
  evidence:       "Evidence",
  judgement:      "Judgment / Order",
  admission:      "Admission",
  caveat:         "Caveat",
  board:          "Board / NCLT",
  conference:     "Conference",
  drafting:       "Drafting",
  research:       "Research",
  advice:         "Advice / Opinion",
  retainer:       "Retainer",
  filing:         "Filing",
  other:          "Other",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onAssigned: () => void;  // triggers sidebar badge refresh
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Inbox({ onAssigned }: Props) {
  const toast = useToast();
  const [captures, setCaptures] = useState<WorkCapture[]>([]);
  const [matters, setMatters]   = useState<Matter[]>([]);
  const [loading, setLoading]   = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null); // capture id being assigned

  useEffect(() => {
    Promise.all([fetchInboxCaptures(), fetchMatters()]).then(([caps, mats]) => {
      setCaptures(caps);
      setMatters(mats.filter(m => m.status === "active"));
      setLoading(false);
    });
  }, []);

  const handleAssign = async (capture: WorkCapture, matter: Matter) => {
    setAssigning(capture.id);
    try {
      await assignWorkCapture(capture, matter.id);
      setCaptures(cs => cs.filter(c => c.id !== capture.id));
      toast.success(`Assigned to ${matter.case_title}`);
      onAssigned();
    } catch {
      toast.error("Failed to assign");
    } finally {
      setAssigning(null);
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await deleteWorkCapture(id);
      setCaptures(cs => cs.filter(c => c.id !== id));
      toast.success("Entry discarded");
      onAssigned(); // update badge count
    } catch {
      toast.error("Failed to discard");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-neutral-400">
        Loading inbox…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-neutral-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <InboxIcon size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Work Inbox</h1>
            <p className="text-xs text-neutral-500">
              {captures.length === 0
                ? "All clear — no unassigned work"
                : `${captures.length} item${captures.length !== 1 ? "s" : ""} waiting to be assigned to a matter`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {captures.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Check size={24} className="text-neutral-400" />
          </div>
          <p className="text-sm font-medium text-neutral-700">Inbox is empty</p>
          <p className="text-xs text-neutral-400 max-w-xs">
            Use <kbd className="bg-neutral-100 border border-neutral-200 rounded px-1 py-0.5 font-mono">⌘K</kbd> to
            quickly capture work. Items saved without a matter will appear here.
          </p>
        </div>
      )}

      {/* Capture list */}
      <div className="flex-1 overflow-y-auto">
        {captures.map(cap => (
          <InboxCard
            key={cap.id}
            capture={cap}
            matters={matters}
            assigning={assigning === cap.id}
            onAssign={handleAssign}
            onDiscard={handleDiscard}
            onUpdated={updated => setCaptures(cs => cs.map(c => c.id === updated.id ? updated : c))}
          />
        ))}
      </div>
    </div>
  );
}

// ── InboxCard ─────────────────────────────────────────────────────────────────

interface CardProps {
  capture: WorkCapture;
  matters: Matter[];
  assigning: boolean;
  onAssign: (capture: WorkCapture, matter: Matter) => void;
  onDiscard: (id: string) => void;
  onUpdated: (updated: WorkCapture) => void;
}

function InboxCard({ capture, matters, assigning, onAssign, onDiscard, onUpdated }: CardProps) {
  const toast = useToast();
  const [query, setQuery]             = useState("");
  const [filtered, setFiltered]       = useState<Matter[]>([]);
  const [showList, setShowList]       = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editForm, setEditForm]       = useState(capture);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // Matter search
  useEffect(() => {
    if (!query.trim()) { setFiltered([]); setShowList(false); return; }
    const q = query.toLowerCase();
    const results = matters.filter(m =>
      m.case_title.toLowerCase().includes(q) ||
      m.client_name.toLowerCase().includes(q) ||
      (m.court ?? "").toLowerCase().includes(q)
    ).slice(0, 5);
    setFiltered(results);
    setShowList(results.length > 0);
  }, [query, matters]);

  const handleSaveEdit = async () => {
    try {
      await updateWorkCapture(editForm);
      onUpdated(editForm);
      setEditing(false);
      toast.success("Entry updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const capturedTime = (() => {
    try { return format(new Date(capture.captured_at), "d MMM, h:mm a"); } catch { return ""; }
  })();

  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";

  return (
    <div className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
      <div className="px-8 py-4">
        {/* Top row: type badge + description + captured time */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium shrink-0 ${
            capture.work_type === "appearance"
              ? "bg-indigo-50 text-indigo-700"
              : "bg-emerald-50 text-emerald-700"
          }`}>
            {capture.work_type === "appearance"
              ? <Scale size={11} />
              : <Clock size={11} />
            }
            {capture.work_type === "appearance" ? "Appearance" : "Time Entry"}
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <input className={inp + " w-full"}
                value={editForm.description ?? ""}
                placeholder="Description…"
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              />
            ) : (
              <p className="text-sm font-medium text-neutral-800 truncate">
                {capture.description || <span className="text-neutral-400 font-normal italic">No description</span>}
              </p>
            )}
          </div>

          <span className="text-xs text-neutral-400 shrink-0">{capturedTime}</span>
        </div>

        {/* Detail row */}
        {!editing ? (
          <div className="flex items-center gap-4 text-xs text-neutral-500 mb-3">
            <span>{format(new Date(capture.work_date), "d MMM yyyy")}</span>
            {capture.work_type === "appearance" && (
              <>
                {capture.hearing_type && <span>{HEARING_LABELS[capture.hearing_type] ?? capture.hearing_type}</span>}
                {capture.court && <span>{capture.court}</span>}
                {capture.fee_amount > 0 && <span className="text-emerald-600 font-medium">{inr(capture.fee_amount)}</span>}
              </>
            )}
            {capture.work_type === "time" && (
              <>
                <span>{Math.floor(capture.duration_minutes / 60)}h {capture.duration_minutes % 60}m</span>
                {capture.rate_per_hour > 0 && (
                  <span className="text-emerald-600 font-medium">
                    {inr((capture.duration_minutes / 60) * capture.rate_per_hour)}
                  </span>
                )}
                {!capture.is_billable && <span className="text-neutral-400">Non-billable</span>}
              </>
            )}
          </div>
        ) : (
          /* Edit form */
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Date</p>
              <input type="date" className={inp}
                value={editForm.work_date}
                onChange={e => setEditForm(f => ({ ...f, work_date: e.target.value }))} />
            </div>
            {capture.work_type === "appearance" ? (
              <>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Court</p>
                  <input className={inp}
                    value={editForm.court ?? ""}
                    placeholder="e.g. Delhi HC"
                    onChange={e => setEditForm(f => ({ ...f, court: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Fee (₹)</p>
                  <input type="number" min={0} className={inp}
                    value={editForm.fee_amount || ""}
                    onChange={e => setEditForm(f => ({ ...f, fee_amount: +e.target.value || 0 }))} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Duration (min)</p>
                  <input type="number" min={0} className={inp}
                    value={editForm.duration_minutes || ""}
                    onChange={e => setEditForm(f => ({ ...f, duration_minutes: +e.target.value || 0 }))} />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Rate / hr (₹)</p>
                  <input type="number" min={0} className={inp}
                    value={editForm.rate_per_hour || ""}
                    onChange={e => setEditForm(f => ({ ...f, rate_per_hour: +e.target.value || 0 }))} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3">
          {/* Matter search + assign */}
          {!editing && (
            <div className="relative flex-1 max-w-xs">
              <div className="flex items-center border border-neutral-200 rounded-lg bg-white overflow-hidden">
                <Search size={13} className="ml-2.5 text-neutral-400 shrink-0" />
                <input
                  className="flex-1 px-2 py-1.5 text-sm outline-none bg-transparent"
                  placeholder="Search matter to assign…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); }}
                  onFocus={() => { if (filtered.length) setShowList(true); }}
                />
                {query && (
                  <button className="pr-2 text-neutral-400 hover:text-neutral-600"
                    onClick={() => { setQuery(""); setShowList(false); }}>
                    <X size={12} />
                  </button>
                )}
              </div>
              {showList && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                  {filtered.map(m => (
                    <button key={m.id} type="button"
                      disabled={assigning}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 border-b border-neutral-100 last:border-0 flex items-center gap-2"
                      onClick={() => { setShowList(false); setQuery(""); onAssign(capture, m); }}>
                      <ArrowRight size={12} className="text-neutral-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">{m.case_title}</p>
                        <p className="text-xs text-neutral-400">{m.client_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit / save */}
          {!editing ? (
            <button
              className="text-xs text-neutral-500 hover:text-neutral-800 px-2 py-1.5 rounded-lg hover:bg-neutral-100"
              onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : (
            <>
              <button
                className="text-xs px-3 py-1.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
                onClick={handleSaveEdit}>
                Save
              </button>
              <button
                className="text-xs px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50"
                onClick={() => { setEditForm(capture); setEditing(false); }}>
                Cancel
              </button>
            </>
          )}

          {/* Discard */}
          {!editing && (
            !discardConfirm ? (
              <button
                className="ml-auto text-xs text-neutral-400 hover:text-red-500 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-red-50"
                onClick={() => setDiscardConfirm(true)}>
                <Trash2 size={12} /> Discard
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="text-neutral-500">Discard this entry?</span>
                <button className="text-red-600 hover:text-red-700 font-medium"
                  onClick={() => onDiscard(capture.id)}>Yes, delete</button>
                <button className="text-neutral-500 hover:text-neutral-700"
                  onClick={() => setDiscardConfirm(false)}>Cancel</button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
