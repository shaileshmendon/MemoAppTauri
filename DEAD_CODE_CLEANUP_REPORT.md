# Dead Code Cleanup Report — Memo (LegalBillTauri)

## Summary

| Metric | Value |
|---|---|
| Files audited | 34 (all .ts / .tsx under src/) |
| Items removed | 5 |
| Lines deleted | 47 |
| Items flagged but kept | 1 |
| Final `npx tsc --noEmit` | Clean (0 errors) |

---

## Items Removed

### 1. Dead `useState` for `setRecipient` — `src/components/Invoices.tsx` (line 432)

```ts
// REMOVED:
const [, setRecipient] = useState<RecipientType>("both"); // kept for compat
```

The state value was already intentionally discarded (`[,` destructuring) with a "kept for compat" comment. The setter `setRecipient` was called in two places inside a `useEffect` (lines 460, 463 — also removed), but the state was never read. The final `invoice.recipient_type` is derived directly from `addressMode` via the local variable `legacyRecipient` (line 537), making the `useState` completely redundant.

**Also removed:** The two `setRecipient(...)` call sites and surrounding comment block (~7 lines total):

```ts
// REMOVED:
// Pre-fill recipient from matter setting
if (matter.invoice_recipient) {
  setRecipient(matter.invoice_recipient);
} else {
  // Auto-detect: if no firm, default to client
  setRecipient(matter.firm_name ? "both" : "client");
}
```

**Why safe:** The `RecipientType` import and the `legacyRecipient` local variable remain; only the dead `useState` and its two no-op calls were removed. No runtime behaviour changes.

---

### 2. `fetchUnbilledTimeEntries` — `src/db.ts` (was line 299)

```ts
export async function fetchUnbilledTimeEntries(matterId: string): Promise<TimeEntry[]>
```

Exported but never imported in any file under `src/`. The related `fetchAllBillableTimeEntries` (which includes all billable entries regardless of billed status) is used by `Invoices.tsx` for the invoice form. This narrower query was superseded.

**Why safe:** Zero import sites found with `grep -r`. No test files in the project.

---

### 3. `fetchUnbilledAppearances` — `src/db.ts` (was line 357)

```ts
export async function fetchUnbilledAppearances(matterId: string): Promise<Appearance[]>
```

Same situation as `fetchUnbilledTimeEntries`. `fetchAllBillableAppearances` is used; this narrower variant is not.

**Why safe:** Zero import sites.

---

### 4. `fetchInvoiceSettlement` — `src/db.ts` (was line 491)

```ts
export async function fetchInvoiceSettlement(invoiceId: string): Promise<{
  totalPaid: number; totalTds: number; totalSettled: number;
}>
```

Computes the settled amount for a single invoice. Never imported anywhere in `src/`. Payment settlement is computed inline in components (`OutstandingDues.tsx`, `RecordPayment.tsx`) rather than via this helper.

**Why safe:** Zero import sites.

---

### 5. `fetchContactPerson` (singular) — `src/db.ts` (was line 790)

```ts
export async function fetchContactPerson(id: string): Promise<ContactPerson | null>
```

The plural `fetchContactPersons` (by `entity_type` + `entity_id`) is used. This singular-by-id variant is not imported anywhere.

**Why safe:** Zero import sites.

---

## Items Flagged but NOT Removed

### `{false && <SupportModal>}` block in `src/components/AboutModal.tsx` (line 55)

The block:
```tsx
{false && (
  <button onClick={() => setShowSupport(true)} ...>
    <Heart size={14} fill="white" />
    Support the Developer
  </button>
)}
```

This is permanently dead JSX (the condition is the literal `false`). However, the instructions explicitly state this block must be kept as it may be activated later. The dependent code — `useState(false)` for `showSupport`, the `SupportModal` import, and the `Heart` icon — all serve this hidden block and were left untouched.

---

## Files Changed

| File | Lines Before | Lines After | Lines Removed |
|---|---|---|---|
| `src/components/Invoices.tsx` | 853 | 845 | 8 |
| `src/db.ts` | 938 | 899 | 39 |
| **Total** | **1791** | **1744** | **47** |

---

## TypeScript

```
$ npx tsc --noEmit
(no output — 0 errors)
```

All changes are type-clean. The `RecipientType` import in `Invoices.tsx` was retained because it is still used by the `legacyRecipient` local variable.
