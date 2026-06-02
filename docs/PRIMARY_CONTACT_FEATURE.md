# Primary Contact Feature — Audit & Implementation Report

## Data Model Findings

### Exact column names in the `matters` table
| Column | Type | Purpose |
|---|---|---|
| `primary_client_contact_id` | TEXT | FK → `contact_persons.id` for the client-side primary contact |
| `primary_firm_contact_id` | TEXT | FK → `contact_persons.id` for the AOR / firm-side primary contact |

Both columns are added via `addIfMissing` in `migrate()` (db.ts lines 169–170) so they exist on both new and existing databases.

Both `insertMatter` and `updateMatter` in `db.ts` correctly persist these values.

The `contact_persons` table stores full contact details: `name`, `designation`, `company`, `email`, `phone`, `mobile`, `address`, `notes`, `apple_contact_id`.

## Root Cause

`MatterDetail.tsx` never fetched or displayed the primary contact IDs stored on a matter.

- The `useEffect` only called `fetchTimeEntries`, `fetchAppearances`, and `fetchInvoices`.
- No `fetchContactPersonById` function existed in `db.ts` — only `fetchContactPersons(entityType, entityId)` which fetches all contacts for an entity, not a single contact by ID.
- The info grid in `MatterDetail.tsx` showed client/firm org-level fields but had no section for primary contacts.

`MatterForm.tsx` was working correctly — it fetches contact persons for linked clients/firms and saves the selected `primary_client_contact_id` / `primary_firm_contact_id` to the matter on save.

`MatterList.tsx` does not show primary contact info (appropriate for a compact list view — no change needed).

## What Was Implemented

### 1. New `fetchContactPersonById` function in `db.ts`
Added a direct lookup by contact person ID:

```ts
export async function fetchContactPersonById(id: string): Promise<ContactPerson | null>
```

Queries `contact_persons WHERE id = ?` and returns the single row or `null`.

### 2. Primary contact state and fetching in `MatterDetail.tsx`
- Added `primaryClientContact` and `primaryFirmContact` state (`ContactPerson | null`)
- Extended the `useEffect` to call `fetchContactPersonById` for each ID when set, and clears state when the matter changes or IDs are absent
- Dependencies include `matter.primary_client_contact_id` and `matter.primary_firm_contact_id` so the display updates immediately when the matter is edited

### 3. "Primary Contacts" section in `MatterDetail.tsx`
- Rendered below the "Partner / Associate Handling" section and above Notes
- Only shown when at least one primary contact is set (graceful null handling)
- Each contact rendered via a new `ContactCard` component showing: Name, Designation, Email, Phone/Mobile
- Styled consistently with the existing black & white Tailwind theme (`bg-neutral-50`, `border-neutral-200`, `rounded-xl`)
- Labels distinguish "Client Contact" from "AOR / Firm Contact"

## Files Changed

| File | Change |
|---|---|
| `src/db.ts` | Added `fetchContactPersonById(id: string): Promise<ContactPerson \| null>` |
| `src/components/MatterDetail.tsx` | Import update, two new state variables, extended `useEffect`, new "Primary Contacts" section, new `ContactCard` helper component |

## TypeScript Result

```
npx tsc --noEmit
(no output — zero errors)
```
