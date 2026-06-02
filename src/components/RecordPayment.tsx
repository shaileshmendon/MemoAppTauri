/**
 * RecordPayment — two-column layout.
 *
 * LEFT  — list of all matters with unpaid invoices; click to select.
 *         Each matter also has an "Advance" button.
 * RIGHT — payment form for the selected invoice / advance, with TDS
 *         reconciliation and recent payment history below.
 */
import { useState, useEffect, useCallback } from "react";
import { format, differenceInDays } from "date-fns";
import { v4 as uuid } from "uuid";
import {
  CheckCircle2, Banknote, FileText, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Search, Receipt,
} from "lucide-react";
import {
  fetchAllUnpaidInvoices, type UnpaidInvoiceRow,
  fetchMatters,
  insertPayment, insertAdvancePayment,
  updateInvoice,
  fetchAllPaymentsLog, deleteAdvancePayment,
  type PaymentLogRow, type AdvancePayment,
} from "../db";
import type { Matter, Invoice, PaymentMode, TdsSection } from "../types";
import { TDS_SECTIONS } from "../types";
import { formatINR as inr, formatCurrency as inr2 } from "../lib/currency";
import { useToast } from "./Toast";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const PAYMENT_MODES: PaymentMode[] = [
  "NEFT", "RTGS", "IMPS", "UPI", "cheque", "cash", "other",
];

