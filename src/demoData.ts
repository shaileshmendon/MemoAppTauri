import { getDb, saveProfile } from "./db";
import { v4 as uuid } from "uuid";
import { format, subDays, addDays } from "date-fns";

const today = new Date();
const fmt = (d: Date) => format(d, "yyyy-MM-dd");

async function clearAllData(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute("DELETE FROM payments");
  await db.execute("DELETE FROM advance_payments");
  await db.execute("DELETE FROM invoices");
  await db.execute("DELETE FROM appearances");
  await db.execute("DELETE FROM time_entries");
  await db.execute("DELETE FROM matter_parties");
  await db.execute("DELETE FROM matters");
  await db.execute("DELETE FROM clients");
  await db.execute("DELETE FROM firms");
}

/** Wipe every matter, invoice, payment, appearance, client and firm. Profile is kept. */
export async function removeAllData() {
  const db = await getDb();
  await clearAllData(db);
}

export async function loadDemoData() {
  const db = await getDb();

  // ── Profile ──────────────────────────────────────────────────────────────
  await saveProfile({
    advocateName:    "Adv. Priya Sharma",
    firmName:        "Sharma & Associates",
    designation:     "Advocate, Bombay High Court",
    barCouncilNumber:"MH/2456/2010",
    addressLine1:    "Chamber No. 12, High Court Annexe",
    addressLine2:    "Fort Area",
    city:            "Mumbai",
    state:           "Maharashtra",
    pincode:         "400032",
    phone:           "+91 98200 12345",
    email:           "priya@sharmaassociates.in",
    website:         "www.sharmaassociates.in",
    gstin:           "27ABCDE1234F1Z5",
    pan:             "ABCDE1234F",
    bankName:        "HDFC Bank",
    bankBranch:      "Fort Branch",
    accountNumber:   "50100987654321",
    ifscCode:        "HDFC0000123",
    accountHolder:   "Sharma & Associates",
    upiId:           "priya@hdfcbank",
    invoicePrefix:   "INV",
    invoiceTemplate: "modern",
    signatureText:   "Authorised Signatory",
    defaultGstRate:  18,
    invoiceCustomization: {
      accentColor: "#1e40af", showGstBreakdown: true, showBankDetails: true,
      showSignature: true, showMatterInfo: true, headerNote: "", footerNote: "", customFields: [],
    },
  });

  // ── Clear existing data ───────────────────────────────────────────────────
  await clearAllData(db);

  // ── Clients ───────────────────────────────────────────────────────────────
  const c1 = uuid(), c2 = uuid(), c3 = uuid(), c4 = uuid();
  const clients = [
    [c1, "Siemens India Limited",    "legal@siemens.in",       "+91 22 6119 7000", "27AADCS0001A1Z3", "Maharashtra", "130, Pandurang Budhkar Marg, Worli, Mumbai 400018", null,                               fmt(subDays(today, 90))],
    [c2, "Tata Sons Pvt. Ltd.",      "legal@tata.com",         "+91 22 6665 8282", "27AABCT0007B1Z8", "Maharashtra", "Bombay House, 24 Homi Mody Street, Fort, Mumbai",  null,                               fmt(subDays(today, 85))],
    [c3, "Reliance Industries Ltd.", "legal@ril.com",          "+91 22 3555 5000", "27AAACR5055K1Z5", "Maharashtra", "Maker Chambers IV, 3rd Floor, Nariman Point, Mumbai", "Major JV dispute matter.",        fmt(subDays(today, 80))],
    [c4, "Infosys BPM Limited",      "contracts@infosys.com",  "+91 80 4116 7000", "29AABCI0002A1Z0", "Karnataka",   "Bengaluru Works, Electronics City, Bengaluru 560100", "Pan-India employment matters.",   fmt(subDays(today, 60))],
  ];
  for (const row of clients) {
    await db.execute(
      `INSERT INTO clients (id,name,email,phone,gstin,state,address,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // ── Firms ─────────────────────────────────────────────────────────────────
  const f1 = uuid(), f2 = uuid(), f3 = uuid();
  const firms = [
    [f1, "Crawford Bayley & Co.",       "info@crawfordbayley.com",  "+91 22 2266 8000", "27AAACC1234B1Z5", "Maharashtra", "State Bank Buildings, N.G.N. Vaidya Marg, Fort, Mumbai 400023", null,              fmt(subDays(today, 90))],
    [f2, "Cyril Amarchand Mangaldas",   "mumbai@cyrilshroff.com",   "+91 22 2496 4455", "27AAACD1234A1Z5", "Maharashtra", "Peninsula Chambers, Peninsula Corporate Park, Lower Parel",    "Top-tier firm.",  fmt(subDays(today, 85))],
    [f3, "AZB & Partners",              "mumbai@azbpartners.com",   "+91 22 4072 9999", "27AAAAZ1234C1Z5", "Maharashtra", "AZB House, Peninsula Corporate Park, Lower Parel, Mumbai",     null,              fmt(subDays(today, 80))],
  ];
  for (const row of firms) {
    await db.execute(
      `INSERT INTO firms (id,name,email,phone,gstin,state,address,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // ── Matters ───────────────────────────────────────────────────────────────
  const m1 = uuid(), m2 = uuid(), m3 = uuid(), m4 = uuid(), m5 = uuid();
  const matters = [
    // id, case_title, client_name, client_email, client_gstin, client_state,
    // court, matter_number, matter_type, status,
    // firm_name, firm_email, firm_gstin, firm_state,
    // handler_name, handler_designation, handler_email, handler_phone,
    // notes, created_at
    [m1, "Siemens Writ Petition — MRI Equipment Import",
      "Siemens India Limited", "legal@siemens.in", "27AADCS0001A1Z3", "Maharashtra",
      "Bombay High Court", "WP/LOD/2024/4521", "litigation", "active",
      "Crawford Bayley & Co.", "info@crawfordbayley.com", "27AAACC1234B1Z5", "Maharashtra",
      "Anoj Menon", "Partner", "anoj@crawfordbayley.com", "+91 98200 22222",
      "Writ petition challenging customs duty classification on MRI equipment.",
      fmt(subDays(today, 60))],

    [m2, "Tata Sons — Board Dispute (NCLT)",
      "Tata Sons Pvt. Ltd.", "legal@tata.com", "27AABCT0007B1Z8", "Maharashtra",
      "NCLT, Mumbai Bench", "NCLT/MUM/2024/112", "corporate", "active",
      "Cyril Amarchand Mangaldas", "mumbai@cyrilshroff.com", "27AAACD1234A1Z5", "Maharashtra",
      "Rohit Verma", "Senior Partner", "rohit@cyrilshroff.com", "+91 98100 11111",
      "Corporate governance dispute. Multiple NCLT hearings scheduled.",
      fmt(subDays(today, 55))],

    [m3, "Reliance — International Arbitration (MIAC)",
      "Reliance Industries Ltd.", "legal@ril.com", "27AAACR5055K1Z5", "Maharashtra",
      "Mumbai International Arbitration Centre", "MIAC/2024/088", "litigation", "active",
      "AZB & Partners", "mumbai@azbpartners.com", "27AAAAZ1234C1Z5", "Maharashtra",
      "Kavita Nair", "Associate", "kavita@azbpartners.com", "+91 98300 33333",
      "International joint venture arbitration. Seat: Mumbai. Governing law: Indian.",
      fmt(subDays(today, 50))],

    [m4, "Infosys BPM — Employment Termination Advisory",
      "Infosys BPM Limited", "contracts@infosys.com", "29AABCI0002A1Z0", "Karnataka",
      null, "ADV/2024/INF/055", "advisory", "active",
      null, null, null, null,
      null, null, null, null,
      "Ongoing retainer for employment law advice across Bengaluru operations.",
      fmt(subDays(today, 40))],

    [m5, "Mahindra — Trademark Opposition",
      "Mahindra & Mahindra Ltd.", "ipr@mahindra.com", "27AAACM3025F1Z5", "Maharashtra",
      "Trade Marks Registry, Mumbai", "TM/MUM/OPP/2023/4421", "other", "closed",
      null, null, null, null,
      null, null, null, null,
      "Successfully opposed third-party trademark. Matter concluded.",
      fmt(subDays(today, 120))],
  ];
  for (const row of matters) {
    await db.execute(
      `INSERT INTO matters (id,case_title,client_name,client_email,client_gstin,client_state,court,matter_number,matter_type,status,firm_name,firm_email,firm_gstin,firm_state,handler_name,handler_designation,handler_email,handler_phone,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // ── Appearances ───────────────────────────────────────────────────────────
  const a: string[] = Array.from({ length: 10 }, () => uuid());
  const appearances = [
    // m1 — Siemens
    [a[0], m1, fmt(subDays(today, 55)), "Bombay High Court",              "mention",        7500,  1, "First mention. Matter admitted."],
    [a[1], m1, fmt(subDays(today, 40)), "Bombay High Court",              "urgent_mention", 15000, 1, "Urgent stay application moved."],
    [a[2], m1, fmt(subDays(today, 20)), "Bombay High Court",              "hearing",        20000, 1, "Hearing on admission. Affidavit in reply filed."],
    [a[3], m1, fmt(subDays(today, 5)),  "Bombay High Court",              "hearing",        20000, 0, "Further hearing. Cross examination of customs officer."],
    // m2 — Tata NCLT
    [a[4], m2, fmt(subDays(today, 50)), "NCLT, Mumbai Bench",             "board",          25000, 1, "Board meeting attendance and advice."],
    [a[5], m2, fmt(subDays(today, 30)), "NCLT, Mumbai Bench",             "hearing",        20000, 1, null],
    [a[6], m2, fmt(subDays(today, 8)),  "NCLT, Mumbai Bench",             "arguments",      30000, 0, "Final arguments commenced."],
    // m3 — Reliance MIAC
    [a[7], m3, fmt(subDays(today, 45)), "Mumbai Intl. Arbitration Centre","conference",     35000, 1, "Preliminary conference with arbitral tribunal."],
    [a[8], m3, fmt(subDays(today, 15)), "Mumbai Intl. Arbitration Centre","evidence",       40000, 0, "Evidence session — examination of witnesses."],
    // m4 — Infosys
    [a[9], m4, fmt(subDays(today, 10)), null,                             "advice",         15000, 0, "Employment law retainer — quarterly advice session."],
  ];
  for (const row of appearances) {
    await db.execute(
      `INSERT INTO appearances (id,matter_id,date,court,hearing_type,fee_amount,is_billed,notes) VALUES (?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // ── Time Entries ──────────────────────────────────────────────────────────
  const t: string[] = Array.from({ length: 8 }, () => uuid());
  const timeEntries = [
    [t[0], m1, fmt(subDays(today, 52)), "Reviewing customs classification and duty structure",        90,  6000, 1, 1],
    [t[1], m1, fmt(subDays(today, 48)), "Drafting writ petition and supporting affidavit",           240,  6000, 1, 1],
    [t[2], m1, fmt(subDays(today, 25)), "Research on similar writ precedents (Bombay HC)",            60,  6000, 1, 1],
    [t[3], m2, fmt(subDays(today, 48)), "Reviewing NCLT petition and company law grounds",            90,  7500, 1, 1],
    [t[4], m2, fmt(subDays(today, 35)), "Conference with client — board resolution strategy",         60,  7500, 1, 1],
    [t[5], m3, fmt(subDays(today, 42)), "Drafting statement of claim for arbitration",               300,  8000, 1, 1],
    [t[6], m3, fmt(subDays(today, 18)), "Reviewing witness statements and expert reports",           150,  8000, 1, 0],
    [t[7], m4, fmt(subDays(today, 12)), "Advising on termination policy compliance — Karnataka shops act", 45, 5000, 1, 0],
  ];
  for (const row of timeEntries) {
    await db.execute(
      `INSERT INTO time_entries (id,matter_id,date,description,duration_minutes,rate_per_hour,is_billable,is_billed) VALUES (?,?,?,?,?,?,?,?)`,
      row
    );
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  const inv1 = uuid(), inv2 = uuid(), inv3 = uuid();

  // Invoice 1 — Siemens (paid)
  const inv1Items = [
    { description: fmt(subDays(today, 55)) + " — Mention — Bombay High Court",               amount: 7500,  type: "appearance", sourceId: a[0] },
    { description: fmt(subDays(today, 40)) + " — Urgent Mention — Bombay High Court",        amount: 15000, type: "appearance", sourceId: a[1] },
    { description: fmt(subDays(today, 20)) + " — Hearing — Bombay High Court",               amount: 20000, type: "appearance", sourceId: a[2] },
    { description: fmt(subDays(today, 52)) + " — Reviewing customs classification",          amount: 9000,  type: "time",       sourceId: t[0] },
    { description: fmt(subDays(today, 48)) + " — Drafting writ petition and affidavit",     amount: 24000, type: "time",       sourceId: t[1] },
    { description: fmt(subDays(today, 25)) + " — Research on writ precedents",              amount: 6000,  type: "time",       sourceId: t[2] },
  ];
  const inv1Sub = inv1Items.reduce((s, i) => s + i.amount, 0); // 81500
  const inv1Tax = inv1Sub * 0.18;
  await db.execute(
    `INSERT INTO invoices (id,matter_id,invoice_number,invoice_date,due_date,recipient_type,subtotal_amount,gst_rate,cgst,sgst,igst,total_amount,status,notes,line_items_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [inv1, m1, "INV-202603-001", fmt(subDays(today, 18)), fmt(subDays(today, 2)),
     "firm", inv1Sub, 18, inv1Tax/2, inv1Tax/2, 0, inv1Sub + inv1Tax,
     "paid", "Professional fees for Writ Petition No. WP/LOD/2024/4521", JSON.stringify(inv1Items)]
  );

  // Invoice 2 — Tata NCLT (sent / outstanding)
  const inv2Items = [
    { description: fmt(subDays(today, 50)) + " — Board Conference — NCLT",                  amount: 25000, type: "appearance", sourceId: a[4] },
    { description: fmt(subDays(today, 30)) + " — Hearing — NCLT, Mumbai Bench",             amount: 20000, type: "appearance", sourceId: a[5] },
    { description: fmt(subDays(today, 48)) + " — Reviewing NCLT petition",                  amount: 11250, type: "time",       sourceId: t[3] },
    { description: fmt(subDays(today, 35)) + " — Conference with client",                   amount: 7500,  type: "time",       sourceId: t[4] },
  ];
  const inv2Sub = inv2Items.reduce((s, i) => s + i.amount, 0);
  const inv2Tax = inv2Sub * 0.18;
  await db.execute(
    `INSERT INTO invoices (id,matter_id,invoice_number,invoice_date,due_date,recipient_type,subtotal_amount,gst_rate,cgst,sgst,igst,total_amount,status,notes,line_items_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [inv2, m2, "INV-202604-002", fmt(subDays(today, 12)), fmt(addDays(today, 18)),
     "firm", inv2Sub, 18, inv2Tax/2, inv2Tax/2, 0, inv2Sub + inv2Tax,
     "sent", "Professional fees for NCLT matter No. NCLT/MUM/2024/112", JSON.stringify(inv2Items)]
  );

  // Invoice 3 — Reliance Arbitration (draft)
  const inv3Items = [
    { description: fmt(subDays(today, 45)) + " — Arbitration Conference — MIAC",            amount: 35000, type: "appearance", sourceId: a[7] },
    { description: fmt(subDays(today, 42)) + " — Drafting Statement of Claim",              amount: 40000, type: "time",       sourceId: t[5] },
  ];
  const inv3Sub = inv3Items.reduce((s, i) => s + i.amount, 0);
  const inv3Tax = inv3Sub * 0.18; // IGST — different states (Reliance: Maharashtra, but illustrative)
  await db.execute(
    `INSERT INTO invoices (id,matter_id,invoice_number,invoice_date,due_date,recipient_type,subtotal_amount,gst_rate,cgst,sgst,igst,total_amount,status,notes,line_items_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [inv3, m3, "INV-202605-003", fmt(subDays(today, 2)), fmt(addDays(today, 28)),
     "client", inv3Sub, 18, inv3Tax/2, inv3Tax/2, 0, inv3Sub + inv3Tax,
     "draft", "Partial billing — arbitration in progress", JSON.stringify(inv3Items)]
  );

  // ── Payments ──────────────────────────────────────────────────────────────
  // Full payment on invoice 1
  await db.execute(
    `INSERT INTO payments (id,invoice_id,payment_date,amount_paid,mode,notes) VALUES (?,?,?,?,?,?)`,
    [uuid(), inv1, fmt(subDays(today, 3)), inv1Sub + inv1Tax, "NEFT", "Full payment — NEFT transfer received"]
  );

  // Partial payment on invoice 2
  await db.execute(
    `INSERT INTO payments (id,invoice_id,payment_date,amount_paid,mode,notes) VALUES (?,?,?,?,?,?)`,
    [uuid(), inv2, fmt(subDays(today, 2)), 30000, "RTGS", "Advance payment against invoice"]
  );
}
