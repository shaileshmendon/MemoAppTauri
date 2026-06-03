import Database from "@tauri-apps/plugin-sql";
import type { Matter, TimeEntry, Appearance, Invoice, Payment, Client, Firm, Profile, MatterParty, ContactPerson } from "./types";
import { applyEffectiveStatus } from "./lib/invoiceUtils";

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:memoapp.db");
  await migrate(_db);
  return _db;
}

async function migrate(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS matters (
      id TEXT PRIMARY KEY,
      case_title TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_gstin TEXT,
      client_state TEXT,
      court TEXT,
      matter_number TEXT,
      matter_type TEXT NOT NULL DEFAULT 'litigation',
      status TEXT NOT NULL DEFAULT 'active',
      firm_name TEXT,
      firm_email TEXT,
      firm_gstin TEXT,
      firm_state TEXT,
      handler_name TEXT,
      handler_designation TEXT,
      handler_email TEXT,
      handler_phone TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      rate_per_hour REAL NOT NULL DEFAULT 0,
      is_billable INTEGER NOT NULL DEFAULT 1,
      is_billed INTEGER NOT NULL DEFAULT 0
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appearances (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      court TEXT,
      hearing_type TEXT NOT NULL DEFAULT 'mention',
      fee_amount REAL NOT NULL DEFAULT 0,
      is_billed INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      recipient_type TEXT NOT NULL DEFAULT 'client',
      subtotal_amount REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 18,
      cgst REAL NOT NULL DEFAULT 0,
      sgst REAL NOT NULL DEFAULT 0,
      igst REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      pdf_path TEXT,
      line_items_data TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      payment_date TEXT NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'NEFT',
      notes TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      gstin TEXT,
      state TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS firms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      gstin TEXT,
      state TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS matter_parties (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      party_type TEXT NOT NULL,
      party_number INTEGER,
      party_name TEXT,
      notes TEXT
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_persons (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      name TEXT NOT NULL,
      designation TEXT,
      company TEXT,
      email TEXT,
      phone TEXT,
      mobile TEXT,
      address TEXT,
      notes TEXT,
      apple_contact_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS advance_payments (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'NEFT',
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Safe column additions for users with existing DBs
  const addIfMissing = async (table: string, column: string, type: string) => {
    try { await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`); } catch { /* already exists */ }
  };
  await addIfMissing("matters",  "handler_name",        "TEXT");
  await addIfMissing("matters",  "handler_designation", "TEXT");
  await addIfMissing("matters",  "handler_email",       "TEXT");
  await addIfMissing("matters",  "handler_phone",       "TEXT");
  await addIfMissing("matters",  "invoice_recipient",   "TEXT");
  await addIfMissing("matters",  "ref_number",                   "INTEGER");
  await addIfMissing("matters",  "primary_client_contact_id",    "TEXT");
  await addIfMissing("matters",  "primary_firm_contact_id",      "TEXT");
  await addIfMissing("invoices", "address_mode",                 "TEXT");
  await addIfMissing("invoices", "client_contact_id",            "TEXT");
  await addIfMissing("invoices", "firm_contact_id",              "TEXT");
  await addIfMissing("payments", "tds_amount",          "REAL DEFAULT 0");
  await addIfMissing("payments", "tds_rate",            "REAL DEFAULT 0");
  await addIfMissing("payments", "tds_section",         "TEXT");

  // Backfill ref_number for existing matters that don't have one yet,
  // assigning numbers in chronological (created_at) order.
  const unNumbered = await db.select<{ id: string }[]>(
    "SELECT id FROM matters WHERE ref_number IS NULL ORDER BY created_at ASC"
  );
  if (unNumbered.length > 0) {
    const [{ max }] = await db.select<{ max: number }[]>(
      "SELECT COALESCE(MAX(ref_number), 0) AS max FROM matters WHERE ref_number IS NOT NULL"
    );
    let next = max;
    for (const row of unNumbered) {
      next += 1;
      await db.execute("UPDATE matters SET ref_number = ? WHERE id = ?", [next, row.id]);
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // ── Invoice number uniqueness ──────────────────────────────────────────
  // SQLite cannot add a UNIQUE constraint to an existing column via ALTER TABLE.
  // Instead we create a UNIQUE INDEX — idempotent via IF NOT EXISTS.
  //
  // DUPLICATE REMEDIATION: Before creating the index, detect and fix any
  // existing duplicate invoice_numbers by appending "-DUP-{rowid}" to all
  // but the earliest occurrence. This prevents the CREATE UNIQUE INDEX from
  // failing on existing databases.
  const dupes = await db.select<{ invoice_number: string; cnt: number }[]>(`
    SELECT invoice_number, COUNT(*) AS cnt
    FROM invoices
    GROUP BY invoice_number
    HAVING cnt > 1
  `);
  for (const { invoice_number } of dupes) {
    // Keep the oldest (lowest rowid) untouched; rename the rest.
    const rows = await db.select<{ id: string }[]>(
      `SELECT id FROM invoices WHERE invoice_number = ? ORDER BY rowid ASC`,
      [invoice_number]
    );
    for (let i = 1; i < rows.length; i++) {
      const suffix = `-DUP-${i}`;
      await db.execute(
        `UPDATE invoices SET invoice_number = invoice_number || ? WHERE id = ?`,
        [suffix, rows[i].id]
      );
    }
  }
  // Now safe to create the unique index (IF NOT EXISTS = safe on re-runs)
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number
    ON invoices (invoice_number)
  `);

  await db.execute(`PRAGMA foreign_keys = ON;`);
}

// ─── Matters ───────────────────────────────────────────────────────────────

export async function fetchMatters(): Promise<Matter[]> {
  const db = await getDb();
  return db.select<Matter[]>(
    "SELECT * FROM matters ORDER BY created_at DESC"
  );
}

/** All matters where the client_name matches (case-insensitive). */
export async function fetchMattersByClientName(name: string): Promise<Matter[]> {
  const db = await getDb();
  return db.select<Matter[]>(
    "SELECT * FROM matters WHERE LOWER(client_name) = LOWER(?) ORDER BY created_at DESC",
    [name],
  );
}

/** All matters where the firm_name matches (case-insensitive). */
export async function fetchMattersByFirmName(name: string): Promise<Matter[]> {
  const db = await getDb();
  return db.select<Matter[]>(
    "SELECT * FROM matters WHERE LOWER(firm_name) = LOWER(?) ORDER BY created_at DESC",
    [name],
  );
}

export async function fetchMatter(id: string): Promise<Matter | null> {
  const db = await getDb();
  const rows = await db.select<Matter[]>("SELECT * FROM matters WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function insertMatter(m: Matter): Promise<Matter> {
  const db = await getDb();
  // Auto-assign the next sequential ref_number
  const [{ max }] = await db.select<{ max: number }[]>(
    "SELECT COALESCE(MAX(ref_number), 0) AS max FROM matters"
  );
  const ref_number = max + 1;
  await db.execute(
    `INSERT INTO matters (id,ref_number,case_title,client_name,client_email,client_gstin,client_state,
      court,matter_number,matter_type,status,firm_name,firm_email,firm_gstin,firm_state,
      handler_name,handler_designation,handler_email,handler_phone,notes,invoice_recipient,
      primary_client_contact_id,primary_firm_contact_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [m.id, ref_number, m.case_title, m.client_name, m.client_email ?? null,
     m.client_gstin ?? null, m.client_state ?? null, m.court ?? null,
     m.matter_number ?? null, m.matter_type, m.status,
     m.firm_name ?? null, m.firm_email ?? null, m.firm_gstin ?? null,
     m.firm_state ?? null, m.handler_name ?? null, m.handler_designation ?? null,
     m.handler_email ?? null, m.handler_phone ?? null, m.notes ?? null,
     m.invoice_recipient ?? null,
     m.primary_client_contact_id ?? null, m.primary_firm_contact_id ?? null,
     m.created_at]
  );
  return { ...m, ref_number };
}

export async function updateMatter(m: Matter): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE matters SET case_title=?,client_name=?,client_email=?,client_gstin=?,
      client_state=?,court=?,matter_number=?,matter_type=?,status=?,
      firm_name=?,firm_email=?,firm_gstin=?,firm_state=?,
      handler_name=?,handler_designation=?,handler_email=?,handler_phone=?,
      notes=?,invoice_recipient=?,
      primary_client_contact_id=?,primary_firm_contact_id=?
     WHERE id=?`,
    [m.case_title, m.client_name, m.client_email ?? null,
     m.client_gstin ?? null, m.client_state ?? null, m.court ?? null,
     m.matter_number ?? null, m.matter_type, m.status,
     m.firm_name ?? null, m.firm_email ?? null, m.firm_gstin ?? null,
     m.firm_state ?? null, m.handler_name ?? null, m.handler_designation ?? null,
     m.handler_email ?? null, m.handler_phone ?? null, m.notes ?? null,
     m.invoice_recipient ?? null,
     m.primary_client_contact_id ?? null, m.primary_firm_contact_id ?? null,
     m.id]
  );
}

export async function deleteMatter(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM matters WHERE id = ?", [id]);
}

// ─── Time Entries ──────────────────────────────────────────────────────────

export async function fetchTimeEntries(matterId: string): Promise<TimeEntry[]> {
  const db = await getDb();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE matter_id = ? ORDER BY date DESC",
    [matterId]
  );
}

export async function fetchAllBillableTimeEntries(matterId: string): Promise<TimeEntry[]> {
  const db = await getDb();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE matter_id = ? AND is_billable = 1 AND duration_minutes > 0 ORDER BY date ASC",
    [matterId]
  );
}

export async function markTimeEntriesBilled(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.execute(`UPDATE time_entries SET is_billed = 1 WHERE id IN (${placeholders})`, ids);
}

export async function insertTimeEntry(t: TimeEntry): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO time_entries (id,matter_id,date,description,duration_minutes,rate_per_hour,is_billable,is_billed)
     VALUES (?,?,?,?,?,?,?,?)`,
    [t.id, t.matter_id, t.date, t.description ?? null,
     t.duration_minutes, t.rate_per_hour, t.is_billable, t.is_billed]
  );
}

export async function updateTimeEntry(t: TimeEntry): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE time_entries SET date=?,description=?,duration_minutes=?,rate_per_hour=?,is_billable=?,is_billed=?
     WHERE id=?`,
    [t.date, t.description ?? null, t.duration_minutes,
     t.rate_per_hour, t.is_billable, t.is_billed, t.id]
  );
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM time_entries WHERE id = ?", [id]);
}

// ─── Appearances ───────────────────────────────────────────────────────────

export async function fetchAppearances(matterId: string): Promise<Appearance[]> {
  const db = await getDb();
  return db.select<Appearance[]>(
    "SELECT * FROM appearances WHERE matter_id = ? ORDER BY date DESC",
    [matterId]
  );
}

export async function fetchAllBillableAppearances(matterId: string): Promise<Appearance[]> {
  const db = await getDb();
  return db.select<Appearance[]>(
    "SELECT * FROM appearances WHERE matter_id = ? AND fee_amount > 0 ORDER BY date ASC",
    [matterId]
  );
}

export async function markAppearancesBilled(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.execute(`UPDATE appearances SET is_billed = 1 WHERE id IN (${placeholders})`, ids);
}

export async function insertAppearance(a: Appearance): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO appearances (id,matter_id,date,court,hearing_type,fee_amount,is_billed,notes)
     VALUES (?,?,?,?,?,?,?,?)`,
    [a.id, a.matter_id, a.date, a.court ?? null,
     a.hearing_type, a.fee_amount, a.is_billed, a.notes ?? null]
  );
}

export async function updateAppearance(a: Appearance): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE appearances SET date=?,court=?,hearing_type=?,fee_amount=?,is_billed=?,notes=?
     WHERE id=?`,
    [a.date, a.court ?? null, a.hearing_type,
     a.fee_amount, a.is_billed, a.notes ?? null, a.id]
  );
}

export async function deleteAppearance(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM appearances WHERE id = ?", [id]);
}

// ─── Invoices ──────────────────────────────────────────────────────────────

export async function fetchInvoices(matterId: string): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.select<Invoice[]>(
    "SELECT * FROM invoices WHERE matter_id = ? ORDER BY invoice_date DESC",
    [matterId]
  );
  return applyEffectiveStatus(rows);
}

