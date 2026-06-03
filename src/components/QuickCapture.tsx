/**
 * QuickCapture.tsx
 *
 * Global ⌘K capture palette.  Lets the lawyer log an appearance or time entry
 * in under 5 seconds without selecting a client, matter, or case first.
 *
 * The captured record is stored in `work_captures` with matter_id = NULL
 * and appears in the Work Inbox for later assignment.
 *
 * Optionally the lawyer can choose a matter immediately ("Assign & Save"),
 * which converts the capture directly to an appearance / time_entry.
 */

import { useState, useEffect, useRef } from "react";
import { useKeyboardShortcuts, useFocusTrap } from "../lib/keyboard/useKeyboardShortcuts";
import { SHORTCUTS } from "../lib/keyboard/shortcuts";
import { X, Zap, Clock, Scale } from "lucide-react";
import { v4 as uuid } from "uuid";
import { format } from "date-fns";
import {
  insertWorkCapture, assignWorkCapture, fetchMatters, loadFeeSchedule,
} from "../db";
import type { WorkCapture, WorkCaptureType, HearingType, Matter, FeeSchedule } from "../types";
// FeeSchedule is used only for the useState type annotation below
import {
  COURT_APPEARANCE_TYPES as COURT_APPEARANCES,
  PROFESSIONAL_WORK_TYPES as PROFESSIONAL_WORK,
  getFeeForHearingType,
} from "../lib/feeSchedule";
import { useToast } from "./Toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function blankCapture(): Omit<WorkCapture, "id" | "captured_at"> {
  return {
    work_date:        todayStr(),
    work_type:        "appearance",
    description:      "",
    hearing_type:     "mention",
    court:            "",
    fee_amount:       0,
    duration_minutes: 0,
    rate_per_hour:    0,
    is_billable:      1,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSaved: () => void;   // called after any successful save — triggers inbox badge refresh
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuickCapture({ onClose, onSaved }: Props) {
  const toast = useToast();
  const descRef  = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [form, setForm]               = useState(blankCapture());
  const [matterQuery, setMatterQuery] = useState("");
  const [allMatters, setAllMatters]   = useState<Matter[]>([]);
  const [filtered, setFiltered]       = useState<Matter[]>([]);
  const [selected, setSelected]       = useState<Matter | null>(null);
  const [showMatterList, setShowMatterList] = useState(false);
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule | null>(null);
  const [saving, setSaving]           = useState(false);

  // Load matters + fee schedule on mount; focus description
  useEffect(() => {
    fetchMatters().then(m => setAllMatters(m.filter(x => x.status === "active")));
    loadFeeSchedule().then(setFeeSchedule);
    setTimeout(() => descRef.current?.focus(), 60);
  }, []);

  // Seed fee from schedule when work type or hearing type changes
  useEffect(() => {
    if (!feeSchedule) return;
    if (form.work_type === "appearance") {
      const ht = (form.hearing_type ?? "mention") as HearingType;
      const scheduled = getFeeForHearingType(ht, feeSchedule);
      if (form.fee_amount === 0 && scheduled > 0) {
        setForm(f => ({ ...f, fee_amount: scheduled }));
      }
    } else {
      if (form.rate_per_hour === 0 && feeSchedule.default_hourly_rate > 0) {
        setForm(f => ({ ...f, rate_per_hour: feeSchedule.default_hourly_rate }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.work_type, form.hearing_type, feeSchedule]);

  // Matter search filter
  useEffect(() => {
    if (!matterQuery.trim()) { setFiltered([]); setShowMatterList(false); return; }
    const q = matterQuery.toLowerCase();
    const results = allMatters.filter(m =>
      m.case_title.toLowerCase().includes(q) ||
      m.client_name.toLowerCase().includes(q) ||
      (m.court ?? "").toLowerCase().includes(q) ||
      (m.matter_number ?? "").toLowerCase().includes(q)
    ).slice(0, 6);
    setFiltered(results);
    setShowMatterList(results.length > 0);
  }, [matterQuery, allMatters]);

  // Trap focus inside the modal so Tab never escapes to the background
  useFocusTrap(modalRef, true);

  const handleTypeChange = (newType: WorkCaptureType) => {
    setForm(f => ({
      ...f,
      work_type: newType,
      // Reset amounts so fee-schedule seeding fires on the new type
      fee_amount: 0,
      rate_per_hour: 0,
    }));
  };

  const handleHearingTypeChange = (ht: HearingType) => {
    setForm(f => {
      const scheduled = getFeeForHearingType(ht, feeSchedule);
      return {
        ...f,
        hearing_type: ht,
        // Always apply the scheduled fee when type changes; user can override after
        fee_amount: scheduled,
      };
    });
  };

  const selectMatter = (m: Matter) => {
    setSelected(m);
    setMatterQuery(m.case_title);
    setShowMatterList(false);
    // Pre-fill court from matter if blank
    if (!form.court && m.court) setForm(f => ({ ...f, court: m.court ?? "" }));
  };

  const buildCapture = (): WorkCapture => ({
    ...form,
    id:          uuid(),
    captured_at: new Date().toISOString(),
  });

  /** Save to inbox (no matter assignment). */
  const handleSaveToInbox = async () => {
    setSaving(true);
    try {
      await insertWorkCapture(buildCapture());
      toast.success("Saved to inbox");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save capture");
    } finally {
      setSaving(false);
    }
  };

  /** Save and immediately assign to the selected matter. */
  const handleAssignAndSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const capture = buildCapture();
      await insertWorkCapture(capture);
      await assignWorkCapture(capture, selected.id);
      toast.success(`Saved to ${selected.case_title}`);
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save or assign");
    } finally {
      setSaving(false);
    }
  };

  const inp = "border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-100 bg-white w-full";

  // Keyboard shortcuts — placed here so handlers are in scope
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useKeyboardShortcuts([
    { key: SHORTCUTS.CLOSE.key, handler: onClose },
    { key: SHORTCUTS.SAVE.key,  handler: handleSaveToInbox, allowInInputs: true },
  ]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" role="dialog" aria-modal="true" aria-label="Quick Capture">

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-neutral-100">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-neutral-800 flex-1">Quick Capture</p>
          <kbd className="text-xs text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">Esc</kbd>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-100 text-neutral-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Work type toggle */}
          <div className="flex gap-2">
            {([
              ["appearance", "Appearance", <Scale size={13} />],
              ["time",       "Time Entry", <Clock size={13} />],
            ] as [WorkCaptureType, string, React.ReactNode][]).map(([type, label, icon]) => (
              <button key={type} type="button"
                onClick={() => handleTypeChange(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  form.work_type === type
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Description <span className="text-neutral-400">(optional)</span></label>
            <input
              ref={descRef}
              className={inp}
              placeholder={form.work_type === "appearance"
                ? "e.g. Mention – Delhi HC – Sharma v UOI"
                : "e.g. Drafted reply to counter-affidavit"
              }
              value={form.description ?? ""}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Date + Type-specific fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Date</label>
              <input type="date" className={inp}
                value={form.work_date}
                onChange={e => setForm(f => ({ ...f, work_date: e.target.value }))} />
            </div>

            {form.work_type === "appearance" ? (
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Type</label>
                <select className={inp}
                  value={form.hearing_type}
                  onChange={e => handleHearingTypeChange(e.target.value as HearingType)}>
                  <optgroup label="Court Appearances">
                    {COURT_APPEARANCES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Professional Work">
                    {PROFESSIONAL_WORK.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Duration (hrs)</label>
                <input type="number" min={0} step={0.5} className={inp}
                  value={form.duration_minutes > 0
                    ? parseFloat((form.duration_minutes / 60).toFixed(2))
                    : ""}
                  placeholder="e.g. 1.5"
                  onChange={e => {
                    const hrs = parseFloat(e.target.value);
                    const mins = isNaN(hrs) ? 0 : Math.round(hrs * 60);
                    setForm(f => ({ ...f, duration_minutes: mins }));
                  }} />
              </div>
            )}
          </div>

          {/* Amount / Rate */}
          <div className="grid grid-cols-2 gap-3">
            {form.work_type === "appearance" ? (
              <>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Court</label>
                  <input className={inp}
                    placeholder="e.g. Delhi HC"
                    value={form.court ?? ""}
                    onChange={e => setForm(f => ({ ...f, court: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Fee (₹)</label>
                  <input type="number" min={0} step={500} className={inp}
                    value={form.fee_amount || ""}
                    placeholder="0"
                    onChange={e => setForm(f => ({ ...f, fee_amount: +e.target.value || 0 }))} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Rate / hr (₹)</label>
                  <input type="number" min={0} step={500} className={inp}
                    value={form.rate_per_hour || ""}
                    placeholder="0"
                    onChange={e => setForm(f => ({ ...f, rate_per_hour: +e.target.value || 0 }))} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.is_billable}
                      onChange={e => setForm(f => ({ ...f, is_billable: e.target.checked ? 1 : 0 }))} />
                    <span className="text-sm text-neutral-600">Billable</span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Matter picker */}
          <div className="relative">
            <label className="block text-xs text-neutral-500 mb-1">
              Matter <span className="text-neutral-400">(optional — assign now or from inbox later)</span>
            </label>
            <input className={inp}
              placeholder="Search by title, client, court…"
              value={matterQuery}
              onChange={e => { setMatterQuery(e.target.value); setSelected(null); }}
              onFocus={() => { if (filtered.length > 0) setShowMatterList(true); }}
            />
            {showMatterList && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                {filtered.map(m => (
                  <button key={m.id} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                    onClick={() => selectMatter(m)}>
                    <p className="text-sm font-medium text-neutral-800 truncate">{m.case_title}</p>
                    <p className="text-xs text-neutral-400">{m.client_name}{m.court ? ` · ${m.court}` : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-200 bg-white">
          <button onClick={onClose} type="button"
            className="px-3 py-2 text-sm font-medium text-neutral-500 rounded-lg hover:bg-neutral-100 hover:text-neutral-800 transition-colors">
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveToInbox}
              className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 hover:border-neutral-400 transition-colors disabled:opacity-40 shadow-sm">
              Save to Inbox
            </button>
            <button
              type="button"
              disabled={saving || !selected}
              onClick={handleAssignAndSave}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                selected
                  ? "bg-neutral-900 text-white hover:bg-neutral-700 cursor-pointer"
                  : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              }`}>
              Assign &amp; Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
