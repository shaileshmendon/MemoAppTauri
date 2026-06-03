/**
 * BillUnbilledWork.tsx
 *
 * "Bill Unbilled Work" — one-click invoice generation from unbilled appearances
 * and time entries on a matter.
 *
 * UI:
 *   • A button is shown on the Matter Overview when unbilled items exist.
 *   • Clicking opens a modal showing a checklist + live invoice preview.
 *   • User can deselect individual items before generating.
 *   • Items already referenced in an existing draft invoice are shown
 *     with a warning and deselected by default (duplicate prevention).
 *   • "Generate Draft Invoice" creates the invoice and auto-opens it
 *     in the Invoices tab.
 *
 * Rules:
 *   • Items are NEVER marked is_billed = 1 here.
 *     That happens only when the invoice is marked Sent.
 *   • No schema changes — uses existing tables and line_items_data JSON.
 */

import { useState, useEffect } from "react";
import { FileText, X, Check, AlertTriangle, Loader, IndianRupee, Clock, Gavel } from "lucide-react";
import { v4 as uuid } from "uuid";
import { format } from "date-fns";
import {
  fetchAllBillableAppearances,
  fetchAllBillableTimeEntries,
  fetchDraftInvoiceSourceIds,
  insertInvoice,
  nextInvoiceNumber,
  loadProfile,
} from "../db";
import type { Matter, Appearance, TimeEntry, Invoice, LineItem } from "../types";
import { HEARING_TYPE_LABELS } from "../lib/feeSchedule";
import { formatINR as inr } from "../lib/currency";
import { useToast } from "./Toast";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  matter: Matter;
  /** Called with the created invoice ID — parent uses this to auto-expand. */
  onInvoiceCreated: (invoiceId: string) => void;
}

// ── Internal types ────────────────────────────────────────────────────────────

interface SelectableAppearance extends Appearance {
  selected: boolean;
  inDraft: boolean;   // already referenced in an existing draft invoice
}

