/**
 * Screenshot helper — seeds realistic demo data so the app looks great
 * for App Store screenshots. Only visible in dev mode.
 * Triggered by: ?screenshot=1 in the URL, or the keyboard shortcut ⌘⇧D
 */
import { useEffect, useState } from "react";
import { getDb } from "../db";
import { v4 as uuid } from "uuid";
import { format, subDays } from "date-fns";

const DEMO_PROFILE = {
  advocateName: "Adv. Priya Sharma",
  firmName: "Sharma & Associates",
  designation: "Advocate, Bombay High Court",
  barCouncilNumber: "MH/2456/2010",
  addressLine1: "Chamber No. 12, High Court Annexe",
  addressLine2: "Fort Area",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400032",
  phone: "+91 98200 12345",
  email: "priya@sharmaassociates.in",
  website: "www.sharmaassociates.in",
  gstin: "27ABCDE1234F1Z5",
  pan: "ABCDE1234F",
  bankName: "HDFC Bank",
  bankBranch: "Fort Branch",
  accountNumber: "50100987654321",
  ifscCode: "HDFC0000123",
  accountHolder: "Sharma & Associates",
  upiId: "priya@hdfcbank",
  invoicePrefix: "INV",
  invoiceTemplate: "modern",
  signatureText: "Authorised Signatory",
};

async function seedDemoData() {
  const db = await getDb();

  // Save profile
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(DEMO_PROFILE)]
  );

  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  // Matters
  const m1 = uuid(), m2 = uuid(), m3 = uuid();
  await db.execute(`DELETE FROM matters`);
  await db.execute(`INSERT OR REPLACE INTO matters VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    m1, "Tata vs. Mistry — Board Dispute", "Tata Sons Pvt. Ltd.", "legal@tata.com",
    "27AABCT0007B1Z8", "Maharashtra", "NCLT, Mumbai", "NCLT/MUM/2024/112",
    "corporate", "active", "Cyril Amarchand Mangaldas", "cam@cam.com", "27AAACD1234A1Z5",
    "Maharashtra", "Rohit Verma", "Senior Partner", "rohit@cam.com", "+91 98100 11111",
    null, fmt(subDays(today, 45)),
  ]);
  await db.execute(`INSERT OR REPLACE INTO matters VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    m2, "Siemens Writ Petition — MRI Equipment", "Siemens India Limited", "legal@siemens.in",
    "27AADCS0001A1Z3", "Maharashtra", "Bombay High Court", "WP/LOD/2024/4521",
    "litigation", "active", "Crawford Bayley & Co.", "info@crawfordbayley.com",
    "27AAACC1234B1Z5", "Maharashtra", "Anoj Menon", "Partner", "anoj@crawfordbayley.com",
    "+91 98200 22222", null, fmt(subDays(today, 30)),
  ]);
  await db.execute(`INSERT OR REPLACE INTO matters VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    m3, "Reliance Industries — Arbitration", "Reliance Industries Ltd.", "legal@ril.com",
    "27AAACR5055K1Z5", "Maharashtra", "Mumbai International Arbitration Centre", "MIAC/2024/088",
    "litigation", "active", "AZB & Partners", "mumbai@azbpartners.com",
    "27AAAAZ1234C1Z5", "Maharashtra", "Kavita Nair", "Associate", "kavita@azbpartners.com",
    "+91 98300 33333", "International arbitration for joint venture dispute.", fmt(subDays(today, 60)),
  ]);

  // Appearances for m2
  await db.execute(`DELETE FROM appearances`);
  const appIds = [uuid(), uuid(), uuid(), uuid()];
  const appData = [
    [appIds[0], m2, fmt(subDays(today, 28)), "Bombay High Court", "mention",       7500,  1, "First mention before court"],
    [appIds[1], m2, fmt(subDays(today, 20)), "Bombay High Court", "urgent_mention", 15000, 1, "Urgent mention for stay"],
    [appIds[2], m2, fmt(subDays(today, 10)), "Bombay High Court", "hearing",        20000, 0, null],
    [appIds[3], m1, fmt(subDays(today, 5)),  "NCLT, Mumbai",      "board",          25000, 0, null],
  ];
  for (const row of appData) {
    await db.execute(
      `INSERT OR REPLACE INTO appearances (id,matter_id,date,court,hearing_type,fee_amount,is_billed,notes) VALUES (?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // Time entries
  await db.execute(`DELETE FROM time_entries`);
  const timeData = [
    [uuid(), m2, fmt(subDays(today, 25)), "Reviewing pleadings and draft reply",         120, 5000, 1, 1],
    [uuid(), m2, fmt(subDays(today, 18)), "Legal research on writ jurisdiction",          90,  5000, 1, 0],
    [uuid(), m3, fmt(subDays(today, 15)), "Drafting arbitration statement of claim",      180, 7500, 1, 0],
    [uuid(), m1, fmt(subDays(today, 8)),  "Conference with client re. board resolution",  60,  7500, 1, 0],
  ];
  for (const row of timeData) {
    await db.execute(
      `INSERT OR REPLACE INTO time_entries (id,matter_id,date,description,duration_minutes,rate_per_hour,is_billable,is_billed) VALUES (?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // Invoice for m2
  await db.execute(`DELETE FROM invoices`);
  const invId = uuid();
  const lineItems = [
    { description: "27 Apr 26 — Mention — Bombay High Court",        amount: 7500,  type: "appearance", sourceId: appIds[0] },
    { description: "4 May 26 — Urgent Mention — Bombay High Court",  amount: 15000, type: "appearance", sourceId: appIds[1] },
    { description: "2 May 26 — Reviewing pleadings and draft reply", amount: 10000, type: "time",       sourceId: null },
  ];
  await db.execute(
    `INSERT OR REPLACE INTO invoices (id,matter_id,invoice_number,invoice_date,due_date,recipient_type,subtotal_amount,gst_rate,cgst,sgst,igst,total_amount,status,notes,line_items_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [invId, m2, "INV-202605-001", fmt(subDays(today, 15)), fmt(subDays(today, -15)),
     "client", 32500, 18, 2925, 2925, 0, 38350, "sent", null, JSON.stringify(lineItems)]
  );

  // Payment
  await db.execute(`DELETE FROM payments`);
  await db.execute(
    `INSERT OR REPLACE INTO payments (id,invoice_id,payment_date,amount_paid,mode,notes) VALUES (?,?,?,?,?,?)`,
    [uuid(), invId, fmt(subDays(today, 5)), 38350, "NEFT", "Full payment received"]
  );

  window.location.reload();
}

export default function ScreenshotHelper() {
  const [visible, setVisible] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!isDev) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === "D") setVisible(v => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDev]);

  if (!isDev || !visible) return null;

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] bg-orange-900 text-orange-100 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 text-sm border border-orange-700">
      <span className="font-semibold">📸 Screenshot Mode</span>
      <button
        onClick={async () => { setSeeding(true); await seedDemoData(); }}
        disabled={seeding}
        className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-50">
        {seeding ? "Seeding…" : "Seed Demo Data"}
      </button>
      <button onClick={() => setVisible(false)} className="text-orange-400 hover:text-orange-200 text-xs">✕</button>
    </div>
  );
}
