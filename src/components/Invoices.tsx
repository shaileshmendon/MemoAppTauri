import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Send, FileEdit, Download } from "lucide-react";
import { v4 as uuid } from "uuid";
import { format, addDays } from "date-fns";
import { pdf } from "@react-pdf/renderer";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  fetchInvoices, insertInvoice, updateInvoice, deleteInvoice,
  fetchPayments, insertPayment,
  fetchAllBillableAppearances, fetchAllBillableTimeEntries,
  markAppearancesBilled, markTimeEntriesBilled,
  fetchMatterParties, fetchContactPersons,
  loadProfile,
} from "../db";
import type {
  Matter, Invoice, Payment, InvoiceStatus, PaymentMode, RecipientType,
  LineItem, Appearance, TimeEntry, Profile, ContactPerson, InvoiceAddressMode,
} from "../types";
import InvoicePDF from "../pdf/InvoicePDF";
import { formatCurrency as inr } from "../lib/currency";
import { useToast } from "./Toast";

interface Props { matter: Matter; }

const today  = () => format(new Date(), "yyyy-MM-dd");

const statusBadge: Record<InvoiceStatus, string> = {
  draft:          "bg-neutral-100 text-neutral-600",
  sent:           "bg-neutral-200 text-neutral-900",
  paid:           "bg-green-100 text-green-700",
  partially_paid: "bg-amber-100 text-amber-700",
  overdue:        "bg-red-100 text-red-700",
  cancelled:      "bg-neutral-100 text-neutral-400",
};

