# Security Documentation — Memo v1.0.0

**Last Updated:** 2026-06-02

---

## Security Model Overview

Memo is a **single-user, local-only desktop application**. The security model is designed around the threat of:
1. Unauthorised physical access to the user's Mac
2. Accidental data exposure (human error, shared Mac)

It is **not** designed to defend against:
- Remote attacks (no network surface)
- Sophisticated local privilege escalation
- Multi-user access control

---

## Authentication

### App Lock (PIN)

The only authentication mechanism is an optional PIN-based lock screen.

**Implementation:**

```typescript
// Setting a PIN (src/db.ts → setLock)
async function setLock(pin: string): Promise<void> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pin)
  );
  const hash = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ('lock', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify({ hash })]
  );
}

// Verifying a PIN (src/db.ts → verifyLock)
async function verifyLock(pin: string): Promise<boolean> {
  const lock = await getLock();
  if (!lock) return true;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hash === lock.hash;
}
```

**Hash function:** SHA-256 via Web Crypto API (`crypto.subtle`)  
**Storage:** Hex-encoded hash in `settings` table  
**Salt:** None (see Known Weaknesses)

**Session management:**
- `unlocked: boolean` state in `App.tsx`
- Defaults to `false` when lock is configured
- Set to `true` on correct PIN entry
- Resets to `false` on every app restart
- User can manually lock via sidebar 🔒 button

**Lock screen bypass:** None in the application. Bypasses exist at the OS level (the database file can be accessed directly via Terminal if the user has macOS account access).

---

## Authorization

There is no role-based access control, no feature-level permissions, and no per-record ownership. When unlocked, the user has full read/write access to all data.

---

## Data at Rest

### Database

| Item | Detail |
|---|---|
| Location | `~/Library/Application Support/com.memoapp.app/memoapp.db` |
| Format | SQLite, unencrypted |
| Protection | macOS file system permissions (user-level: `700` or `600`) |
| Contents | All matters, client data, invoices, payments, bank account numbers, GSTIN, PAN |

**The database is not encrypted.** Any user with macOS account access can read the database file using Terminal or a SQLite browser. The protection relies entirely on macOS account authentication.

### Backup Files

| Item | Detail |
|---|---|
| Format | Plain-text JSON |
| Location | User-chosen (Desktop, iCloud, external drive) |
| Encryption | None |
| Contents | Full copy of all database tables |

Backup files are as sensitive as the database itself. Users should store them in protected locations (iCloud Drive with password-protected account, encrypted external drive, etc.).

### Profile Data Stored

The `settings` table `profile` key contains:
- Advocate's full name and firm name
- Office address
- Phone and email
- GSTIN (15-char) and PAN (10-char)
- Bank account number, IFSC code
- UPI ID

This is highly sensitive data. The app does not encrypt it separately from the SQLite file.

---

## Data in Transit

**No data is transmitted to external servers during normal operation.**

The only outbound connections are user-initiated:

| Connection | Trigger | Data Sent |
|---|---|---|
| `upi://pay?pa=ssmendon@icici&am=...` | User clicks "Send Tip" | Payment amount, developer UPI VPA |
| `mailto:stripes_swoops_2b@icloud.com` | User clicks support link | Nothing (opens Mail.app) |

Both are opened by `tauri-plugin-opener → openUrl()` and handled by the OS — Memo does not make HTTP requests.

### macOS Contacts

When the user searches Contacts:
- JXA queries the local Contacts database on-device
- Results are returned to the app in memory
- Contact data is never stored in the app's database unless the user explicitly saves a client/firm/contact person record

---

## Permissions Model

### macOS TCC Permissions

| Permission | Purpose | Status |
|---|---|---|
| Contacts | "From Contacts" import feature | Requested on first use; user grants/revokes |
| File System | PDF export, backup save/load | Granted via entitlements; no prompt |
| Network | None required | Not requested |
| Camera | None | Not requested |
| Microphone | None | Not requested |
| Location | None | Not requested |

### Tauri IPC Permissions

Defined in `src-tauri/capabilities/default.json`. The principle of least privilege is applied — only specific operations are granted, not blanket access:

```json
// File system: only specific operations granted
"fs:allow-write-file"        // Write binary files (PDF)
"fs:allow-write-text-file"   // Write text files (backup JSON)
"fs:allow-read-file"         // Read binary files
"fs:allow-read-text-file"    // Read text files (backup JSON)

// Not granted: fs:allow-list-directory, fs:allow-delete-file, etc.
```

---

## Content Security Policy

The app's CSP is set to `null` (disabled):

```json
"security": { "csp": null }
```

**Rationale:** This is acceptable because:
1. The WebView loads only bundled local assets (no remote URLs in normal operation)
2. There is no user-generated HTML rendered in the WebView
3. The only remote URLs opened are via `openUrl()` which opens them in an external browser/app, not in the WebView

**Risk:** If an attacker were to inject arbitrary content into the WebView (e.g. via an XSS in a client name field displayed without sanitisation), a disabled CSP offers no protection. In practice, all user content is rendered as text nodes (via React's default escaping), not as HTML.

---

## Secrets Management

| Secret | Storage | Protection |
|---|---|---|
| PIN hash | `settings` table in SQLite | SHA-256; unencrypted at file level |
| Developer UPI VPA | Hardcoded in `SupportModal.tsx` | None — intentionally public payment address |
| Bank account numbers | `settings` table (profile) | Unencrypted at file level |
| GSTIN / PAN | `settings` table (profile) | Unencrypted at file level |

**There are no API keys, OAuth tokens, or server secrets** in this application.

---

## Known Weaknesses

| Weakness | Severity | Notes |
|---|---|---|
| No PIN salt | Low | SHA-256 without salt. For a single-user, local-only device, the risk of offline dictionary attack is low. Salt would be a simple improvement. |
| No PIN brute-force protection | Low | No lockout after N wrong attempts. Physical access is required, limiting the attack surface. |
| Database unencrypted | Medium | Any macOS user who can access the Library folder can read the database. Mitigation: use macOS FileVault. |
| Backup files unencrypted | Medium | JSON backups are plain text. Users should store in protected locations. |
| No PIN recovery | Low (UX risk) | Forgotten PINs require database manipulation or full reset. |
| App not code-signed | Medium (distribution) | Gatekeeper blocks on first launch; users must right-click → Open. Not a runtime security issue. |
| CSP disabled | Low | No remote content loaded; default React output is escaped. |
| No audit log | Low | No record of who made changes or when (beyond SQLite timestamps). |

---

## Recommendations for Future Versions

### Short-term
- **Add PIN brute-force protection**: lock after 5 wrong attempts for 30 seconds
- **Add PIN salt**: `sha256(pin + random_salt)` stored with the salt; prevents rainbow table attacks

### Medium-term
- **SQLite encryption**: Use SQLCipher or an encrypted wrapper to protect the database file
- **Encrypted backup files**: Password-protect JSON backups (AES-256)
- **Code signing**: Obtain Apple Developer certificate for proper distribution without Gatekeeper warnings

### Long-term
- **Biometric unlock**: Touch ID / Face ID via macOS LocalAuthentication
- **Secure enclave**: Store PIN hash in macOS Keychain instead of SQLite

---

## Security Contact

For security issues, contact: **stripes_swoops_2b@icloud.com**
