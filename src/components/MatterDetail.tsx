import { useState, useEffect } from "react";
import { Pencil, Trash2, Clock, Gavel, FileText, ChevronRight } from "lucide-react";
import { fmtRef } from "../types";
import {
  fetchTimeEntries, fetchAppearances, fetchInvoices, deleteMatter,
  fetchContactPersonById,
} from "../db";
import type { Matter, TimeEntry, Appearance, Invoice, ContactPerson } from "../types";
import type { MatterTab } from "./MatterTabs";
import MatterParties from "./MatterParties";
import { format } from "date-fns";
import { formatINR as inr } from "../lib/currency";

interface Props {
  matter: Matter;
  onEdit: () => void;
  onDelete: () => void;
  onTabChange?: (tab: MatterTab) => void;
}

function fmt(iso: string) {
  try { return format(new Date(iso), "d MMM yyyy"); } catch { return iso; }
}

const statusBadge: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  closed: "bg-neutral-100 text-neutral-600",
  "on-hold": "bg-amber-100 text-amber-800",
};

export default function MatterDetail({ matter, onEdit, onDelete, onTabChange }: Props) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [primaryClientContact, setPrimaryClientContact] = useState<ContactPerson | null>(null);
  const [primaryFirmContact, setPrimaryFirmContact] = useState<ContactPerson | null>(null);

  useEffect(() => {
    fetchTimeEntries(matter.id).then(setTimeEntries);
    fetchAppearances(matter.id).then(setAppearances);
    fetchInvoices(matter.id).then(setInvoices);
    // Fetch primary contacts if IDs are set
    if (matter.primary_client_contact_id) {
      fetchContactPersonById(matter.primary_client_contact_id).then(setPrimaryClientContact);
    } else {
      setPrimaryClientContact(null);
    }
    if (matter.primary_firm_contact_id) {
      fetchContactPersonById(matter.primary_firm_contact_id).then(setPrimaryFirmContact);
    } else {
      setPrimaryFirmContact(null);
    }
  }, [matter.id, matter.primary_client_contact_id, matter.primary_firm_contact_id]);

  const totalTime = timeEntries.reduce((s, t) => s + t.duration_minutes, 0);
  const totalFees = appearances.reduce((s, a) => s + a.fee_amount, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);

  const handleDelete = async () => {
    await deleteMatter(matter.id);
    onDelete();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-4 pb-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 text-xs font-mono font-medium tracking-wide">
              {fmtRef(matter.ref_number)}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 leading-tight">{matter.case_title}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{matter.client_name}</p>
          {matter.court && <p className="text-xs text-neutral-400 mt-0.5">{matter.court}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge[matter.status]}`}>
            {matter.status}
          </span>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors" title="Edit">
            <Pencil size={15} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={handleDelete}
                className="px-2 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700">
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors" title="Delete">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 grid grid-cols-3 gap-3 mb-6">
        <StatCard
          icon={<Clock size={16} className="text-neutral-600" />}
          label="Time Logged"
          value={`${Math.floor(totalTime / 60)}h ${totalTime % 60}m`}
          sub={`${timeEntries.length} entries`}
          onClick={() => onTabChange?.("time")}
        />
        <StatCard
          icon={<Gavel size={16} className="text-purple-500" />}
          label="Appearances"
          value={appearances.length.toString()}
          sub={`${inr(totalFees)} fees`}
          onClick={() => onTabChange?.("appearances")}
        />
        <StatCard
          icon={<FileText size={16} className="text-emerald-500" />}
          label="Invoices"
          value={invoices.length.toString()}
          sub={`${inr(totalInvoiced)} billed`}
          onClick={() => onTabChange?.("invoices")}
        />
      </div>

      {/* Party representation */}
      <MatterParties matterId={matter.id} />

      {/* Divider */}
      <div className="mx-6 mt-5 border-t border-neutral-100" />

      {/* Info grid */}
      <div className="px-6 mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        {matter.matter_number && <Field label="Matter No." value={matter.matter_number} />}
        <Field label="Type" value={matter.matter_type} />
        <Field label="Opened" value={fmt(matter.created_at)} />
        {matter.client_email && <Field label="Client Email" value={matter.client_email} />}
        {matter.client_gstin && <Field label="Client GSTIN" value={matter.client_gstin} />}
        {matter.client_state && <Field label="Client State" value={matter.client_state} />}
        {matter.firm_name && <Field label="AOR / Firm" value={matter.firm_name} />}
        {matter.firm_gstin && <Field label="AOR / Firm GSTIN" value={matter.firm_gstin} />}
        {matter.firm_state && <Field label="AOR / Firm State" value={matter.firm_state} />}
        {matter.invoice_recipient && (
          <Field
            label="Invoice issued to"
            value={matter.invoice_recipient === "both" ? "AOR / Firm & Client" : matter.invoice_recipient === "firm" ? "AOR / Firm only" : "Client only"}
          />
        )}
      </div>

      {/* Handler / Advocate in charge */}
      {(matter.handler_name || matter.handler_designation || matter.handler_email || matter.handler_phone) && (
        <div className="px-6 mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Partner / Associate Handling
          </p>
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-wrap gap-x-8 gap-y-2">
            {matter.handler_name && (
              <div>
                <p className="text-xs text-neutral-400">Name</p>
                <p className="text-sm font-medium text-neutral-800">{matter.handler_name}</p>
              </div>
            )}
            {matter.handler_designation && (
              <div>
                <p className="text-xs text-neutral-400">Designation</p>
                <p className="text-sm text-neutral-800">{matter.handler_designation}</p>
              </div>
            )}
            {matter.handler_email && (
              <div>
                <p className="text-xs text-neutral-400">Email</p>
                <p className="text-sm text-neutral-800">{matter.handler_email}</p>
              </div>
            )}
            {matter.handler_phone && (
              <div>
                <p className="text-xs text-neutral-400">Phone</p>
                <p className="text-sm text-neutral-800">{matter.handler_phone}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Primary Contacts */}
      {(primaryClientContact || primaryFirmContact) && (
        <div className="px-6 mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Primary Contacts
          </p>
          <div className="space-y-2">
            {primaryClientContact && (
              <ContactCard label="Client Contact" contact={primaryClientContact} />
            )}
            {primaryFirmContact && (
              <ContactCard label="AOR / Firm Contact" contact={primaryFirmContact} />
            )}
          </div>
        </div>
      )}

      {matter.notes && (
        <div className="px-6 mt-4">
          <p className="text-xs text-neutral-400 mb-1">Notes</p>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{matter.notes}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, sub, onClick,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-left hover:bg-neutral-100 hover:border-neutral-300 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-neutral-500">{label}</span>
        <ChevronRight size={12} className="ml-auto text-neutral-300 group-hover:text-blue-400" />
      </div>
      <p className="text-lg font-semibold text-neutral-800">{value}</p>
      <p className="text-xs text-neutral-400">{sub}</p>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-sm text-neutral-800 font-medium">{value}</p>
    </div>
  );
}

function ContactCard({ label, contact }: { label: string; contact: ContactPerson }) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="text-xs text-neutral-400">Name</p>
          <p className="text-sm font-medium text-neutral-800">{contact.name}</p>
        </div>
        {contact.designation && (
          <div>
            <p className="text-xs text-neutral-400">Designation</p>
            <p className="text-sm text-neutral-800">{contact.designation}</p>
          </div>
        )}
        {contact.email && (
          <div>
            <p className="text-xs text-neutral-400">Email</p>
            <p className="text-sm text-neutral-800">{contact.email}</p>
          </div>
        )}
        {(contact.phone || contact.mobile) && (
          <div>
            <p className="text-xs text-neutral-400">Phone</p>
            <p className="text-sm text-neutral-800">{contact.phone || contact.mobile}</p>
          </div>
        )}
      </div>
    </div>
  );
}