/**
 * Generate the next available invoice number for the current month.
 *
 * Format: {prefix}-{YYYYMM}-{NNN}
 *   e.g.  INV-202606-001, INV-202606-002 …
 *
 * Finds the highest existing sequence number for the given prefix+month
 * combination and increments it. If none exist, starts at 001.
 * The returned number is NOT yet saved — it is a suggestion for the form.
 * Uniqueness is enforced at DB level by idx_invoices_invoice_number.
 */
export async function nextInvoiceNumber(
  prefix: string = "INV",
  date: Date = new Date(),
): Promise<string> {
  const db = await getDb();
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const pattern = `${prefix}-${yyyymm}-%`;

  const rows = await db.select<{ invoice_number: string }[]>(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 50`,
    [pattern]
  );

  // Extract the trailing numeric sequence from each matching number
  let maxSeq = 0;
  for (const { invoice_number } of rows) {
    const parts = invoice_number.split("-");
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  const next = String(maxSeq + 1).padStart(3, "0");
  return `${prefix}-${yyyymm}-${next}`;
}

export async function insertInvoice(inv: Invoice): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO invoices (id,matter_id,invoice_number,invoice_date,due_date,recipient_type,
      address_mode,client_contact_id,firm_contact_id,
      subtotal_amount,gst_rate,cgst,sgst,igst,total_amount,status,notes,pdf_path,line_items_data)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [inv.id, inv.matter_id, inv.invoice_number, inv.invoice_date, inv.due_date,
     inv.recipient_type, inv.address_mode ?? null,
     inv.client_contact_id ?? null, inv.firm_contact_id ?? null,
     inv.subtotal_amount, inv.gst_rate, inv.cgst, inv.sgst,
     inv.igst, inv.total_amount, inv.status, inv.notes ?? null,
     inv.pdf_path ?? null, inv.line_items_data ?? null]
  );
}

export async function updateInvoice(inv: Invoice): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE invoices SET invoice_number=?,invoice_date=?,due_date=?,recipient_type=?,
      address_mode=?,client_contact_id=?,firm_contact_id=?,
      subtotal_amount=?,gst_rate=?,cgst=?,sgst=?,igst=?,total_amount=?,status=?,notes=?,
      pdf_path=?,line_items_data=?
     WHERE id=?`,
    [inv.invoice_number, inv.invoice_date, inv.due_date, inv.recipient_type,
     inv.address_mode ?? null, inv.client_contact_id ?? null, inv.firm_contact_id ?? null,
     inv.subtotal_amount, inv.gst_rate, inv.cgst, inv.sgst, inv.igst,
     inv.total_amount, inv.status, inv.notes ?? null,
     inv.pdf_path ?? null, inv.line_items_data ?? null, inv.id]
  );
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM invoices WHERE id = ?", [id]);
}

