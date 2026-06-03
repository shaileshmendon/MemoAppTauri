/** Format a matter's ref_number as a zero-padded string, e.g. 7 → "#007" */
export function fmtRef(ref?: number | null): string {
  if (!ref) return "—";
  return "#" + String(ref).padStart(3, "0");
}

export type MatterType = "litigation" | "advisory" | "drafting" | "corporate" | "other";
export type MatterStatus = "active" | "closed" | "on-hold";
export type HearingType =
  // Court Appearances
  | "mention" | "urgent_mention" | "hearing" | "adjournment" | "circulation"
  | "arguments" | "evidence" | "judgement" | "admission" | "caveat" | "board"
  // Professional Work
  | "conference" | "drafting" | "research" | "advice" | "retainer" | "filing"
  | "other";
export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
export type PaymentMode = "NEFT" | "RTGS" | "IMPS" | "UPI" | "cheque" | "cash" | "other";
export type RecipientType = "firm" | "client" | "both";

/**
 * How the invoice recipient block is addressed.
 * A = AOR/Firm organisation only
 * B = Client organisation only
 * C = Both organisations (legacy "both")
 * D = Named contact person at AOR/Firm
 * E = Named contact person at Client
 * F = Named contact persons at both
 */
export type InvoiceAddressMode =
  | "org_firm"          // A
  | "org_client"        // B
  | "org_both"          // C
  | "contact_firm"      // D
  | "contact_client"    // E
  | "contact_both";     // F

export interface Matter {
  id: string;
  ref_number?: number;   // App-assigned sequential matter number (#001, #002 …)
  primary_client_contact_id?: string;  // FK → contact_persons.id
  primary_firm_contact_id?: string;    // FK → contact_persons.id
  case_title: string;
  client_name: string;
  client_email?: string;
  client_gstin?: string;
  client_state?: string;
  court?: string;
  matter_number?: string;
  matter_type: MatterType;
  status: MatterStatus;
  firm_name?: string;
  firm_email?: string;
  firm_gstin?: string;
  firm_state?: string;
  handler_name?: string;
  handler_designation?: string;
  handler_email?: string;
  handler_phone?: string;
  notes?: string;
  invoice_recipient?: RecipientType; // default billing party for invoices
  created_at: string;
}

export interface TimeEntry {
  id: string;
  matter_id: string;
  date: string;
  description?: string;
  duration_minutes: number;
  rate_per_hour: number;
  is_billable: number; // 0 | 1
  is_billed: number;   // 0 | 1
}

export interface Appearance {
  id: string;
  matter_id: string;
  date: string;
  court?: string;
  hearing_type: HearingType;
  fee_amount: number;
  is_billed: number; // 0 | 1
  notes?: string;
}

export interface LineItem {
  description: string;
  amount: number;
  type: "appearance" | "time" | "expense" | "other";
  sourceId?: string; // ID of the originating appearance or time entry
}

export interface Invoice {
  id: string;
  matter_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  recipient_type: RecipientType;
  // Contact-person addressing (Options D/E/F)
  address_mode?: InvoiceAddressMode;
  client_contact_id?: string;   // FK → contact_persons.id
  firm_contact_id?: string;     // FK → contact_persons.id
  subtotal_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  status: InvoiceStatus;
  notes?: string;
  pdf_path?: string;
  line_items_data?: string; // JSON string of LineItem[]
}

/** A contact person linked to a Client or Firm entity. */
export interface ContactPerson {
  id: string;
  entity_type: "client" | "firm";
  entity_id: string;
  name: string;
  designation?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  notes?: string;
  apple_contact_id?: string;
  created_at: string;
  updated_at: string;
}

export type TdsSection =
  | "194J(b)"   // Professional services — 10%
  | "194J(a)"   // Technical services — 2%
  | "194C(1)"   // Contractor individual/HUF — 1%
  | "194C(2)"   // Contractor others — 2%
  | "custom";

export const TDS_SECTIONS: { value: TdsSection; label: string; rate: number }[] = [
  { value: "194J(b)", label: "194J(b) — Professional Fees (Advocate / Doctor)", rate: 10 },
  { value: "194J(a)", label: "194J(a) — Technical Services",                    rate: 2  },
  { value: "194C(1)", label: "194C(1) — Contractor (Individual / HUF)",          rate: 1  },
  { value: "194C(2)", label: "194C(2) — Contractor (Company / Firm)",            rate: 2  },
  { value: "custom",  label: "Custom rate",                                      rate: 10 },
];

export interface Payment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount_paid: number;
  mode: PaymentMode;
  notes?: string;
  // TDS fields (optional — only populated when payer deducted TDS)
  tds_amount?: number;    // actual TDS deducted by payer
  tds_rate?: number;      // rate applied, e.g. 10.0 for 10%
  tds_section?: string;   // e.g. "194J(b)"
}

export interface MatterParty {
  id: string;
  matter_id: string;
  party_type: string;     // e.g. "Respondent", "Defendant", custom
  party_number?: number;  // e.g. 2 → "Respondent No. 2"; null/undefined = no number
  party_name?: string;    // actual name of the party, e.g. "ABC Corporation"
  notes?: string;
}

