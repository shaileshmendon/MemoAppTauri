import { useState, useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";
import {
  insertMatter, updateMatter,
  fetchClients, fetchFirms,
  insertClient, insertFirm,
  fetchContactPersons,
} from "../db";
import type { Matter, MatterType, MatterStatus, RecipientType, Client, Firm, ContactPerson } from "../types";
import { Search, Plus, Check, Database, X, ChevronDown } from "lucide-react";

interface Props {
  initial?: Matter;
  onSave: (m: Matter) => void;
  onCancel: () => void;
}

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh","Other",
];

const blank: Omit<Matter, "id" | "created_at"> = {
  case_title: "", client_name: "", client_email: "", client_gstin: "",
  client_state: "", court: "", matter_number: "", matter_type: "litigation",
  status: "active", firm_name: "", firm_email: "", firm_gstin: "", firm_state: "",
  handler_name: "", handler_designation: "", handler_email: "", handler_phone: "",
  notes: "", invoice_recipient: "both",
};

// ── Inline searchable entity picker ──────────────────────────────────────────
// Shows existing records as you type, lets user pick one, create a new
// saved record, or just type freely (without saving to the DB).

interface EntityRow { id: string; name: string; email?: string; state?: string; }

function EntityPicker({
  label,
  placeholder,
  records,
  selectedId,
  onSelect,        // user picked an existing record
  onClear,
  savedBadge,      // text to show when linked to a DB record
}: {
  label: string;
  placeholder: string;
  records: EntityRow[];
  selectedId: string;
  onSelect: (r: EntityRow) => void;
  onClear: () => void;
  savedBadge: string;
}) {
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);

  const selected = records.find(r => r.id === selectedId);

  const filtered = query.trim()
    ? records.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
    : records;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
        <Check size={13} className="text-green-600 shrink-0" />
        <span className="text-sm font-medium text-green-800 flex-1 truncate">{selected.name}</span>
        <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded font-medium shrink-0">
          {savedBadge}
        </span>
        <button type="button" onClick={onClear}
          className="text-green-500 hover:text-green-700 shrink-0">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 border border-neutral-200 rounded-lg px-3 py-2 bg-white focus-within:border-neutral-800 focus-within:ring-1 focus-within:ring-blue-100">
        <Search size={13} className="text-neutral-400 shrink-0" />
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          className="flex-1 text-sm outline-none bg-transparent text-neutral-800 placeholder-neutral-400"
        />
        {records.length > 0 && (
          <button type="button" onClick={() => setOpen(o => !o)} className="text-neutral-400">
            <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-xs text-neutral-400 text-center">
              {query ? `No ${label.toLowerCase()} matching "${query}"` : `No saved ${label.toLowerCase()} yet`}
            </div>
          )}
          {filtered.map(r => (
            <button key={r.id} type="button"
              onClick={() => { onSelect(r); setQuery(""); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-neutral-100 transition-colors border-b border-neutral-100 last:border-0">
              <p className="text-sm font-medium text-neutral-800 truncate">{r.name}</p>
              {(r.email || r.state) && (
                <p className="text-xs text-neutral-400 truncate">
                  {[r.email, r.state].filter(Boolean).join(" · ")}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Save-to-DB banner ─────────────────────────────────────────────────────────
// Appears when the user has entered name details that aren't yet in the DB.

function SaveToDB({
  label,
  name,
  onSave,
  saved,
}: {
  label: string;
  name: string;
  onSave: () => Promise<void>;
  saved: boolean;
}) {
  const [saving, setSaving] = useState(false);
  if (!name.trim() || saved) return null;
  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-neutral-100 border border-neutral-300 rounded-lg">
      <Database size={12} className="text-neutral-600 shrink-0" />
      <p className="text-xs text-neutral-900 flex-1">
        Save <strong>"{name}"</strong> as a reusable {label}?
      </p>
      <button type="button"
        disabled={saving}
        onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}
        className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 text-white text-xs rounded-lg hover:bg-neutral-800 disabled:opacity-50 shrink-0">
        <Plus size={10} /> {saving ? "Saving…" : `Save ${label}`}
      </button>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function MatterForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Omit<Matter, "id" | "created_at">>(
    initial ? { ...initial } : { ...blank }
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // DB records
  const [clients, setClients] = useState<Client[]>([]);
  const [firms,   setFirms]   = useState<Firm[]>([]);

  // Which saved record is linked (if any)
  const [linkedClientId, setLinkedClientId] = useState("");
  const [linkedFirmId,   setLinkedFirmId]   = useState("");

  // Whether the current name has already been saved to DB
  const [clientSaved, setClientSaved] = useState(false);
  const [firmSaved,   setFirmSaved]   = useState(false);

  // Contact persons for linked records
  const [clientContacts, setClientContacts] = useState<ContactPerson[]>([]);
  const [firmContacts,   setFirmContacts]   = useState<ContactPerson[]>([]);

  const reloadClients = async () => {
    const list = await fetchClients();
    setClients(list);
    return list;
  };
  const reloadFirms = async () => {
    const list = await fetchFirms();
    setFirms(list);
    return list;
  };

  useEffect(() => {
    reloadClients();
    reloadFirms();
  }, []);

  // When editing, try to match existing saved records by name
  useEffect(() => {
    if (!initial) return;
    (async () => {
      const [allC, allF] = await Promise.all([fetchClients(), fetchFirms()]);
      setClients(allC);
      setFirms(allF);
      const mc = allC.find(c => c.name === initial.client_name);
      const mf = allF.find(f => f.name === initial.firm_name);
      if (mc) { setLinkedClientId(mc.id); setClientSaved(true); fetchContactPersons("client", mc.id).then(setClientContacts); }
      if (mf) { setLinkedFirmId(mf.id);   setFirmSaved(true);   fetchContactPersons("firm",   mf.id).then(setFirmContacts); }
    })();
  }, [initial]);

  // Auto-detect if the typed name now matches a saved record
  useEffect(() => {
    if (linkedClientId) return; // already linked
    const match = clients.find(c => c.name.toLowerCase() === form.client_name?.toLowerCase());
    setClientSaved(!!match);
  }, [form.client_name, clients, linkedClientId]);

  useEffect(() => {
    if (linkedFirmId) return;
    const match = firms.find(f => f.name.toLowerCase() === form.firm_name?.toLowerCase());
    setFirmSaved(!!match);
  }, [form.firm_name, firms, linkedFirmId]);

  const set = (k: keyof typeof form, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  // ── Pick existing client ──────────────────────────────────────────────────
  const pickClient = (r: EntityRow) => {
    const c = clients.find(x => x.id === r.id);
    if (!c) return;
    setLinkedClientId(c.id);
    setClientSaved(true);
    setForm(f => ({
      ...f,
      client_name: c.name, client_email: c.email ?? "",
      client_gstin: c.gstin ?? "", client_state: c.state ?? "",
      primary_client_contact_id: undefined,
    }));
    fetchContactPersons("client", c.id).then(setClientContacts);
  };

  const clearClient = () => {
    setLinkedClientId(""); setClientSaved(false); setClientContacts([]);
    setForm(f => ({ ...f, client_name: "", client_email: "", client_gstin: "", client_state: "", primary_client_contact_id: undefined }));
  };

  // ── Save new client to DB ─────────────────────────────────────────────────
  const saveNewClient = async () => {
    const now = new Date().toISOString();
    const newClient: Client = {
      id: uuid(), name: form.client_name!,
      email: form.client_email || undefined,
      gstin: form.client_gstin || undefined,
      state: form.client_state || undefined,
      created_at: now,
    };
    await insertClient(newClient);
    const list = await reloadClients();
    const saved = list.find(c => c.id === newClient.id);
    if (saved) { setLinkedClientId(saved.id); setClientSaved(true); }
  };

  // ── Pick existing firm ────────────────────────────────────────────────────
  const pickFirm = (r: EntityRow) => {
    const f = firms.find(x => x.id === r.id);
    if (!f) return;
    setLinkedFirmId(f.id);
    setFirmSaved(true);
    setForm(prev => ({
      ...prev,
      firm_name: f.name, firm_email: f.email ?? "",
      firm_gstin: f.gstin ?? "", firm_state: f.state ?? "",
      primary_firm_contact_id: undefined,
    }));
    fetchContactPersons("firm", f.id).then(setFirmContacts);
  };

  const clearFirm = () => {
    setLinkedFirmId(""); setFirmSaved(false); setFirmContacts([]);
    setForm(f => ({ ...f, firm_name: "", firm_email: "", firm_gstin: "", firm_state: "", primary_firm_contact_id: undefined }));
  };

  // ── Save new firm to DB ───────────────────────────────────────────────────
  const saveNewFirm = async () => {
    const now = new Date().toISOString();
    const newFirm: Firm = {
      id: uuid(), name: form.firm_name!,
      email: form.firm_email || undefined,
      gstin: form.firm_gstin || undefined,
      state: form.firm_state || undefined,
      created_at: now,
    };
    await insertFirm(newFirm);
    const list = await reloadFirms();
    const saved = list.find(f => f.id === newFirm.id);
    if (saved) { setLinkedFirmId(saved.id); setFirmSaved(true); }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const matter: Matter = initial
        ? { ...initial, ...form }
        : { ...form, id: uuid(), created_at: new Date().toISOString() };
      if (initial) { await updateMatter(matter); onSave(matter); }
      else         { const saved = await insertMatter(matter); onSave(saved); }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const lbl  = "block text-xs font-medium text-neutral-600 mb-1";
  const inp  = "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white";
  const sel  = inp + " cursor-default";
  const sec  = "text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3";

  const canSave = !!form.case_title.trim() && !!form.client_name?.trim();
  const touched = form.case_title !== "" || form.client_name !== "" || !!form.firm_name;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* ── Sticky header with Case Title always visible ─────────────── */}
      <div className="shrink-0 border-b border-neutral-200 bg-white">
        <div className="flex items-start gap-4 px-6 py-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              Case Title *
            </label>
            <input
              className="w-full text-lg font-semibold text-neutral-900 outline-none placeholder-neutral-300 border-0 border-b-2 border-transparent focus:border-neutral-900 bg-transparent pb-0.5 transition-colors"
              placeholder="e.g. Siemens vs. Maharashtra — Writ Petition"
              required
              value={form.case_title}
              onChange={e => set("case_title", e.target.value)}
            />
          </div>
          <div className="flex gap-2 shrink-0 pt-5">
            <button type="button" onClick={onCancel}
              className="px-4 py-1.5 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600">
              Cancel
            </button>
            <button type="submit" disabled={saving || !canSave}
              className="px-4 py-1.5 text-sm rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? "Saving…" : "Save Matter"}
            </button>
          </div>
        </div>
        {/* Validation hint — shows when fields are touched but incomplete */}
        {touched && !canSave && (
          <div className="px-6 pb-3 flex items-center gap-2 text-xs text-amber-700">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {!form.case_title.trim() && !form.client_name?.trim()
              ? "Case title and client name are required to save."
              : !form.case_title.trim()
              ? "Case title is required."
              : "Client name is required."}
          </div>
        )}
        {error && (
          <div className="mx-6 mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Save failed:</strong> {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Case Details ─────────────────────────────────────────────── */}
        <section>
          <h3 className={sec}>Case Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Matter Type</label>
              <select className={sel} value={form.matter_type}
                onChange={e => set("matter_type", e.target.value as MatterType)}>
                <option value="litigation">Litigation</option>
                <option value="advisory">Advisory</option>
                <option value="drafting">Drafting</option>
                <option value="corporate">Corporate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={sel} value={form.status}
                onChange={e => set("status", e.target.value as MatterStatus)}>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="on-hold">On Hold</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Court / Forum</label>
              <input className={inp} value={form.court ?? ""}
                onChange={e => set("court", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Court Case Number</label>
              <input className={inp} value={form.matter_number ?? ""}
                onChange={e => set("matter_number", e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Client ───────────────────────────────────────────────────── */}
        <section className="border border-neutral-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className={sec + " mb-0 flex-1"}>Client</h3>
            {clientSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                <Check size={11} /> Saved to Clients
              </span>
            )}
          </div>

          {/* Searchable picker */}
          <div>
            <label className={lbl}>Search or select saved client</label>
            <EntityPicker
              label="Client"
              placeholder="Type to search existing clients…"
              records={clients}
              selectedId={linkedClientId}
              savedBadge="Saved Client"
              onSelect={pickClient}
              onClear={clearClient}
            />
          </div>

          {/* Free-type fields */}
          {!linkedClientId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Client Name *</label>
                  <input className={inp} required value={form.client_name ?? ""}
                    onChange={e => set("client_name", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" className={inp} value={form.client_email ?? ""}
                    onChange={e => set("client_email", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>GSTIN</label>
                  <input className={inp} maxLength={15} placeholder="22AAAAA0000A1Z5"
                    value={form.client_gstin ?? ""}
                    onChange={e => set("client_gstin", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <select className={sel} value={form.client_state ?? ""}
                    onChange={e => set("client_state", e.target.value)}>
                    <option value="">— Select —</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {/* Offer to save to DB */}
              <SaveToDB
                label="Client"
                name={form.client_name ?? ""}
                saved={clientSaved}
                onSave={saveNewClient}
              />
            </>
          )}

          {/* Primary contact person */}
          {clientContacts.length > 0 && (
            <div>
              <label className={lbl}>Primary Contact Person</label>
              <select className={sel}
                value={form.primary_client_contact_id ?? ""}
                onChange={e => setForm(f => ({ ...f, primary_client_contact_id: e.target.value || undefined }))}>
                <option value="">— None —</option>
                {clientContacts.map(cp => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}{cp.designation ? ` · ${cp.designation}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* ── AOR / Firm ───────────────────────────────────────────────── */}
        <section className="border border-neutral-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className={sec + " mb-0 flex-1"}>AOR / Firm <span className="normal-case font-normal text-neutral-400">(optional)</span></h3>
            {firmSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                <Check size={11} /> Saved to AOR / Firms
              </span>
            )}
          </div>

          {/* Searchable picker */}
          <div>
            <label className={lbl}>Search or select saved AOR / Firm</label>
            <EntityPicker
              label="AOR / Firm"
              placeholder="Type to search existing AOR / Firms…"
              records={firms}
              selectedId={linkedFirmId}
              savedBadge="Saved Firm"
              onSelect={pickFirm}
              onClear={clearFirm}
            />
          </div>

          {/* Free-type fields */}
          {!linkedFirmId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>AOR / Firm Name</label>
                  <input className={inp} value={form.firm_name ?? ""}
                    placeholder="e.g. Crawford Bayley & Co. or Adv. Rajan Mehta"
                    onChange={e => set("firm_name", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" className={inp} value={form.firm_email ?? ""}
                    onChange={e => set("firm_email", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>GSTIN</label>
                  <input className={inp} maxLength={15} placeholder="22AAAAA0000A1Z5"
                    value={form.firm_gstin ?? ""}
                    onChange={e => set("firm_gstin", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className={lbl}>State</label>
                  <select className={sel} value={form.firm_state ?? ""}
                    onChange={e => set("firm_state", e.target.value)}>
                    <option value="">— Select —</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {/* Offer to save to DB */}
              <SaveToDB
                label="AOR / Firm"
                name={form.firm_name ?? ""}
                saved={firmSaved}
                onSave={saveNewFirm}
              />
            </>
          )}

          {/* Primary contact person */}
          {firmContacts.length > 0 && (
            <div>
              <label className={lbl}>Primary Contact Person</label>
              <select className={sel}
                value={form.primary_firm_contact_id ?? ""}
                onChange={e => setForm(f => ({ ...f, primary_firm_contact_id: e.target.value || undefined }))}>
                <option value="">— None —</option>
                {firmContacts.map(cp => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}{cp.designation ? ` · ${cp.designation}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* ── Invoice Billing ───────────────────────────────────────────── */}
        <section>
          <h3 className={sec}>Invoice Billing</h3>
          <p className="text-xs text-neutral-400 mb-3">
            Who should invoices be addressed to by default? You can override this per invoice.
          </p>
          <div className="flex gap-3">
            {([
              { value: "both",   label: "AOR / Firm & Client",  desc: "Both parties shown on invoice" },
              { value: "firm",   label: "AOR / Firm only",       desc: "Invoice to the engaging firm / AOR" },
              { value: "client", label: "Client only",            desc: "Invoice directly to the client" },
            ] as { value: RecipientType; label: string; desc: string }[]).map(opt => (
              <label key={opt.value}
                className={`flex-1 border rounded-xl p-3 cursor-pointer transition-colors ${
                  form.invoice_recipient === opt.value
                    ? "border-neutral-900 bg-neutral-100"
                    : "border-neutral-200 hover:border-neutral-300 bg-white"
                }`}>
                <input type="radio" className="sr-only" name="invoice_recipient" value={opt.value}
                  checked={form.invoice_recipient === opt.value}
                  onChange={() => setForm(f => ({ ...f, invoice_recipient: opt.value }))} />
                <p className={`text-sm font-medium ${form.invoice_recipient === opt.value ? "text-neutral-900" : "text-neutral-700"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">{opt.desc}</p>
              </label>
            ))}
          </div>
        </section>

        {/* ── Handler ───────────────────────────────────────────────────── */}
        <section>
          <h3 className={sec}>Partner / Associate Handling the Matter</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Full Name</label>
              <input className={inp} placeholder="e.g. Adv. Rahul Mehta"
                value={form.handler_name ?? ""} onChange={e => set("handler_name", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Designation</label>
              <input className={inp} placeholder="e.g. Partner, Senior Associate"
                value={form.handler_designation ?? ""} onChange={e => set("handler_designation", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" className={inp} placeholder="advocate@firm.com"
                value={form.handler_email ?? ""} onChange={e => set("handler_email", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Phone / Mobile</label>
              <input type="tel" className={inp} placeholder="+91 98765 43210"
                value={form.handler_phone ?? ""} onChange={e => set("handler_phone", e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <section>
          <label className={lbl}>Notes</label>
          <textarea rows={3} className={inp + " resize-none"} value={form.notes ?? ""}
            onChange={e => set("notes", e.target.value)} />
        </section>

        {/* ── Bottom save bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          {!canSave && touched ? (
            <p className="text-xs text-amber-700 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0" />
              {!form.case_title.trim() ? "Case title required" : "Client name required"}
            </p>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600">
              Cancel
            </button>
            <button type="submit" disabled={saving || !canSave}
              className="px-5 py-2 text-sm rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
              {saving ? "Saving…" : "Save Matter"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
