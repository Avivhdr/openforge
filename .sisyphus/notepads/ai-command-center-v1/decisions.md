# Architectural Decisions

This file tracks key architectural choices made during implementation.

---

## Initial Decisions (from plan)

- **Desktop Framework**: Tauri 2.0 (96% smaller than Electron, native feel)
- **Frontend**: Svelte + TypeScript
- **Database**: SQLite via rusqlite or Tauri SQL plugin
- **OpenCode Integration**: Spawn `opencode web`, connect via REST API
- **Agent Control**: Checkpoint-based (discrete steps with approvals)
- **JIRA Filtering**: Default to `assignee = currentUser()` via JQL
- **Polling**: JIRA 60s, GitHub 30-60s (webhooks deferred to v2)

---
