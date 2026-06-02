# Documentation Maintenance Rules — Memo

**Version:** 1.0.0  
**Last Updated:** 2026-06-02  
**Enforced for:** Every developer and AI coding agent working on this codebase

---

## The Rule

> **A feature is not complete until every relevant documentation file is updated.**

Code that works but is undocumented is a liability. A future developer (or AI agent) reading stale docs will make wrong assumptions, introduce bugs, and waste hours debugging things that are already documented somewhere. These rules exist to prevent that.

---

## Documentation File Map

```
docs/
├── README.md                     Index + quick facts + update policy
├── PRODUCT_SPEC.md               Business requirements, personas, use cases
├── FEATURE_CATALOG.md            Every feature in detail
├── FEATURE_INVENTORY_MATRIX.md   Feature status matrix + gap analysis
├── DATABASE_DOCUMENTATION.md     Schema, tables, columns, ERD
├── ARCHITECTURE.md               System design, tech stack, data flows
├── API_DOCUMENTATION.md          All APIs, Tauri commands, TypeScript functions
├── USER_GUIDE.md                 End-user instructions for every feature
├── ADMIN_GUIDE.md                Install, update, troubleshoot
├── DEPLOYMENT_GUIDE.md           Build, bundle, distribute
├── SECURITY.md                   Auth, encryption, permissions, risks
├── CHANGELOG.md                  Version history — EVERY change logged here
├── AI_AGENT_GUIDE.md             Architecture for AI/new devs; common mistakes
├── DOCUMENTATION_MAINTENANCE.md  This file
└── MASTER_DOCUMENTATION.md       Single-file complete reference
```

---

## Change Type → Required Documentation Updates

### New Feature

A new feature means any new user-facing capability, screen, or workflow.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | Add under current version: feature name, one-line description |
| `FEATURE_CATALOG.md` | ✅ **Mandatory** | Add a new `F-XX` entry with all fields (purpose, workflow, screens, tables, APIs, permissions, dependencies, related features) |
| `FEATURE_INVENTORY_MATRIX.md` | ✅ **Mandatory** | Add row to the feature matrix; set status (✅/⚠️/🔒/🗄️) |
| `USER_GUIDE.md` | ✅ **Mandatory** | Add a section explaining how to use the feature from the user's perspective |
| `API_DOCUMENTATION.md` | ✅ if new APIs added | Document every new `db.ts` function or Tauri command |
| `DATABASE_DOCUMENTATION.md` | ✅ if new tables/columns | Add table or column definitions |
| `PRODUCT_SPEC.md` | If scope changes | Add functional requirement (FR-XX) if feature was not pre-planned |
| `ARCHITECTURE.md` | If architecture changes | Update component map, data flows, or integration diagram |
| `SECURITY.md` | If new permissions or data | Document new data stored, new permissions requested |
| `AI_AGENT_GUIDE.md` | If new patterns introduced | Add to Component Patterns, State Management, or Common Mistakes |
| `MASTER_DOCUMENTATION.md` | After all above | Sync the master doc to reflect new feature |

---

### New Screen / Component

A new React component that users see or interact with.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | Name the new screen in the changelog entry |
| `USER_GUIDE.md` | ✅ **Mandatory** | Add a section: what the screen does, how to navigate to it, what each action does |
| `FEATURE_CATALOG.md` | ✅ **Mandatory** | Add or update the feature entry with the new screen name |
| `AI_AGENT_GUIDE.md` | ✅ **Mandatory** | Add the component to the Folder Structure section (`src/components/`) with a one-line description |
| `ARCHITECTURE.md` | ✅ **Mandatory** | Add to the Component Map under the relevant section |
| `FEATURE_INVENTORY_MATRIX.md` | ✅ if new feature | Update or add the feature row |

---

### New Database Table

