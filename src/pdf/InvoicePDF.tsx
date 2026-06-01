import {
  Document, Page, Text, View, StyleSheet,
} from "@react-pdf/renderer";
import type { Invoice, Matter, Profile, LineItem, MatterParty, InvoiceCustomization, ContactPerson } from "../types";
import { formatParty, DEFAULT_CUSTOMIZATION } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function inr(n: number): string {
  // Use "Rs." prefix — built-in PDF fonts (Helvetica/Times) don't contain the ₹ glyph
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2, minimumFractionDigits: 2,
  }).format(n);
  return `Rs. ${formatted}`;
}

// ── Number to words (Indian system) ─────────────────────────────────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsBelow100(n: number): string {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")).trim();
}

function wordsBelow1000(n: number): string {
  if (n < 100) return wordsBelow100(n);
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + wordsBelow100(n % 100) : "");
}

function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const rupees  = Math.floor(rounded);
  const paise   = Math.round((rounded - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const parts: string[] = [];

  const crore = Math.floor(rupees / 10000000);
  const lakh  = Math.floor((rupees % 10000000) / 100000);
  const thou  = Math.floor((rupees % 100000) / 1000);
  const rem   = rupees % 1000;

  if (crore) parts.push(wordsBelow1000(crore) + " Crore");
  if (lakh)  parts.push(wordsBelow1000(lakh)  + " Lakh");
  if (thou)  parts.push(wordsBelow1000(thou)  + " Thousand");
  if (rem)   parts.push(wordsBelow1000(rem));

  let result = "Rupees " + parts.join(" ");
  if (paise) result += " and " + wordsBelow100(paise) + " Paise";
  return result + " Only";
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return d;
  }
}

function addressLines(p: Profile): string[] {
  return [
    p.addressLine1,
    p.addressLine2,
    [p.city, p.state, p.pincode].filter(Boolean).join(", "),
  ].filter(Boolean);
}

/** Determine whether a contact-person mode is active for a given side. */
function useContactSide(
  invoice: Invoice,
  side: "firm" | "client",
  contact?: ContactPerson,
): boolean {
  if (!contact) return false;
  const m = invoice.address_mode;
  if (!m) return false;
  if (side === "firm")   return m === "contact_firm"   || m === "contact_both";
  if (side === "client") return m === "contact_client" || m === "contact_both";
  return false;
}

/** Determine whether an org side should be shown. */
function showOrgSide(invoice: Invoice, side: "firm" | "client"): boolean {
  const m = invoice.address_mode;
  // Fall back to recipient_type for older invoices without address_mode
  if (!m) {
    if (side === "firm")   return invoice.recipient_type === "firm"   || invoice.recipient_type === "both";
    if (side === "client") return invoice.recipient_type === "client" || invoice.recipient_type === "both";
    return false;
  }
  if (side === "firm")   return m === "org_firm"   || m === "org_both";
  if (side === "client") return m === "org_client" || m === "org_both";
  return false;
}

// ── Modern template ──────────────────────────────────────────────────────────

