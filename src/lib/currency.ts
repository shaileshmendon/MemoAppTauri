/**
 * currency.ts — shared INR formatting utilities for Memo
 *
 * Three variants:
 *   formatINR(n)      — whole rupees, ₹ symbol   e.g. "₹1,23,456"
 *   formatCurrency(n) — two-decimal, ₹ symbol    e.g. "₹1,23,456.00"
 *   formatPDF(n)      — two-decimal, "Rs." prefix e.g. "Rs. 1,23,456.00"
 *                       (PDF fonts lack the ₹ glyph — use Rs. in @react-pdf/renderer)
 *
 * All use the en-IN locale which produces Indian grouping (lakhs/crores).
 */

const FMT_0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const FMT_2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const FMT_2_NUM = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** Whole-rupee display — e.g. ₹1,23,456 */
export function formatINR(n: number): string {
  return FMT_0.format(n);
}

/** Two-decimal rupee display — e.g. ₹1,23,456.00 (for invoices and payment amounts) */
export function formatCurrency(n: number): string {
  return FMT_2.format(n);
}

/**
 * PDF-safe rupee display — e.g. Rs. 1,23,456.00
 * Must use "Rs." because Helvetica/Times/Courier do not contain the ₹ glyph.
 * Use ONLY inside @react-pdf/renderer components.
 */
export function formatPDF(n: number): string {
  return `Rs. ${FMT_2_NUM.format(n)}`;
}
