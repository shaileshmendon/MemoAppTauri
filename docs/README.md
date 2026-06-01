# Memo — Documentation Index

**Version:** 1.0.0  
**Last updated:** 2026-05-31

---

## Documents in this folder

| File | Audience | Description |
|---|---|---|
| [CHANGELOG.md](./CHANGELOG.md) | Everyone | What changed in each version |
| [USER_MANUAL.md](./USER_MANUAL.md) | End users (advocates, staff) | How to use every feature |
| [ADMINISTRATOR_MANUAL.md](./ADMINISTRATOR_MANUAL.md) | Developer / distributor | Installation, updates, release process, troubleshooting |
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Developer | Tech stack, data flows, component map |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Developer | Every table, column, type, and relationship |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | Developer | Tauri IPC commands + all TypeScript db functions |
| [THIRD_PARTY_SERVICES.md](./THIRD_PARTY_SERVICES.md) | Business owner / developer | Every library, plugin, and external service used |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Developer | Build-time config, hardcoded constants, data paths |

---

## Quick Facts

- **App name:** Memo
- **Bundle ID:** `com.memoapp.app`
- **Database:** SQLite at `~/Library/Application Support/com.memoapp.app/memoapp.db`
- **Support email:** stripes_swoops_2b@icloud.com
- **Developer UPI:** ssmendon@icici
- **No cloud, no analytics, no subscriptions** — fully local, free forever

---

## Documentation Update Policy

Whenever a new feature, integration, API, database table, workflow, or dependency is added to the codebase:

1. **CHANGELOG.md** — add an entry under the relevant version
2. **DATABASE_SCHEMA.md** — add / update table definitions if schema changed
3. **API_DOCUMENTATION.md** — add any new db functions or Tauri commands
4. **THIRD_PARTY_SERVICES.md** — add any new libraries or services
5. **ENVIRONMENT_VARIABLES.md** — add any new constants or config values
6. **USER_MANUAL.md** — describe the feature for end users
7. **ADMINISTRATOR_MANUAL.md** — add any deploy/update notes
8. **SYSTEM_ARCHITECTURE.md** — update if the architecture changed significantly
