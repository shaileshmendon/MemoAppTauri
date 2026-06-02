import { useState } from "react";
import { Scale, ArrowRight, Check } from "lucide-react";
import { saveProfile } from "../db";
import type { Profile, InvoiceTemplate } from "../types";
import { DEFAULT_PROFILE } from "../types";
import { INDIAN_STATES } from "../lib/constants/states";

interface Props {
  onComplete: (profile: Profile) => void;
}

const STEPS = ["welcome", "identity", "contact", "bank", "invoice"] as const;
type Step = typeof STEPS[number];

const STEP_FORM_LABELS: Record<Step, string> = {
  welcome:  "Welcome",
  identity: "Your Details",
  contact:  "Address & Contact",
  bank:     "Bank Details",
  invoice:  "Invoice Settings",
};

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [form, setForm] = useState<Profile>({ ...DEFAULT_PROFILE });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Profile, v: string) => setForm(f => ({ ...f, [k]: v }));

  const stepIndex = STEPS.indexOf(step);
  const isLast = stepIndex === STEPS.length - 1;
  const formSteps = STEPS.filter(s => s !== "welcome");
  const formIndex = formSteps.indexOf(step as any);

  const next = () => { if (!isLast) setStep(STEPS[stepIndex + 1]); };
  const back = () => { if (stepIndex > 0) setStep(STEPS[stepIndex - 1]); };

  const finish = async () => {
    setSaving(true);
    await saveProfile(form);
    onComplete(form);
    setSaving(false);
  };

  const canProceed = () => {
    if (step === "identity") return form.advocateName.trim() !== "" || form.firmName.trim() !== "";
    return true;
  };

  const inp = "w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white transition-colors";
  const lbl = "block text-xs font-medium text-neutral-600 mb-1";

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex items-center justify-center z-50">
      {/* Welcome screen */}
      {step === "welcome" && (
        <div className="text-center px-8 max-w-md">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Scale size={44} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Memo</h1>
          <p className="text-blue-200 text-lg mb-2">Professional billing for Indian lawyers</p>
          <p className="text-slate-400 text-sm mb-10 leading-relaxed">
            Manage matters, track appearances and time, generate GST-compliant invoices — all stored privately on your Mac.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={next}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-neutral-900 hover:bg-neutral-1000 text-white rounded-2xl font-semibold text-base transition-colors shadow-lg">
              Get Started <ArrowRight size={18} />
            </button>
            <button onClick={finish}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors py-1">
              Skip setup for now
            </button>
          </div>
          <p className="text-slate-600 text-xs mt-8">
            You can update your profile anytime from the Dashboard.
          </p>
        </div>
      )}

      {/* Form steps */}
      {step !== "welcome" && (
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <Scale size={22} />
              <span className="text-lg font-bold">Memo</span>
            </div>
            <p className="text-blue-100 text-sm mt-1">Set up your profile to personalise invoices</p>

            {/* Step progress */}
            <div className="flex items-center gap-1.5 mt-5">
              {formSteps.map((s, i) => {
                const done = i < formIndex;
                const active = i === formIndex;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done   ? "bg-white text-neutral-800" :
                      active ? "bg-white text-neutral-800 ring-2 ring-blue-300 ring-offset-1 ring-offset-blue-600" :
                               "bg-neutral-1000 text-blue-200"
                    }`}>
                      {done ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-xs hidden sm:block ${active ? "text-white font-medium" : "text-blue-300"}`}>
                      {STEP_FORM_LABELS[s]}
                    </span>
                    {i < formSteps.length - 1 && (
                      <div className={`w-5 h-px mx-0.5 ${done ? "bg-white/60" : "bg-blue-400/50"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-4">
            <h2 className="text-lg font-semibold text-neutral-800">{STEP_FORM_LABELS[step]}</h2>

            {step === "identity" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Your Full Name *</label>
                  <input className={inp} placeholder="Adv. Rajesh Kumar" autoFocus
                    value={form.advocateName} onChange={e => set("advocateName", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Firm Name (if applicable)</label>
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

            {step === "contact" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={lbl}>Address Line 1</label>
                  <input className={inp} placeholder="Office No. 5, Legal Chambers" autoFocus
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
                  <label className={lbl}>Website (optional)</label>
                  <input className={inp} placeholder="www.kumarassociates.com"
                    value={form.website} onChange={e => set("website", e.target.value)} />
                </div>
              </div>
            )}

            {step === "bank" && (
              <div className="grid grid-cols-2 gap-4">
                <p className="col-span-2 text-xs text-neutral-500 bg-neutral-100 border border-neutral-200 rounded-lg px-3 py-2">
                  Bank details will appear on your invoices so clients and firms know where to send payment.
                </p>
                <div className="col-span-2">
                  <label className={lbl}>Account Holder Name</label>
                  <input className={inp} placeholder="Rajesh Kumar / Kumar & Associates" autoFocus
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

            {step === "invoice" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Invoice Number Prefix</label>
                    <input className={inp} placeholder="INV" maxLength={10} autoFocus
                      value={form.invoicePrefix} onChange={e => set("invoicePrefix", e.target.value)} />
                    <p className="text-xs text-neutral-400 mt-1">
                      e.g. {form.invoicePrefix || "INV"}-2024-001
                    </p>
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
                    <p className="text-xs text-neutral-400 mt-1">Pre-fills on every new invoice.</p>
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
                        <p className={`text-sm font-medium mt-2 capitalize ${
                          form.invoiceTemplate === t ? "text-neutral-900" : "text-neutral-700"
                        }`}>{t}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center gap-3">
            <button onClick={back}
              className="px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors">
              ← Back
            </button>
            <div className="flex-1" />
            {!isLast ? (
              <button onClick={next} disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors font-medium">
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={finish} disabled={saving}
                className="flex items-center gap-2 px-6 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-40 transition-colors font-medium">
                <Check size={14} />
                {saving ? "Setting up…" : "Finish Setup"}
              </button>
            )}
            {step !== "identity" && (
              <button onClick={finish} disabled={saving}
                className="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
                Skip for now
              </button>
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