Any `CREATE TABLE IF NOT EXISTS` added to `migrate()` in `src/db.ts`.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Added `table_name` table — purpose" |
| `DATABASE_DOCUMENTATION.md` | ✅ **Mandatory** | Full table entry: purpose, all columns with type/nullable/description, constraints, relationships |
| `DATABASE_DOCUMENTATION.md` (ERD) | ✅ **Mandatory** | Add table to the Mermaid ERD diagram with its relationships |
| `DATABASE_DOCUMENTATION.md` (backup) | ✅ **Mandatory** | Add table name to the backup order and restore order sections |
| `API_DOCUMENTATION.md` | ✅ **Mandatory** | Document the new CRUD functions for the table |
| `AI_AGENT_GUIDE.md` | ✅ **Mandatory** | Add to the "All 11 Tables" section (update count), and to the `BACKUP_TABLES` mistake warning |
| `FEATURE_INVENTORY_MATRIX.md` | ✅ **Mandatory** | Update the "Unused Tables" analysis |
| `MASTER_DOCUMENTATION.md` | After all above | Sync |

**Code checklist when adding a new table:**
```
[ ] CREATE TABLE IF NOT EXISTS added to migrate() in db.ts
[ ] Table name added to BACKUP_TABLES array in db.ts
[ ] Table added to deletionOrder in importAllData() (correct dependency position)
[ ] TypeScript interface added to types.ts
[ ] CRUD functions added to db.ts
[ ] All documentation files above updated
```

---

### New Database Column

Any `addIfMissing()` call added to `migrate()` in `src/db.ts`.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Added `column_name` column to `table_name` — purpose" |
| `DATABASE_DOCUMENTATION.md` | ✅ **Mandatory** | Add column row to the relevant table definition |
| `DATABASE_DOCUMENTATION.md` (Migration History) | ✅ **Mandatory** | Add row: column, table, version added |
| `API_DOCUMENTATION.md` | ✅ if affects existing functions | Note the new field in INSERT/UPDATE function signatures |
| `AI_AGENT_GUIDE.md` | ✅ **Mandatory** | Update Migration History table in Section 12 |

**Code checklist when adding a column:**
```
[ ] addIfMissing("table", "column", "TYPE DEFAULT value") in migrate()
[ ] TypeScript interface in types.ts updated (add optional field: column?: Type)
[ ] INSERT SQL updated (column in column list + value in params array with ?? null)
[ ] UPDATE SQL updated (column=? in SET + value in params array)
[ ] If column needs backfill: backfill logic added after addIfMissing call
[ ] All documentation files above updated
```

---

### New API / Database Function

Any new exported function added to `src/db.ts`, or any new Tauri IPC command in `src-tauri/src/lib.rs`.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Added `functionName()` — purpose" |
| `API_DOCUMENTATION.md` | ✅ **Mandatory** | Full entry: signature, parameters, return type, error cases, implementation notes |
| `FEATURE_INVENTORY_MATRIX.md` | ✅ **Mandatory** | Update the APIs column of the relevant feature row |
| `AI_AGENT_GUIDE.md` | ✅ if introduces new pattern | Add example to API Patterns section if it's a new calling pattern |

**For new Tauri IPC commands specifically, also check:**
```
[ ] Command registered in generate_handler![] in lib.rs
[ ] Required capability added to capabilities/default.json
[ ] capabilities/default.json documented in DEPLOYMENT_GUIDE.md if new capability type
```

---

### New Workflow

A new sequence of steps that achieves a user goal (e.g. "import from contacts", "record payment with TDS").

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | Describe the new workflow in the feature list |
| `USER_GUIDE.md` | ✅ **Mandatory** | Step-by-step instructions for the workflow from the user's perspective |
| `PRODUCT_SPEC.md` | ✅ if new use case | Add a `UC-XX` use case entry |
| `FEATURE_CATALOG.md` | ✅ **Mandatory** | Add or update the User Workflow section of the relevant feature |
| `ARCHITECTURE.md` | ✅ if new data flow | Add a data flow example in the "Data Flow Examples" section |
| `AI_AGENT_GUIDE.md` | ✅ if new pattern | Document any new code patterns the workflow introduces |

---

### New Permission

