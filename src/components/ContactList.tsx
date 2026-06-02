/**
 * Generic reusable list for Clients and Firms.
 * Includes "Import from Contacts" — searches macOS Contacts via a Tauri
 * command and pre-fills the form fields from the selected contact.
 */
import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Mail, Phone, MapPin, BookUser, X, Loader2, AlertTriangle, Scale } from "lucide-react";
import { v4 as uuid } from "uuid";
import { invoke } from "@tauri-apps/api/core";
import type { Client, Firm, Matter } from "../types";
import { fmtRef } from "../types";
import ContactPersonsPanel from "./ContactPersonsPanel";
import {
  fetchClients, insertClient, updateClient, deleteClient,
  fetchFirms, insertFirm, updateFirm, deleteFirm,
  fetchMattersByClientName, fetchMattersByFirmName,
} from "../db";
import { INDIAN_STATES, matchState } from "../lib/constants/states";
import type { MacContact } from "../types/contacts";

type ContactType = "client" | "firm";
type Contact = Client | Firm;

interface Props {
  type: ContactType;
}

// ── Contact picker modal ───────────────────────────────────────────────────────

function ContactPickerModal({
  type,
  onPick,
  onClose,
}: {
  type: ContactType;
  onPick: (c: MacContact) => void;
  onClose: () => void;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<MacContact[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setError("");
    try {
      const contacts = await invoke<MacContact[]>("search_contacts", { query: q });
      setResults(contacts);
      setSearched(true);
    } catch (err) {
      setError(String(err));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 320);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runSearch(query);
    }
  };

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col overflow-hidden border border-neutral-200">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
            <BookUser size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-800">Import from Contacts</p>
            <p className="text-xs text-neutral-400">
              Search your macOS Contacts and import into this {type === "client" ? "client" : "firm"} record
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600">
            <X size={15} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
            {loading
              ? <Loader2 size={14} className="text-neutral-600 animate-spin shrink-0" />
              : <Search size={14} className="text-neutral-400 shrink-0" />
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a name or company to search…"
              className="flex-1 text-sm outline-none bg-transparent text-neutral-800 placeholder-neutral-400"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSearched(false); setError(""); }}
                className="text-neutral-400 hover:text-neutral-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-4 mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-3 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!error && !loading && !searched && (
            <div className="text-center py-10 text-sm text-neutral-400 select-none">
              <BookUser size={32} className="mx-auto mb-3 text-neutral-200" />
              Type a name or company above to search your Contacts
            </div>
          )}

          {!error && searched && results.length === 0 && (
            <div className="text-center py-10 text-sm text-neutral-400 select-none">
              No contacts match <strong className="text-neutral-600">"{query}"</strong>
            </div>
          )}

          {results.map((c, i) => (
            <button key={i}
              onClick={() => onPick(c)}
              className="w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-100 transition-colors group">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center shrink-0 text-xs font-semibold text-neutral-500 group-hover:text-neutral-800 transition-colors">
                  {(c.givenName?.[0] ?? c.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{c.name || "(No name)"}</p>
                  {c.organization && c.organization !== c.name && (
                    <p className="text-xs text-neutral-500 truncate">{c.organization}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {c.emails[0] && (
                      <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <Mail size={10} /> {c.emails[0]}
                      </p>
                    )}
                    {c.phones[0] && (
                      <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <Phone size={10} /> {c.phones[0]}
                      </p>
                    )}
                    {c.addressCity && (
                      <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <MapPin size={10} /> {[c.addressCity, c.addressState].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-neutral-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                  Import →
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            {results.length > 0
              ? `${results.length} result${results.length !== 1 ? "s" : ""} — click one to import`
              : "Results from your macOS Contacts app"}
          </p>
          <p className="text-xs text-neutral-400">↵ to search · Esc to close</p>
        </div>
      </div>
    </div>
  );
}

// ── Main list component ────────────────────────────────────────────────────────

export default function ContactList({ type }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const label = type === "client" ? "Client" : "AOR / Firm";
  const plural = type === "client" ? "Clients" : "AOR / Firms";

  useEffect(() => { reload(); }, [type]);

  async function reload() {
    const data = type === "client" ? await fetchClients() : await fetchFirms();
    setContacts(data);
  }

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const handleNew = () => { setSelected(null); setIsNew(true); setShowForm(true); };
  const handleEdit = (c: Contact) => { setSelected(c); setIsNew(false); setShowForm(true); };

  const handleSave = async (c: Contact) => {
    if (isNew) {
      if (type === "client") await insertClient(c as Client);
      else await insertFirm(c as Firm);
    } else {
      if (type === "client") await updateClient(c as Client);
      else await updateFirm(c as Firm);
    }
    await reload();
    setShowForm(false);
    setSelected(c);
  };

  const handleDelete = async (id: string) => {
    if (type === "client") await deleteClient(id);
    else await deleteFirm(id);
    setConfirmDelete(null);
    if (selected?.id === id) { setSelected(null); setShowForm(false); }
    await reload();
  };

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-64 border-r border-neutral-200 flex flex-col shrink-0 bg-neutral-50">
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-800 flex-1">{plural}</h2>
          <button onClick={handleNew}
            className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-600 transition-colors" title={`New ${label}`}>
            <Plus size={16} />
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-2 py-1.5">
            <Search size={13} className="text-neutral-400" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${plural.toLowerCase()}…`}
              className="flex-1 text-sm outline-none bg-transparent text-neutral-800 placeholder-neutral-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-neutral-400 text-center mt-8 px-4">
              {query ? "No matches" : `No ${plural.toLowerCase()} yet.\nClick + to add.`}
            </p>
          )}
          {filtered.map((c) => (
            <button key={c.id} onClick={() => { setSelected(c); setShowForm(false); }}
              className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 transition-colors cursor-default ${
                selected?.id === c.id && !showForm ? "bg-neutral-100 border-l-2 border-l-neutral-900" : "hover:bg-white"
              }`}>
              <p className="text-sm font-medium text-neutral-800 truncate">{c.name}</p>
              {c.email && <p className="text-xs text-neutral-500 truncate">{c.email}</p>}
              {c.state && <p className="text-xs text-neutral-400 truncate">{c.state}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail or form */}
      <div className="flex-1 overflow-y-auto">
        {showForm ? (
          <ContactForm
            type={type}
            initial={isNew ? undefined : selected ?? undefined}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        ) : selected ? (
          <ContactDetail
            contact={selected}
            type={type}
            onEdit={() => handleEdit(selected)}
            onDelete={() => setConfirmDelete(selected.id)}
            confirmDelete={confirmDelete === selected.id}
            onConfirmDelete={() => handleDelete(selected.id)}
            onCancelDelete={() => setConfirmDelete(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm select-none">
            Select a {label.toLowerCase()} or click + to add one
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail ────────────────────────────────────────────────────────────────────

// ─── Linked Matters Panel ──────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  active:   "bg-green-100 text-green-700",
  closed:   "bg-neutral-100 text-neutral-500",
  "on-hold":"bg-amber-100 text-amber-700",
};

function LinkedMattersPanel({ name, type }: { name: string; type: ContactType }) {
  const [matters, setMatters] = useState<Matter[]>([]);

  useEffect(() => {
    if (!name) return;
    const fn = type === "client" ? fetchMattersByClientName : fetchMattersByFirmName;
    fn(name).then(setMatters);
  }, [name, type]);

  if (matters.length === 0) return null;

  const active  = matters.filter(m => m.status === "active");
  const others  = matters.filter(m => m.status !== "active");

  return (
    <div className="border-t border-neutral-100 mt-4 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Scale size={13} className="text-neutral-400" />
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          Linked Matters
        </p>
        <span className="text-[10px] bg-neutral-100 text-neutral-500 rounded-full px-1.5 py-0.5 font-medium">
          {matters.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {/* Active first */}
        {active.map(m => (
          <div key={m.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-100">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800 truncate">{m.case_title}</p>
              {m.court && <p className="text-xs text-neutral-500 truncate mt-0.5">{m.court}</p>}
              {m.matter_number && <p className="text-xs text-neutral-400 truncate">{m.matter_number}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-neutral-400">{fmtRef(m.ref_number)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[m.status]}`}>
                {m.status}
              </span>
            </div>
          </div>
        ))}
        {/* Closed / on-hold */}
        {others.map(m => (
          <div key={m.id}
            className="flex items-start gap-3 px-3 py-2 rounded-lg border border-neutral-100 bg-white">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-neutral-600 truncate">{m.case_title}</p>
              {m.court && <p className="text-xs text-neutral-400 truncate mt-0.5">{m.court}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-neutral-400">{fmtRef(m.ref_number)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[m.status]}`}>
                {m.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contact Detail ────────────────────────────────────────────────────────────

function ContactDetail({
  contact, type, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete,
}: {
  contact: Contact;
  type: ContactType;
  onEdit: () => void; onDelete: () => void;
  confirmDelete: boolean; onConfirmDelete: () => void; onCancelDelete: () => void;
}) {
  return (
    <div className="p-6 overflow-y-auto">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-neutral-900">{contact.name}</h1>
          {contact.state && <p className="text-sm text-neutral-500 mt-0.5">{contact.state}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors">
            <Pencil size={15} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={onConfirmDelete}
                className="px-2 py-1 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700">Confirm</button>
              <button onClick={onCancelDelete}
                className="px-2 py-1 text-xs rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50">Cancel</button>
            </div>
          ) : (
            <button onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
        {contact.email && (
          <div className="flex items-start gap-2">
            <Mail size={14} className="text-neutral-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">Email</p>
              <p className="text-sm text-neutral-800">{contact.email}</p>
            </div>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-start gap-2">
            <Phone size={14} className="text-neutral-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">Phone</p>
              <p className="text-sm text-neutral-800">{contact.phone}</p>
            </div>
          </div>
        )}
        {contact.state && (
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-neutral-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-neutral-400">State</p>
              <p className="text-sm text-neutral-800">{contact.state}</p>
            </div>
          </div>
        )}
        {contact.gstin && (
          <div>
            <p className="text-xs text-neutral-400">GSTIN</p>
            <p className="text-sm font-mono text-neutral-800">{contact.gstin}</p>
          </div>
        )}
        {contact.address && (
          <div className="col-span-2">
            <p className="text-xs text-neutral-400">Address</p>
            <p className="text-sm text-neutral-800 whitespace-pre-wrap">{contact.address}</p>
          </div>
        )}
        {contact.notes && (
          <div className="col-span-2">
            <p className="text-xs text-neutral-400">Notes</p>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Linked matters */}
      <LinkedMattersPanel name={contact.name} type={type} />

      {/* Contact persons */}
      <ContactPersonsPanel
        entityType={type === "client" ? "client" : "firm"}
        entityId={contact.id}
      />
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────────────────────

function ContactForm({
  type, initial, onSave, onCancel,
}: {
  type: ContactType; initial?: Contact;
  onSave: (c: Contact) => void; onCancel: () => void;
}) {
  const label = type === "client" ? "Client" : "Firm / Advocate";
  const [form, setForm] = useState({
    name:    initial?.name    ?? "",
    email:   initial?.email   ?? "",
    phone:   initial?.phone   ?? "",
    gstin:   initial?.gstin   ?? "",
    state:   initial?.state   ?? "",
    address: initial?.address ?? "",
    notes:   initial?.notes   ?? "",
  });
  const [saving, setSaving]           = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [importedFrom, setImportedFrom] = useState("");

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  /** Map a MacContact into the form fields. */
  const handlePick = (c: MacContact) => {
    setShowPicker(false);

    // Name: for clients prefer full name; for firms prefer org name
    const name = type === "firm" && c.organization
      ? c.organization
      : c.name || c.organization || "";

    // Address: combine street parts into a single string
    const addrParts = [c.addressStreet, c.addressCity, c.addressPostal, c.addressCountry]
      .map(s => s.trim()).filter(Boolean);
    const address = addrParts.join(", ");

    // Try to match state against INDIAN_STATES
    const state = matchState(c.addressState);

    setForm(f => ({
      ...f,
      name:    name    || f.name,
      email:   c.emails[0]  || f.email,
      phone:   c.phones[0]  || f.phone,
      state:   state   || f.state,
      address: address || f.address,
      // Don't overwrite gstin or notes — those aren't in Contacts
    }));

    setImportedFrom(c.name || c.organization || "contact");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const contact: Contact = initial
        ? { ...initial, ...form }
        : { ...form, id: uuid(), created_at: new Date().toISOString() };
      await onSave(contact);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white";
  const lbl = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <>
      {showPicker && (
        <ContactPickerModal
          type={type}
          onPick={handlePick}
          onClose={() => setShowPicker(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        {/* Form header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-neutral-800">
              {initial ? `Edit ${label}` : `New ${label}`}
            </h2>
            {importedFrom && (
              <p className="text-xs text-neutral-800 mt-0.5 flex items-center gap-1">
                <BookUser size={11} /> Imported from <span className="font-medium">"{importedFrom}"</span> — review and save
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {/* Import from Contacts button */}
            <button type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              title="Import details from macOS Contacts">
              <BookUser size={13} />
              From Contacts
            </button>
            <button type="button" onClick={onCancel}
              className="px-4 py-1.5 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.name}
              className="px-4 py-1.5 text-sm rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Form fields */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>{label} Name *</label>
            <input className={inp} required value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input type="email" className={inp} value={form.email}
              onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input type="tel" className={inp} value={form.phone}
              onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>GSTIN</label>
            <input className={inp} value={form.gstin} maxLength={15}
              placeholder="22AAAAA0000A1Z5"
              onChange={(e) => set("gstin", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className={lbl}>State</label>
            <select className={inp} value={form.state}
              onChange={(e) => set("state", e.target.value)}>
              <option value="">— Select —</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Address</label>
            <textarea rows={2} className={inp + " resize-none"} value={form.address}
              onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Notes</label>
            <textarea rows={2} className={inp + " resize-none"} value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
      </form>
    </>
  );
}