// Returns all non-paid, non-cancelled, non-draft invoices with matter info attached
export interface UnpaidInvoiceRow extends Invoice {
  case_title: string;
  client_name: string;
  firm_name: string | null;
}

export async function fetchAllUnpaidInvoices(): Promise<UnpaidInvoiceRow[]> {
  const db = await getDb();
  // Fetch sent/partially_paid/overdue — effectiveStatus will auto-promote
  // sent/partially_paid to overdue if past due_date at read time.
  const rows = await db.select<UnpaidInvoiceRow[]>(`
    SELECT i.*, m.case_title, m.client_name, m.firm_name
    FROM invoices i
    JOIN matters m ON i.matter_id = m.id
    WHERE i.status IN ('sent', 'partially_paid', 'overdue')
    ORDER BY i.due_date ASC
  `);
  return applyEffectiveStatus(rows);
}

// ─── Payments ──────────────────────────────────────────────────────────────

export async function fetchPayments(invoiceId: string): Promise<Payment[]> {
  const db = await getDb();
  return db.select<Payment[]>(
    "SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC",
    [invoiceId]
  );
}

export async function insertPayment(p: Payment): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO payments (id,invoice_id,payment_date,amount_paid,mode,notes,tds_amount,tds_rate,tds_section)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [p.id, p.invoice_id, p.payment_date, p.amount_paid, p.mode, p.notes ?? null,
     p.tds_amount ?? 0, p.tds_rate ?? 0, p.tds_section ?? null]
  );
}

