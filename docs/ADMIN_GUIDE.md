# Administrator Guide — Memo v1.0.0

**Last Updated:** 2026-06-02  
**Audience:** Developer distributing and maintaining the application

---

## System Requirements

| Requirement | Specification |
|---|---|
| macOS | Ventura 13.0 or later |
| Architecture | Apple Silicon (arm64) or Intel (x86_64) |
| RAM | 256 MB minimum free |
| Disk (app bundle) | ~15 MB |
| Disk (data) | Grows with usage; typically < 50 MB for an active practice |
| Internet connection | Not required |
| Xcode / CLT | Not required for end users |

---

## Installation

### Installing for the First Time

1. Build or obtain the DMG file (see DEPLOYMENT_GUIDE.md)
2. Double-click the DMG
3. Drag **Memo** to the Applications folder
4. Eject the DMG
5. Launch Memo from Applications or Spotlight

### Gatekeeper Bypass (First Launch)

Because the app is not signed with an Apple Developer certificate, macOS blocks it on first launch with:

> "Memo" cannot be opened because the developer cannot be verified.

**Method 1 (recommended):** Right-click Memo.app → Open → click Open in the dialog

**Method 2 (command line):**
```bash
xattr -dr com.apple.quarantine /Applications/Memo.app
```

This is a one-time step. After that, double-clicking works normally.

---

## Data Location

| Item | Path |
|---|---|
| SQLite database | `~/Library/Application Support/com.memoapp.app/memoapp.db` |
| App data folder | `~/Library/Application Support/com.memoapp.app/` |
| App bundle | `/Applications/Memo.app` |
| User backup files | User-chosen location (Desktop, iCloud Drive, etc.) |

The data folder is completely separate from the app bundle. Updating or uninstalling the app never affects the data.

### Inspecting the Database Directly

```bash
sqlite3 ~/Library/Application\ Support/com.memoapp.app/memoapp.db

# Useful commands:
.tables                          -- list all tables
.schema matters                  -- show matters table schema
SELECT COUNT(*) FROM matters;    -- count matters
SELECT * FROM settings;          -- view profile and lock
.quit
```

---

## Updating the App

### Standard Update Process

1. Build the new version (see DEPLOYMENT_GUIDE.md)
2. Share the new DMG with the user
3. User double-clicks the new DMG
4. Drags **Memo.app** onto Applications → confirms Replace
5. Launch the updated app

**The database is never touched.** It lives in `~/Library/Application Support/` which is completely separate from the `.app` bundle.

### Schema Migrations

Schema migrations run **automatically on first launch** of the new version. The `migrate()` function in `src/db.ts`:
1. Runs `CREATE TABLE IF NOT EXISTS` for any new tables
2. Runs `addIfMissing()` for any new columns
3. Runs any backfill logic (e.g. assigning `ref_number` to existing matters)

**No manual SQL commands are ever needed.** The migration is safe — it never drops or renames columns.

### Testing an Update

Before distributing a new version to end users:
1. Build the release DMG
2. Test on a Mac that has an existing database (not a fresh install)
3. Verify: all existing data is intact
4. Verify: new features work
5. Verify: the `npx tsc --noEmit` check passes before building

---

## Version Release Checklist

When releasing a new version:

- [ ] Increment `"version"` in `src-tauri/tauri.conf.json`
- [ ] Update version string in `src/components/AboutModal.tsx`
- [ ] Update version string in `src/components/SupportModal.tsx` (constant `APP_VERSION`)
- [ ] Add any new `addIfMissing()` calls to `src/db.ts → migrate()`
- [ ] Update `docs/CHANGELOG.md`
- [ ] Update affected documentation files
- [ ] Run `npx tsc --noEmit` — must pass with no errors
- [ ] Run `npm run tauri build`
- [ ] Test on Mac with existing database (migration test)
- [ ] Test on fresh Mac (clean install test)
- [ ] Distribute new DMG

---

## Activating the Tip Feature

The "Support the Developer" tip flow is built but hidden. To activate:

1. Open `src/components/AboutModal.tsx`
2. Find the comment: `{/* Support the developer — hidden for now */}`
3. The code wrapped in `{false && (...)}` — remove the `{false && ...}` wrapper:

```tsx
// Before (hidden):
{false && (
  <button onClick={() => setShowSupport(true)} ...>
    Support the Developer
  </button>
)}

// After (visible):
<button onClick={() => setShowSupport(true)} ...>
  Support the Developer
</button>
```

4. Run `npx tsc --noEmit` to verify no errors
5. Rebuild and distribute

**UPI ID:** `ssmendon@icici` (in `src/components/SupportModal.tsx` constant `DEVELOPER_UPI`)

---

## Contacts Permission

On first use of "From Contacts", macOS shows:

> "Memo" would like to access your Contacts.  
> *Memo uses your Contacts to help fill in client and firm details when creating new records.*

If a user accidentally clicks Don't Allow:
- **System Settings → Privacy & Security → Contacts → find Memo → toggle On**

---

## Backup Management

### Manual Database Backup

```bash
# Close the app first, then:
cp ~/Library/Application\ Support/com.memoapp.app/memoapp.db ~/Desktop/memoapp-backup-$(date +%Y%m%d).db
```

### Manual Database Restore

```bash
# Close the app first, then:
cp ~/Desktop/memoapp-backup-20260601.db ~/Library/Application\ Support/com.memoapp.app/memoapp.db
```

### Built-in Backup

Preferred method. User can export via Settings → Backup & Restore. The JSON backup format is more forward-compatible than copying the raw SQLite file (it handles schema changes automatically on restore).

---

## Troubleshooting

### "App cannot be opened" (Gatekeeper)
Use `xattr -dr com.apple.quarantine /Applications/Memo.app` in Terminal.

### App crashes on launch
Check Console.app for crash logs. Common cause: corrupted database.

```bash
# Test database integrity:
sqlite3 ~/Library/Application\ Support/com.memoapp.app/memoapp.db "PRAGMA integrity_check;"
# Should output: ok
```

If corrupted, restore from a JSON backup (Settings → Backup & Restore) or a `cp` backup.

### Contacts search never returns results
1. Check System Settings → Privacy & Security → Contacts → Memo is On
2. Try with a simpler query (single word)
3. Large contact books (>5,000 contacts) may take 5+ seconds — wait for results

### Contacts search returns "osascript" error
macOS may have a stale permission. Go to System Settings → Privacy & Security → Contacts → find Memo → toggle off then on.

### Input fields don't respond to typing
This was a bug in early versions caused by `startDragging()` making the WebView lose keyboard focus. **Fixed in v1.0.0** by switching to `data-tauri-drag-region` attribute. If this reappears, check `App.tsx` drag bar for any `startDragging()` calls.

### Typing invisible in dark mode
Ensure `index.css` contains `color-scheme: light` on `:root`. This prevents macOS Dark Mode from setting near-white text on white inputs.

### Invoice PDF shows squares instead of ₹ symbol
This is expected. The built-in PDF fonts (Helvetica, Times) don't include the ₹ glyph. The app uses "Rs." instead. To display ₹, embed a custom font in `InvoicePDF.tsx`.

### "Unable to merge unrelated histories" in GitHub Desktop
This happens when the GitHub repo was initialised with a README (different history). Fix:
```bash
cd "/path/to/project"
git pull origin main --allow-unrelated-histories --no-rebase
git push origin main
```

### Full Reset (last resort)

```bash
# Removes all data — irreversible
rm ~/Library/Application\ Support/com.memoapp.app/memoapp.db
# Relaunch → onboarding runs from scratch
```

---

## App Lock Administration

If a user forgets their PIN:
- There is no PIN recovery mechanism
- The lock hash is in `settings` table with key `lock`
- **Option 1:** Delete the lock row directly:
  ```bash
  sqlite3 ~/Library/Application\ Support/com.memoapp.app/memoapp.db \
    "DELETE FROM settings WHERE key = 'lock';"
  ```
- **Option 2:** Full reset (loses all data unless they have a backup)

---

## Demo Data

For new user onboarding or testing:

**Load demo data:** Settings → Demo Data → Load Demo Data  
Creates: 3 matters, 4 appearances, 4 time entries, 1 invoice, 1 payment

**Clear all data:** Settings → Demo Data → Clear All Data  
Removes all transactional data; keeps profile and settings.

Both actions require confirmation and reload the app.