const modernStyles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a", backgroundColor: "#ffffff" },
  header: { backgroundColor: "#1e40af", paddingHorizontal: 36, paddingVertical: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flex: 1 },
  headerName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 3 },
  headerSub: { fontSize: 8, color: "#bfdbfe", marginBottom: 1 },
  headerRight: { alignItems: "flex-end" },
  invoiceLabel: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#ffffff", opacity: 0.9 },
  invoiceNum: { fontSize: 9, color: "#bfdbfe", marginTop: 2 },
  body: { paddingHorizontal: 36, paddingTop: 24 },
  twoCol: { flexDirection: "row", gap: 20, marginBottom: 20 },
  col: { flex: 1 },
  sectionLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingBottom: 3 },
  field: { marginBottom: 3 },
  fieldLabel: { fontSize: 7, color: "#9ca3af", marginBottom: 1 },
  fieldVal: { fontSize: 8.5, color: "#111827" },
  table: { marginTop: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1e40af", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 3 },
  tableHeaderText: { color: "#ffffff", fontSize: 8, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  descCol: { flex: 1 },
  amtCol: { width: 70, textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  totalLabel: { fontSize: 8, color: "#6b7280", width: 90, textAlign: "right", marginRight: 12 },
  totalVal: { fontSize: 8, color: "#374151", width: 70, textAlign: "right" },
  grandRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, backgroundColor: "#1e40af", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  grandLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff", width: 90, textAlign: "right", marginRight: 12 },
  grandVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff", width: 70, textAlign: "right" },
  bank: { marginTop: 20, backgroundColor: "#f0f9ff", borderRadius: 6, padding: 12 },
  bankTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1e40af", marginBottom: 6 },
  bankRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  bankItem: { marginBottom: 3 },
  notes: { marginTop: 16, fontSize: 8, color: "#6b7280", fontStyle: "italic" },
  footer: { marginTop: 20, borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#9ca3af" },
  sig: { marginTop: 32, alignItems: "flex-end" },
  sigLine: { width: 120, borderTopWidth: 0.5, borderTopColor: "#6b7280", paddingTop: 4, fontSize: 8, color: "#6b7280", textAlign: "center" },
});

function ModernTemplate({ invoice, matter, profile, lineItems, parties, c, clientContact, firmContact }: TemplateProps) {
  const addr = addressLines(profile);
  const accent = c.accentColor;
  return (
    <Page size="A4" style={modernStyles.page}>
      {/* Header */}
      <View style={[modernStyles.header, { backgroundColor: accent }]}>
        <View style={modernStyles.headerLeft}>
          <Text style={modernStyles.headerName}>{profile.firmName || profile.advocateName}</Text>
          {profile.firmName && <Text style={modernStyles.headerSub}>{profile.advocateName}</Text>}
          <Text style={modernStyles.headerSub}>{profile.designation}</Text>
          {profile.barCouncilNumber ? <Text style={modernStyles.headerSub}>Enr. No: {profile.barCouncilNumber}</Text> : null}
          {addr.map((l, i) => <Text key={i} style={modernStyles.headerSub}>{l}</Text>)}
          {profile.phone ? <Text style={modernStyles.headerSub}>{profile.phone}</Text> : null}
          {profile.email ? <Text style={modernStyles.headerSub}>{profile.email}</Text> : null}
          {profile.gstin ? <Text style={modernStyles.headerSub}>GSTIN: {profile.gstin}</Text> : null}
          {c.headerNote ? <Text style={[modernStyles.headerSub, { marginTop: 4, fontStyle: "italic" }]}>{c.headerNote}</Text> : null}
          {/* Custom fields in header */}
          {c.customFields.length > 0 && (
            <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {c.customFields.filter(f => f.label && f.value).map((f, i) => (
                <Text key={i} style={[modernStyles.headerSub, { marginTop: 0 }]}>
                  {f.label}: {f.value}
                </Text>
              ))}
            </View>
          )}
        </View>
        <View style={modernStyles.headerRight}>
          <Text style={modernStyles.invoiceLabel}>Memorandum of Fees</Text>
          <Text style={modernStyles.invoiceNum}>{invoice.invoice_number}</Text>
        </View>
      </View>

      <View style={modernStyles.body}>
        {/* Bill To — driven by address_mode / contact persons */}
        <View style={modernStyles.twoCol}>
          {/* Left column: AOR/Firm (org or contact) */}
          {useContactSide(invoice, "firm", firmContact) ? (
            <View style={modernStyles.col}>
              <Text style={modernStyles.sectionLabel}>Bill To — AOR / Firm</Text>
              <Text style={[modernStyles.fieldVal, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>{firmContact!.name}</Text>
              {firmContact!.designation ? <Text style={modernStyles.fieldVal}>{firmContact!.designation}</Text> : null}
              {(firmContact!.company || matter.firm_name) ? <Text style={modernStyles.fieldVal}>{firmContact!.company || matter.firm_name}</Text> : null}
              {firmContact!.email   ? <Text style={modernStyles.fieldVal}>{firmContact!.email}</Text>   : null}
              {firmContact!.phone   ? <Text style={modernStyles.fieldVal}>{firmContact!.phone}</Text>   : null}
              {firmContact!.address ? <Text style={modernStyles.fieldVal}>{firmContact!.address}</Text> : null}
            </View>
          ) : showOrgSide(invoice, "firm") && matter.firm_name ? (
            <View style={modernStyles.col}>
              <Text style={modernStyles.sectionLabel}>
                {(invoice.address_mode === "org_firm" || invoice.recipient_type === "firm") ? "Bill To — AOR / Firm" : "Engaged by (AOR / Firm)"}
              </Text>
              <Text style={[modernStyles.fieldVal, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>{matter.firm_name}</Text>
              {matter.firm_gstin ? <Text style={modernStyles.fieldVal}>GSTIN: {matter.firm_gstin}</Text> : null}
              {matter.firm_state  ? <Text style={modernStyles.fieldVal}>State: {matter.firm_state}</Text>  : null}
              {matter.firm_email  ? <Text style={modernStyles.fieldVal}>{matter.firm_email}</Text>  : null}
            </View>
          ) : <View style={modernStyles.col} />}

          {/* Right column: Client (org or contact) */}
          {useContactSide(invoice, "client", clientContact) ? (
            <View style={modernStyles.col}>
              <Text style={modernStyles.sectionLabel}>Bill To — Client</Text>
              <Text style={[modernStyles.fieldVal, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>{clientContact!.name}</Text>
              {clientContact!.designation ? <Text style={modernStyles.fieldVal}>{clientContact!.designation}</Text> : null}
              {(clientContact!.company || matter.client_name) ? <Text style={modernStyles.fieldVal}>{clientContact!.company || matter.client_name}</Text> : null}
              {clientContact!.email   ? <Text style={modernStyles.fieldVal}>{clientContact!.email}</Text>   : null}
              {clientContact!.phone   ? <Text style={modernStyles.fieldVal}>{clientContact!.phone}</Text>   : null}
              {clientContact!.address ? <Text style={modernStyles.fieldVal}>{clientContact!.address}</Text> : null}
            </View>
          ) : showOrgSide(invoice, "client") ? (
            <View style={modernStyles.col}>
              <Text style={modernStyles.sectionLabel}>
                {(invoice.address_mode === "org_client" || invoice.recipient_type === "client") ? "Bill To — Client" : "Client"}
              </Text>
              <Text style={[modernStyles.fieldVal, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>{matter.client_name}</Text>
              {matter.client_gstin ? <Text style={modernStyles.fieldVal}>GSTIN: {matter.client_gstin}</Text> : null}
              {matter.client_state  ? <Text style={modernStyles.fieldVal}>State: {matter.client_state}</Text>  : null}
              {matter.client_email  ? <Text style={modernStyles.fieldVal}>{matter.client_email}</Text>  : null}
            </View>
          ) : (
            <View style={modernStyles.col}>
              <Text style={modernStyles.sectionLabel}>Client (for the matter of)</Text>
              <Text style={[modernStyles.fieldVal, { marginBottom: 2 }]}>{matter.client_name}</Text>
            </View>
          )}
        </View>

        {/* Invoice details row */}
        <View style={[modernStyles.twoCol, { backgroundColor: "#f8fafc", borderRadius: 6, padding: 10, marginBottom: 4 }]}>
          <View style={modernStyles.field}>
            <Text style={modernStyles.fieldLabel}>Invoice No.</Text>
            <Text style={modernStyles.fieldVal}>{invoice.invoice_number}</Text>
          </View>
          <View style={modernStyles.field}>
            <Text style={modernStyles.fieldLabel}>Invoice Date</Text>
            <Text style={modernStyles.fieldVal}>{fmtDate(invoice.invoice_date)}</Text>
          </View>
          {invoice.due_date ? (
            <View style={modernStyles.field}>
              <Text style={modernStyles.fieldLabel}>Due Date</Text>
              <Text style={modernStyles.fieldVal}>{fmtDate(invoice.due_date)}</Text>
            </View>
          ) : null}
          {c.showMatterInfo && (
            <View style={modernStyles.field}>
              <Text style={modernStyles.fieldLabel}>Matter</Text>
              <Text style={modernStyles.fieldVal}>{matter.case_title}</Text>
            </View>
          )}
          {c.showMatterInfo && matter.matter_number ? (
            <View style={modernStyles.field}>
              <Text style={modernStyles.fieldLabel}>Matter No.</Text>
              <Text style={modernStyles.fieldVal}>{matter.matter_number}</Text>
            </View>
          ) : null}
        </View>

        {/* Appearing for */}
        {parties.length > 0 && (
          <View style={{ marginBottom: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#eff6ff", borderRadius: 4 }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#1e40af", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>
              Appearing for
            </Text>
            <Text style={{ fontSize: 8.5, color: "#1e3a8a" }}>
              {parties.map(formatParty).join("  ·  ")}
            </Text>
          </View>
        )}

        {/* Line items table */}
        <View style={modernStyles.table}>
          <View style={[modernStyles.tableHeader, { backgroundColor: accent }]}>
            <Text style={[modernStyles.tableHeaderText, modernStyles.descCol]}>Description</Text>
            <Text style={[modernStyles.tableHeaderText, modernStyles.amtCol]}>Amount</Text>
          </View>
          {lineItems.map((li, i) => (
            <View key={i} style={[modernStyles.tableRow, i % 2 === 1 ? modernStyles.tableRowAlt : {}]}>
              <Text style={[{ fontSize: 8.5, color: "#374151" }, modernStyles.descCol]}>{li.description}</Text>
              <Text style={[{ fontSize: 8.5, color: "#374151" }, modernStyles.amtCol]}>{inr(li.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={modernStyles.totals}>
          <View style={modernStyles.totalRow}>
            <Text style={modernStyles.totalLabel}>Subtotal</Text>
            <Text style={modernStyles.totalVal}>{inr(invoice.subtotal_amount)}</Text>
          </View>
          {c.showGstBreakdown && invoice.cgst > 0 && <>
            <View style={modernStyles.totalRow}>
              <Text style={modernStyles.totalLabel}>CGST ({invoice.gst_rate / 2}%)</Text>
              <Text style={modernStyles.totalVal}>{inr(invoice.cgst)}</Text>
            </View>
            <View style={modernStyles.totalRow}>
              <Text style={modernStyles.totalLabel}>SGST ({invoice.gst_rate / 2}%)</Text>
              <Text style={modernStyles.totalVal}>{inr(invoice.sgst)}</Text>
            </View>
          </>}
          {c.showGstBreakdown && invoice.igst > 0 && (
            <View style={modernStyles.totalRow}>
              <Text style={modernStyles.totalLabel}>IGST ({invoice.gst_rate}%)</Text>
              <Text style={modernStyles.totalVal}>{inr(invoice.igst)}</Text>
            </View>
          )}
          <View style={[modernStyles.grandRow, { backgroundColor: accent }]}>
            <Text style={modernStyles.grandLabel}>Total</Text>
            <Text style={modernStyles.grandVal}>{inr(invoice.total_amount)}</Text>
          </View>
          <View style={{ marginTop: 5, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 7.5, color: "#4b5563", fontStyle: "italic" }}>
              {amountInWords(invoice.total_amount)}
            </Text>
          </View>
        </View>

        {/* Bank details */}
        {c.showBankDetails && (profile.bankName || profile.accountNumber) && (
          <View style={modernStyles.bank}>
            <Text style={[modernStyles.bankTitle, { color: accent }]}>Payment Details</Text>
            <View style={modernStyles.bankRow}>
              {profile.accountHolder ? <BankField label="Account Name" val={profile.accountHolder} /> : null}
              {profile.bankName      ? <BankField label="Bank"         val={profile.bankName}      /> : null}
              {profile.bankBranch   ? <BankField label="Branch"        val={profile.bankBranch}    /> : null}
              {profile.accountNumber ? <BankField label="Account No."  val={profile.accountNumber} /> : null}
              {profile.ifscCode      ? <BankField label="IFSC"         val={profile.ifscCode}      /> : null}
              {profile.upiId         ? <BankField label="UPI"          val={profile.upiId}         /> : null}
            </View>
          </View>
        )}

        {/* Notes */}
        {invoice.notes ? <Text style={modernStyles.notes}>{invoice.notes}</Text> : null}

        {/* Signature */}
        {c.showSignature && (
          <View style={modernStyles.sig}>
            <Text style={modernStyles.sigLine}>{profile.signatureText || profile.advocateName || "Authorised Signatory"}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={modernStyles.footer}>
          <Text style={modernStyles.footerText}>
            {profile.advocateName}{profile.barCouncilNumber ? ` · Enr. ${profile.barCouncilNumber}` : ""}
          </Text>
          <Text style={modernStyles.footerText}>{invoice.invoice_number}</Text>
        </View>
        {c.footerNote ? (
          <Text style={[modernStyles.footerText, { textAlign: "center", marginTop: 4, fontStyle: "italic" }]}>
            {c.footerNote}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}

function BankField({ label, val }: { label: string; val: string }) {
  return (
    <View style={{ marginBottom: 2, marginRight: 12 }}>
      <Text style={{ fontSize: 7, color: "#6b7280" }}>{label}</Text>
      <Text style={{ fontSize: 8, color: "#111827" }}>{val}</Text>
    </View>
  );
}

// ── Classic template ──────────────────────────────────────────────────────────

const classicStyles = StyleSheet.create({
  page: { fontFamily: "Times-Roman", fontSize: 9.5, color: "#111111", backgroundColor: "#ffffff", paddingHorizontal: 48, paddingVertical: 48 },
  border: { borderWidth: 1.5, borderColor: "#111111", padding: 24 },
  heading: { textAlign: "center", marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 12 },
  firmName: { fontSize: 18, fontFamily: "Times-Bold", marginBottom: 2 },
  firmSub: { fontSize: 9, marginBottom: 1 },
  invoiceTitle: { fontSize: 13, fontFamily: "Times-Bold", marginTop: 10, letterSpacing: 1 },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  col: { flex: 1 },
  label: { fontSize: 8, fontFamily: "Times-Bold", marginBottom: 1 },
  val: { fontSize: 9, marginBottom: 2 },
  tableHeader: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#111111", paddingVertical: 5, marginTop: 12 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 5 },
  desc: { flex: 1, fontSize: 9 },
  amt: { width: 80, textAlign: "right", fontSize: 9 },
  labelBold: { fontFamily: "Times-Bold", fontSize: 9 },
  totalSection: { marginTop: 8, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  tLabel: { width: 100, textAlign: "right", fontSize: 9, marginRight: 12 },
  tVal: { width: 80, textAlign: "right", fontSize: 9 },
  tLabelBold: { width: 100, textAlign: "right", fontSize: 10, fontFamily: "Times-Bold", marginRight: 12, borderTopWidth: 1, borderTopColor: "#111111", paddingTop: 3 },
  tValBold: { width: 80, textAlign: "right", fontSize: 10, fontFamily: "Times-Bold", borderTopWidth: 1, borderTopColor: "#111111", paddingTop: 3 },
  bank: { marginTop: 20, borderTopWidth: 0.5, borderTopColor: "#999999", paddingTop: 10 },
  bankTitle: { fontSize: 9, fontFamily: "Times-Bold", marginBottom: 4 },
  bankText: { fontSize: 8.5 },
  sig: { marginTop: 40, alignItems: "flex-end" },
  sigLine: { width: 140, borderTopWidth: 1, borderTopColor: "#111111", paddingTop: 4, fontSize: 8.5, textAlign: "center" },
  notes: { marginTop: 12, fontSize: 8.5, fontStyle: "italic", color: "#555555" },
});

function ClassicTemplate({ invoice, matter, profile, lineItems, parties, c, clientContact, firmContact }: TemplateProps) {
  const addr = addressLines(profile);
  return (
    <Page size="A4" style={classicStyles.page}>
      <View style={classicStyles.border}>
        {/* Letterhead */}
        <View style={classicStyles.heading}>
          <Text style={classicStyles.firmName}>{profile.firmName || profile.advocateName}</Text>
          {profile.firmName && <Text style={classicStyles.firmSub}>{profile.advocateName}</Text>}
          <Text style={classicStyles.firmSub}>{profile.designation}</Text>
          {profile.barCouncilNumber ? <Text style={classicStyles.firmSub}>Bar Enrolment: {profile.barCouncilNumber}</Text> : null}
          {addr.map((l, i) => <Text key={i} style={classicStyles.firmSub}>{l}</Text>)}
          {profile.phone ? <Text style={classicStyles.firmSub}>Tel: {profile.phone}</Text> : null}
          {profile.email ? <Text style={classicStyles.firmSub}>{profile.email}</Text> : null}
          {profile.gstin ? <Text style={classicStyles.firmSub}>GSTIN: {profile.gstin}</Text> : null}
          {c.headerNote ? <Text style={[classicStyles.firmSub, { fontStyle: "italic", marginTop: 3 }]}>{c.headerNote}</Text> : null}
          {c.customFields.filter(f => f.label && f.value).map((f, i) => (
            <Text key={i} style={classicStyles.firmSub}>{f.label}: {f.value}</Text>
          ))}
          <Text style={classicStyles.invoiceTitle}>Memorandum of Fees</Text>
        </View>

        {/* Invoice meta */}
        <View style={[classicStyles.twoCol, { marginBottom: 10 }]}>
          <View style={classicStyles.col} />
          <View style={[classicStyles.col, { alignItems: "flex-end" }]}>
            <Text style={classicStyles.label}>Invoice No.: <Text style={{ fontFamily: "Times-Roman" }}>{invoice.invoice_number}</Text></Text>
            <Text style={classicStyles.label}>Date: <Text style={{ fontFamily: "Times-Roman" }}>{fmtDate(invoice.invoice_date)}</Text></Text>
            {invoice.due_date ? <Text style={classicStyles.label}>Due: <Text style={{ fontFamily: "Times-Roman" }}>{fmtDate(invoice.due_date)}</Text></Text> : null}
            {c.showMatterInfo && <Text style={classicStyles.label}>Matter: <Text style={{ fontFamily: "Times-Roman" }}>{matter.case_title}</Text></Text>}
            {c.showMatterInfo && matter.matter_number ? <Text style={classicStyles.label}>Matter No.: <Text style={{ fontFamily: "Times-Roman" }}>{matter.matter_number}</Text></Text> : null}
          </View>
        </View>

        {/* Bill To */}
        <View style={[classicStyles.twoCol, { borderTopWidth: 0.5, borderTopColor: "#999999", borderBottomWidth: 0.5, borderBottomColor: "#999999", paddingVertical: 8, marginBottom: 10 }]}>
          {useContactSide(invoice, "firm", firmContact) ? (
            <View style={classicStyles.col}>
              <Text style={classicStyles.label}>Bill To (AOR / Firm):</Text>
              <Text style={[classicStyles.val, { fontFamily: "Times-Bold" }]}>{firmContact!.name}</Text>
              {firmContact!.designation ? <Text style={classicStyles.val}>{firmContact!.designation}</Text> : null}
              {(firmContact!.company || matter.firm_name) ? <Text style={classicStyles.val}>{firmContact!.company || matter.firm_name}</Text> : null}
              {firmContact!.email   ? <Text style={classicStyles.val}>{firmContact!.email}</Text>   : null}
              {firmContact!.address ? <Text style={classicStyles.val}>{firmContact!.address}</Text> : null}
            </View>
          ) : showOrgSide(invoice, "firm") && matter.firm_name ? (
            <View style={classicStyles.col}>
              <Text style={classicStyles.label}>{(invoice.address_mode === "org_firm" || invoice.recipient_type === "firm") ? "Bill To (AOR / Firm):" : "Engaged by (AOR / Firm):"}</Text>
              <Text style={[classicStyles.val, { fontFamily: "Times-Bold" }]}>{matter.firm_name}</Text>
              {matter.firm_gstin ? <Text style={classicStyles.val}>GSTIN: {matter.firm_gstin}</Text> : null}
              {matter.firm_email  ? <Text style={classicStyles.val}>{matter.firm_email}</Text>  : null}
            </View>
          ) : <View style={classicStyles.col} />}

          {useContactSide(invoice, "client", clientContact) ? (
            <View style={classicStyles.col}>
              <Text style={classicStyles.label}>Bill To (Client):</Text>
              <Text style={[classicStyles.val, { fontFamily: "Times-Bold" }]}>{clientContact!.name}</Text>
              {clientContact!.designation ? <Text style={classicStyles.val}>{clientContact!.designation}</Text> : null}
              {(clientContact!.company || matter.client_name) ? <Text style={classicStyles.val}>{clientContact!.company || matter.client_name}</Text> : null}
              {clientContact!.email   ? <Text style={classicStyles.val}>{clientContact!.email}</Text>   : null}
              {clientContact!.address ? <Text style={classicStyles.val}>{clientContact!.address}</Text> : null}
            </View>
          ) : showOrgSide(invoice, "client") ? (
            <View style={classicStyles.col}>
              <Text style={classicStyles.label}>{(invoice.address_mode === "org_client" || invoice.recipient_type === "client") ? "Bill To (Client):" : "Client:"}</Text>
              <Text style={[classicStyles.val, { fontFamily: "Times-Bold" }]}>{matter.client_name}</Text>
              {matter.client_gstin ? <Text style={classicStyles.val}>GSTIN: {matter.client_gstin}</Text> : null}
              {matter.client_email  ? <Text style={classicStyles.val}>{matter.client_email}</Text>  : null}
            </View>
          ) : (
            <View style={classicStyles.col}>
              <Text style={classicStyles.label}>Client (for the matter of):</Text>
              <Text style={classicStyles.val}>{matter.client_name}</Text>
            </View>
          )}
        </View>

        {/* Appearing for */}
        {parties.length > 0 && (
          <View style={{ marginBottom: 8, borderTopWidth: 0.5, borderTopColor: "#999999", paddingTop: 6 }}>
            <Text style={{ fontSize: 8.5, fontFamily: "Times-Bold" }}>
              Appearing for:{" "}
              <Text style={{ fontFamily: "Times-Roman" }}>
                {parties.map(formatParty).join(", ")}
              </Text>
            </Text>
          </View>
        )}

        {/* Table */}
        <View style={classicStyles.tableHeader}>
          <Text style={[classicStyles.desc, { fontFamily: "Times-Bold" }]}>Description</Text>
          <Text style={[classicStyles.amt, { fontFamily: "Times-Bold" }]}>Amount</Text>
        </View>
        {lineItems.map((li, i) => (
          <View key={i} style={classicStyles.tableRow}>
            <Text style={classicStyles.desc}>{li.description}</Text>
            <Text style={classicStyles.amt}>{inr(li.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={classicStyles.totalSection}>
          <View style={classicStyles.totalRow}>
            <Text style={classicStyles.tLabel}>Subtotal</Text>
            <Text style={classicStyles.tVal}>{inr(invoice.subtotal_amount)}</Text>
          </View>
          {c.showGstBreakdown && invoice.cgst > 0 && <>
            <View style={classicStyles.totalRow}>
              <Text style={classicStyles.tLabel}>CGST ({invoice.gst_rate / 2}%)</Text>
              <Text style={classicStyles.tVal}>{inr(invoice.cgst)}</Text>
            </View>
            <View style={classicStyles.totalRow}>
              <Text style={classicStyles.tLabel}>SGST ({invoice.gst_rate / 2}%)</Text>
              <Text style={classicStyles.tVal}>{inr(invoice.sgst)}</Text>
            </View>
          </>}
          {c.showGstBreakdown && invoice.igst > 0 && (
            <View style={classicStyles.totalRow}>
              <Text style={classicStyles.tLabel}>IGST ({invoice.gst_rate}%)</Text>
              <Text style={classicStyles.tVal}>{inr(invoice.igst)}</Text>
            </View>
          )}
          <View style={classicStyles.totalRow}>
            <Text style={classicStyles.tLabelBold}>Total</Text>
            <Text style={classicStyles.tValBold}>{inr(invoice.total_amount)}</Text>
          </View>
          <View style={{ marginTop: 6, borderTopWidth: 0.5, borderTopColor: "#cccccc", paddingTop: 5 }}>
            <Text style={{ fontSize: 8, color: "#444444", fontStyle: "italic" }}>
              Amount in words: {amountInWords(invoice.total_amount)}
            </Text>
          </View>
        </View>

        {/* Bank */}
        {c.showBankDetails && (profile.bankName || profile.accountNumber) && (
          <View style={classicStyles.bank}>
            <Text style={classicStyles.bankTitle}>Payment Details</Text>
            {profile.accountHolder ? <Text style={classicStyles.bankText}>Account Name: {profile.accountHolder}</Text> : null}
            {profile.bankName      ? <Text style={classicStyles.bankText}>Bank: {profile.bankName}{profile.bankBranch ? `, ${profile.bankBranch}` : ""}</Text> : null}
            {profile.accountNumber ? <Text style={classicStyles.bankText}>Account No.: {profile.accountNumber}</Text> : null}
            {profile.ifscCode      ? <Text style={classicStyles.bankText}>IFSC: {profile.ifscCode}</Text> : null}
            {profile.upiId         ? <Text style={classicStyles.bankText}>UPI: {profile.upiId}</Text> : null}
          </View>
        )}

        {invoice.notes ? <Text style={classicStyles.notes}>{invoice.notes}</Text> : null}

        {/* Signature */}
        {c.showSignature && (
          <View style={classicStyles.sig}>
            <Text style={classicStyles.sigLine}>{profile.signatureText || profile.advocateName || "Authorised Signatory"}</Text>
          </View>
        )}

        {c.footerNote ? (
          <Text style={{ marginTop: 12, fontSize: 8, color: "#666666", fontStyle: "italic", textAlign: "center" }}>
            {c.footerNote}
          </Text>
        ) : null}
      </View>
    </Page>
  );
}

// ── Minimal template ──────────────────────────────────────────────────────────

const minimalStyles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: "#333333", backgroundColor: "#ffffff", paddingHorizontal: 52, paddingVertical: 52 },
  firmName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#111111", marginBottom: 2 },
  firmSub: { fontSize: 8, color: "#888888", marginBottom: 1 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#dddddd", marginVertical: 16 },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  col: { flex: 1 },
  label: { fontSize: 7, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  val: { fontSize: 9, color: "#222222", marginBottom: 1 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cccccc", paddingBottom: 5, marginBottom: 2 },
  tableHeaderText: { fontSize: 7.5, color: "#888888", textTransform: "uppercase", letterSpacing: 0.3 },
  tableRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.3, borderBottomColor: "#eeeeee" },
  desc: { flex: 1, fontSize: 8.5, color: "#333333" },
  amt: { width: 80, textAlign: "right", fontSize: 8.5, color: "#333333" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", marginBottom: 2 },
  tLabel: { fontSize: 8, color: "#888888", width: 100, textAlign: "right", marginRight: 12 },
  tVal: { fontSize: 8, color: "#333333", width: 80, textAlign: "right" },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111111", width: 100, textAlign: "right", marginRight: 12, marginTop: 8 },
  grandVal: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111111", width: 80, textAlign: "right", marginTop: 8 },
  bank: { marginTop: 24, backgroundColor: "#f9f9f9", padding: 12, borderRadius: 4 },
  bankLabel: { fontSize: 7, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  bankRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  bankItem: { marginRight: 16, marginBottom: 4 },
  bankItemLabel: { fontSize: 7, color: "#aaaaaa" },
  bankItemVal: { fontSize: 8.5, color: "#222222" },
  notes: { marginTop: 16, fontSize: 8, color: "#999999", fontStyle: "italic" },
  sig: { marginTop: 40, alignItems: "flex-end" },
  sigLine: { width: 120, borderTopWidth: 0.5, borderTopColor: "#bbbbbb", paddingTop: 4, fontSize: 7.5, color: "#888888", textAlign: "center" },
  invoiceTag: { fontSize: 8, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  invoiceNum: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#111111" },
});

function MinimalTemplate({ invoice, matter, profile, lineItems, parties, c, clientContact, firmContact }: TemplateProps) {
  const addr = addressLines(profile);
  return (
    <Page size="A4" style={minimalStyles.page}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={minimalStyles.firmName}>{profile.firmName || profile.advocateName}</Text>
          {profile.firmName && <Text style={minimalStyles.firmSub}>{profile.advocateName}</Text>}
          <Text style={minimalStyles.firmSub}>{profile.designation}</Text>
          {profile.barCouncilNumber ? <Text style={minimalStyles.firmSub}>Enr. {profile.barCouncilNumber}</Text> : null}
          {addr.map((l, i) => <Text key={i} style={minimalStyles.firmSub}>{l}</Text>)}
          {profile.phone ? <Text style={minimalStyles.firmSub}>{profile.phone}</Text> : null}
          {profile.email ? <Text style={minimalStyles.firmSub}>{profile.email}</Text> : null}
          {profile.gstin ? <Text style={minimalStyles.firmSub}>GSTIN: {profile.gstin}</Text> : null}
          {c.headerNote ? <Text style={[minimalStyles.firmSub, { fontStyle: "italic", marginTop: 3 }]}>{c.headerNote}</Text> : null}
          {c.customFields.filter(f => f.label && f.value).map((f, i) => (
            <Text key={i} style={minimalStyles.firmSub}>{f.label}: {f.value}</Text>
          ))}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={minimalStyles.invoiceTag}>Memorandum of Fees</Text>
          <Text style={minimalStyles.invoiceNum}>{invoice.invoice_number}</Text>
        </View>
      </View>

      <View style={minimalStyles.divider} />

      {/* Bill To — driven by address_mode / contact persons */}
      <View style={minimalStyles.twoCol}>
        {useContactSide(invoice, "firm", firmContact) ? (
          <View style={minimalStyles.col}>
            <Text style={minimalStyles.label}>Bill To — AOR / Firm</Text>
            <Text style={[minimalStyles.val, { fontFamily: "Helvetica-Bold" }]}>{firmContact!.name}</Text>
            {firmContact!.designation ? <Text style={minimalStyles.val}>{firmContact!.designation}</Text> : null}
            {(firmContact!.company || matter.firm_name) ? <Text style={minimalStyles.val}>{firmContact!.company || matter.firm_name}</Text> : null}
            {firmContact!.email   ? <Text style={minimalStyles.val}>{firmContact!.email}</Text>   : null}
            {firmContact!.address ? <Text style={minimalStyles.val}>{firmContact!.address}</Text> : null}
          </View>
        ) : showOrgSide(invoice, "firm") && matter.firm_name ? (
          <View style={minimalStyles.col}>
            <Text style={minimalStyles.label}>{(invoice.address_mode === "org_firm" || invoice.recipient_type === "firm") ? "Bill To — AOR / Firm" : "Engaged by (AOR / Firm)"}</Text>
            <Text style={[minimalStyles.val, { fontFamily: "Helvetica-Bold" }]}>{matter.firm_name}</Text>
            {matter.firm_gstin ? <Text style={minimalStyles.val}>GSTIN: {matter.firm_gstin}</Text> : null}
            {matter.firm_email  ? <Text style={minimalStyles.val}>{matter.firm_email}</Text>  : null}
          </View>
        ) : null}
        {useContactSide(invoice, "client", clientContact) ? (
          <View style={minimalStyles.col}>
            <Text style={minimalStyles.label}>Bill To — Client</Text>
            <Text style={[minimalStyles.val, { fontFamily: "Helvetica-Bold" }]}>{clientContact!.name}</Text>
            {clientContact!.designation ? <Text style={minimalStyles.val}>{clientContact!.designation}</Text> : null}
            {(clientContact!.company || matter.client_name) ? <Text style={minimalStyles.val}>{clientContact!.company || matter.client_name}</Text> : null}
            {clientContact!.email   ? <Text style={minimalStyles.val}>{clientContact!.email}</Text>   : null}
            {clientContact!.address ? <Text style={minimalStyles.val}>{clientContact!.address}</Text> : null}
          </View>
        ) : showOrgSide(invoice, "client") ? (
          <View style={minimalStyles.col}>
            <Text style={minimalStyles.label}>{(invoice.address_mode === "org_client" || invoice.recipient_type === "client") ? "Bill To — Client" : "Client"}</Text>
            <Text style={[minimalStyles.val, { fontFamily: "Helvetica-Bold" }]}>{matter.client_name}</Text>
            {matter.client_gstin ? <Text style={minimalStyles.val}>GSTIN: {matter.client_gstin}</Text> : null}
            {matter.client_email  ? <Text style={minimalStyles.val}>{matter.client_email}</Text>  : null}
          </View>
        ) : (
          <View style={minimalStyles.col}>
            <Text style={minimalStyles.label}>Client (for the matter of)</Text>
            <Text style={minimalStyles.val}>{matter.client_name}</Text>
          </View>
        )}
        <View style={[minimalStyles.col, { alignItems: "flex-end" }]}>
          <Text style={minimalStyles.label}>Invoice Date</Text>
          <Text style={minimalStyles.val}>{fmtDate(invoice.invoice_date)}</Text>
          {invoice.due_date ? <>
            <Text style={[minimalStyles.label, { marginTop: 6 }]}>Due Date</Text>
            <Text style={minimalStyles.val}>{fmtDate(invoice.due_date)}</Text>
          </> : null}
          {c.showMatterInfo && <>
            <Text style={[minimalStyles.label, { marginTop: 6 }]}>Matter</Text>
            <Text style={[minimalStyles.val, { textAlign: "right" }]}>{matter.case_title}</Text>
          </>}
          {c.showMatterInfo && matter.matter_number ? <>
            <Text style={[minimalStyles.label, { marginTop: 4 }]}>Matter No.</Text>
            <Text style={[minimalStyles.val, { textAlign: "right" }]}>{matter.matter_number}</Text>
          </> : null}
        </View>
      </View>

      {/* Appearing for */}
      {parties.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={[minimalStyles.label, { marginBottom: 2 }]}>Appearing for</Text>
          <Text style={{ fontSize: 8.5, color: "#222222" }}>
            {parties.map(formatParty).join("  ·  ")}
          </Text>
          <View style={minimalStyles.divider} />
        </View>
      )}

      {/* Table */}
      <View style={minimalStyles.tableHeader}>
        <Text style={[minimalStyles.tableHeaderText, { flex: 1 }]}>Description</Text>
        <Text style={[minimalStyles.tableHeaderText, { width: 80, textAlign: "right" }]}>Amount</Text>
      </View>
      {lineItems.map((li, i) => (
        <View key={i} style={minimalStyles.tableRow}>
          <Text style={minimalStyles.desc}>{li.description}</Text>
          <Text style={minimalStyles.amt}>{inr(li.amount)}</Text>
        </View>
      ))}

      {/* Totals */}
      <View style={minimalStyles.totals}>
        <View style={minimalStyles.totalRow}>
          <Text style={minimalStyles.tLabel}>Subtotal</Text>
          <Text style={minimalStyles.tVal}>{inr(invoice.subtotal_amount)}</Text>
        </View>
        {c.showGstBreakdown && invoice.cgst > 0 && <>
          <View style={minimalStyles.totalRow}>
            <Text style={minimalStyles.tLabel}>CGST ({invoice.gst_rate / 2}%)</Text>
            <Text style={minimalStyles.tVal}>{inr(invoice.cgst)}</Text>
          </View>
          <View style={minimalStyles.totalRow}>
            <Text style={minimalStyles.tLabel}>SGST ({invoice.gst_rate / 2}%)</Text>
            <Text style={minimalStyles.tVal}>{inr(invoice.sgst)}</Text>
          </View>
        </>}
        {c.showGstBreakdown && invoice.igst > 0 && (
          <View style={minimalStyles.totalRow}>
            <Text style={minimalStyles.tLabel}>IGST ({invoice.gst_rate}%)</Text>
            <Text style={minimalStyles.tVal}>{inr(invoice.igst)}</Text>
          </View>
        )}
        <View style={[minimalStyles.totalRow, { borderTopWidth: 0.5, borderTopColor: "#cccccc", marginTop: 6 }]}>
          <Text style={minimalStyles.grandLabel}>Total</Text>
          <Text style={minimalStyles.grandVal}>{inr(invoice.total_amount)}</Text>
        </View>
        <View style={{ marginTop: 5, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 7.5, color: "#666666", fontStyle: "italic" }}>
            {amountInWords(invoice.total_amount)}
          </Text>
        </View>
      </View>

      {/* Bank */}
      {c.showBankDetails && (profile.bankName || profile.accountNumber) && (
        <View style={minimalStyles.bank}>
          <Text style={minimalStyles.bankLabel}>Payment Details</Text>
          <View style={minimalStyles.bankRow}>
            {profile.accountHolder ? <MinBankItem label="Account" val={profile.accountHolder} /> : null}
            {profile.bankName      ? <MinBankItem label="Bank"    val={`${profile.bankName}${profile.bankBranch ? `, ${profile.bankBranch}` : ""}`} /> : null}
            {profile.accountNumber ? <MinBankItem label="Acc. No." val={profile.accountNumber} /> : null}
            {profile.ifscCode      ? <MinBankItem label="IFSC"    val={profile.ifscCode}      /> : null}
            {profile.upiId         ? <MinBankItem label="UPI"     val={profile.upiId}         /> : null}
          </View>
        </View>
      )}

      {invoice.notes ? <Text style={minimalStyles.notes}>{invoice.notes}</Text> : null}

      {/* Signature */}
      {c.showSignature && (
        <View style={minimalStyles.sig}>
          <Text style={minimalStyles.sigLine}>{profile.signatureText || profile.advocateName || "Authorised Signatory"}</Text>
        </View>
      )}

      {c.footerNote ? (
        <Text style={{ marginTop: 12, fontSize: 7.5, color: "#888888", fontStyle: "italic", textAlign: "center" }}>
          {c.footerNote}
        </Text>
      ) : null}
    </Page>
  );
}

function MinBankItem({ label, val }: { label: string; val: string }) {
  return (
    <View style={minimalStyles.bankItem}>
      <Text style={minimalStyles.bankItemLabel}>{label}</Text>
      <Text style={minimalStyles.bankItemVal}>{val}</Text>
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface TemplateProps {
  invoice: Invoice;
  matter: Matter;
  profile: Profile;
  lineItems: LineItem[];
  parties: MatterParty[];
  c: InvoiceCustomization;
  clientContact?: ContactPerson;
  firmContact?: ContactPerson;
}

interface Props {
  invoice: Invoice;
  matter: Matter;
  profile: Profile;
  parties?: MatterParty[];
  customization?: InvoiceCustomization;
  clientContact?: ContactPerson;
  firmContact?: ContactPerson;
}

export default function InvoicePDF({ invoice, matter, profile, parties = [], customization, clientContact, firmContact }: Props) {
  const lineItems: LineItem[] = invoice.line_items_data
    ? JSON.parse(invoice.line_items_data) : [];

  const c: InvoiceCustomization = {
    ...DEFAULT_CUSTOMIZATION,
    ...(profile.invoiceCustomization ?? {}),
    ...(customization ?? {}),
  };

  const template = profile.invoiceTemplate ?? "modern";
  const props: TemplateProps = { invoice, matter, profile, lineItems, parties, c, clientContact, firmContact };

  return (
    <Document title={invoice.invoice_number} author={profile.advocateName || profile.firmName}>
      {template === "classic"  ? <ClassicTemplate  {...props} /> :
       template === "minimal"  ? <MinimalTemplate  {...props} /> :
                                 <ModernTemplate   {...props} />}
    </Document>
  );
}
