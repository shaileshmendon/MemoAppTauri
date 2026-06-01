/**
 * InvoiceDesigner — two-pane customisation + live PDF preview.
 *
 * Left:  accent colour, content toggles, header note, footer note, custom fields.
 * Right: debounced live iframe PDF preview using sample data.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { Plus, Trash2, Check, RefreshCw } from "lucide-react";
import type { Profile, InvoiceCustomization, InvoiceTemplate } from "../types";
import { DEFAULT_CUSTOMIZATION } from "../types";
import InvoicePDF from "../pdf/InvoicePDF";
import type { Invoice, Matter, MatterParty } from "../types";

// ── Sample data used for live preview ────────────────────────────────────────

const SAMPLE_MATTER: Matter = {
  id: "preview",
  case_title: "ABC Corporation vs. XYZ Limited",
  client_name: "ABC Corporation Pvt. Ltd.",
  client_gstin: "27AABCU9603R1ZM",
  client_state: "Maharashtra",
  client_email: "legal@abccorp.com",
  firm_name: "Mehta & Partners, Advocates",
  firm_gstin: "07AAAFM1234A1ZB",
  firm_state: "Delhi",
  firm_email: "contact@mehtapartners.com",
  court: "Bombay High Court",
  matter_number: "WP/2024/1234",
  matter_type: "litigation",
  status: "active",
  invoice_recipient: "both",
  created_at: new Date().toISOString(),
};

const SAMPLE_INVOICE: Invoice = {
  id: "preview",
  matter_id: "preview",
  invoice_number: "INV-2024-042",
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  recipient_type: "both",
  subtotal_amount: 85000,
  gst_rate: 18,
  cgst: 7650,
  sgst: 7650,
  igst: 0,
  total_amount: 100300,
  status: "sent",
  line_items_data: JSON.stringify([
    { description: "Appearance — Bombay High Court, Hearing (15 Jan 2024)", amount: 25000, type: "appearance" },
    { description: "Appearance — Bombay High Court, Arguments (22 Jan 2024)", amount: 25000, type: "appearance" },
    { description: "Drafting of Written Submissions — 4 hrs @ Rs. 5,000/hr", amount: 20000, type: "time" },
    { description: "Legal Research and Case Analysis — 3 hrs @ Rs. 5,000/hr", amount: 15000, type: "time" },
  ]),
};

const SAMPLE_PARTIES: MatterParty[] = [
  { id: "p1", matter_id: "preview", party_type: "Petitioner", party_number: undefined, party_name: "ABC Corporation Pvt. Ltd." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCENT_SWATCHES = [
  "#1e40af", // Blue (default)
  "#047857", // Emerald
  "#7c3aed", // Violet
  "#b45309", // Amber
  "#dc2626", // Red
  "#0f172a", // Slate dark
  "#374151", // Gray
  "#0369a1", // Sky
];

interface Props {
  profile: Profile;
  onSave: (customization: InvoiceCustomization, template: InvoiceTemplate) => void;
}

export default function InvoiceDesigner({ profile, onSave }: Props) {
  // Start from current profile settings
  const [c, setC] = useState<InvoiceCustomization>({
    ...DEFAULT_CUSTOMIZATION,
    ...(profile.invoiceCustomization ?? {}),
  });
  const [template, setTemplate] = useState<InvoiceTemplate>(profile.invoiceTemplate ?? "modern");
  const [saved, setSaved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a preview profile that merges user's saved profile with current designer state
  const previewProfile: Profile = {
    ...profile,
    invoiceTemplate: template,
    invoiceCustomization: c,
  };

  const generatePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const blob = await pdf(
        <InvoicePDF
          invoice={SAMPLE_INVOICE}
          matter={SAMPLE_MATTER}
          profile={previewProfile}
          parties={SAMPLE_PARTIES}
          customization={c}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      console.error("Preview error", err);
    } finally {
      setPreviewLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, template, profile]);

  // Debounced preview regeneration
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      generatePreview();
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [generatePreview]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setC_ = (patch: Partial<InvoiceCustomization>) =>
    setC(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSave(c, template);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addCustomField = () => {
    if (c.customFields.length >= 5) return;
    setC_(({ customFields: [...c.customFields, { label: "", value: "" }] }));
  };

  const removeCustomField = (i: number) => {
    setC_({ customFields: c.customFields.filter((_, idx) => idx !== i) });
  };

  const updateCustomField = (i: number, key: "label" | "value", val: string) => {
    const fields = c.customFields.map((f, idx) => idx === i ? { ...f, [key]: val } : f);
    setC_({ customFields: fields });
  };

  const inp = "border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-800 focus:ring-1 focus:ring-neutral-200 bg-white w-full";
  const tog = (on: boolean) =>
    `relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${on ? "bg-neutral-900" : "bg-neutral-300"}`;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel: controls ── */}
      <div className="w-80 shrink-0 border-r border-neutral-100 overflow-y-auto">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Invoice Designer</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Customise your invoice appearance</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
          >
            {saved ? <><Check size={12} /> Saved!</> : "Save"}
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Template selector */}
          <section>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Template</p>
            <div className="grid grid-cols-3 gap-2">
              {(["modern", "classic", "minimal"] as InvoiceTemplate[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`border-2 rounded-xl p-2 text-left transition-all ${
                    template === t ? "border-neutral-900 bg-neutral-100" : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <TemplateMini template={t} accent={c.accentColor} />
                  <p className={`text-xs font-medium mt-1.5 capitalize ${template === t ? "text-neutral-900" : "text-neutral-600"}`}>
                    {t}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Accent colour — only meaningful for Modern */}
          {template === "modern" && (
            <section>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Accent Colour</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {ACCENT_SWATCHES.map(sw => (
                  <button
                    key={sw}
                    title={sw}
                    onClick={() => setC_({ accentColor: sw })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${c.accentColor === sw ? "border-neutral-700 scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: sw }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={c.accentColor}
                  onChange={e => setC_({ accentColor: e.target.value })}
                  className="w-8 h-8 rounded border border-neutral-200 cursor-pointer p-0.5"
                />
                <span className="text-xs text-neutral-500 font-mono">{c.accentColor}</span>
              </div>
            </section>
          )}

          {/* Content toggles */}
          <section>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Show / Hide Sections</p>
            <div className="space-y-3">
              {([
                { key: "showGstBreakdown", label: "GST Breakdown (CGST / SGST / IGST)" },
                { key: "showBankDetails",  label: "Bank / Payment Details" },
                { key: "showSignature",    label: "Signature Line" },
                { key: "showMatterInfo",   label: "Matter Name & Number" },
              ] as { key: keyof InvoiceCustomization; label: string }[]).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-700">{label}</span>
                  <button
                    role="switch"
                    aria-checked={c[key] as boolean}
                    className={tog(c[key] as boolean)}
                    onClick={() => setC_({ [key]: !(c[key] as boolean) })}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${c[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Header note */}
          <section>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Header Note</p>
            <input
              className={inp}
              placeholder="e.g. Enrolled as Advocate-on-Record, Supreme Court"
              value={c.headerNote}
              onChange={e => setC_({ headerNote: e.target.value })}
            />
            <p className="text-xs text-neutral-400 mt-1">Appears below your name/address in the header.</p>
          </section>

          {/* Footer note */}
          <section>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Footer Note</p>
            <input
              className={inp}
              placeholder="e.g. Subject to Mumbai jurisdiction only."
              value={c.footerNote}
              onChange={e => setC_({ footerNote: e.target.value })}
            />
            <p className="text-xs text-neutral-400 mt-1">Printed at the very bottom of the invoice.</p>
          </section>

          {/* Custom fields */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Custom Fields</p>
              {c.customFields.length < 5 && (
                <button
                  onClick={addCustomField}
                  className="flex items-center gap-1 text-xs text-neutral-800 hover:text-neutral-900 font-medium"
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-400 mb-3">e.g. PAN, Registration No. — appear in invoice header.</p>
            {c.customFields.length === 0 && (
              <p className="text-xs text-neutral-300 italic text-center py-3">No custom fields yet</p>
            )}
            {c.customFields.map((f, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input
                  className={`${inp} flex-1`}
                  placeholder="Label"
                  value={f.label}
                  onChange={e => updateCustomField(i, "label", e.target.value)}
                />
                <input
                  className={`${inp} flex-1`}
                  placeholder="Value"
                  value={f.value}
                  onChange={e => updateCustomField(i, "value", e.target.value)}
                />
                <button
                  onClick={() => removeCustomField(i)}
                  className="shrink-0 text-neutral-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </section>
        </div>
      </div>

      {/* ── Right panel: live preview ── */}
      <div className="flex-1 flex flex-col bg-neutral-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-white border-b border-neutral-200 flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-neutral-500">Live Preview</span>
          {previewLoading && (
            <span className="flex items-center gap-1 text-xs text-neutral-600">
              <RefreshCw size={11} className="animate-spin" /> Updating…
            </span>
          )}
          <span className="ml-auto text-xs text-neutral-400">Sample data — your actual invoice will use real matter details</span>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          {previewUrl ? (
            <iframe
              key={previewUrl}
              src={previewUrl}
              className="w-full h-full rounded-lg shadow-lg border border-neutral-200 bg-white"
              title="Invoice Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
              {previewLoading ? "Generating preview…" : "Preview will appear here"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mini template thumbnails ──────────────────────────────────────────────────

function TemplateMini({ template, accent }: { template: InvoiceTemplate; accent: string }) {
  if (template === "modern") return (
    <div className="rounded overflow-hidden border border-neutral-200 bg-white" style={{ height: 60 }}>
      <div className="h-4 px-1.5 flex items-center" style={{ backgroundColor: accent }}>
        <div className="bg-white/70 rounded h-1 w-8" />
      </div>
      <div className="p-1 space-y-0.5">
        <div className="bg-neutral-200 h-0.5 w-10 rounded" />
        <div className="mt-1 space-y-0.5">
          <div className="flex gap-0.5"><div className="bg-neutral-100 h-0.5 flex-1 rounded" /><div className="bg-neutral-200 h-0.5 w-4 rounded" /></div>
          <div className="flex gap-0.5"><div className="bg-neutral-100 h-0.5 flex-1 rounded" /><div className="bg-neutral-200 h-0.5 w-4 rounded" /></div>
        </div>
        <div className="flex justify-end mt-0.5">
          <div className="h-1 w-8 rounded" style={{ backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
  if (template === "classic") return (
    <div className="rounded overflow-hidden border-2 border-neutral-800 bg-white" style={{ height: 60 }}>
      <div className="border-b-2 border-neutral-800 p-1">
        <div className="bg-neutral-800 h-1.5 w-10 rounded" />
        <div className="bg-neutral-400 h-0.5 w-8 rounded mt-0.5" />
      </div>
      <div className="p-1 space-y-0.5">
        <div className="flex gap-0.5"><div className="bg-neutral-100 h-0.5 flex-1 rounded" /><div className="bg-neutral-200 h-0.5 w-4 rounded" /></div>
        <div className="flex gap-0.5"><div className="bg-neutral-100 h-0.5 flex-1 rounded" /><div className="bg-neutral-200 h-0.5 w-4 rounded" /></div>
        <div className="flex justify-end mt-0.5"><div className="bg-neutral-800 h-1 w-7 rounded" /></div>
      </div>
    </div>
  );
  return (
    <div className="rounded overflow-hidden border border-neutral-200 bg-white" style={{ height: 60 }}>
      <div className="p-1">
        <div className="bg-neutral-800 h-1.5 w-12 rounded" />
        <div className="bg-neutral-300 h-px w-full mt-1 mb-1" />
        <div className="space-y-0.5">
          <div className="flex gap-0.5"><div className="bg-neutral-100 h-0.5 flex-1 rounded" /><div className="bg-neutral-200 h-0.5 w-4 rounded" /></div>
          <div className="flex gap-0.5"><div className="bg-neutral-100 h-0.5 flex-1 rounded" /><div className="bg-neutral-200 h-0.5 w-4 rounded" /></div>
        </div>
        <div className="flex justify-end mt-1"><div className="bg-neutral-700 h-1 w-7 rounded" /></div>
      </div>
    </div>
  );
}
