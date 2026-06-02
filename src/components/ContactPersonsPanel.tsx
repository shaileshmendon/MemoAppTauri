/**
 * ContactPersonsPanel — shows and manages contact persons for a Client or Firm.
 * Embeds directly in the ContactDetail view.
 * Also exposes an "Import from Contacts" flow that reuses the macOS Contacts
 * picker already built into ContactList.tsx.
 */
import { useState, useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";
import { invoke } from "@tauri-apps/api/core";
import {
  UserPlus, Pencil, Trash2, BookUser, Search, X,
  Phone, Mail, Loader2, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  fetchContactPersons, insertContactPerson,
  updateContactPerson, deleteContactPerson,
} from "../db";
import type { ContactPerson } from "../types";
import type { MacContact } from "../types/contacts";

// ── Contacts picker modal (self-contained, reused from ContactList pattern) ───

function ContactPickerModal({
  onPick, onClose,
}: {
  onPick: (c: MacContact) => void;
  onClose: () => void;
}) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<MacContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [searched, setSearched] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const runSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true); setError("");
    try {
      const contacts = await invoke<MacContact[]>("search_contacts", { query: q });
      setResults(contacts); setSearched(true);
    } catch (err) { setError(String(err)); setResults([]); }
    finally { setLoading(false); }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 320);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-h-[68vh] flex flex-col overflow-hidden border border-neutral-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
            <BookUser size={14} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-800">Import Contact Person from Contacts</p>
            <p className="text-xs text-neutral-400">Search your macOS Contacts app</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400">
            <X size={15} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-neutral-100">
          <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2">
            {loading ? <Loader2 size={13} className="text-neutral-600 animate-spin shrink-0" />
                     : <Search size={13} className="text-neutral-400 shrink-0" />}
            <input ref={inputRef} type="text" value={query} onChange={onChange}
              onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Enter") { if (debounce.current) clearTimeout(debounce.current); runSearch(query); }}}
              placeholder="Search by name or company…"
              className="flex-1 text-sm outline-none bg-transparent text-neutral-800 placeholder-neutral-400" />
            {query && <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }} className="text-neutral-400 hover:text-neutral-600"><X size={12} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {error && <div className="mx-4 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{error}</div>}
          {!error && !searched && <div className="text-center py-8 text-sm text-neutral-400 select-none"><BookUser size={28} className="mx-auto mb-2 text-neutral-200" />Type a name to search</div>}
          {!error && searched && results.length === 0 && <div className="text-center py-8 text-sm text-neutral-400">No results for "{query}"</div>}
          {results.map((c, i) => (
            <button key={i} onClick={() => onPick(c)}
              className="w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-100 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center shrink-0 text-xs font-semibold text-neutral-500 group-hover:text-neutral-800">
                  {(c.givenName?.[0] ?? c.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{c.name || "(No name)"}</p>
                  {c.jobTitle && <p className="text-xs text-neutral-500 truncate">{c.jobTitle}{c.organization ? ` · ${c.organization}` : ""}</p>}
                  {!c.jobTitle && c.organization && c.organization !== c.name && <p className="text-xs text-neutral-500 truncate">{c.organization}</p>}
                  <div className="flex gap-3 mt-0.5">
                    {c.emails[0] && <span className="text-xs text-neutral-400 flex items-center gap-1"><Mail size={9} />{c.emails[0]}</span>}
                    {c.phones[0] && <span className="text-xs text-neutral-400 flex items-center gap-1"><Phone size={9} />{c.phones[0]}</span>}
                  </div>
                </div>
                <span className="text-xs text-neutral-600 opacity-0 group-hover:opacity-100 shrink-0 mt-1">Import →</span>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50">
          <p className="text-xs text-neutral-400">{results.length > 0 ? `${results.length} result${results.length !== 1 ? "s" : ""} · click to import` : "Results from macOS Contacts"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Contact person form ────────────────────────────────────────────────────────

function ContactPersonForm({
  initial, entityType, entityId, onSave, onCancel,
}: {
  initial?: ContactPerson;
  entityType: "client" | "firm";
  entityId: string;
  onSave: (cp: ContactPerson) => void;
  onCancel: () => void;
}) {
  const now = new Date().toISOString();
  const [form, setForm] = useState({
    name:        initial?.name         ?? "",
    designation: initial?.designation  ?? "",
    company:     initial?.company      ?? "",
    email:       initial?.email        ?? "",
    phone:       initial?.phone        ?? "",
    mobile:      initial?.mobile       ?? "",
    address:     initial?.address      ?? "",
    notes:       initial?.notes        ?? "",
  });
  const [saving, setSaving]           = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [importedFrom, setImportedFrom] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handlePick = (c: MacContact) => {
    setShowPicker(false);
    const addrParts = [c.addressStreet, c.addressCity, c.addressPostal, c.addressCountry].map(s => s.trim()).filter(Boolean);
    setForm(f => ({
      ...f,
      name:        c.name || f.name,
      designation: c.jobTitle || f.designation,
      company:     c.organization || f.company,
      email:       c.emails[0] || f.email,
      phone:       c.phones[0] || f.phone,
      mobile:      c.phones[1] || f.mobile,
      address:     addrParts.join(", ") || f.address,
    }));
    setImportedFrom(c.name || c.organization || "contact");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const cp: ContactPerson = initial
      ? { ...initial, ...form, updated_at: now }
      : { ...form, id: uuid(), entity_type: entityType, entity_id: entityId, apple_contact_id: undefined, created_at: now, updated_at: now };
    if (initial) await updateContactPerson(cp);
    else         await insertContactPerson(cp);
    onSave(cp);
    setSaving(false);
  };

  const inp = "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white";
  const lbl = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <>
      {showPicker && <ContactPickerModal onPick={handlePick} onClose={() => setShowPicker(false)} />}
      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
        {/* Mini header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 bg-neutral-50">
          <p className="text-sm font-semibold text-neutral-700 flex-1">
            {initial ? "Edit Contact Person" : "New Contact Person"}
          </p>
          <button type="button" onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:bg-white">
            <BookUser size={12} /> From Contacts
          </button>
          <button type="button" onClick={onCancel}
            className="px-3 py-1 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:bg-white">
            Cancel
          </button>
          <button type="button" disabled={saving || !form.name.trim()} onClick={handleSave}
            className="px-3 py-1 text-xs bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {importedFrom && (
          <div className="px-4 py-2 bg-neutral-100 border-b border-neutral-200">
            <p className="text-xs text-neutral-800 flex items-center gap-1">
              <BookUser size={11} /> Imported from "{importedFrom}" — review fields below
            </p>
          </div>
        )}
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={lbl}>Full Name *</label>
            <input className={inp} value={form.name} placeholder="e.g. Rajesh Kumar"
              onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Designation / Title</label>
            <input className={inp} value={form.designation} placeholder="e.g. Partner, General Counsel"
              onChange={e => set("designation", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Company / Firm</label>
            <input className={inp} value={form.company} placeholder="e.g. ABC Law Associates"
              onChange={e => set("company", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input type="email" className={inp} value={form.email}
              onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Phone</label>
            <input type="tel" className={inp} value={form.phone}
              onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Mobile</label>
            <input type="tel" className={inp} value={form.mobile}
              onChange={e => set("mobile", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Address</label>
            <textarea rows={2} className={inp + " resize-none"} value={form.address}
              onChange={e => set("address", e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Notes</label>
            <textarea rows={1} className={inp + " resize-none"} value={form.notes}
              onChange={e => set("notes", e.target.value)} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  entityType: "client" | "firm";
  entityId: string;
}

export default function ContactPersonsPanel({ entityType, entityId }: Props) {
  const [persons, setPersons]           = useState<ContactPerson[]>([]);
  const [showForm, setShowForm]         = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed]       = useState(false);

  useEffect(() => {
    fetchContactPersons(entityType, entityId).then(setPersons);
  }, [entityType, entityId]);

  const handleSave = (cp: ContactPerson) => {
    setPersons(prev =>
      prev.some(p => p.id === cp.id)
        ? prev.map(p => p.id === cp.id ? cp : p)
        : [...prev, cp]
    );
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteContactPerson(id);
    setPersons(prev => prev.filter(p => p.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="border-t border-neutral-100 mt-4 pt-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 flex-1 text-left group">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-neutral-700">
            Contact Persons
          </span>
          {persons.length > 0 && (
            <span className="text-[10px] bg-neutral-100 text-neutral-500 rounded-full px-1.5 py-0.5 font-medium">
              {persons.length}
            </span>
          )}
          {collapsed ? <ChevronDown size={13} className="text-neutral-400" /> : <ChevronUp size={13} className="text-neutral-400" />}
        </button>
        {!collapsed && !showForm && editingId === null && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50">
            <UserPlus size={12} /> Add
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {/* New form */}
          {showForm && (
            <ContactPersonForm
              entityType={entityType}
              entityId={entityId}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Existing persons */}
          {persons.map(cp => (
            <div key={cp.id}>
              {editingId === cp.id ? (
                <ContactPersonForm
                  initial={cp}
                  entityType={entityType}
                  entityId={entityId}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="border border-neutral-200 rounded-xl px-4 py-3 bg-white group">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center shrink-0 text-sm font-bold text-neutral-800">
                      {cp.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800">{cp.name}</p>
                      {(cp.designation || cp.company) && (
                        <p className="text-xs text-neutral-500 truncate">
                          {[cp.designation, cp.company].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {cp.email && <span className="text-xs text-neutral-400 flex items-center gap-1"><Mail size={10} />{cp.email}</span>}
                        {cp.phone && <span className="text-xs text-neutral-400 flex items-center gap-1"><Phone size={10} />{cp.phone}</span>}
                        {cp.mobile && cp.mobile !== cp.phone && <span className="text-xs text-neutral-400 flex items-center gap-1"><Phone size={10} />{cp.mobile} (M)</span>}
                      </div>
                      {cp.address && <p className="text-xs text-neutral-400 mt-0.5 truncate">{cp.address}</p>}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingId(cp.id)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600">
                        <Pencil size={13} />
                      </button>
                      {confirmDelete === cp.id ? (
                        <>
                          <button onClick={() => handleDelete(cp.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 text-xs border border-neutral-200 rounded-lg text-neutral-600">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(cp.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {persons.length === 0 && !showForm && (
            <p className="text-xs text-neutral-400 text-center py-3">
              No contact persons yet. Click Add to create one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
