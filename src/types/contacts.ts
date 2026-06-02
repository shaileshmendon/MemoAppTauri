/**
 * contacts.ts — shared macOS Contacts types for Memo
 *
 * MacContact mirrors the JSON shape returned by the Rust `search_contacts`
 * Tauri IPC command (src-tauri/src/lib.rs), which queries the macOS
 * Contacts framework via JXA / osascript.
 *
 * Consumers:
 *   - src/components/ContactList.tsx      (org/firm contact import)
 *   - src/components/ContactPersonsPanel.tsx (contact-person import)
 */

export interface MacContact {
  /** Full display name (e.g. "Shailesh Mendon") */
  name: string;
  /** First name */
  givenName: string;
  /** Last name */
  familyName: string;
  /** Company / organisation name */
  organization: string;
  /** Job title / designation */
  jobTitle: string;
  /** All email addresses on the contact */
  emails: string[];
  /** All phone numbers on the contact */
  phones: string[];
  /** Street address (line 1 + line 2 combined) */
  addressStreet: string;
  /** City */
  addressCity: string;
  /** State — raw string from Contacts; use matchState() to normalise */
  addressState: string;
  /** PIN / postal code */
  addressPostal: string;
  /** Country */
  addressCountry: string;
}