Any new entry in `src-tauri/capabilities/default.json`, or a new macOS privacy description in `src-tauri/Info.plist`.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Added `permission:name` capability for [reason]" |
| `SECURITY.md` | ✅ **Mandatory** | Add to the Tauri IPC Permissions table OR the macOS TCC Permissions table |
| `DEPLOYMENT_GUIDE.md` | ✅ **Mandatory** | Add to the capabilities/default.json section listing all permissions |
| `THIRD_PARTY_SERVICES.md` | ✅ if new external access | Document what data is accessed and whether it leaves the device |
| `AI_AGENT_GUIDE.md` | ✅ **Mandatory** | Update the "Forgetting to add a capability permission" mistake section |

---

### New External Integration

Any new third-party service, macOS API, or external data source.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | Name the integration and what it provides |
| `THIRD_PARTY_SERVICES.md` | ✅ **Mandatory** | Full entry: service name, version, purpose, data sent externally (yes/no + what) |
| `ARCHITECTURE.md` | ✅ **Mandatory** | Add to External Integrations table and update the data flow diagram |
| `SECURITY.md` | ✅ **Mandatory** | Document what data the integration accesses, whether it leaves the device, what permissions are required |
| `DEPLOYMENT_GUIDE.md` | ✅ if new dependency | Document any new npm package, Cargo crate, or system requirement |
| `ADMIN_GUIDE.md` | ✅ if affects users | Document any new permission prompt users will see |

---

### New Dependency

Any new entry in `package.json` (npm) or `src-tauri/Cargo.toml` (Rust).

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Added dependency `package-name@version` for [reason]" |
| `THIRD_PARTY_SERVICES.md` | ✅ **Mandatory** | Add to the relevant section (Runtime JS Libraries, Tauri Plugins, or Build Tools) |
| `ARCHITECTURE.md` | ✅ **Mandatory** | Add to Technology Stack table |
| `DEPLOYMENT_GUIDE.md` | ✅ if affects build | Note any new build-time requirements |

---

### Removed Feature or Deprecated Code

Any feature disabled, code deleted, or behaviour changed.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Removed / Deprecated: [name] — reason" |
| `FEATURE_CATALOG.md` | ✅ **Mandatory** | Remove the feature entry or mark as removed |
| `FEATURE_INVENTORY_MATRIX.md` | ✅ **Mandatory** | Remove row or update status |
| `USER_GUIDE.md` | ✅ if user-facing | Remove instructions for the removed feature |
| `API_DOCUMENTATION.md` | ✅ if function removed | Remove or strikethrough the function entry |
| `DATABASE_DOCUMENTATION.md` | ✅ if column removed | Note as deprecated (never actually DROP — see migration rules) |

---

### Bug Fix

A fix that changes behaviour without adding new features.

| Documentation File | Required Update | What to Write |
|---|---|---|
| `CHANGELOG.md` | ✅ **Mandatory** | "Fixed: [description of bug and fix]" |
| `AI_AGENT_GUIDE.md` | ✅ if bug was a pattern | Add to Common Mistakes section to prevent recurrence |
| `SECURITY.md` | ✅ if security-related | Document the vulnerability and its fix |
| Others | Only if the fix changes documented behaviour | Update descriptions that were accurate to the bug, not the fix |

---

## Documentation Completion Checklist

Copy this checklist for every change. A change is not complete until every applicable box is checked.

