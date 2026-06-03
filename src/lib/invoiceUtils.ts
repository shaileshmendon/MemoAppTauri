/**
 * invoiceUtils.ts — invoice status helpers for Memo
 *
 * ## The overdue problem
 *
 * Invoice `status` is stored as a static string in SQLite. An invoice created
 * as "sent" on 1 May with due_date = 31 May will still read "sent" on 15 June
 * unless something updates it. The app has no background job, so the DB value
 * is never automatically updated.
 *
 * ## The fix — computed effective status
 *
 * `effectiveStatus(inv)` derives the *real* status at read time:
 *   - If stored status is terminal (paid, cancelled, draft) → keep it.
 *   - If stored status is "in-flight" (sent, partially_paid, overdue) AND
 *     today's LOCAL date is strictly after due_date → return "overdue".
 *   - Otherwise → keep stored status.
 *
 * This is a pure function applied after every DB SELECT via
 * `applyEffectiveStatus()`. No DB writes occur. The DB remains the source of
 * truth for *intentional* status changes (e.g. marking as paid).
 *
 * ## Timezone handling
 *
 * due_date is stored as a plain "YYYY-MM-DD" string (no time, no TZ offset).
 * We compare it against today's LOCAL date string (also YYYY-MM-DD) to avoid
 * UTC/IST off-by-one issues. An invoice due on "2026-06-03" is overdue only
 * from "2026-06-04" onwards in the user's local timezone.
 */

import type { Invoice } from "../types";
import type { InvoiceStatus } from "../types";

/** Statuses that can flip to overdue automatically */
const IN_FLIGHT: InvoiceStatus[] = ["sent", "partially_paid", "overdue"];

/**
 * Returns today's date as a "YYYY-MM-DD" string in LOCAL time.
 * Using this instead of `new Date().toISOString()` (which is UTC) prevents
 * IST invoices flipping overdue 5h30m early.
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Derive the effective invoice status at read time.
 *
 * @param inv   The invoice as stored in the DB.
 * @param today Optional override for "today" — used in tests.
 */
export function effectiveStatus(
  inv: Pick<Invoice, "status" | "due_date">,
  today: string = localDateString(),
): InvoiceStatus {
  // Terminal statuses are never auto-changed
  if (!IN_FLIGHT.includes(inv.status as InvoiceStatus)) {
    return inv.status as InvoiceStatus;
  }

  // No due date set — can't be overdue
  if (!inv.due_date) return inv.status as InvoiceStatus;

  // Overdue: today is strictly AFTER the due date (string comparison is valid
  // for ISO dates — lexicographic order matches chronological order)
  if (today > inv.due_date) return "overdue";

  // Not yet overdue — return stored status (could be "overdue" if manually set
  // and the due date was later extended, so normalise back to "sent")
  if (inv.status === "overdue") return "sent";

  return inv.status as InvoiceStatus;
}

/**
 * Apply effectiveStatus to an array of invoices returned from the DB.
 * Use this after every SELECT query on the invoices table.
 */
export function applyEffectiveStatus<T extends Pick<Invoice, "status" | "due_date">>(
  invoices: T[],
  today?: string,
): T[] {
  return invoices.map(inv => ({
    ...inv,
    status: effectiveStatus(inv, today),
  }));
}

/**
 * Returns true if the invoice is overdue (effective status, not stored).
 */
export function isOverdue(
  inv: Pick<Invoice, "status" | "due_date">,
  today?: string,
): boolean {
  return effectiveStatus(inv, today) === "overdue";
}

/**
 * Returns the number of days an invoice is overdue (negative = days remaining).
 * 0 = due today.
 */
export function daysOverdue(
  inv: Pick<Invoice, "due_date">,
  today: string = localDateString(),
): number {
  if (!inv.due_date) return 0;
  const due = new Date(inv.due_date);
  const now = new Date(today);
  return Math.floor((now.getTime() - due.getTime()) / 86_400_000);
}
