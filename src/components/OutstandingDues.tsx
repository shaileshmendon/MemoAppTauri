import { useState, useEffect } from "react";
import { format, differenceInDays } from "date-fns";
import {
  AlertCircle, Clock, CheckCircle2, RefreshCw, Plus, Trash2,
  Banknote, FileText,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import {
  fetchAllUnpaidInvoices, type UnpaidInvoiceRow,
  fetchMatters, fetchInvoices,
  insertPayment, insertAdvancePayment, deleteAdvancePayment,
  updateInvoice,
  fetchAllPaymentsLog, type PaymentLogRow,
  type AdvancePayment,
} from "../db";
import type { Matter, Invoice, PaymentMode, TdsSection } from "../types";
import { TDS_SECTIONS } from "../types";
import { formatINR as inr } from "../lib/currency";

const today = () => format(new Date(), "yyyy-MM-dd");

const PAYMENT_MODES: PaymentMode[] = ["NEFT", "RTGS", "IMPS", "UPI", "cheque", "cash", "other"];

// ── Ageing buckets ─────────────────────────────────────────────────────────

interface AgeGroup {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  headerClass: string;
  filter: (daysOverdue: number) => boolean;
}

const ageGroups: AgeGroup[] = [
  {
    key: "critical",
    label: "Critical — Over 60 Days",
    description: "Invoices overdue by more than 60 days",
    icon: <AlertCircle size={15} className="text-red-600" />,
    headerClass: "bg-red-50 border-red-100 text-red-700",
    filter: (d) => d > 60,
  },
  {
    key: "serious",
    label: "Serious — 30 to 60 Days",
    description: "Invoices overdue by 30 – 60 days",
    icon: <AlertCircle size={15} className="text-orange-500" />,
    headerClass: "bg-orange-50 border-orange-100 text-orange-700",
    filter: (d) => d > 30 && d <= 60,
  },
  {
    key: "moderate",
    label: "Moderate — 15 to 30 Days",
    description: "Invoices overdue by 15 – 30 days",
    icon: <Clock size={15} className="text-amber-500" />,
    headerClass: "bg-amber-50 border-amber-100 text-amber-700",
    filter: (d) => d > 15 && d <= 30,
  },
  {
    key: "recent",
    label: "Recent — Up to 15 Days",
    description: "Invoices overdue by up to 15 days",
    icon: <Clock size={15} className="text-yellow-500" />,
    headerClass: "bg-yellow-50 border-yellow-100 text-yellow-700",
    filter: (d) => d >= 0 && d <= 15,
  },
  {
    key: "upcoming",
    label: "Not Yet Due",
    description: "Issued but not yet past due date",
    icon: <CheckCircle2 size={15} className="text-neutral-600" />,
    headerClass: "bg-neutral-50 border-neutral-100 text-neutral-600",
    filter: (d) => d < 0,
  },
];

const statusLabel: Record<string, string> = {
  sent: "Issued",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
};

// ── Main component ─────────────────────────────────────────────────────────

type Tab = "outstanding" | "payments";

export default function OutstandingDues() {
  const [tab, setTab] = useState<Tab>("outstanding");
  const [invoices, setInvoices] = useState<UnpaidInvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const [inv, pay] = await Promise.all([
      fetchAllUnpaidInvoices(),
      fetchAllPaymentsLog(),
    ]);
    setInvoices(inv);
    setPayments(pay);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const annotated = invoices.map((inv) => {
    const due = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    return { ...inv, daysOverdue: differenceInDays(todayDate, due) };
  });

  const totalOutstanding = annotated.reduce((s, i) => s + i.total_amount, 0);
  const overdueCount     = annotated.filter((i) => i.daysOverdue > 0).length;
  const totalReceived    = payments.reduce((s, p) => s + p.amount, 0);
  const totalTdsAll      = payments.reduce((s, p) => s + (p.tds_amount ?? 0), 0);

  const handlePaymentSaved = () => {
    setShowPayForm(false);
    load();
  };

  const handleDeleteAdvance = async (id: string) => {
    await deleteAdvancePayment(id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-neutral-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="px-6 pt-4 pb-0 border-b border-neutral-100 bg-white shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-base font-semibold text-neutral-800">Outstanding Dues & Payments</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Track unpaid invoices and record payments across all matters
            </p>
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 bg-neutral-50 rounded-xl px-4 py-2.5">
            <p className="text-xs text-neutral-400">Total Outstanding</p>
            <p className="text-lg font-bold text-neutral-800">{inr(totalOutstanding)}</p>
          </div>
          <div className="flex-1 bg-red-50 rounded-xl px-4 py-2.5">
            <p className="text-xs text-red-400">Overdue Invoices</p>
            <p className="text-lg font-bold text-red-700">{overdueCount}</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-xl px-4 py-2.5">
            <p className="text-xs text-green-500">Total Received</p>
            <p className="text-lg font-bold text-green-700">{inr(totalReceived)}</p>
            {totalTdsAll > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">+ {inr(totalTdsAll)} TDS</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {(["outstanding", "payments"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-default ${
                tab === t
                  ? "border-neutral-900 text-neutral-800"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t === "outstanding" ? "Outstanding Dues" : "Payments Log"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Outstanding */}
      {tab === "outstanding" && (
        <div className="flex-1 overflow-y-auto">
          {annotated.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <CheckCircle2 size={36} className="text-green-400" />
              <p className="text-sm font-medium text-neutral-600">All clear!</p>
              <p className="text-xs text-neutral-400">No outstanding dues at this time.</p>
            </div>
          ) : (
            ageGroups.map(({ key, label, description, icon, headerClass, filter }) => {
              const group = annotated.filter((i) => filter(i.daysOverdue));
              if (group.length === 0) return null;
              const groupTotal = group.reduce((s, i) => s + i.total_amount, 0);
              return (
                <div key={key}>
                  <div className={`flex items-center gap-2 px-6 py-2.5 border-b ${headerClass}`}>
                    {icon}
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-xs opacity-70 ml-1">— {description}</span>
                    <span className="ml-auto text-xs font-semibold">{group.length} invoice{group.length > 1 ? "s" : ""}</span>
                    <span className="text-xs font-bold ml-3">{inr(groupTotal)}</span>
                  </div>
                  {group.map((inv) => (
                    <OutstandingRow key={inv.id} inv={inv} onPayNow={() => setTab("payments")} />
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Payments Log */}
      {tab === "payments" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-100 shrink-0">
            <span className="text-sm text-neutral-500 flex-1">
              {payments.length} payments recorded
            </span>
            <button
              onClick={() => setShowPayForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
            >
              <Plus size={12} /> Record Payment
            </button>
          </div>

          {/* Payment form */}
          {showPayForm && (
            <div className="shrink-0 border-b border-neutral-200 bg-neutral-100">
              <PaymentForm onSaved={handlePaymentSaved} onCancel={() => setShowPayForm(false)} />
            </div>
          )}

          {/* Payments list */}
          <div className="flex-1 overflow-y-auto">
            {payments.length === 0 && !showPayForm && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <Banknote size={36} className="text-neutral-300" />
                <p className="text-sm text-neutral-400">No payments recorded yet.</p>
              </div>
            )}
            {payments.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                onDelete={p.type === "advance" ? () => handleDeleteAdvance(p.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outstanding row ────────────────────────────────────────────────────────

function OutstandingRow({
  inv, onPayNow,
}: {
  inv: UnpaidInvoiceRow & { daysOverdue: number };
  onPayNow: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-neutral-100 hover:bg-neutral-50 cursor-default">
      <div className="w-32 shrink-0">
        <p className="text-sm font-medium text-neutral-800">{inv.invoice_number}</p>
        <p className="text-xs text-neutral-400">{format(new Date(inv.invoice_date), "d MMM yyyy")}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-700 truncate">{inv.case_title}</p>
        <p className="text-xs text-neutral-400 truncate">
          {inv.client_name}{inv.firm_name ? ` · ${inv.firm_name}` : ""}
        </p>
      </div>
      <div className="w-28 text-right shrink-0">
        <p className="text-xs text-neutral-500">Due {format(new Date(inv.due_date), "d MMM yyyy")}</p>
        <p className={`text-xs font-medium mt-0.5 ${
          inv.daysOverdue > 60 ? "text-red-600" :
          inv.daysOverdue > 30 ? "text-orange-600" :
          inv.daysOverdue > 15 ? "text-amber-600" :
          inv.daysOverdue > 0  ? "text-yellow-600" : "text-neutral-600"
        }`}>
          {inv.daysOverdue > 0
            ? `${inv.daysOverdue}d overdue`
            : inv.daysOverdue === 0 ? "Due today"
            : `${Math.abs(inv.daysOverdue)}d remaining`}
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
        inv.status === "overdue"        ? "bg-red-100 text-red-700" :
        inv.status === "partially_paid" ? "bg-amber-100 text-amber-700" :
        "bg-neutral-200 text-neutral-900"
      }`}>
        {statusLabel[inv.status] ?? inv.status}
      </span>
      <p className="text-sm font-semibold text-neutral-800 w-24 text-right shrink-0">
        {inr(inv.total_amount)}
      </p>
      <button
        onClick={onPayNow}
        className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700"
      >
        Pay
      </button>
    </div>
  );
}

// ── Payment row ────────────────────────────────────────────────────────────

function PaymentRow({
  payment, onDelete,
}: {
  payment: PaymentLogRow;
  onDelete?: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const hasTds = payment.type === "invoice" && !!payment.tds_amount && payment.tds_amount > 0;

  return (
    <div className="flex items-start gap-4 px-6 py-3 border-b border-neutral-100 hover:bg-neutral-50 group cursor-default">
      {/* Date */}
      <div className="w-24 shrink-0 pt-0.5">
        <p className="text-xs text-neutral-500">{format(new Date(payment.payment_date), "d MMM yyyy")}</p>
      </div>

      {/* Type badge */}
      <div className="shrink-0 pt-0.5">
        {payment.type === "advance" ? (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            <Banknote size={10} /> Advance
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-900 font-medium">
            <FileText size={10} /> Invoice
          </span>
        )}
      </div>

      {/* Matter + invoice + TDS note */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-neutral-700 font-medium truncate">{payment.case_title}</p>
        <p className="text-xs text-neutral-400 truncate">
          {payment.client_name}
          {payment.invoice_number ? ` · ${payment.invoice_number}` : ""}
          {payment.notes ? ` — ${payment.notes}` : ""}
        </p>
        {hasTds && (
          <p className="text-xs text-amber-600 mt-0.5">
            TDS §{payment.tds_section} @ {payment.tds_rate}% — deducted {inr(payment.tds_amount!)}
          </p>
        )}
      </div>

      {/* Mode */}
      <span className="text-xs text-neutral-500 w-14 text-right shrink-0 pt-0.5">{payment.mode}</span>

      {/* Amount */}
      <div className="text-right shrink-0 w-32">
        <p className="text-sm font-semibold text-green-700">+ {inr(payment.amount)}</p>
        {hasTds && (
          <p className="text-xs text-amber-600">+ {inr(payment.tds_amount!)} TDS</p>
        )}
      </div>

      {/* Delete (advance only) */}
      {onDelete && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
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
            <button onClick={() => setConfirmDel(true)}
              className="p-1.5 rounded hover:bg-red-50 text-neutral-300 hover:text-red-500">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Payment form ───────────────────────────────────────────────────────────

type PayType = "invoice" | "advance";

function expTds(subtotal: number, rate: number) {
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

function PaymentForm({
  onSaved, onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [payType, setPayType]       = useState<PayType>("invoice");
  const [matters, setMatters]       = useState<Matter[]>([]);
  const [matterId, setMatterId]     = useState("");
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId]   = useState("");
  const [date, setDate]             = useState(today());
  const [amount, setAmount]         = useState<number | "">("");
  const [mode, setMode]             = useState<PaymentMode>("NEFT");
  const [notes, setNotes]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [loadingInv, setLoadingInv] = useState(false);

  // TDS state
  const [tdsEnabled, setTdsEnabled] = useState(false);
  const [tdsSection, setTdsSection] = useState<TdsSection>("194J(b)");
  const [tdsRate, setTdsRate]       = useState(10);
  const [tdsAmount, setTdsAmount]   = useState<number | "">("");
  const [tdsManual, setTdsManual]   = useState(false);

  // Load matters on mount
  useEffect(() => {
    fetchMatters().then((ms) => {
      setMatters(ms);
      if (ms.length > 0) setMatterId(ms[0].id);
    });
  }, []);

  // Load invoices when matter changes
  useEffect(() => {
    if (!matterId || payType !== "invoice") return;
    setLoadingInv(true);
    fetchInvoices(matterId).then((invs) => {
      const unpaid = invs.filter((i) =>
        ["sent", "partially_paid", "overdue"].includes(i.status)
      );
      setInvoices(unpaid);
      setInvoiceId(unpaid.length > 0 ? unpaid[0].id : "");
      setLoadingInv(false);
    });
  }, [matterId, payType]);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  // Auto-calculate TDS
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

  const handleSave = async () => {
    if (!matterId || amount === "" || +amount < 0) return;
    setSaving(true);
    try {
      if (payType === "invoice" && invoiceId && selectedInvoice) {
        const tdsAmt  = tdsEnabled && tdsAmount !== "" ? +tdsAmount : 0;
        const settled = +amount + tdsAmt;
        await insertPayment({
          id: uuid(),
          invoice_id: invoiceId,
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
        const newStatus = settled >= selectedInvoice.total_amount ? "paid" : "partially_paid";
        await updateInvoice({ ...selectedInvoice, status: newStatus as Invoice["status"] });
      } else {
        const adv: AdvancePayment = {
          id: uuid(),
          matter_id: matterId,
          payment_date: date,
          amount: +amount,
          mode,
          notes,
          created_at: new Date().toISOString(),
        };
        await insertAdvancePayment(adv);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";

  const tdsAmt = tdsEnabled && tdsAmount !== "" ? +tdsAmount : 0;
  const settled = amount !== "" ? +amount + tdsAmt : 0;
  const showRecon = payType === "invoice" && selectedInvoice && amount !== "" && +amount > 0;

  return (
    <div className="p-5 space-y-4">
      <p className="text-sm font-semibold text-neutral-700">Record Payment</p>

      {/* Payment type toggle */}
      <div className="flex gap-2">
        {(["invoice", "advance"] as PayType[]).map((t) => (
          <button key={t} onClick={() => setPayType(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              payType === t
                ? t === "invoice" ? "bg-neutral-900 text-white border-neutral-900"
                                  : "bg-purple-600 text-white border-purple-600"
                : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
            }`}>
            {t === "invoice" ? <FileText size={13} /> : <Banknote size={13} />}
            {t === "invoice" ? "Against Invoice" : "Advance Payment"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        {/* Matter */}
        <div className="min-w-52">
          <p className="text-xs text-neutral-500 mb-1">Matter</p>
          <select className={inp + " w-full"} value={matterId}
            onChange={(e) => setMatterId(e.target.value)}>
            {matters.map((m) => (
              <option key={m.id} value={m.id}>{m.case_title}</option>
            ))}
          </select>
        </div>

        {/* Invoice */}
        {payType === "invoice" && (
          <div className="min-w-52">
            <p className="text-xs text-neutral-500 mb-1">Invoice</p>
            {loadingInv ? (
              <p className="text-xs text-neutral-400 py-1.5">Loading…</p>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-amber-600 py-1.5">No unpaid invoices</p>
            ) : (
              <select className={inp + " w-full"} value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {inr(inv.total_amount)} ({inv.status})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Date */}
        <div>
          <p className="text-xs text-neutral-500 mb-1">Date</p>
          <input type="date" className={inp} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>

        {/* Amount */}
        <div>
          <p className="text-xs text-neutral-500 mb-1">
            Amount received (₹)
            {selectedInvoice && payType === "invoice" && (
              <span className="ml-1 text-neutral-600">
                · Total {inr(selectedInvoice.total_amount)}
              </span>
            )}
          </p>
          <input type="number" min="0" className={inp + " w-36"} placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : +e.target.value)} />
        </div>

        {/* Mode */}
        <div>
          <p className="text-xs text-neutral-500 mb-1">Mode</p>
          <select className={inp} value={mode}
            onChange={(e) => setMode(e.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* TDS toggle (invoice mode only) */}
      {payType === "invoice" && selectedInvoice && (
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          <button type="button"
            onClick={() => {
              setTdsEnabled(e => !e);
              if (!tdsEnabled && selectedInvoice) {
                setTdsAmount(expTds(selectedInvoice.subtotal_amount, tdsRate));
                setTdsManual(false);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 transition-colors">
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${tdsEnabled ? "bg-neutral-900" : "bg-neutral-300"}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${tdsEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-neutral-700">TDS Deducted by Payer</span>
          </button>

          {tdsEnabled && (
            <div className="px-4 pb-4 pt-3 border-t border-neutral-100 bg-neutral-50 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-neutral-500 mb-1">TDS Section</p>
                  <select className={inp + " w-full"} value={tdsSection}
                    onChange={e => handleSectionChange(e.target.value as TdsSection)}>
                    {TDS_SECTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <p className="text-xs text-neutral-500 mb-1">Rate (%)</p>
                  <input type="number" min="0" max="100" step="0.5" className={inp + " w-full"}
                    value={tdsRate}
                    onChange={e => { setTdsRate(+e.target.value); setTdsManual(false); }} />
                </div>
                <div className="w-32">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-neutral-500">TDS Amount (₹)</p>
                  </div>
                  <input type="number" min="0" className={inp + " w-full"} placeholder="0"
                    value={tdsAmount}
                    onChange={e => {
                      setTdsAmount(e.target.value === "" ? "" : +e.target.value);
                      setTdsManual(true);
                    }} />
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                Expected TDS at {tdsRate}% on fees of {inr(selectedInvoice.subtotal_amount)} (ex-GST):{" "}
                <strong>{inr(expTds(selectedInvoice.subtotal_amount, tdsRate))}</strong>
                {" "}· Net payable: <strong>{inr(selectedInvoice.total_amount - expTds(selectedInvoice.subtotal_amount, tdsRate))}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation */}
      {showRecon && (() => {
        const diff = selectedInvoice!.total_amount - settled;
        const isOk = Math.abs(diff) < 0.5;
        if (isOk) return (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
            <CheckCircle2 size={13} className="text-green-600 shrink-0" />
            <p className="text-xs text-green-700 font-medium">
              Fully settled — invoice will be marked Paid
              {tdsEnabled && tdsAmt > 0 && ` (${inr(+amount)} received + ${inr(tdsAmt)} TDS)`}
            </p>
          </div>
        );
        return (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
            <AlertCircle size={13} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">
              {tdsEnabled
                ? `${inr(+amount)} + ${inr(tdsAmt)} TDS = ${inr(settled)} · Outstanding: ${inr(diff)}`
                : `Partial payment · Outstanding: ${inr(diff)}`}
            </p>
          </div>
        );
      })()}

      {/* Notes */}
      <div>
        <p className="text-xs text-neutral-500 mb-1">Notes (optional)</p>
        <input className={inp + " w-full"} placeholder="Cheque no., transaction ref, etc."
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave}
          disabled={saving || !matterId || amount === "" || +amount < 0 || (payType === "invoice" && !invoiceId)}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
          {saving ? "Saving…" : "Save Payment"}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