function expTds(subtotal: number, rate: number) {
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

// ── Selection type ─────────────────────────────────────────────────────────

type Selection =
  | { kind: "invoice"; invoice: UnpaidInvoiceRow }
  | { kind: "advance"; matter: Matter };

// ── Status colours ─────────────────────────────────────────────────────────

const statusBadge: Record<string, string> = {
  sent:           "bg-neutral-200 text-neutral-900",
  partially_paid: "bg-amber-100 text-amber-700",
  overdue:        "bg-red-100 text-red-700",
};

const statusLabel: Record<string, string> = {
  sent:           "Issued",
  partially_paid: "Part Paid",
  overdue:        "Overdue",
};

// ── Reconciliation banner ──────────────────────────────────────────────────

function ReconciliationBanner({
  invoice, amountPaid, tdsEnabled, tdsAmount, tdsRate,
}: {
  invoice: Invoice; amountPaid: number; tdsEnabled: boolean;
  tdsAmount: number; tdsRate: number;
}) {
  const settled = amountPaid + (tdsEnabled ? tdsAmount : 0);
  const diff    = invoice.total_amount - settled;
  const isOk    = Math.abs(diff) < 0.5;

  if (!tdsEnabled) {
    if (isOk) return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-100">
        <CheckCircle size={13} className="text-green-600 shrink-0" />
        <p className="text-xs text-green-700 font-medium">Full amount — invoice will be marked Paid</p>
      </div>
    );
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
        <AlertTriangle size={13} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700">
          Partial payment — <strong>{inr2(diff)}</strong> will remain outstanding
        </p>
      </div>
    );
  }

  const expTdsAmt   = expTds(invoice.subtotal_amount, tdsRate);
  const tdsVariance = Math.abs(tdsAmount - expTdsAmt);
  const tdsCorrect  = tdsVariance < 0.5;

  if (isOk && tdsCorrect) return (
    <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-2.5 space-y-0.5">
      <div className="flex items-center gap-2">
        <CheckCircle size={13} className="text-green-600 shrink-0" />
        <p className="text-xs text-green-700 font-semibold">Fully settled — invoice will be marked Paid</p>
      </div>
      <p className="text-xs text-green-600 pl-5">
        {inr2(amountPaid)} received + {inr2(tdsAmount)} TDS = {inr2(settled)} ✓
      </p>
    </div>
  );

  if (isOk && !tdsCorrect) return (
    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-0.5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 font-semibold">Payment balances, but TDS rate mismatch</p>
      </div>
      <p className="text-xs text-amber-600 pl-5">
        At {tdsRate}% on {inr2(invoice.subtotal_amount)} fees, expected TDS is{" "}
        <strong>{inr2(expTdsAmt)}</strong> — deducted {inr2(tdsAmount)} (variance {inr2(tdsVariance)}).
        Verify TDS certificate.
      </p>
    </div>
  );

  return (
    <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 space-y-0.5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} className="text-red-600 shrink-0" />
        <p className="text-xs text-red-700 font-semibold">Short payment — genuine outstanding remains</p>
      </div>
      <p className="text-xs text-red-600 pl-5">
        {inr2(amountPaid)} + {inr2(tdsAmount)} TDS = {inr2(settled)}, invoice total {inr2(invoice.total_amount)}.
        Outstanding: <strong>{inr2(diff)}</strong>
        {!tdsCorrect && ` (also: expected TDS ${inr2(expTdsAmt)}, deducted ${inr2(tdsAmount)})`}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function RecordPayment() {
  const toast = useToast();
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoiceRow[]>([]);
  const [matters, setMatters]               = useState<Matter[]>([]);
  const [selection, setSelection]           = useState<Selection | null>(null);
  const [search, setSearch]                 = useState("");
  const [loading, setLoading]               = useState(true);

  // Form state
  const [date, setDate]       = useState(todayStr());
  const [amount, setAmount]   = useState<number | "">("");
  const [mode, setMode]       = useState<PaymentMode>("NEFT");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // TDS state
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsSection, setTdsSection] = useState<TdsSection>("194J(b)");
  const [tdsRate, setTdsRate]       = useState(10);
  const [tdsAmount, setTdsAmount]   = useState<number | "">("");
  const [tdsManual, setTdsManual]   = useState(false);

  // Recent payments
  const [recentLog, setRecentLog]     = useState<PaymentLogRow[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [invs, ms, log] = await Promise.all([
      fetchAllUnpaidInvoices(),
      fetchMatters(),
      fetchAllPaymentsLog(),
    ]);
    setUnpaidInvoices(invs);
    setMatters(ms);
    setRecentLog(log);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Auto-calculate TDS when section/rate/invoice changes
  const selectedInvoice =
    selection?.kind === "invoice" ? selection.invoice : null;

  useEffect(() => {
    if (!tdsEnabled || tdsManual || !selectedInvoice) return;
    setTdsAmount(expTds(selectedInvoice.subtotal_amount, tdsRate));
  }, [tdsEnabled, tdsManual, tdsRate, selectedInvoice]);

  const handleSectionChange = (sec: TdsSection) => {
    setTdsSection(sec);
    if (sec !== "custom") {
      const found = TDS_SECTIONS.find(s => s.value === sec);
      if (found) setTdsRate(found.rate);
    }
    setTdsManual(false);
  };

  // When selection changes, reset the form
  const handleSelect = (s: Selection) => {
    setSelection(s);
    setAmount("");
    setNotes("");
    setDate(todayStr());
    setTdsEnabled(false);
    setTdsAmount("");
    setTdsManual(false);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selection) return;
    setSaving(true);
    try {
      if (selection.kind === "invoice") {
        const inv    = selection.invoice;
        const tdsAmt = tdsEnabled && tdsAmount !== "" ? +tdsAmount : 0;
        const settled = +amount + tdsAmt;
        await insertPayment({
          id: uuid(),
          invoice_id: inv.id,
          payment_date: date,
          amount_paid: +amount,
          mode,
          notes,
          ...(tdsEnabled && tdsAmt > 0 ? {
            tds_amount: tdsAmt,
            tds_rate: tdsRate,
            tds_section: tdsSection,
          } : {}),
        });
        const newStatus: Invoice["status"] =
          settled >= inv.total_amount ? "paid" : "partially_paid";
        await updateInvoice({ ...inv, status: newStatus });
      } else {
        const adv: AdvancePayment = {
          id: uuid(),
          matter_id: selection.matter.id,
          payment_date: date,
          amount: +amount,
          mode,
          notes,
          created_at: new Date().toISOString(),
        };
        await insertAdvancePayment(adv);
      }

      setAmount("");
      setNotes("");
      setDate(todayStr());
      setTdsEnabled(false);
      setTdsAmount("");
      setTdsManual(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (selection.kind === "invoice") {
        toast.success("Payment recorded");
      } else {
        toast.success("Advance recorded");
      }
      await reload();
      // If the invoice is now paid, clear selection
      if (selection.kind === "invoice") {
        const tdsAmt  = tdsEnabled && tdsAmount !== "" ? +tdsAmount : 0;
        const settled = amount !== "" ? +amount + tdsAmt : 0;
        if (settled >= selection.invoice.total_amount) setSelection(null);
      }
    } catch {
      toast.error("Failed to record payment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Group unpaid invoices by matter
  const matterIds = Array.from(new Set(unpaidInvoices.map(i => i.matter_id)));
  const grouped = matterIds.map(mid => ({
    matter: matters.find(m => m.id === mid) ?? null,
    invoices: unpaidInvoices.filter(i => i.matter_id === mid),
  })).filter(g => g.matter);

  // Filter by search
  const filtered = grouped.filter(g =>
    !search ||
    g.matter!.case_title.toLowerCase().includes(search.toLowerCase()) ||
    g.matter!.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (g.matter!.firm_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    g.invoices.some(i => i.invoice_number.toLowerCase().includes(search.toLowerCase()))
  );

  // Matters with no unpaid invoices (for advance-only)
  const advanceOnlyMatters = matters.filter(m =>
    !unpaidInvoices.some(i => i.matter_id === m.id) &&
    (!search ||
      m.case_title.toLowerCase().includes(search.toLowerCase()) ||
      m.client_name.toLowerCase().includes(search.toLowerCase()))
  );

  const inp = "border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white w-full";
  const tdsAmt = tdsEnabled && tdsAmount !== "" ? +tdsAmount : 0;
  const canSave = !!selection && amount !== "" && +amount >= 0;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── LEFT: matter / invoice list ── */}
      <div className="w-80 shrink-0 border-r border-neutral-100 flex flex-col bg-neutral-50 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100 bg-white shrink-0">
          <h1 className="text-sm font-semibold text-neutral-800">Select Invoice or Matter</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Choose what to record payment against</p>
          {/* Search */}
          <div className="relative mt-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="w-full border border-neutral-200 rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none focus:border-neutral-800 bg-white"
              placeholder="Search matters, clients, invoices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-neutral-400 text-center py-8">Loading…</p>
          ) : (
            <>
              {/* Matters with unpaid invoices */}
              {filtered.length > 0 && (
                <div className="pt-2 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-4 py-1.5">
                    Unpaid Invoices
                  </p>
                  {filtered.map(({ matter, invoices: invs }) => (
                    <MatterGroup
                      key={matter!.id}
                      matter={matter!}
                      invoices={invs}
                      selection={selection}
                      onSelectInvoice={inv => handleSelect({ kind: "invoice", invoice: inv })}
                      onSelectAdvance={() => handleSelect({ kind: "advance", matter: matter! })}
                    />
                  ))}
                </div>
              )}

              {/* Matters with no unpaid invoices — advance only */}
              {advanceOnlyMatters.length > 0 && (
                <div className="pt-2 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-4 py-1.5">
                    All Paid / Advance Only
                  </p>
                  {advanceOnlyMatters.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleSelect({ kind: "advance", matter: m })}
                      className={`w-full text-left px-4 py-2.5 border-b border-neutral-100 hover:bg-white transition-colors cursor-default ${
                        selection?.kind === "advance" && selection.matter.id === m.id
                          ? "bg-purple-50 border-l-2 border-l-purple-500"
                          : ""
                      }`}
                    >
                      <p className="text-sm font-medium text-neutral-700 truncate">{m.case_title}</p>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">
                        {m.client_name}
                        {m.firm_name ? ` · ${m.firm_name}` : ""}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-1">
                        <Banknote size={10} /> Record Advance
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {filtered.length === 0 && advanceOnlyMatters.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Receipt size={28} className="text-neutral-300 mb-2" />
                  <p className="text-sm text-neutral-400">
                    {search ? "No results match your search" : "No outstanding invoices"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT: payment form + recent history ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selection ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <Receipt size={40} className="text-neutral-200" />
            <p className="text-sm font-medium text-neutral-400">Select an invoice or matter on the left</p>
            <p className="text-xs text-neutral-300">
              Choose an unpaid invoice to record a payment against it, or select any matter to record an advance receipt.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Form area */}
            <div className="px-6 py-5 space-y-4 border-b border-neutral-100">

              {/* Context card — shows what's being paid */}
              <div className={`rounded-xl px-4 py-3 border ${
                selection.kind === "invoice"
                  ? "bg-neutral-100 border-neutral-200"
                  : "bg-purple-50 border-purple-100"
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {selection.kind === "invoice" ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={13} className="text-neutral-800 shrink-0" />
                          <span className="text-xs font-semibold text-neutral-900">
                            {selection.invoice.invoice_number}
                          </span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${statusBadge[selection.invoice.status] ?? ""}`}>
                            {statusLabel[selection.invoice.status] ?? selection.invoice.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-neutral-800 truncate">
                          {selection.invoice.case_title}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">
                          {selection.invoice.client_name}
                          {selection.invoice.firm_name ? ` · ${selection.invoice.firm_name}` : ""}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-neutral-900">
                            Total: <strong>{inr(selection.invoice.total_amount)}</strong>
                          </span>
                          <span className="text-xs text-neutral-600">
                            Fees: {inr(selection.invoice.subtotal_amount)} + GST: {inr(selection.invoice.total_amount - selection.invoice.subtotal_amount)}
                          </span>
                        </div>
                        {selection.invoice.due_date && (() => {
                          const days = differenceInDays(new Date(), new Date(selection.invoice.due_date));
                          return days > 0 ? (
                            <p className="text-xs text-red-500 mt-0.5">{days}d overdue (due {format(new Date(selection.invoice.due_date), "d MMM yyyy")})</p>
                          ) : null;
                        })()}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <Banknote size={13} className="text-purple-600 shrink-0" />
                          <span className="text-xs font-semibold text-purple-700">Advance / On Account</span>
                        </div>
                        <p className="text-sm font-semibold text-neutral-800 truncate">
                          {selection.matter.case_title}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 truncate">
                          {selection.matter.client_name}
                          {selection.matter.firm_name ? ` · ${selection.matter.firm_name}` : ""}
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setSelection(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-600 shrink-0 mt-0.5"
                  >
                    Change ✕
                  </button>
                </div>
              </div>

              {/* Date / Amount / Mode */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Date received</p>
                  <input type="date" className={inp} value={date}
                    onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">
                    Amount received (₹)
                  </p>
                  <div className="relative">
                    <input
                      type="number" min="0" placeholder="0" className={inp}
                      value={amount}
                      onChange={e => setAmount(e.target.value === "" ? "" : +e.target.value)}
                    />
                  </div>
                  {selection.kind === "invoice" && (
                    <button
                      type="button"
                      className="text-xs text-neutral-800 hover:underline mt-0.5"
                      onClick={() => {
                        const net = selection.invoice.total_amount - tdsAmt;
                        setAmount(net);
                      }}
                    >
                      Net payable: {inr(selection.invoice.total_amount - tdsAmt)}
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 mb-1">Mode</p>
                  <select className={inp} value={mode}
                    onChange={e => setMode(e.target.value as PaymentMode)}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* TDS panel — invoice payments only */}
              {selection.kind === "invoice" && (
                <div className="rounded-xl border border-neutral-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !tdsEnabled;
                      setTdsEnabled(next);
                      if (next && selectedInvoice) {
                        setTdsAmount(expTds(selectedInvoice.subtotal_amount, tdsRate));
                        setTdsManual(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${tdsEnabled ? "bg-neutral-900" : "bg-neutral-300"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${tdsEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-neutral-700">TDS Deducted by Payer</p>
                      <p className="text-xs text-neutral-400">Tax Deducted at Source — deducted on fees before GST</p>
                    </div>
                  </button>

                  {tdsEnabled && (
                    <div className="px-4 pb-4 pt-3 border-t border-neutral-100 bg-neutral-50 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <p className="text-xs font-medium text-neutral-500 mb-1">TDS Section</p>
                          <select className={inp} value={tdsSection}
                            onChange={e => handleSectionChange(e.target.value as TdsSection)}>
                            {TDS_SECTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-neutral-500 mb-1">Rate (%)</p>
                          <input type="number" min="0" max="100" step="0.5"
                            className={inp} value={tdsRate}
                            onChange={e => { setTdsRate(+e.target.value); setTdsManual(false); }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-neutral-500">TDS Amount (₹)</p>
                          <button type="button" className="text-xs text-neutral-800 hover:underline"
                            onClick={() => {
                              if (selectedInvoice) {
                                setTdsAmount(expTds(selectedInvoice.subtotal_amount, tdsRate));
                                setTdsManual(false);
                              }
                            }}>
                            Auto ({tdsRate}% of {inr(selectedInvoice!.subtotal_amount)})
                          </button>
                        </div>
                        <input type="number" min="0" placeholder="0" className={inp}
                          value={tdsAmount}
                          onChange={e => {
                            setTdsAmount(e.target.value === "" ? "" : +e.target.value);
                            setTdsManual(true);
                          }} />
                        <p className="text-xs text-neutral-400 mt-1">
                          Expected: <strong>{inr2(expTds(selectedInvoice!.subtotal_amount, tdsRate))}</strong>
                          {" "}· Net payable after TDS:{" "}
                          <strong>{inr2(selectedInvoice!.total_amount - (tdsAmount !== "" ? +tdsAmount : 0))}</strong>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reconciliation banner */}
              {selection.kind === "invoice" && selectedInvoice && amount !== "" && +amount > 0 && (
                <ReconciliationBanner
                  invoice={selectedInvoice}
                  amountPaid={+amount}
                  tdsEnabled={tdsEnabled}
                  tdsAmount={tdsAmt}
                  tdsRate={tdsRate}
                />
              )}

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-1">Notes / Reference</p>
                <input className={inp}
                  placeholder="Cheque no., UTR, TDS certificate no., transaction reference…"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-40 ${
                    selection.kind === "invoice"
                      ? "bg-neutral-900 hover:bg-neutral-800 text-white"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  }`}
                >
                  {saving ? "Saving…" : selection.kind === "invoice" ? "Record Payment" : "Record Advance"}
                </button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                    <CheckCircle2 size={15} /> Saved!
                  </span>
                )}
              </div>
            </div>

            {/* ── Recent payments ── */}
            <div>
              <button
                onClick={() => setShowHistory(h => !h)}
                className="w-full flex items-center gap-2 px-6 py-3 text-left hover:bg-neutral-50 transition-colors border-b border-neutral-100"
              >
                {showHistory
                  ? <ChevronDown size={13} className="text-neutral-400" />
                  : <ChevronRight size={13} className="text-neutral-400" />}
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Recent Payments
                </span>
                <span className="ml-auto text-xs text-neutral-400">{recentLog.length} total</span>
              </button>

              {showHistory && (
                recentLog.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-8">No payments recorded yet.</p>
                ) : (
                  recentLog.map(p => (
                    <RecentRow
                      key={p.id}
                      payment={p}
                      onDeleteAdvance={
                        p.type === "advance"
                          ? async () => { await deleteAdvancePayment(p.id); toast.success("Advance deleted"); reload(); }
                          : undefined
                      }
                    />
                  ))
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Left panel: matter group ───────────────────────────────────────────────

function MatterGroup({
  matter, invoices, selection, onSelectInvoice, onSelectAdvance,
}: {
  matter: Matter;
  invoices: UnpaidInvoiceRow[];
  selection: Selection | null;
  onSelectInvoice: (inv: UnpaidInvoiceRow) => void;
  onSelectAdvance: () => void;
}) {
  const today = new Date();

  return (
    <div className="border-b border-neutral-100">
      {/* Matter header */}
      <div className="px-4 pt-2.5 pb-1">
        <p className="text-xs font-semibold text-neutral-700 truncate">{matter.case_title}</p>
        <p className="text-xs text-neutral-400 truncate">
          {matter.client_name}{matter.firm_name ? ` · ${matter.firm_name}` : ""}
        </p>
      </div>

      {/* Invoice rows */}
      {invoices.map(inv => {
        const isSelected = selection?.kind === "invoice" && selection.invoice.id === inv.id;
        const daysOver = inv.due_date
          ? differenceInDays(today, new Date(inv.due_date))
          : -1;
        return (
          <button
            key={inv.id}
            onClick={() => onSelectInvoice(inv)}
            className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-white transition-colors cursor-default ${
              isSelected ? "bg-neutral-100 border-l-2 border-l-neutral-900" : "pl-4"
            }`}
          >
            <FileText size={13} className={isSelected ? "text-neutral-600" : "text-neutral-400"} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium truncate ${isSelected ? "text-neutral-900" : "text-neutral-700"}`}>
                  {inv.invoice_number}
                </span>
                <span className={`text-xs px-1.5 py-0 rounded-full font-medium shrink-0 ${statusBadge[inv.status] ?? ""}`}>
                  {statusLabel[inv.status] ?? inv.status}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-neutral-800">{inr(inv.total_amount)}</span>
                {daysOver > 0 && (
                  <span className="text-xs text-red-500">{daysOver}d overdue</span>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Advance button */}
      <button
        onClick={onSelectAdvance}
        className={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-white transition-colors cursor-default mb-1 ${
          selection?.kind === "advance" && selection.matter.id === matter.id
            ? "bg-purple-50 border-l-2 border-l-purple-500"
            : ""
        }`}
      >
        <Banknote size={13} className="text-purple-400" />
        <span className="text-xs text-purple-600 font-medium">+ Record Advance</span>
      </button>
    </div>
  );
}

// ── Recent payment row ─────────────────────────────────────────────────────

function RecentRow({
  payment, onDeleteAdvance,
}: {
  payment: PaymentLogRow;
  onDeleteAdvance?: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const hasTds = payment.type === "invoice" && !!payment.tds_amount && payment.tds_amount > 0;

  return (
    <div className="flex items-start gap-4 px-6 py-3 border-b border-neutral-100 hover:bg-neutral-50 group cursor-default">
      <div className="w-24 shrink-0 text-xs text-neutral-500 pt-0.5">
        {format(new Date(payment.payment_date), "d MMM yyyy")}
      </div>

      <div className="shrink-0 pt-0.5">
        {payment.type === "advance" ? (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium whitespace-nowrap">
            <Banknote size={10} /> Advance
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-900 font-medium whitespace-nowrap">
            <FileText size={10} /> Invoice
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 truncate">{payment.case_title}</p>
        <p className="text-xs text-neutral-400 truncate">
          {payment.client_name}
          {payment.invoice_number ? ` · ${payment.invoice_number}` : ""}
          {payment.notes ? ` — ${payment.notes}` : ""}
        </p>
        {hasTds && (
          <p className="text-xs text-amber-600 mt-0.5">
            TDS §{payment.tds_section} @ {payment.tds_rate}% — {inr(payment.tds_amount!)}
          </p>
        )}
      </div>

      <span className="text-xs text-neutral-500 shrink-0 pt-0.5">{payment.mode}</span>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-green-700">
          + {inr(payment.amount)}
        </p>
        {hasTds && (
          <p className="text-xs text-amber-600">+ {inr(payment.tds_amount!)} TDS</p>
        )}
      </div>

      {onDeleteAdvance && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
          {confirmDel ? (
            <>
              <button onClick={onDeleteAdvance}
                className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Delete
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="text-xs px-2 py-1 border border-neutral-200 text-neutral-600 rounded-lg">✕
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="text-xs text-neutral-300 hover:text-red-500 px-1 py-1 rounded hover:bg-red-50">
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