/** Total cash received + TDS deducted across all payments for an invoice. */
export async function deletePayment(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM payments WHERE id = ?", [id]);
}

// ─── Clients ───────────────────────────────────────────────────────────────

export async function fetchClients(): Promise<Client[]> {
  const db = await getDb();
  return db.select<Client[]>("SELECT * FROM clients ORDER BY name ASC");
}

export async function insertClient(c: Client): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO clients (id,name,email,phone,gstin,state,address,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [c.id, c.name, c.email ?? null, c.phone ?? null, c.gstin ?? null,
     c.state ?? null, c.address ?? null, c.notes ?? null, c.created_at]
  );
}

export async function updateClient(c: Client): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE clients SET name=?,email=?,phone=?,gstin=?,state=?,address=?,notes=? WHERE id=?`,
    [c.name, c.email ?? null, c.phone ?? null, c.gstin ?? null,
     c.state ?? null, c.address ?? null, c.notes ?? null, c.id]
  );
}

export async function deleteClient(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM clients WHERE id = ?", [id]);
}

// ─── Firms ─────────────────────────────────────────────────────────────────

export async function fetchFirms(): Promise<Firm[]> {
  const db = await getDb();
  return db.select<Firm[]>("SELECT * FROM firms ORDER BY name ASC");
}

export async function insertFirm(f: Firm): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO firms (id,name,email,phone,gstin,state,address,notes,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [f.id, f.name, f.email ?? null, f.phone ?? null, f.gstin ?? null,
     f.state ?? null, f.address ?? null, f.notes ?? null, f.created_at]
  );
}

export async function updateFirm(f: Firm): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE firms SET name=?,email=?,phone=?,gstin=?,state=?,address=?,notes=? WHERE id=?`,
    [f.name, f.email ?? null, f.phone ?? null, f.gstin ?? null,
     f.state ?? null, f.address ?? null, f.notes ?? null, f.id]
  );
}