```markdown
## Change: [Feature/Fix/Change Name]
**Type:** [ ] New Feature  [ ] New Screen  [ ] New Table  [ ] New Column
           [ ] New API     [ ] New Workflow [ ] New Permission [ ] New Integration
           [ ] Bug Fix     [ ] Removed Feature  [ ] Dependency Update

### Code
- [ ] Implementation complete
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] App launches without errors (`npm run tauri dev`)
- [ ] Manual test of the specific change performed
- [ ] Manual test of related features (regression check)
- [ ] Test on Mac with EXISTING database (migration test)
- [ ] Test on fresh Mac / empty database (clean install test)

### Tests
- [ ] No existing tests broken
- [ ] New unit tests written for business logic (if applicable)
- [ ] New component tests written (if applicable)
- [ ] Test file updated with new cases

### Documentation — check all that apply

#### Always Required
- [ ] **CHANGELOG.md** — entry added under current version
- [ ] **FEATURE_INVENTORY_MATRIX.md** — feature row added or updated

#### Feature Changes
- [ ] **FEATURE_CATALOG.md** — feature entry added (F-XX) or updated
- [ ] **USER_GUIDE.md** — user-facing instructions added or updated
- [ ] **PRODUCT_SPEC.md** — functional requirement added (if new scope)

#### Database Changes
- [ ] **DATABASE_DOCUMENTATION.md** — table/column definitions updated
- [ ] **DATABASE_DOCUMENTATION.md** — Mermaid ERD updated
- [ ] **DATABASE_DOCUMENTATION.md** — Migration History table updated
- [ ] **AI_AGENT_GUIDE.md** — Section 4 (Database Structure) updated

#### API / Code Changes
- [ ] **API_DOCUMENTATION.md** — new functions or commands documented
- [ ] **AI_AGENT_GUIDE.md** — patterns or mistakes updated (if new pattern)

#### Architecture / Integration Changes
- [ ] **ARCHITECTURE.md** — component map, tech stack, or data flows updated
- [ ] **THIRD_PARTY_SERVICES.md** — new service or library documented
- [ ] **DEPLOYMENT_GUIDE.md** — build process or dependencies updated

#### Security / Permissions
- [ ] **SECURITY.md** — permissions, data access, or risks updated
- [ ] **ADMIN_GUIDE.md** — permission prompts or setup steps updated

#### Final
- [ ] **MASTER_DOCUMENTATION.md** — synced with all above changes
- [ ] **README.md** — index updated if new doc files added

### Release
- [ ] Version bumped in `tauri.conf.json`, `AboutModal.tsx`, `SupportModal.tsx`
- [ ] Git commit created with descriptive message
- [ ] Pushed to GitHub (`git push origin main`)
```

---

## Quick Reference — Which Doc for What

| Question | Go To |
|---|---|
| What does this app do? | `PRODUCT_SPEC.md` |
| What features exist and what is their status? | `FEATURE_INVENTORY_MATRIX.md` |
| How does feature X work in detail? | `FEATURE_CATALOG.md` |
| How do I use feature X as a user? | `USER_GUIDE.md` |
| What is in table X? | `DATABASE_DOCUMENTATION.md` |
| How do I call function X? | `API_DOCUMENTATION.md` |
| How does the system fit together? | `ARCHITECTURE.md` |
| How do I build and distribute? | `DEPLOYMENT_GUIDE.md` |
| What changed in version X? | `CHANGELOG.md` |
| What are the security risks? | `SECURITY.md` |
| How do I install and troubleshoot? | `ADMIN_GUIDE.md` |
| What are the gotchas for AI/new devs? | `AI_AGENT_GUIDE.md` |
| What third-party services are used? | `THIRD_PARTY_SERVICES.md` |
| What environment variables exist? | `ENVIRONMENT_VARIABLES.md` |
| Everything in one place | `MASTER_DOCUMENTATION.md` |

---

## Enforcement

### For Human Developers

Before opening a pull request or committing to `main`, run through the Documentation Completion Checklist above. If a documentation file needs updating and you skip it, the next developer (human or AI) will have incorrect information and may introduce bugs.

### For AI Coding Agents

When completing any task that changes the codebase:

1. **Always update `CHANGELOG.md` first.** This is the minimum documentation for every change.
2. **Run the checklist** and identify every applicable box.
3. **Update each relevant doc file.** Do not skip a file because "it's obvious" — what's obvious to you now won't be obvious to the next agent with no context.
4. **Update `MASTER_DOCUMENTATION.md` last**, after all specific files have been updated, since it is a consolidated reference.
5. **Never mark a task as complete** without confirming documentation is updated.

### Minimum Bar (Non-Negotiable)

No matter how small the change:
- `CHANGELOG.md` — always
- `FEATURE_INVENTORY_MATRIX.md` — for any feature-level change

Everything else — follow the tables above based on change type.

---

## Version History of This Document

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-06-02 | Initial document created |
