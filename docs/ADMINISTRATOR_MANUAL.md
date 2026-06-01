# Administrator Manual

**App:** Memo v1.0.0  
**Last updated:** 2026-05-31  
**Audience:** Developer or technically-aware person distributing and maintaining the app

---

## 1. System Requirements

| Requirement | Minimum |
|---|---|
| macOS | Ventura 13.0 or later |
| Architecture | Apple Silicon (M1/M2/M3) or Intel x86-64 |
| Disk space (app) | ~15 MB |
| Disk space (data) | Grows with usage; typically < 50 MB for a busy practice |
| RAM | 256 MB free |
| Internet | Not required (app works fully offline) |
| Contacts permission | Required for Contacts import feature; optional otherwise |

---

## 2. Installation

### Fresh Install

1. Build the DMG:
   ```bash
   cd "/Volumes/Mac 1TB/Claude Code/Mac App/LegalBillTauri"
   npm run tauri build
   ```
2. Find the DMG at:
   ```
   src-tauri/target/release/bundle/dmg/Memo_1.0.0_aarch64.dmg
   ```
3. Share the DMG file with the user.
4. User double-clicks the DMG, drags **Memo** to Applications, and launches.

### Gatekeeper (first launch)

Because the app is not signed with an Apple Developer certificate, macOS will block it on first launch. The user must:
1. Right-click (or Control-click) **Memo.app** → **Open**
2. Click **Open** in the dialog

This is a one-time step. After that, double-clicking works normally.

Alternatively, run in Terminal after installation:
```bash
xattr -dr com.apple.quarantine /Applications/Memo.app
```

---

## 3. Update Process

To update an existing installation:

1. Build the new DMG as above
2. Share it with the user
3. User drags the new **Memo.app** over the existing one in Applications (confirm replace)
4. **Database is untouched** — it lives in `~/Library/Application Support/com.memoapp.app/` which is separate from the app bundle

**Schema migrations** run automatically on first launch of the new version. No manual steps are required.

---

## 4. Data Location

| Item | Path |
|---|---|
| Database | `~/Library/Application Support/com.memoapp.app/memoapp.db` |
| App data folder | `~/Library/Application Support/com.memoapp.app/` |
| App bundle | `/Applications/Memo.app` |

To inspect the database directly (for debugging):
```bash
sqlite3 ~/Library/Application\ Support/com.memoapp.app/memoapp.db
```

---

## 5. Backup & Restore

### Built-in backup (recommended)
- **Settings → Backup & Restore → Export Backup**
- Saves a dated `.json` file anywhere the user chooses (Desktop, iCloud Drive, external drive)
- To restore: **Import Backup** → choose the file → confirm

### Manual database copy
```bash
# Backup
cp ~/Library/Application\ Support/com.memoapp.app/memoapp.db ~/Desktop/memoapp-backup.db

# Restore (app must be closed)
cp ~/Desktop/memoapp-backup.db ~/Library/Application\ Support/com.memoapp.app/memoapp.db
```

---

## 6. Releasing a New Version

### Version bump checklist

1. Update version in `src-tauri/tauri.conf.json`:
   ```json
   "version": "1.1.0"
   ```
2. Update version in `src/components/AboutModal.tsx` and `SupportModal.tsx` (hardcoded strings)
3. If schema changed: add `addIfMissing(...)` calls in `src/db.ts → migrate()` — never drop or rename columns
4. Update `docs/CHANGELOG.md` with what changed
5. Update `docs/DATABASE_SCHEMA.md` if tables/columns changed
6. Update other docs as needed
7. Build:
   ```bash
   npm run tauri build
   ```
8. Test on a Mac that has an existing database to verify the migration runs cleanly
9. Distribute the new DMG

---

## 7. Adding the Tip / Support Feature

The tip infrastructure is built but the UI is hidden. To activate:

1. Open `src/components/AboutModal.tsx`
2. Find the block starting with `{/* Support the developer — hidden for now */}`
3. Remove the `{false && (...)}` wrapper so the button renders
4. Rebuild and distribute

The UPI VPA is `ssmendon@icici` (configured in `src/components/SupportModal.tsx`).

---

## 8. Contacts Permission

On first use of "From Contacts", macOS shows a permission dialog. The prompt reads:

> "Memo" would like to access your Contacts.
> *Memo uses your Contacts to help fill in client and firm details when creating new records.*

If a user accidentally denies this:
- **System Settings → Privacy & Security → Contacts** → find Memo → toggle On

---

## 9. Development Setup

```bash
# Prerequisites
# - Node.js 20+
# - Rust (stable) via rustup
# - Xcode Command Line Tools

# Clone / open project
cd "/Volumes/Mac 1TB/Claude Code/Mac App/LegalBillTauri"

# Install JS dependencies
npm install

# Run in development mode (hot reload)
npm run tauri dev

# Type-check only (no build)
npx tsc --noEmit

# Regenerate app icons from SVG
npm run tauri icon app-icon.svg

# Production build
npm run tauri build
```

---

## 10. Troubleshooting

### App won't open (Gatekeeper)
See section 2 above. Use `xattr -dr com.apple.quarantine /Applications/Memo.app`.

### "Database is locked" error
Another process (e.g. DB browser) has the database open. Close it.

### Contacts search hangs
- Check System Settings → Privacy & Security → Contacts → Memo is On
- If still hanging, `osascript` may be slow due to a large address book. Results appear within ~5 seconds for books < 5,000 contacts.

### Data not showing after update
The migration may have failed silently. Open Terminal:
```bash
sqlite3 ~/Library/Application\ Support/com.memoapp.app/memoapp.db ".schema matters"
```
Check that columns like `ref_number`, `primary_client_contact_id` exist.

### Reset everything (last resort)
```bash
# Removes all data — irreversible
rm ~/Library/Application\ Support/com.memoapp.app/memoapp.db
```
Relaunch the app — onboarding runs again from scratch.