/** Returns the formatted label: "Respondent No. 2 — ABC Corp" */
export function formatParty(p: MatterParty): string {
  const role = p.party_number ? `${p.party_type} No. ${p.party_number}` : p.party_type;
  return p.party_name ? `${role} — ${p.party_name}` : role;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  state?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface Firm {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  state?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export type InvoiceTemplate = "classic" | "modern" | "minimal";

export interface InvoiceCustomization {
  accentColor: string;          // Modern template header / table / total colour
  showGstBreakdown: boolean;    // show CGST / SGST / IGST rows
  showBankDetails: boolean;     // show payment-details section
  showSignature: boolean;       // show signature line
  showMatterInfo: boolean;      // show matter name / number in invoice meta
  headerNote: string;           // small text printed below your name in the header
  footerNote: string;           // text printed at the very bottom
  customFields: Array<{ label: string; value: string }>; // e.g. PAN, Reg. No.
}

export const DEFAULT_CUSTOMIZATION: InvoiceCustomization = {
  accentColor: "#1e40af",
  showGstBreakdown: true,
  showBankDetails: true,
  showSignature: true,
  showMatterInfo: true,
  headerNote: "",
  footerNote: "",
  customFields: [],
};

export interface Profile {
  // Identity
  advocateName: string;
  firmName: string;
  designation: string;
  barCouncilNumber: string;
  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  // Contact
  phone: string;
  email: string;
  website: string;
  // Tax
  gstin: string;
  pan: string;
  // Bank
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  ifscCode: string;
  accountHolder: string;
  upiId: string;
  // Invoice preferences
  invoicePrefix: string;
  invoiceTemplate: InvoiceTemplate;
  signatureText: string;
  defaultGstRate: number; // 0 | 5 | 12 | 18
  invoiceCustomization: InvoiceCustomization;
}

export const DEFAULT_PROFILE: Profile = {
  advocateName: "", firmName: "", designation: "Advocate",
  barCouncilNumber: "", addressLine1: "", addressLine2: "",
  city: "", state: "", pincode: "", phone: "", email: "",
  website: "", gstin: "", pan: "", bankName: "", bankBranch: "",
  accountNumber: "", ifscCode: "", accountHolder: "", upiId: "",
  invoicePrefix: "INV", invoiceTemplate: "modern", signatureText: "Authorised Signatory",
  defaultGstRate: 18,
  invoiceCustomization: { ...DEFAULT_CUSTOMIZATION },
};

// ── Fee Schedule ──────────────────────────────────────────────────────────────

/**
 * Standard fee schedule — stored as JSON in the `settings` table under key
 * `fee_schedule`.
 *
 * Storage format:
 * {
 *   "appearance_fees": {
 *     "Mention": 5000,
 *     "Hearing": 15000,
 *     ...
 *   },
 *   "default_hourly_rate": 1500
 * }
 *
 * Keys inside `appearance_fees` are the canonical display labels
 * (e.g. "Mention", "Urgent Mention") — NOT the HearingType enum values.
 * Only types with a fee > 0 are stored (sparse).
 *
 * Look up fees via `getFeeForHearingType()` in `src/lib/feeSchedule.ts`.
 */
export interface FeeSchedule {
  /** Map of display label → fixed INR amount for appearances. Sparse. */
  appearance_fees: Record<string, number>;
  /** Default hourly rate pre-filled on new time entries. 0 = no auto-fill. */
  default_hourly_rate: number;
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  appearance_fees:     {},
  default_hourly_rate: 0,
};

// ── Work Capture (Quick Capture / Inbox) ─────────────────────────────────────

export type WorkCaptureType = "appearance" | "time";

/**
 * A quick-captured work item that may not yet be assigned to a matter.
 * `matter_id IS NULL`     → unassigned, appears in the Inbox.
 * `matter_id IS NOT NULL` → assigned; `converted_id` is the ID of the
 *                           downstream `appearance` or `time_entry` record.
 */
export interface WorkCapture {
  id: string;
  captured_at: string;       // ISO timestamp — when the user pressed Save
  work_date: string;         // YYYY-MM-DD — the date the work actually happened
  work_type: WorkCaptureType;
  description?: string;
  // Appearance fields (used when work_type = 'appearance')
  hearing_type?: HearingType;
  court?: string;
  fee_amount: number;
  // Time-entry fields (used when work_type = 'time')
  duration_minutes: number;
  rate_per_hour: number;
  is_billable: number;       // 0 | 1
  // Assignment
  matter_id?: string;        // NULL until assigned
  assigned_at?: string;      // ISO timestamp set when assigned
  converted_id?: string;     // ID of created appearance / time_entry
}

// UI-only types
export type NavSection = "matters" | "outstanding" | "record_payment" | "dashboard" | "inbox" | "clients" | "firms" | "settings";
export type MatterTab  = "overview" | "work_done" | "invoices";
