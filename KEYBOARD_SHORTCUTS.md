# Memo App — Keyboard Shortcuts

> Version: v1.2.0  
> Last updated: 2026-06-04

Memo is designed for keyboard-first operation. All primary workflows can be completed without a mouse.

---

## Global Navigation

Available from any screen. Suppressed while typing in text fields.

| Shortcut | Action |
|---|---|
| `⌘1` | Go to Dashboard |
| `⌘2` | Go to Matters |
| `⌘3` | Go to Clients |
| `⌘4` | Go to AOR / Firms |
| `⌘5` | Go to Outstanding Dues |
| `⌘6` | Go to Reports |
| `⌘,` | Open Settings |

---

## Quick Actions

| Shortcut | Action |
|---|---|
| `⌘K` | Open Quick Capture palette |

Quick Capture works from any screen. Press `Esc` to close without saving.

---

## Matter Tab Navigation

Active only when a matter is open. Suppressed while typing in text fields.

| Shortcut | Action |
|---|---|
| `⌘⇧O` | Switch to Overview tab |
| `⌘⇧W` | Switch to Work Done tab |
| `⌘⇧I` | Switch to Invoices tab |
| `←` | Previous tab (cycles: Overview → Invoices → Work Done) |
| `→` | Next tab (cycles: Overview → Work Done → Invoices) |

---

## List Navigation

Active in Matters, Clients, and Firms lists. Suppressed while typing in text fields.

| Shortcut | Action |
|---|---|
| `↑` | Move selection up |
| `↓` | Move selection down |
| `Home` | Jump to first item |
| `End` | Jump to last item |
| `Enter` | Open / select highlighted item |
| `/` | Focus the search box |

The selected row is highlighted with a blue left border. Scrolls into view automatically.

---

## Work Done Row Navigation

Active in the Work Done tab when no form is open.

| Shortcut | Action |
|---|---|
| `↑` | Move highlight up |
| `↓` | Move highlight down |
| `Enter` | Open edit form for highlighted row |

---

## Form Shortcuts

These shortcuts work **even while typing in a form field**.

| Shortcut | Action |
|---|---|
| `⌘S` | Save current form |
| `Esc` | Cancel / close modal or form |

### Forms that support ⌘S
- Work Done — Appearance form
- Work Done — Time Entry form
- Quick Capture palette (`⌘S` saves to Inbox)

---

## Focus Management

- **Tab / Shift+Tab** — move between focusable elements
- **Focus trap** — Tab is trapped inside modals (Quick Capture). Focus cannot escape to the background.
- **Focus indicators** — a blue ring (`⌘2563eb`) is shown around the focused element when navigating by keyboard. Invisible when using a mouse.

---

## Usage examples

### Log an appearance in under 5 seconds
```
⌘K               → open Quick Capture
Tab              → focus Type field
↑/↓              → select "Appearance"
Tab              → focus Hearing Type
↑/↓              → select type (fee auto-fills)
⌘S               → Save to Inbox
```

### Navigate to a matter's Work Done tab
```
⌘2               → go to Matters
↑/↓              → select matter (mouse or click)
⌘⇧W             → switch to Work Done tab
```

### Save a form
```
(fill in fields)
⌘S               → Save (works from any field in the form)
```

---

## Reserved — not yet implemented

These shortcuts are reserved for future features. Do not assign them to other actions.

| Shortcut | Reserved for |
|---|---|
| `⌘K` | Currently: Quick Capture. Future: Command Palette (when implemented) |
| `⌘N` | New Matter / New Item (context-sensitive) |
| `⌘F` | Search / filter within current screen |
| `⌘P` | Print / Generate PDF |
| `⌘Z` | Undo (future) |

---

## Architecture

Shortcuts are defined in a single registry:

```
src/lib/keyboard/
  shortcuts.ts            ← All shortcut definitions (keys + descriptions)
  useKeyboardShortcuts.ts ← Hook for registering handlers
                            Also exports useFocusTrap()
```

### Adding a new shortcut

1. Add to `SHORTCUTS` in `shortcuts.ts`:
```ts
MY_ACTION: { key: "meta+shift+m", description: "My action", group: "Global Navigation" },
```

2. Register a handler in the relevant component:
```ts
useKeyboardShortcuts([
  { key: SHORTCUTS.MY_ACTION.key, handler: () => doSomething() },
]);
```

### Rules
- **Never hardcode key strings** in components. Always import from `SHORTCUTS`.
- Navigation shortcuts must set `allowInInputs: false` (default) so they don't fire while the user is typing.
- Save shortcuts must set `allowInInputs: true` — users save mid-form.
- Modal-closing shortcuts (`Esc`) should have `allowInInputs: false`.

---

## Known limitations (v1.1.1)

| Limitation | Plan |
|---|---|
| `⌘S` not wired in MatterForm (new/edit matter) | Phase 3 |
| `⌘S` not wired in SettingsPage | Phase 3 |
| `Enter` → next field not implemented globally | Phase 3 |
| No keyboard shortcut for New Matter (`⌘N`) | Phase 3 |
| No keyboard shortcut for timer start/stop | Phase 3 |
| Outstanding Dues list not keyboard navigable | Phase 3 |
| No shortcut reference overlay (`⌘?`) | Phase 3 |
| Command Palette | Phase 4 |
