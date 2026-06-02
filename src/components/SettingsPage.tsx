import { useState, useEffect } from "react";
import { Settings, Check, FlaskConical, Trash2, AlertTriangle, Download, Upload, ShieldCheck, RotateCcw } from "lucide-react";
import { saveProfile, exportAllData, importAllData } from "../db";
import type { BackupManifest } from "../db";
import { loadDemoData, removeAllData } from "../demoData";
import { save as dialogSave, open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import LockSettings from "./LockSettings";
import InvoiceDesigner from "./InvoiceDesigner";
import type { Profile, InvoiceTemplate, InvoiceCustomization } from "../types";
import { DEFAULT_PROFILE } from "../types";
import { INDIAN_STATES } from "../lib/constants/states";

interface Props {
  profile: Profile | null;
  onSaved: (profile: Profile) => void;
  onLockChanged: () => void;
}

const SECTIONS = [
  { key: "identity", label: "Identity" },
  { key: "contact",  label: "Address & Contact" },
  { key: "bank",     label: "Bank Details" },
  { key: "invoice",  label: "Invoice Settings" },
  { key: "designer", label: "Invoice Designer" },
  { key: "backup",   label: "Backup & Restore" },
  { key: "security", label: "Security" },
  { key: "demo",     label: "Demo Data" },
] as const;
type Section = typeof SECTIONS[number]["key"];

export default function SettingsPage({ profile, onSaved, onLockChanged }: Props) {
  const [form, setForm] = useState<Profile>({ ...DEFAULT_PROFILE });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("identity");
  const [demoConfirm, setDemoConfirm]   = useState(false);
  const [demoLoading, setDemoLoading]   = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  // Backup & Restore state
  const [backupLoading, setBackupLoading]     = useState(false);
  const [backupDone, setBackupDone]           = useState(false);
  const [restoreLoading, setRestoreLoading]   = useState(false);
  const [restorePreview, setRestorePreview]   = useState<BackupManifest | null>(null);
  const [restoreJson, setRestoreJson]         = useState<string>("");
  const [restoreConfirm, setRestoreConfirm]   = useState(false);
  const [backupError, setBackupError]         = useState<string>("");
  const [restoreError, setRestoreError]       = useState<string>("");

  const handleExport = async () => {
    setBackupError("");
    setBackupLoading(true);
    try {
      const json = await exportAllData();
      const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const filePath = await dialogSave({
        title: "Save Memo Backup",
        defaultPath: `MemoApp-backup-${date}.json`,
        filters: [{ name: "Memo Backup", extensions: ["json"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, json);
        setBackupDone(true);
        setTimeout(() => setBackupDone(false), 3000);
      }
    } catch (err) {
      setBackupError(String(err));
    } finally {
      setBackupLoading(false);
    }
  };

  const handlePickRestore = async () => {
    setRestoreError("");
    setRestorePreview(null);
    setRestoreConfirm(false);
    try {
      const filePath = await dialogOpen({
        title: "Open Memo Backup",
        multiple: false,
        filters: [{ name: "Memo Backup", extensions: ["json"] }],
      });
      if (!filePath) return;
      const path = Array.isArray(filePath) ? filePath[0] : filePath;
      const json = await readTextFile(path);
      let manifest: BackupManifest;
      try {
        manifest = JSON.parse(json) as BackupManifest;
      } catch {
        setRestoreError("The selected file is not valid JSON.");
        return;
      }
      if (!manifest.version || !manifest.data) {
        setRestoreError("This file does not appear to be a Memo backup.");
        return;
      }
      setRestoreJson(json);
      setRestorePreview(manifest);
    } catch (err) {
      setRestoreError(String(err));
    }
  };

  const handleRestore = async () => {
    setRestoreError("");
    setRestoreLoading(true);
    try {
      await importAllData(restoreJson);
      window.location.reload();
    } catch (err) {
      setRestoreError(String(err));
      setRestoreLoading(false);
      setRestoreConfirm(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    await loadDemoData();
    setDemoLoading(false);
    setDemoConfirm(false);
    window.location.reload();
  };

  const handleClearAll = async () => {
    setClearLoading(true);
    await removeAllData();
    setClearLoading(false);
    setClearConfirm(false);
    window.location.reload();
  };

  useEffect(() => {
    if (profile) setForm({ ...profile });
  }, [profile]);

  const set = (k: keyof Profile, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await saveProfile(form);
    onSaved(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inp = "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white";
  const lbl = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <aside className="w-44 shrink-0 border-r border-neutral-100 bg-neutral-50 py-6 px-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-3 mb-3">Profile</p>
        {(["identity", "contact", "bank", "invoice", "designer"] as const).map(key => {
          const s = SECTIONS.find(s => s.key === key)!;
          return (
            <button key={key} onClick={() => setActiveSection(key)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                activeSection === key
                  ? "bg-neutral-100 text-neutral-900 font-medium"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}>
              {s.label}
            </button>
          );
        })}
        <div className="border-t border-neutral-200 my-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-3 mb-2">Data</p>
        <button onClick={() => setActiveSection("backup")}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
            activeSection === "backup"
              ? "bg-neutral-100 text-neutral-900 font-medium"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}>
          Backup & Restore
        </button>
        <div className="border-t border-neutral-200 my-3" />
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 px-3 mb-2">Developer</p>
        {(["security", "demo"] as const).map(key => (
          <button key={key} onClick={() => setActiveSection(key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
              activeSection === key
                ? key === "demo" ? "bg-violet-50 text-violet-700 font-medium" : "bg-neutral-100 text-neutral-900 font-medium"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}>
            {key === "security" ? "Security & Lock" : "Demo Data"}
          </button>
        ))}
      </aside>

      {/* Main form — designer gets full width, others are constrained */}
      {activeSection === "designer" ? (
        <div className="flex-1 overflow-hidden">
          <InvoiceDesigner
            profile={form}
            onSave={(customization: InvoiceCustomization, tmpl: InvoiceTemplate) => {
              const updated = { ...form, invoiceCustomization: customization, invoiceTemplate: tmpl };
              setForm(updated);
              saveProfile(updated).then(() => onSaved(updated));
            }}
          />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
              <Settings size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">Settings</h1>
              <p className="text-xs text-neutral-500">Your profile is used in generated invoices</p>
            </div>
            {activeSection !== "demo" && activeSection !== "security" && (
              <div className="ml-auto flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <Check size={13} /> Saved
                  </span>
                )}
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>

          {activeSection === "identity" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lbl}>Your Full Name *</label>
                <input className={inp} placeholder="Adv. Rajesh Kumar"
                  value={form.advocateName} onChange={e => set("advocateName", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Firm Name</label>
                <input className={inp} placeholder="Kumar & Associates"
                  value={form.firmName} onChange={e => set("firmName", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Designation</label>
                <input className={inp} placeholder="Advocate, High Court"
                  value={form.designation} onChange={e => set("designation", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Bar Council Enrollment No.</label>
                <input className={inp} placeholder="MH/1234/2005"
                  value={form.barCouncilNumber} onChange={e => set("barCouncilNumber", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>GSTIN</label>
                <input className={inp} placeholder="27AAAAA0000A1Z5" maxLength={15}
                  value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className={lbl}>PAN</label>
                <input className={inp} placeholder="AAAAA0000A" maxLength={10}
                  value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          {activeSection === "contact" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lbl}>Address Line 1</label>
                <input className={inp} placeholder="Office No. 5, Legal Chambers"
                  value={form.addressLine1} onChange={e => set("addressLine1", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Address Line 2</label>
                <input className={inp} placeholder="High Court Road"
                  value={form.addressLine2} onChange={e => set("addressLine2", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>City</label>
                <input className={inp} placeholder="Mumbai"
                  value={form.city} onChange={e => set("city", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Pincode</label>
                <input className={inp} placeholder="400001" maxLength={6}
                  value={form.pincode} onChange={e => set("pincode", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>State</label>
                <select className={inp} value={form.state} onChange={e => set("state", e.target.value)}>
                  <option value="">— Select —</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Phone</label>
                <input type="tel" className={inp} placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => set("phone", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" className={inp} placeholder="rajesh@chambers.com"
                  value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Website</label>
                <input className={inp} placeholder="www.kumarassociates.com"
                  value={form.website} onChange={e => set("website", e.target.value)} />
              </div>
            </div>
          )}

          {activeSection === "bank" && (
            <div className="grid grid-cols-2 gap-4">
              <p className="col-span-2 text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2">
                Bank details appear on your invoices for client payments.
              </p>
              <div className="col-span-2">
                <label className={lbl}>Account Holder Name</label>
                <input className={inp} placeholder="Rajesh Kumar / Kumar & Associates"
                  value={form.accountHolder} onChange={e => set("accountHolder", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Bank Name</label>
                <input className={inp} placeholder="HDFC Bank"
                  value={form.bankName} onChange={e => set("bankName", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Branch</label>
                <input className={inp} placeholder="Fort Branch, Mumbai"
                  value={form.bankBranch} onChange={e => set("bankBranch", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Account Number</label>
                <input className={inp} placeholder="50100123456789"
                  value={form.accountNumber} onChange={e => set("accountNumber", e.target.value)} />
              </div>
              <div>
                <label className={lbl}>IFSC Code</label>
                <input className={inp} placeholder="HDFC0001234" maxLength={11}
                  value={form.ifscCode} onChange={e => set("ifscCode", e.target.value.toUpperCase())} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>UPI ID (optional)</label>
                <input className={inp} placeholder="rajesh@hdfcbank"
                  value={form.upiId} onChange={e => set("upiId", e.target.value)} />
              </div>
            </div>
          )}

          {activeSection === "security" && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed">
                App lock requires a password whenever Memo is opened, protecting your client data
                from unauthorised access on a shared Mac.
              </p>
              <LockSettings onLockChanged={onLockChanged} />
            </div>
          )}

          {activeSection === "demo" && (
            <div className="space-y-5">
              {/* Load demo data card */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <FlaskConical size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-800">Load Demo Data</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Populates the app with realistic sample matters, clients, firms, appearances,
                      time entries, and invoices — great for exploring features or taking screenshots.
                    </p>
                    <ul className="text-xs text-neutral-400 mt-2 space-y-0.5 list-disc list-inside">
                      <li>5 matters across litigation, corporate, and advisory</li>
                      <li>4 clients and 3 law firms</li>
                      <li>10 appearances and 8 time entries</li>
                      <li>3 invoices (paid, sent, draft) with payments</li>
                      <li>Complete lawyer profile pre-filled</li>
                    </ul>
                  </div>
                </div>

                {/* Warning + confirmation */}
                {!demoConfirm ? (
                  <div className="px-5 pb-4">
                    <button
                      onClick={() => setDemoConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">
                      <FlaskConical size={14} /> Load Demo Data
                    </button>
                  </div>
                ) : (
                  <div className="mx-5 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">This will replace all existing data</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          All current matters, invoices, appearances, time entries, clients and firms will be
                          permanently deleted and replaced with demo data. This cannot be undone.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={handleLoadDemo}
                            disabled={demoLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium">
                            <Trash2 size={12} />
                            {demoLoading ? "Loading…" : "Yes, replace with demo data"}
                          </button>
                          <button
                            onClick={() => setDemoConfirm(false)}
                            className="px-3 py-1.5 text-xs border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* What's included info cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Matters", count: "5", detail: "Litigation · Corporate · Advisory" },
                  { label: "Clients & Firms", count: "7", detail: "Siemens · Tata · Reliance · Infosys" },
                  { label: "Invoices", count: "3", detail: "Paid · Sent · Draft" },
                ].map(c => (
                  <div key={c.label} className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <p className="text-2xl font-bold text-neutral-800">{c.count}</p>
                    <p className="text-xs font-medium text-neutral-600 mt-0.5">{c.label}</p>
                    <p className="text-xs text-neutral-400 mt-1">{c.detail}</p>
                  </div>
                ))}
              </div>

              {/* Clear all data card */}
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 size={18} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-800">Clear All Data</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Permanently delete all matters, invoices, appearances, time entries, payments,
                      clients and firms. Your profile settings are kept.
                    </p>
                  </div>
                </div>

                {!clearConfirm ? (
                  <div className="px-5 pb-4">
                    <button
                      onClick={() => setClearConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                      <Trash2 size={14} /> Clear All Data
                    </button>
                  </div>
                ) : (
                  <div className="mx-5 mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-800">This cannot be undone</p>
                        <p className="text-xs text-red-700 mt-0.5">
                          Every matter, invoice, payment, appearance, time entry, client and firm
                          will be permanently deleted. Your profile and settings are preserved.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={handleClearAll}
                            disabled={clearLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium">
                            <Trash2 size={12} />
                            {clearLoading ? "Clearing…" : "Yes, delete everything"}
                          </button>
                          <button
                            onClick={() => setClearConfirm(false)}
                            className="px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "invoice" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Invoice Number Prefix</label>
                  <input className={inp} placeholder="INV" maxLength={10}
                    value={form.invoicePrefix} onChange={e => set("invoicePrefix", e.target.value)} />
                  <p className="text-xs text-neutral-400 mt-1">e.g. {form.invoicePrefix || "INV"}-2024-001</p>
                </div>
                <div>
                  <label className={lbl}>Signature Text</label>
                  <input className={inp} placeholder="Authorised Signatory"
                    value={form.signatureText} onChange={e => set("signatureText", e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Default GST Rate</label>
                  <select className={inp}
                    value={form.defaultGstRate ?? 18}
                    onChange={e => setForm(f => ({ ...f, defaultGstRate: +e.target.value }))}>
                    <option value={0}>0% — Exempt / Composition</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (standard for legal services)</option>
                  </select>
                  <p className="text-xs text-neutral-400 mt-1">Pre-fills the GST rate on every new invoice.</p>
                </div>
              </div>

              <div>
                <label className={lbl}>Invoice Template</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {(["modern", "classic", "minimal"] as InvoiceTemplate[]).map(t => (
                    <button key={t} type="button"
                      onClick={() => set("invoiceTemplate", t)}
                      className={`border-2 rounded-xl p-3 text-left transition-all ${
                        form.invoiceTemplate === t
                          ? "border-neutral-900 bg-neutral-100"
                          : "border-neutral-200 hover:border-neutral-300"
                      }`}>
                      <TemplatePreview template={t} />
                      <p className={`text-sm font-medium mt-2 capitalize ${form.invoiceTemplate === t ? "text-neutral-900" : "text-neutral-700"}`}>
                        {t}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Backup & Restore ─────────────────────────────────────── */}
          {activeSection === "backup" && (
            <div className="space-y-6">

              {/* Export card */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-neutral-50 border-b border-neutral-200">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
                    <Download size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Export Backup</p>
                    <p className="text-xs text-neutral-500">Save all your data to a JSON file you can store safely</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: "What's included", items: ["All matters & clients", "Appearances & time entries"] },
                      { label: "Invoices & payments", items: ["All invoices", "Payment records & TDS"] },
                      { label: "Your settings", items: ["Profile & bank details", "Invoice preferences"] },
                    ].map(col => (
                      <div key={col.label} className="bg-neutral-100 rounded-lg p-3 text-left">
                        <p className="text-[11px] font-semibold text-neutral-900 mb-1.5">{col.label}</p>
                        {col.items.map(i => (
                          <p key={i} className="text-xs text-neutral-900 flex items-center gap-1">
                            <Check size={10} className="shrink-0" /> {i}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                  {backupError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {backupError}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExport}
                      disabled={backupLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-800 disabled:opacity-50 font-medium">
                      {backupLoading ? (
                        <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Exporting…</>
                      ) : (
                        <><Download size={14} /> Export Backup</>
                      )}
                    </button>
                    {backupDone && (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <ShieldCheck size={15} /> Backup saved successfully
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Import / Restore card */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-neutral-50 border-b border-neutral-200">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                    <Upload size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Restore from Backup</p>
                    <p className="text-xs text-neutral-500">Replace all current data with a previously exported backup file</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">

                  {/* Warning banner */}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                    <p><strong>This will permanently replace all current data</strong> — matters, clients, invoices, payments and your profile — with the contents of the backup file. This cannot be undone.</p>
                  </div>

                  {/* Step 1 — Pick file */}
                  {!restorePreview && (
                    <div>
                      <p className="text-xs font-medium text-neutral-600 mb-2">Step 1 — Choose your backup file</p>
                      <button
                        onClick={handlePickRestore}
                        className="flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 text-sm rounded-lg hover:bg-neutral-50 font-medium">
                        <Upload size={14} /> Choose Backup File…
                      </button>
                    </div>
                  )}

                  {/* Restore error */}
                  {restoreError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {restoreError}
                    </div>
                  )}

                  {/* Step 2 — Preview & confirm */}
                  {restorePreview && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-neutral-600">Step 2 — Review and confirm</p>

                      {/* Backup info card */}
                      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
                          <ShieldCheck size={13} /> Valid Memo backup (v{restorePreview.version})
                        </div>
                        <p className="text-xs text-green-700">
                          Exported: {new Date(restorePreview.exportedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {[
                            { label: "Matters",    count: restorePreview.counts?.matters ?? 0 },
                            { label: "Invoices",   count: restorePreview.counts?.invoices ?? 0 },
                            { label: "Payments",   count: restorePreview.counts?.payments ?? 0 },
                            { label: "Clients",    count: (restorePreview.counts?.clients ?? 0) + (restorePreview.counts?.firms ?? 0) },
                          ].map(({ label, count }) => (
                            <div key={label} className="bg-white rounded-lg p-2 text-center border border-green-200">
                              <p className="text-base font-bold text-green-800">{count}</p>
                              <p className="text-[10px] text-green-600">{label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {!restoreConfirm ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRestoreConfirm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 font-medium">
                            <RotateCcw size={14} /> Restore This Backup
                          </button>
                          <button
                            onClick={() => { setRestorePreview(null); setRestoreJson(""); setRestoreError(""); }}
                            className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="border border-red-300 rounded-xl px-4 py-3 bg-red-50 space-y-3">
                          <p className="text-sm font-semibold text-red-800">Are you absolutely sure?</p>
                          <p className="text-xs text-red-700">All current data will be permanently deleted and replaced with the backup. The app will reload after restoration.</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleRestore}
                              disabled={restoreLoading}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium">
                              {restoreLoading ? (
                                <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> Restoring…</>
                              ) : (
                                <><RotateCcw size={14} /> Yes, Restore Now</>
                              )}
                            </button>
                            <button
                              onClick={() => setRestoreConfirm(false)}
                              disabled={restoreLoading}
                              className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-5 py-4">
                <p className="text-xs font-semibold text-neutral-600 mb-2">Backup tips</p>
                <ul className="space-y-1 text-xs text-neutral-500">
                  <li>• Export a backup before loading demo data or clearing all data.</li>
                  <li>• Store backups in iCloud Drive, Google Drive, or an external drive.</li>
                  <li>• A backup file contains your complete data — treat it like a sensitive document.</li>
                  <li>• You can open a backup file in any text editor to inspect its contents.</li>
                </ul>
              </div>

            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function TemplatePreview({ template }: { template: InvoiceTemplate }) {
  if (template === "modern") return (
    <div className="rounded overflow-hidden border border-neutral-200 bg-white" style={{ height: 80 }}>
      <div className="bg-neutral-800 h-5 px-1.5 flex items-center">
        <div className="bg-white/80 rounded h-1.5 w-12" />
      </div>
      <div className="p-1.5 space-y-1">
        <div className="bg-neutral-200 h-1 w-16 rounded" />
        <div className="bg-neutral-100 h-1 w-10 rounded" />
        <div className="mt-2 space-y-0.5">
          <div className="flex gap-1"><div className="bg-neutral-100 h-1 flex-1 rounded" /><div className="bg-neutral-200 h-1 w-6 rounded" /></div>
          <div className="flex gap-1"><div className="bg-neutral-100 h-1 flex-1 rounded" /><div className="bg-neutral-200 h-1 w-6 rounded" /></div>
        </div>
        <div className="flex justify-end mt-1"><div className="bg-neutral-900 h-1.5 w-10 rounded" /></div>
      </div>
    </div>
  );
  if (template === "classic") return (
    <div className="rounded overflow-hidden border-2 border-neutral-800 bg-white" style={{ height: 80 }}>
      <div className="border-b-2 border-neutral-800 p-1.5">
        <div className="bg-neutral-800 h-2 w-14 rounded" />
        <div className="bg-neutral-400 h-1 w-10 rounded mt-0.5" />
      </div>
      <div className="p-1.5 space-y-1">
        <div className="border-b border-neutral-300 pb-1 flex gap-1">
          <div className="bg-neutral-200 h-1 flex-1 rounded" />
          <div className="bg-neutral-200 h-1 w-6 rounded" />
        </div>
        <div className="flex gap-1"><div className="bg-neutral-100 h-1 flex-1 rounded" /><div className="bg-neutral-200 h-1 w-6 rounded" /></div>
        <div className="flex justify-end mt-1"><div className="bg-neutral-800 h-1.5 w-10 rounded" /></div>
      </div>
    </div>
  );
  return (
    <div className="rounded overflow-hidden border border-neutral-200 bg-white" style={{ height: 80 }}>
      <div className="p-1.5">
        <div className="bg-neutral-800 h-2 w-16 rounded" />
        <div className="bg-neutral-300 h-px w-full mt-1.5 mb-1.5" />
        <div className="bg-neutral-200 h-1 w-12 rounded mb-1" />
        <div className="space-y-0.5">
          <div className="flex gap-1"><div className="bg-neutral-100 h-1 flex-1 rounded" /><div className="bg-neutral-200 h-1 w-6 rounded" /></div>
          <div className="flex gap-1"><div className="bg-neutral-100 h-1 flex-1 rounded" /><div className="bg-neutral-200 h-1 w-6 rounded" /></div>
        </div>
        <div className="flex justify-end mt-1.5"><div className="bg-neutral-700 h-1.5 w-10 rounded" /></div>
      </div>
    </div>
  );
}