export async function deleteFirm(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM firms WHERE id = ?", [id]);
}

// ─── Profile / Settings ────────────────────────────────────────────────────

export async function loadProfile(): Promise<Profile | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'profile'"
  );
  if (!rows.length) return null;
  return JSON.parse(rows[0].value) as Profile;
}

export async function saveProfile(profile: Profile): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('profile', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(profile)]
  );
}

export async function isProfileSetup(): Promise<boolean> {
  const p = await loadProfile();
  return p !== null && (p.advocateName.trim() !== "" || p.firmName.trim() !== "");
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?", [key]
  );
  return rows.length ? rows[0].value : null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM settings WHERE key = ?", [key]);
}

export interface AppLock {
  username: string;
  passwordHash: string;
}

export async function getLock(): Promise<AppLock | null> {
  const raw = await getSetting("app_lock");
  return raw ? JSON.parse(raw) : null;
}

export async function setLock(username: string, password: string): Promise<void> {
  const passwordHash = await sha256(password);
  await setSetting("app_lock", JSON.stringify({ username, passwordHash }));
}

export async function removeLock(): Promise<void> {
  await deleteSetting("app_lock");
}

export async function verifyLock(username: string, password: string): Promise<boolean> {
  const lock = await getLock();
  if (!lock) return true; // no lock set
  const hash = await sha256(password);
  return lock.username === username && lock.passwordHash === hash;
}