function calcGST(subtotal: number, gstRate: number, firmState?: string, clientState?: string) {
  const tax = subtotal * (gstRate / 100);
  const sameState = firmState && clientState && firmState === clientState;
  return sameState
    ? { cgst: tax / 2, sgst: tax / 2, igst: 0 }
    : { cgst: 0, sgst: 0, igst: tax };
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Invoices({ matter }: Props) {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchInvoices(matter.id).then(setInvoices);
    loadProfile().then(setProfile);
  }, [matter.id]);

  const handleSave = async (inv: Invoice, billedAppIds: string[], billedTimeIds: string[]) => {
    try {
      await insertInvoice(inv);
      if (inv.status === "sent") {
        await markAppearancesBilled(billedAppIds);
        await markTimeEntriesBilled(billedTimeIds);
      }
      setInvoices(prev => [inv, ...prev]);
      setShowForm(false);
      toast.success("Invoice created");
    } catch {
      toast.error("Failed to create invoice");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice(id);
      setInvoices(prev => prev.filter(x => x.id !== id));
      if (expanded === id) setExpanded(null);
      toast.success("Invoice deleted");
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const handleStatusChange = async (inv: Invoice, status: InvoiceStatus) => {
    try {
      const updated = { ...inv, status };
      await updateInvoice(updated);
      setInvoices(prev => prev.map(x => x.id === inv.id ? updated : x));
      toast.success("Invoice marked as " + status);
      // If issuing a draft, mark items billed now
      if (status === "sent" && inv.status === "draft") {
        const lineItems: LineItem[] = inv.line_items_data ? JSON.parse(inv.line_items_data) : [];
        const appIds  = lineItems.filter(li => li.sourceId && li.type === "appearance").map(li => li.sourceId!);
        const timeIds = lineItems.filter(li => li.sourceId && li.type === "time").map(li => li.sourceId!);
        await markAppearancesBilled(appIds);
        await markTimeEntriesBilled(timeIds);
      }
    } catch {
      toast.error("Failed to update invoice");
    }
  };

  const totalBilled = invoices.reduce((s, i) => s + i.total_amount, 0);

  // Group by status
  const groups: { label: string; statuses: InvoiceStatus[]; color: string }[] = [
    { label: "Draft",     statuses: ["draft"],                          color: "text-neutral-500" },
    { label: "Unpaid",    statuses: ["sent", "overdue", "partially_paid"], color: "text-amber-600" },
    { label: "Paid",      statuses: ["paid"],                           color: "text-green-600" },
    { label: "Cancelled", statuses: ["cancelled"],                      color: "text-neutral-400" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-700 flex-1">Invoices</h2>
        <span className="text-xs text-neutral-400">
          {invoices.length} invoices · {inr(totalBilled)} total
        </span>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
            <Plus size={12} /> New Invoice
          </button>
        )}
      </div>

      {/* Invoice form */}
      {showForm && (
        <div className="flex-1 overflow-y-auto">
          <InvoiceForm
            matter={matter}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Invoice list — grouped by status */}
      {!showForm && (
        <div className="flex-1 overflow-y-auto">
          {invoices.length === 0 && (
            <p className="text-sm text-neutral-400 text-center mt-12">
              No invoices yet. Click "New Invoice" to create one.
            </p>
          )}
          {invoices.length > 0 && groups.map(({ label, statuses, color }) => {
            const group = invoices.filter(inv => statuses.includes(inv.status));
            if (group.length === 0) return null;
            const groupTotal = group.reduce((s, i) => s + i.total_amount, 0);
            return (
              <div key={label}>
                <div className="flex items-center gap-2 px-6 py-2 bg-neutral-50 border-b border-neutral-100">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
                  <span className="text-xs text-neutral-400 ml-auto">{group.length} · {inr(groupTotal)}</span>
                </div>
                {group.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    matter={matter}
                    profile={profile}
                    expanded={expanded === inv.id}
                    onToggle={() => setExpanded(expanded === inv.id ? null : inv.id)}
                    onStatusChange={s => handleStatusChange(inv, s)}
                    onDelete={() => handleDelete(inv.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Invoice row ────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, matter, profile, expanded, onToggle, onStatusChange, onDelete }: {
  invoice: Invoice; matter: Matter; profile: Profile | null; expanded: boolean;
  onToggle: () => void;
  onStatusChange: (s: InvoiceStatus) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPayForm, setShowPayForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const [parties, allClients, allFirms] = await Promise.all([
        fetchMatterParties(matter.id),
        (await import("../db")).fetchClients(),
        (await import("../db")).fetchFirms(),
      ]);
      // Resolve contact persons for this invoice's address_mode
      const matchClient = allClients.find(c => c.name === matter.client_name);
      const matchFirm   = allFirms.find(f => f.name === matter.firm_name);
      const [cContacts, fContacts] = await Promise.all([
        matchClient ? fetchContactPersons("client", matchClient.id) : Promise.resolve([]),
        matchFirm   ? fetchContactPersons("firm",   matchFirm.id)   : Promise.resolve([]),
      ]);
      const clientContact = invoice.client_contact_id ? cContacts.find(c => c.id === invoice.client_contact_id) : undefined;
      const firmContact   = invoice.firm_contact_id   ? fContacts.find(c => c.id === invoice.firm_contact_id)   : undefined;
      const blob = await pdf(
        <InvoicePDF invoice={invoice} matter={matter} profile={profile} parties={parties}
          clientContact={clientContact} firmContact={firmContact} />
      ).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const filePath = await save({
        defaultPath: `${invoice.invoice_number}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (filePath) {
        await writeFile(filePath, uint8);
        toast.success("PDF saved");
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("PDF generation failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (expanded) fetchPayments(invoice.id).then(setPayments);
  }, [expanded, invoice.id]);

  const totalPaid     = payments.reduce((s, p) => s + p.amount_paid, 0);
  const totalTds      = payments.reduce((s, p) => s + (p.tds_amount ?? 0), 0);
  const totalSettled  = totalPaid + totalTds;   // cash received + TDS withheld = effective settlement
  const lineItems: LineItem[] = invoice.line_items_data
    ? JSON.parse(invoice.line_items_data) : [];

  const handleAddPayment = async (p: Payment) => {
    try {
      await insertPayment(p);
      setPayments(prev => [...prev, p]);
      const settled = totalSettled + p.amount_paid + (p.tds_amount ?? 0);
      onStatusChange(settled >= invoice.total_amount ? "paid" : "partially_paid");
      setShowPayForm(false);
      toast.success("Payment recorded");
    } catch {
      toast.error("Failed to record payment");
    }
  };

  return (
    <div className="border-b border-neutral-100">
      {/* Row header */}
      <div className="px-6 py-3 flex items-center gap-3 hover:bg-neutral-50 cursor-default group"
        onClick={onToggle}>
        <span className="text-neutral-400">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-800">{invoice.invoice_number}</p>
          <p className="text-xs text-neutral-500">
            {format(new Date(invoice.invoice_date), "d MMM yyyy")}
            {invoice.due_date && ` · Due ${format(new Date(invoice.due_date), "d MMM yyyy")}`}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[invoice.status]}`}>
          {invoice.status.replace("_", " ")}
        </span>
        <p className="text-sm font-semibold text-neutral-800 w-28 text-right shrink-0">
          {inr(invoice.total_amount)}
        </p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {profile && (
            <button onClick={handleDownloadPDF} disabled={downloading}
              title="Download PDF"
              className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-800 disabled:opacity-40">
              <Download size={13} />
            </button>
          )}
          {confirmDel ? (
            <>
              <button onClick={() => onDelete()}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
              <button onClick={() => setConfirmDel(false)}
                className="px-2 py-1 text-xs border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-10 pb-5 bg-neutral-50 space-y-4">

          {/* Line items */}
          {lineItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Line Items</p>
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                {lineItems.map((li, i) => (
                  <div key={i} className={`flex justify-between px-4 py-2.5 text-sm ${i < lineItems.length - 1 ? "border-b border-neutral-100" : ""}`}>
                    <span className="text-neutral-700 flex-1">{li.description}</span>
                    <span className="font-medium text-neutral-800 ml-4">{inr(li.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GST breakdown */}
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span><span>{inr(invoice.subtotal_amount)}</span>
            </div>
            {invoice.cgst > 0 && <>
              <div className="flex justify-between text-neutral-500">
                <span>CGST ({invoice.gst_rate / 2}%)</span><span>{inr(invoice.cgst)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>SGST ({invoice.gst_rate / 2}%)</span><span>{inr(invoice.sgst)}</span>
              </div>
            </>}
            {invoice.igst > 0 && (
              <div className="flex justify-between text-neutral-500">
                <span>IGST ({invoice.gst_rate}%)</span><span>{inr(invoice.igst)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-neutral-100 pt-1.5 mt-1">
              <span className="text-neutral-800">Total</span>
              <span className="text-neutral-900">{inr(invoice.total_amount)}</span>
            </div>
          </div>

          {/* Payments */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex-1">Payments</p>
              <button onClick={() => setShowPayForm(true)}
                className="text-xs text-neutral-800 hover:underline">+ Record Payment</button>
            </div>
            {showPayForm && (
              <PaymentForm invoiceId={invoice.id} onSave={handleAddPayment} onCancel={() => setShowPayForm(false)} />
            )}
            {payments.length === 0 && !showPayForm && (
              <p className="text-xs text-neutral-400">No payments recorded yet.</p>
            )}
            {payments.map(p => {
              const hasTds = !!p.tds_amount && p.tds_amount > 0;
              return (
                <div key={p.id} className="py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-neutral-500 w-24 shrink-0">{format(new Date(p.payment_date), "d MMM yyyy")}</span>
                    <span className="text-neutral-600 w-16 shrink-0">{p.mode}</span>
                    {p.notes && <span className="text-neutral-400 flex-1 truncate text-xs">{p.notes}</span>}
                    <div className="ml-auto text-right">
                      <span className="font-medium text-green-700">{inr(p.amount_paid)}</span>
                      {hasTds && (
                        <span className="text-xs text-amber-600 ml-1">
                          + {inr(p.tds_amount!)} TDS
                        </span>
                      )}
                    </div>
                  </div>
                  {hasTds && (
                    <p className="text-xs text-amber-600 mt-0.5 pl-0">
                      TDS under §{p.tds_section ?? "—"} @ {p.tds_rate ?? 0}%
                      — settled {inr(p.amount_paid + (p.tds_amount ?? 0))} against invoice
                    </p>
                  )}
                </div>
              );
            })}
            {payments.length > 0 && (
              <div className="mt-1 pt-2 border-t border-neutral-200 space-y-1">
                {totalTds > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Cash received</span>
                      <span>{inr(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-amber-600">
                      <span>TDS deducted at source</span>
                      <span>+ {inr(totalTds)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-600 font-medium">
                      <span>Effective settlement</span>
                      <span>{inr(totalSettled)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-semibold pt-1">
                  <span className="text-neutral-600">Balance Due</span>
                  <span className={invoice.total_amount - totalSettled > 0.5 ? "text-red-600" : "text-green-600"}>
                    {inr(Math.max(0, invoice.total_amount - totalSettled))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Status actions */}
          <div className="flex items-center flex-wrap gap-2 pt-1">
            <span className="text-xs text-neutral-400 mr-1">Mark as:</span>
            {(["draft","sent","paid","overdue","cancelled"] as InvoiceStatus[]).map(s => (
              <button key={s} onClick={() => onStatusChange(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  invoice.status === s
                    ? statusBadge[s] + " border-transparent font-medium"
                    : "border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                }`}>
                {s === "sent" ? "Issue / Send" : s.replace("_", " ")}
              </button>
            ))}
          </div>

          {invoice.notes && (
            <p className="text-xs text-neutral-500 italic">{invoice.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Invoice creation form ──────────────────────────────────────────────────

interface BillableItem {
  id: string;
  type: "appearance" | "time";
  label: string;
  date: string;
  amount: number;
  selected: boolean;
  alreadyBilled: boolean; // previously invoiced
}

function InvoiceForm({ matter, onSave, onCancel }: {
  matter: Matter;
  onSave: (inv: Invoice, appIds: string[], timeIds: string[]) => void;
  onCancel: () => void;
}) {
  const [billable, setBillable]       = useState<BillableItem[]>([]);
  const [customItems, setCustom]      = useState<LineItem[]>([]);
  const [gstRate, setGstRate]         = useState(18);
  const [invoiceNum, setInvoiceNum]   = useState(`INV-${format(new Date(), "yyyyMM")}-001`);
  const [invoiceDate, setInvDate]     = useState(today());
  const [dueDate, setDueDate]         = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [notes, setNotes]             = useState("");
  const [loading, setLoading]         = useState(true);
  // Contact person addressing
  const [addressMode, setAddressMode] = useState<InvoiceAddressMode>("org_both");
  const [clientContacts, setClientContacts] = useState<ContactPerson[]>([]);
  const [firmContacts,   setFirmContacts]   = useState<ContactPerson[]>([]);
  const [clientContactId, setClientContactId] = useState(matter.primary_client_contact_id ?? "");
  const [firmContactId,   setFirmContactId]   = useState(matter.primary_firm_contact_id ?? "");

  useEffect(() => {
    (async () => {
      const [apps, times, prof] = await Promise.all([
        fetchAllBillableAppearances(matter.id),
        fetchAllBillableTimeEntries(matter.id),
        loadProfile(),
      ]);
      if (prof?.invoicePrefix) {
        setInvoiceNum(`${prof.invoicePrefix}-${format(new Date(), "yyyyMM")}-001`);
      }
      if (prof?.defaultGstRate !== undefined) {
        setGstRate(prof.defaultGstRate);
      }
      const items: BillableItem[] = [
        ...apps.map((a: Appearance) => ({
          id: a.id, type: "appearance" as const,
          label: `${formatHearingType(a.hearing_type)}${a.court ? ` — ${a.court}` : ""}`,
          date: a.date, amount: a.fee_amount,
          alreadyBilled: !!a.is_billed,
          selected: !a.is_billed, // pre-select unbilled only
        })),
        ...times.map((t: TimeEntry) => ({
          id: t.id, type: "time" as const,
          label: t.description || "Time — no description",
          date: t.date,
          amount: parseFloat(((t.duration_minutes / 60) * t.rate_per_hour).toFixed(2)),
          alreadyBilled: !!t.is_billed,
          selected: !t.is_billed,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      setBillable(items);

      // Load contact persons for client and firm (by matching name to saved records)
      const { fetchClients, fetchFirms } = await import("../db");
      const [allClients, allFirms] = await Promise.all([fetchClients(), fetchFirms()]);
      const matchClient = allClients.find(c => c.name === matter.client_name);
      const matchFirm   = allFirms.find(f => f.name === matter.firm_name);
      const [cContacts, fContacts] = await Promise.all([
        matchClient ? fetchContactPersons("client", matchClient.id) : Promise.resolve([]),
        matchFirm   ? fetchContactPersons("firm",   matchFirm.id)   : Promise.resolve([]),
      ]);
      setClientContacts(cContacts);
      setFirmContacts(fContacts);

      // Set initial address mode from matter's primary contacts
      const hasFirmContact   = !!matter.primary_firm_contact_id   && fContacts.some(c => c.id === matter.primary_firm_contact_id);
      const hasClientContact = !!matter.primary_client_contact_id && cContacts.some(c => c.id === matter.primary_client_contact_id);
      const invRec = matter.invoice_recipient ?? (matter.firm_name ? "both" : "client");
      if (hasFirmContact && hasClientContact && invRec === "both") setAddressMode("contact_both");
      else if (hasFirmContact   && invRec !== "client") setAddressMode("contact_firm");
      else if (hasClientContact && invRec !== "firm")   setAddressMode("contact_client");
      else {
        if (invRec === "both")   setAddressMode("org_both");
        else if (invRec === "firm")   setAddressMode("org_firm");
        else setAddressMode("org_client");
      }

      setLoading(false);
    })();
  }, [matter.id]);

  const toggleItem = (id: string) =>
    setBillable(prev => prev.map(x => x.id === id ? { ...x, selected: !x.selected } : x));

  const toggleAll = (checked: boolean) =>
    setBillable(prev => prev.map(x => x.alreadyBilled ? x : { ...x, selected: checked }));

  const selectedItems = billable.filter(x => x.selected);
  const subtotalBillable = selectedItems.reduce((s, x) => s + x.amount, 0);
  const subtotalCustom   = customItems.reduce((s, li) => s + li.amount, 0);
  const subtotal = subtotalBillable + subtotalCustom;
  const { cgst, sgst, igst } = calcGST(subtotal, gstRate, matter.firm_state, matter.client_state);
  const total = subtotal + cgst + sgst + igst;

  const buildAndSave = (status: InvoiceStatus) => {
    const lineItems: LineItem[] = [
      ...selectedItems.map(x => ({
        description: `${format(new Date(x.date), "d MMM yy")} — ${x.label}`,
        amount: x.amount,
        type: x.type,
        sourceId: x.id,
      })),
      ...customItems.filter(li => li.description).map(li => ({ ...li, sourceId: undefined })),
    ];
    // Derive legacy recipient_type from address mode (for backwards-compat)
    const legacyRecipient: RecipientType =
      addressMode === "org_firm" || addressMode === "contact_firm"     ? "firm"   :
      addressMode === "org_client" || addressMode === "contact_client" ? "client" : "both";

    const inv: Invoice = {
      id: uuid(), matter_id: matter.id,
      invoice_number: invoiceNum,
      invoice_date: invoiceDate, due_date: dueDate,
      recipient_type: legacyRecipient,
      address_mode: addressMode,
      client_contact_id: (addressMode === "contact_client" || addressMode === "contact_both") ? (clientContactId || undefined) : undefined,
      firm_contact_id:   (addressMode === "contact_firm"   || addressMode === "contact_both") ? (firmContactId   || undefined) : undefined,
      subtotal_amount: subtotal, gst_rate: gstRate,
      cgst, sgst, igst, total_amount: total,
      status, notes,
      line_items_data: JSON.stringify(lineItems),
    };
    const appIds  = selectedItems.filter(x => x.type === "appearance").map(x => x.id);
    const timeIds = selectedItems.filter(x => x.type === "time").map(x => x.id);
    onSave(inv, status === "sent" ? appIds : [], status === "sent" ? timeIds : []);
  };

  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-sm text-neutral-400">Loading unbilled items…</div>;
  }

  const unbilledItems = billable.filter(x => !x.alreadyBilled);
  const allSelected = unbilledItems.length > 0 && unbilledItems.every(x => x.selected);
  const anySelected = billable.some(x => x.selected);

  return (
    <div className="p-6 space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="text-xs text-neutral-500 mb-1">Invoice #</p>
          <input className={inp} value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">Invoice Date</p>
          <input type="date" className={inp} value={invoiceDate} onChange={e => setInvDate(e.target.value)} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">Due Date</p>
          <input type="date" className={inp} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-1">GST Rate</p>
          <select className={inp} value={gstRate} onChange={e => setGstRate(+e.target.value)}>
            <option value={0}>0% — Exempt</option>
            <option value={5}>5%</option>
            <option value={12}>12%</option>
            <option value={18}>18%</option>
          </select>
        </div>
      </div>

      {/* Invoice addressing — 6 options */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Invoice Addressed To</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {([
            { mode: "org_firm"       as InvoiceAddressMode, label: "A — AOR / Firm",            sub: "Organisation only",          disabled: !matter.firm_name },
            { mode: "org_client"     as InvoiceAddressMode, label: "B — Client",                 sub: "Organisation only",          disabled: false },
            { mode: "org_both"       as InvoiceAddressMode, label: "C — Both",                   sub: "Firm & Client organisations", disabled: !matter.firm_name },
            { mode: "contact_firm"   as InvoiceAddressMode, label: "D — Firm Contact",           sub: "Named person at AOR / Firm", disabled: firmContacts.length === 0 },
            { mode: "contact_client" as InvoiceAddressMode, label: "E — Client Contact",         sub: "Named person at Client",     disabled: clientContacts.length === 0 },
            { mode: "contact_both"   as InvoiceAddressMode, label: "F — Both Contacts",          sub: "Named persons at both",      disabled: firmContacts.length === 0 || clientContacts.length === 0 },
          ]).map(opt => (
            <button key={opt.mode} type="button"
              disabled={opt.disabled}
              onClick={() => setAddressMode(opt.mode)}
              className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                addressMode === opt.mode
                  ? "border-neutral-900 bg-neutral-100 text-neutral-900"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
              }`}>
              <p className="font-semibold">{opt.label}</p>
              <p className="text-neutral-400 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>

        {/* Contact person pickers for modes D/E/F */}
        {(addressMode === "contact_firm" || addressMode === "contact_both") && firmContacts.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-neutral-500 mb-1">AOR / Firm Contact Person</p>
            <select className={inp} value={firmContactId}
              onChange={e => setFirmContactId(e.target.value)}>
              <option value="">— Select —</option>
              {firmContacts.map(cp => (
                <option key={cp.id} value={cp.id}>{cp.name}{cp.designation ? ` · ${cp.designation}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        {(addressMode === "contact_client" || addressMode === "contact_both") && clientContacts.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-neutral-500 mb-1">Client Contact Person</p>
            <select className={inp} value={clientContactId}
              onChange={e => setClientContactId(e.target.value)}>
              <option value="">— Select —</option>
              {clientContacts.map(cp => (
                <option key={cp.id} value={cp.id}>{cp.name}{cp.designation ? ` · ${cp.designation}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        {(addressMode === "contact_firm" || addressMode === "contact_client" || addressMode === "contact_both") &&
          firmContacts.length === 0 && clientContacts.length === 0 && (
          <p className="text-xs text-amber-600">
            No contact persons on record. Add them via Clients / AOR & Firms → select entity → Contact Persons.
          </p>
        )}
      </div>

      {/* Unbilled work items */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex-1">
            Unbilled Work Items
          </p>
          {unbilledItems.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
              <input type="checkbox" checked={allSelected}
                onChange={e => toggleAll(e.target.checked)} />
              Select all unbilled
            </label>
          )}
        </div>

        {billable.length === 0 ? (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-6 text-center text-sm text-neutral-400">
            No appearances or time entries recorded for this matter yet.
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {billable.map((item, i) => (
              <label key={item.id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                  item.alreadyBilled ? "bg-neutral-50 opacity-70" : "hover:bg-neutral-100"
                } ${i < billable.length - 1 ? "border-b border-neutral-100" : ""}`}>
                <input type="checkbox" checked={item.selected}
                  onChange={() => toggleItem(item.id)}
                  className="shrink-0" />
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                  item.type === "appearance" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                }`}>
                  {item.type === "appearance" ? "Appearance" : "Time"}
                </span>
                <span className="text-xs text-neutral-400 w-20 shrink-0">
                  {format(new Date(item.date), "d MMM yy")}
                </span>
                <span className={`text-sm flex-1 truncate ${item.alreadyBilled ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                  {item.label}
                </span>
                {item.alreadyBilled && (
                  <span className="text-xs text-orange-500 font-medium shrink-0">Already billed</span>
                )}
                <span className="text-sm font-medium text-neutral-800 shrink-0">{inr(item.amount)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Custom line items */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Additional Line Items
        </p>
        <div className="space-y-2">
          {customItems.map((li, i) => (
            <div key={i} className="flex gap-2">
              <input className={inp + " flex-1"} placeholder="Description"
                value={li.description}
                onChange={e => setCustom(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <input type="number" min="0" className={inp + " w-28"} placeholder="₹ Amount"
                value={li.amount || ""}
                onChange={e => setCustom(prev => prev.map((x, j) => j === i ? { ...x, amount: +e.target.value } : x))} />
              <button onClick={() => setCustom(prev => prev.filter((_, j) => j !== i))}
                className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={() => setCustom(prev => [...prev, { description: "", amount: 0, type: "other" }])}
            className="text-xs text-neutral-800 hover:underline">
            + Add custom line item
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm space-y-1.5">
        <div className="flex justify-between text-neutral-500">
          <span>Subtotal ({selectedItems.length + customItems.filter(li => li.description).length} items)</span>
          <span>{inr(subtotal)}</span>
        </div>
        {cgst > 0 && <>
          <div className="flex justify-between text-neutral-500">
            <span>CGST ({gstRate / 2}%)</span><span>{inr(cgst)}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>SGST ({gstRate / 2}%)</span><span>{inr(sgst)}</span>
          </div>
        </>}
        {igst > 0 && (
          <div className="flex justify-between text-neutral-500">
            <span>IGST ({gstRate}%)</span><span>{inr(igst)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t border-neutral-200 pt-1.5">
          <span className="text-neutral-800">Total</span>
          <span className="text-lg text-neutral-900">{inr(total)}</span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="text-xs text-neutral-500 mb-1">Notes (optional)</p>
        <textarea rows={2} className={inp + " w-full resize-none"} value={notes}
          onChange={e => setNotes(e.target.value)} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => buildAndSave("draft")}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 text-neutral-700">
          <FileEdit size={15} />
          Save as Draft
        </button>
        <button
          onClick={() => buildAndSave("sent")}
          disabled={!anySelected && customItems.filter(li => li.description).length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50">
          <Send size={15} />
          Issue Invoice
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 ml-auto">
          Cancel
        </button>
      </div>
      <p className="text-xs text-neutral-400 -mt-2">
        <strong>Save as Draft</strong> — keeps items unbilled until you issue. &nbsp;
        <strong>Issue Invoice</strong> — marks selected items as billed immediately.
      </p>
    </div>
  );
}

// ── Payment form ───────────────────────────────────────────────────────────

function PaymentForm({ invoiceId, onSave, onCancel }: {
  invoiceId: string;
  onSave: (p: Payment) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ date: today(), amount: 0, mode: "NEFT" as PaymentMode, notes: "" });
  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-neutral-800 bg-white";

  return (
    <div className="flex flex-wrap gap-2 items-end mb-3 p-3 bg-white rounded-xl border border-neutral-300">
      <div>
        <p className="text-xs text-neutral-500 mb-1">Date</p>
        <input type="date" className={inp} value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
      </div>
      <div>
        <p className="text-xs text-neutral-500 mb-1">Amount (₹)</p>
        <input type="number" min="0" className={inp + " w-28"} value={form.amount || ""}
          onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} />
      </div>
      <div>
        <p className="text-xs text-neutral-500 mb-1">Mode</p>
        <select className={inp} value={form.mode}
          onChange={e => setForm(f => ({ ...f, mode: e.target.value as PaymentMode }))}>
          {(["NEFT","RTGS","IMPS","UPI","cheque","cash","other"] as PaymentMode[]).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-28">
        <p className="text-xs text-neutral-500 mb-1">Notes</p>
        <input className={inp + " w-full"} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <button
        onClick={() => onSave({ id: uuid(), invoice_id: invoiceId, payment_date: form.date, amount_paid: form.amount, mode: form.mode, notes: form.notes })}
        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
        Save
      </button>
      <button onClick={onCancel}
        className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50">
        Cancel
      </button>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatHearingType(t: string): string {
  const map: Record<string, string> = {
    mention: "Mention", urgent_mention: "Urgent Mention", hearing: "Hearing",
    adjournment: "Adjournment", circulation: "Circulation", arguments: "Arguments",
    evidence: "Evidence", judgement: "Judgment/Order", admission: "Admission",
    caveat: "Caveat", board: "Board/NCLT", conference: "Conference",
    drafting: "Drafting", research: "Research", advice: "Advice/Opinion",
    retainer: "Retainer", filing: "Filing", other: "Other",
  };
  return map[t] ?? t;
}