interface SelectableTimeEntry extends TimeEntry {
  selected: boolean;
  inDraft: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try { return format(new Date(iso), "d MMM yyyy"); } catch { return iso; }
}

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillUnbilledWork({ matter, onInvoiceCreated }: Props) {
  const toast = useToast();

  // Trigger state
  const [unbilledCount, setUnbilledCount]       = useState(0);
  const [triggerDraftWarn, setTriggerDraftWarn] = useState(false);
  const [loadingCount, setLoadingCount]         = useState(true);

  // Modal state
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [generating, setGenerating] = useState(false);

  const [appearances, setAppearances] = useState<SelectableAppearance[]>([]);
  const [timeEntries, setTimeEntries] = useState<SelectableTimeEntry[]>([]);
  const [previewNumber, setPreviewNumber] = useState<string>("");

  // ── Initial count (trigger badge) ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchAllBillableAppearances(matter.id),
      fetchAllBillableTimeEntries(matter.id),
      fetchDraftInvoiceSourceIds(matter.id),
    ]).then(([apps, times, draftIds]) => {
      setUnbilledCount(apps.length + times.length);
      // Warn on the trigger if any unbilled item is already in a draft
      const anyInDraft =
        apps.some(a => draftIds.has(a.id)) ||
        times.some(t => draftIds.has(t.id));
      setTriggerDraftWarn(anyInDraft);
      setLoadingCount(false);
    });
  }, [matter.id]);

  // ── Load full data when modal opens ───────────────────────────────────────
  const openModal = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const [apps, times, draftIds, profile] = await Promise.all([
        fetchAllBillableAppearances(matter.id),
        fetchAllBillableTimeEntries(matter.id),
        fetchDraftInvoiceSourceIds(matter.id),
        loadProfile(),
      ]);

      const prefix = profile?.invoicePrefix ?? "INV";
      const num    = await nextInvoiceNumber(prefix);

      setAppearances(apps.map(a => ({
        ...a,
        inDraft:  draftIds.has(a.id),
        selected: !draftIds.has(a.id),   // deselect if already in a draft
      })));

      setTimeEntries(times.map(t => ({
        ...t,
        inDraft:  draftIds.has(t.id),
        selected: !draftIds.has(t.id),
      })));

      setPreviewNumber(num);
    } catch {
      toast.error("Failed to load unbilled items");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived totals ─────────────────────────────────────────────────────────
  const selApps  = appearances.filter(a => a.selected);
  const selTimes = timeEntries.filter(t => t.selected);
  const totalSel = selApps.length + selTimes.length;

  const appTotal  = selApps.reduce((s, a) => s + a.fee_amount, 0);
  const timeTotal = selTimes.reduce((s, t) => s + (t.duration_minutes / 60) * t.rate_per_hour, 0);
  const subtotal  = appTotal + timeTotal;

  const hasDraftWarning = [...appearances, ...timeEntries].some(x => x.inDraft);

  // ── Generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (totalSel === 0) { toast.error("Select at least one item"); return; }

    setGenerating(true);
    try {
      const profile  = await loadProfile();
      const prefix   = profile?.invoicePrefix ?? "INV";
      const gstRate  = profile?.defaultGstRate ?? 18;
      const invNum   = await nextInvoiceNumber(prefix);

      // Build line items (chronological within each group)
      const lineItems: LineItem[] = [
        ...selApps.map(a => ({
          description: `${HEARING_TYPE_LABELS[a.hearing_type] ?? a.hearing_type}${a.court ? ` — ${a.court}` : ""} (${fmtDate(a.date)})`,
          amount:   a.fee_amount,
          type:     "appearance" as const,
          sourceId: a.id,
        })),
        ...selTimes.map(t => ({
          description: `${t.description || "Time Entry"} — ${fmtDuration(t.duration_minutes)} @ ${inr(t.rate_per_hour)}/hr (${fmtDate(t.date)})`,
          amount:   (t.duration_minutes / 60) * t.rate_per_hour,
          type:     "time" as const,
          sourceId: t.id,
        })),
      ];

      // GST: IGST for inter-state, CGST+SGST for same or unknown state
      const sameState =
        matter.client_state && matter.firm_state &&
        matter.client_state === matter.firm_state;
      const taxTotal = subtotal * (gstRate / 100);
      const cgst = sameState ? taxTotal / 2 : 0;
      const sgst = sameState ? taxTotal / 2 : 0;
      const igst = sameState ? 0 : taxTotal;
      const total = subtotal + taxTotal;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoice: Invoice = {
        id:              uuid(),
        matter_id:       matter.id,
        invoice_number:  invNum,
        invoice_date:    format(new Date(), "yyyy-MM-dd"),
        due_date:        format(dueDate, "yyyy-MM-dd"),
        recipient_type:  matter.invoice_recipient ?? "client",
        subtotal_amount: subtotal,
        gst_rate:        gstRate,
        cgst,
        sgst,
        igst,
        total_amount:    total,
        status:          "draft",
        line_items_data: JSON.stringify(lineItems),
      };

      await insertInvoice(invoice);

      toast.success(`Draft ${invNum} created — ${inr(total)}`);
      setOpen(false);
      onInvoiceCreated(invoice.id);
    } catch (err) {
      toast.error(`Failed to create invoice: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Don't render trigger if nothing unbilled ───────────────────────────────
  if (loadingCount || unbilledCount === 0) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <div className="mx-6 mt-5">
        <button
          type="button"
          onClick={openModal}
          className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 hover:border-emerald-300 transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <FileText size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Bill Unbilled Work</p>
            <p className="text-xs text-emerald-700">
              {unbilledCount} item{unbilledCount !== 1 ? "s" : ""} ready to invoice
            </p>
            {triggerDraftWarn && (
              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertTriangle size={11} />
                Some items are already in a draft invoice
              </p>
            )}
          </div>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-1.5 group-hover:bg-emerald-200 transition-colors shrink-0">
            Generate Invoice →
          </span>
        </button>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
          onClick={e => { if (e.target === e.currentTarget && !generating) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-100 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                <FileText size={15} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900">Bill Unbilled Work</p>
                <p className="text-xs text-neutral-500">{matter.case_title}</p>
              </div>
              <button
                onClick={() => { if (!generating) setOpen(false); }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center flex-1 py-16 text-neutral-400 text-sm gap-2">
                <Loader size={16} className="animate-spin" /> Loading unbilled items…
              </div>
            ) : (
              <>
                {/* Draft warning */}
                {hasDraftWarning && (
                  <div className="mx-6 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 shrink-0">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>
                      Some items (shown with ⚠) are already included in an existing draft invoice.
                      They are deselected by default. Including them again will create duplicates.
                    </span>
                  </div>
                )}

                {/* Body: checklist */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

                  {/* Appearances */}
                  {appearances.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Gavel size={13} className="text-indigo-500" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          Appearances ({appearances.length})
                        </p>
                        <button
                          type="button"
                          className="ml-auto text-xs text-neutral-400 hover:text-neutral-700"
                          onClick={() => setAppearances(list => list.map(a => ({ ...a, selected: !a.inDraft })))}
                        >
                          Select unbilled
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {appearances.map(a => (
                          <label
                            key={a.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              a.selected ? "bg-emerald-50 hover:bg-emerald-100" : "hover:bg-neutral-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={a.selected}
                              onChange={e => setAppearances(list =>
                                list.map(x => x.id === a.id ? { ...x, selected: e.target.checked } : x)
                              )}
                              className="rounded accent-emerald-600"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-neutral-800">
                                {a.inDraft && <span className="text-amber-500 mr-1">⚠</span>}
                                {HEARING_TYPE_LABELS[a.hearing_type] ?? a.hearing_type}
                                {a.court ? ` — ${a.court}` : ""}
                              </span>
                              <span className="text-xs text-neutral-400 ml-2">{fmtDate(a.date)}</span>
                            </div>
                            <span className="text-sm font-medium tabular-nums text-neutral-700 shrink-0">
                              {inr(a.fee_amount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time entries */}
                  {timeEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={13} className="text-blue-500" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                          Time Entries ({timeEntries.length})
                        </p>
                        <button
                          type="button"
                          className="ml-auto text-xs text-neutral-400 hover:text-neutral-700"
                          onClick={() => setTimeEntries(list => list.map(t => ({ ...t, selected: !t.inDraft })))}
                        >
                          Select unbilled
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {timeEntries.map(t => {
                          const amount = (t.duration_minutes / 60) * t.rate_per_hour;
                          return (
                            <label
                              key={t.id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                t.selected ? "bg-emerald-50 hover:bg-emerald-100" : "hover:bg-neutral-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={t.selected}
                                onChange={e => setTimeEntries(list =>
                                  list.map(x => x.id === t.id ? { ...x, selected: e.target.checked } : x)
                                )}
                                className="rounded accent-emerald-600"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-neutral-800">
                                  {t.inDraft && <span className="text-amber-500 mr-1">⚠</span>}
                                  {t.description || "Time Entry"}
                                </span>
                                <span className="text-xs text-neutral-400 ml-2">
                                  {fmtDuration(t.duration_minutes)} · {fmtDate(t.date)}
                                </span>
                              </div>
                              <span className="text-sm font-medium tabular-nums text-neutral-700 shrink-0">
                                {inr(amount)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Invoice preview + actions */}
                <div className="border-t border-neutral-100 bg-neutral-50 shrink-0">
                  {/* Preview strip */}
                  <div className="px-6 py-3 grid grid-cols-2 gap-x-8 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Invoice No.</span>
                        <span className="font-mono font-medium text-neutral-800">{previewNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Date</span>
                        <span className="text-neutral-700">{fmtDate(new Date().toISOString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Due</span>
                        <span className="text-neutral-700">
                          {fmtDate(new Date(Date.now() + 30 * 86400000).toISOString())}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Items</span>
                        <span className={`font-medium ${totalSel === 0 ? "text-red-500" : "text-neutral-700"}`}>
                          {totalSel} selected
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Subtotal</span>
                        <span className="font-medium tabular-nums text-neutral-800">{inr(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>GST (will be computed)</span>
                        <span className="tabular-nums">—</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-neutral-200">
                        <span className="font-semibold text-neutral-700">Approx. Total</span>
                        <span className="font-bold tabular-nums text-neutral-900 flex items-center gap-0.5">
                          <IndianRupee size={11} strokeWidth={2.5} />
                          {(subtotal * 1.18).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-200 bg-white">
                    <p className="text-[11px] text-neutral-400">
                      Items are marked billed only when the invoice is sent.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        disabled={generating}
                        className="px-4 py-2 text-sm font-medium text-neutral-600 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={generating || totalSel === 0}
                        onClick={handleGenerate}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          totalSel > 0 && !generating
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                        }`}
                      >
                        {generating
                          ? <><Loader size={13} className="animate-spin" /> Generating…</>
                          : <><Check size={13} /> Generate Draft Invoice</>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