// ─── Matter Parties ────────────────────────────────────────────────────────

export async function fetchMatterParties(matterId: string): Promise<MatterParty[]> {
  const db = await getDb();
  return db.select<MatterParty[]>(
    `SELECT * FROM matter_parties WHERE matter_id = ?
     ORDER BY party_type ASC, party_number ASC`,
    [matterId]
  );
}

export async function insertMatterParty(p: MatterParty): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO matter_parties (id,matter_id,party_type,party_number,party_name,notes)
     VALUES (?,?,?,?,?,?)`,
    [p.id, p.matter_id, p.party_type, p.party_number ?? null,
     p.party_name ?? null, p.notes ?? null]
  );
}

export async function updateMatterParty(p: MatterParty): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE matter_parties SET party_type=?,party_number=?,party_name=?,notes=?
     WHERE id=?`,
    [p.party_type, p.party_number ?? null,
     p.party_name ?? null, p.notes ?? null, p.id]
  );
}

export async function deleteMatterParty(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM matter_parties WHERE id = ?", [id]);
}

// ─── Advance Payments ──────────────────────────────────────────────────────

export interface AdvancePayment {
  id: string;
  matter_id: string;
  payment_date: string;
  amount: number;
  mode: string;
  notes?: string;
  created_at: string;
}

export async function fetchAdvancePayments(matterId: string): Promise<AdvancePayment[]> {
  const db = await getDb();
  return db.select<AdvancePayment[]>(
    "SELECT * FROM advance_payments WHERE matter_id = ? ORDER BY payment_date DESC",
    [matterId]
  );
}

export async function insertAdvancePayment(p: AdvancePayment): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO advance_payments (id,matter_id,payment_date,amount,mode,notes,created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [p.id, p.matter_id, p.payment_date, p.amount, p.mode, p.notes ?? null, p.created_at]
  );
}

export async function deleteAdvancePayment(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM advance_payments WHERE id = ?", [id]);
}

// ─── Payments Log (all payments across all matters) ────────────────────────

export interface PaymentLogRow {
  id: string;
  payment_date: string;
  amount: number;
  mode: string;
  notes?: string;
  type: "invoice" | "advance";
  // TDS info (invoice payments only)
  tds_amount?: number;
  tds_rate?: number;
  tds_section?: string;
  // invoice payment extras
  invoice_number?: string;
  invoice_id?: string;
  // matter info
  matter_id: string;
  case_title: string;
  client_name: string;
  firm_name?: string;
}

export async function fetchAllPaymentsLog(): Promise<PaymentLogRow[]> {
  const db = await getDb();

  const invoiceRows = await db.select<PaymentLogRow[]>(`
    SELECT
      p.id, p.payment_date, p.amount_paid AS amount, p.mode, p.notes,
      'invoice' AS type,
      p.tds_amount, p.tds_rate, p.tds_section,
      i.invoice_number, i.id AS invoice_id,
      m.id AS matter_id, m.case_title, m.client_name, m.firm_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN matters m ON i.matter_id = m.id
    ORDER BY p.payment_date DESC
  `);

  const advanceRows = await db.select<PaymentLogRow[]>(`
    SELECT
      ap.id, ap.payment_date, ap.amount, ap.mode, ap.notes,
      'advance' AS type,
      NULL AS invoice_number, NULL AS invoice_id,
      m.id AS matter_id, m.case_title, m.client_name, m.firm_name
    FROM advance_payments ap
    JOIN matters m ON ap.matter_id = m.id
    ORDER BY ap.payment_date DESC
  `);

  return [...invoiceRows, ...advanceRows].sort(
    (a, b) => b.payment_date.localeCompare(a.payment_date)
  );
}

