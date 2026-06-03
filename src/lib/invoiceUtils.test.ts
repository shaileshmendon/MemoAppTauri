/**
 * invoiceUtils.test.ts — tests for automatic overdue detection
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from "vitest";
import {
  effectiveStatus,
  applyEffectiveStatus,
  isOverdue,
  daysOverdue,
  localDateString,
} from "./invoiceUtils";
import type { Invoice } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeInvoice(
  overrides: Partial<Pick<Invoice, "status" | "due_date">>
): Pick<Invoice, "status" | "due_date"> {
  return {
    status:   "sent",
    due_date: "2026-06-01",
    ...overrides,
  };
}

// ── localDateString ────────────────────────────────────────────────────────

describe("localDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = localDateString(new Date(2026, 5, 3)); // June 3 2026
    expect(result).toBe("2026-06-03");
  });

  it("zero-pads month and day", () => {
    const result = localDateString(new Date(2026, 0, 5)); // Jan 5 2026
    expect(result).toBe("2026-01-05");
  });
});

// ── effectiveStatus ────────────────────────────────────────────────────────

describe("effectiveStatus — sent invoices", () => {
  it("is overdue when today is after due_date", () => {
    const inv = makeInvoice({ status: "sent", due_date: "2026-06-01" });
    expect(effectiveStatus(inv, "2026-06-02")).toBe("overdue");
  });

  it("is overdue when today is far past due_date", () => {
    const inv = makeInvoice({ status: "sent", due_date: "2026-01-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("overdue");
  });

  it("is still sent when today equals due_date (due today, not overdue)", () => {
    const inv = makeInvoice({ status: "sent", due_date: "2026-06-03" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("sent");
  });

  it("is still sent when today is before due_date", () => {
    const inv = makeInvoice({ status: "sent", due_date: "2026-12-31" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("sent");
  });

  it("is still sent when due_date is empty string", () => {
    const inv = makeInvoice({ status: "sent", due_date: "" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("sent");
  });
});

describe("effectiveStatus — partially_paid invoices", () => {
  it("is overdue when today is after due_date", () => {
    const inv = makeInvoice({ status: "partially_paid", due_date: "2026-05-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("overdue");
  });

  it("is still partially_paid when not yet past due", () => {
    const inv = makeInvoice({ status: "partially_paid", due_date: "2026-12-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("partially_paid");
  });
});

describe("effectiveStatus — paid invoices", () => {
  it("remains paid even when past due_date", () => {
    const inv = makeInvoice({ status: "paid", due_date: "2026-01-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("paid");
  });

  it("remains paid regardless of due_date", () => {
    const inv = makeInvoice({ status: "paid", due_date: "2099-12-31" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("paid");
  });
});

describe("effectiveStatus — terminal statuses are never auto-changed", () => {
  it("draft remains draft even past due_date", () => {
    const inv = makeInvoice({ status: "draft", due_date: "2026-01-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("draft");
  });

  it("cancelled remains cancelled even past due_date", () => {
    const inv = makeInvoice({ status: "cancelled", due_date: "2026-01-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("cancelled");
  });
});

describe("effectiveStatus — manually stored overdue status", () => {
  it("normalises overdue back to sent when due_date is in the future", () => {
    // Edge case: user manually set status=overdue but then extended the due date
    const inv = makeInvoice({ status: "overdue", due_date: "2026-12-31" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("sent");
  });

  it("keeps overdue when due_date is in the past (consistent)", () => {
    const inv = makeInvoice({ status: "overdue", due_date: "2026-01-01" });
    expect(effectiveStatus(inv, "2026-06-03")).toBe("overdue");
  });
});

// ── applyEffectiveStatus ──────────────────────────────────────────────────

describe("applyEffectiveStatus", () => {
  it("promotes sent invoices past due to overdue", () => {
    const invoices = [
      makeInvoice({ status: "sent",          due_date: "2026-05-01" }),
      makeInvoice({ status: "sent",          due_date: "2026-12-01" }),
      makeInvoice({ status: "paid",          due_date: "2026-01-01" }),
      makeInvoice({ status: "partially_paid", due_date: "2026-04-01" }),
    ];
    const result = applyEffectiveStatus(invoices, "2026-06-03");
    expect(result[0].status).toBe("overdue");        // past due
    expect(result[1].status).toBe("sent");            // future due
    expect(result[2].status).toBe("paid");            // terminal
    expect(result[3].status).toBe("overdue");         // partially_paid past due
  });

  it("preserves other fields unchanged", () => {
    const inv = { status: "sent" as const, due_date: "2026-01-01", id: "abc" } as Invoice;
    const [result] = applyEffectiveStatus([inv], "2026-06-03");
    expect(result.id).toBe("abc");
    expect(result.due_date).toBe("2026-01-01");
  });
});

// ── isOverdue ─────────────────────────────────────────────────────────────

describe("isOverdue", () => {
  it("returns true when past due", () => {
    expect(isOverdue({ status: "sent", due_date: "2026-01-01" }, "2026-06-03")).toBe(true);
  });

  it("returns false when due today", () => {
    expect(isOverdue({ status: "sent", due_date: "2026-06-03" }, "2026-06-03")).toBe(false);
  });

  it("returns false when paid and past due", () => {
    expect(isOverdue({ status: "paid", due_date: "2026-01-01" }, "2026-06-03")).toBe(false);
  });

  it("returns false when future due date", () => {
    expect(isOverdue({ status: "sent", due_date: "2026-12-31" }, "2026-06-03")).toBe(false);
  });
});

// ── daysOverdue ───────────────────────────────────────────────────────────

describe("daysOverdue", () => {
  it("returns positive days when past due", () => {
    expect(daysOverdue({ due_date: "2026-06-01" }, "2026-06-03")).toBe(2);
  });

  it("returns 0 when due today", () => {
    expect(daysOverdue({ due_date: "2026-06-03" }, "2026-06-03")).toBe(0);
  });

  it("returns negative days when due in the future", () => {
    expect(daysOverdue({ due_date: "2026-06-10" }, "2026-06-03")).toBe(-7);
  });

  it("returns 0 when due_date is empty", () => {
    expect(daysOverdue({ due_date: "" }, "2026-06-03")).toBe(0);
  });

  it("handles 30 days overdue correctly", () => {
    expect(daysOverdue({ due_date: "2026-05-04" }, "2026-06-03")).toBe(30);
  });
});