// ─── Contact Persons ──────────────────────────────────────────────────────────

export async function fetchContactPersons(
  entityType: "client" | "firm",
  entityId: string,
): Promise<ContactPerson[]> {
  const db = await getDb();
  return db.select<ContactPerson[]>(
    "SELECT * FROM contact_persons WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC",
    [entityType, entityId],
  );
}

export async function fetchContactPersonById(id: string): Promise<ContactPerson | null> {
  const db = await getDb();
  const rows = await db.select<ContactPerson[]>(
    "SELECT * FROM contact_persons WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

export async function insertContactPerson(cp: ContactPerson): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO contact_persons
       (id,entity_type,entity_id,name,designation,company,email,phone,mobile,
        address,notes,apple_contact_id,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [cp.id, cp.entity_type, cp.entity_id, cp.name,
     cp.designation ?? null, cp.company ?? null, cp.email ?? null,
     cp.phone ?? null, cp.mobile ?? null, cp.address ?? null,
     cp.notes ?? null, cp.apple_contact_id ?? null,
     cp.created_at, cp.updated_at],
  );
}

export async function updateContactPerson(cp: ContactPerson): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE contact_persons
     SET name=?,designation=?,company=?,email=?,phone=?,mobile=?,
         address=?,notes=?,apple_contact_id=?,updated_at=?
     WHERE id=?`,
    [cp.name, cp.designation ?? null, cp.company ?? null,
     cp.email ?? null, cp.phone ?? null, cp.mobile ?? null,
     cp.address ?? null, cp.notes ?? null, cp.apple_contact_id ?? null,
     new Date().toISOString(), cp.id],
  );
}

export async function deleteContactPerson(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM contact_persons WHERE id = ?", [id]);
}

// ─── Backup & Restore ─────────────────────────────────────────────────────────

export const BACKUP_VERSION = 1;

const BACKUP_TABLES = [
  "settings",
  "clients",
  "firms",
  "matters",
  "matter_parties",
  "contact_persons",
  "appearances",
  "time_entries",
  "invoices",
  "payments",
  "advance_payments",
] as const;

export interface BackupManifest {
  version: number;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
}

/** Reads every table and serialises to a JSON string ready to write to disk. */
export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const data: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    try {
      const rows = await db.select<Record<string, unknown>[]>(`SELECT * FROM ${table}`);
      data[table] = rows;
      counts[table] = rows.length;
    } catch {
      data[table] = [];
      counts[table] = 0;
    }
  }

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: "1.0.1",
    counts,
    data,
  };

  return JSON.stringify(manifest, null, 2);
}

/** Validates and imports a JSON backup string, wiping current data first. */
export async function importAllData(jsonStr: string): Promise<BackupManifest> {
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(jsonStr) as BackupManifest;
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (!manifest.version || !manifest.data) {
    throw new Error("This file does not appear to be a Memo App backup.");
  }

  const db = await getDb();

  // Delete in reverse-dependency order to avoid FK issues
  const deletionOrder = [
    "advance_payments",
    "payments",
    "invoices",
    "time_entries",
    "appearances",
    "matter_parties",
    "matters",
    "firms",
    "clients",
    "settings",
  ];
  for (const table of deletionOrder) {
    try { await db.execute(`DELETE FROM ${table}`); } catch { /* table may not exist */ }
  }

  // Insert restored rows — use column names from the JSON to stay
  // schema-forward-compatible even if older backups lack newer columns.
  for (const table of BACKUP_TABLES) {
    const rows = manifest.data[table] ?? [];
    for (const row of rows) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      const placeholders = cols.map(() => "?").join(", ");
      const values = cols.map(c => row[c]);
      try {
        await db.execute(
          `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
          values,
        );
      } catch (err) {
        console.warn(`Skipped row in ${table}:`, err);
      }
    }
  }

  return manifest;
}
