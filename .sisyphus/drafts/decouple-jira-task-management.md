# Draft: Decouple JIRA from Task Management

## Current Architecture (Findings)
- **Stack**: Tauri 2 (Rust) + Svelte 4 + SQLite (rusqlite) + Vite
- **JIRA is currently THE source of tasks**: All tickets come from JIRA sync. No local task creation exists.
- **Ticket ID = JIRA key** (e.g., "PROJ-123") — used as PRIMARY KEY in `tickets` table
- **JIRA sync** is a background poller that fetches issues via JQL and upserts them into SQLite
- **Status mapping**: JIRA status auto-mapped to cockpit status (`map_jira_status_to_cockpit`)
- **PRs matched** to tickets by checking if JIRA key appears in PR title or branch name
- **No "Add Task" UI exists** — the Kanban board is read-only from JIRA

## Requirements (confirmed from user)
- Tasks should be created locally, independently of JIRA
- JIRA link is optional — can be added when creating a task
- Multiple tasks can link to a single JIRA ticket (many-to-one)
- JIRA sync = checking linked tasks against JIRA, displaying info, NOT auto-creating
- Statuses should NOT auto-sync from JIRA — keep them independent
- Tasks need their own unique ID (like JIRA has PROJ-123)
- PR integration should still work (need to figure out matching strategy)
- Keep task management "unopinionated" from JIRA

## Technical Decisions
- **Task ID**: Auto-increment with "T-" prefix (T-1, T-2, T-3). Replaces JIRA key as PK.
- **JIRA sync**: Read-only info display. Fetch JIRA status/details and show as reference. No writes to JIRA.
- **PR matching**: Match via local task ID (T-5) OR linked JIRA key (PROJ-123) in branch/title.
- **JIRA link cardinality**: One optional JIRA link per task. Many tasks can point to same JIRA ticket.
- **Add Task UI**: Both — quick inline add (+ in column header, type title, Enter) AND full form dialog (title, desc, JIRA link, status)
- **JIRA Sync trigger**: Keep background polling, but only update JIRA info fields on tasks that have a JIRA link. No auto-creating tasks from JIRA.
- **Task fields**: Minimal — title, description (optional), status (kanban column), JIRA link (optional)
- **Migration**: Clean slate. Drop existing JIRA-sourced tickets. Fresh start.
- **Test strategy**: Tests after implementation. Matches existing pattern (vitest + Rust #[cfg(test)])

## Metis Gap Resolution

### Auto-Resolved (minor):
- **Status change command**: Need new `update_task_status` Tauri command (implicit, no local status change exists today). Via context menu + detail panel, NOT drag-and-drop.
- **Assignee field**: JIRA-supplementary only. Populated by sync when task has JIRA link. Not user-editable.
- **ID storage**: TEXT "T-42" with `next_task_id` counter in config table. Minimizes FK blast radius.
- **JIRA sync architecture**: Batch JQL `key IN (KEY-1, KEY-2, ...)` for linked tasks only. Single API call.
- **JIRA filter settings**: Keep in UI, but sync logic changes to only fetch linked issues.
- **`transition_ticket`**: Remove — JIRA is read-only.
- **Config preserved**: Yes, config table untouched in migration.
- **Orchestrator**: Update prompts from "JIRA ticket" → "task".
- **Rename**: ticket → task throughout codebase (clean conceptual break).

### User-Decided:
- **Task editing**: YES, fully editable (title, desc, JIRA link)
- **Task deletion**: NO deletion (move to Done instead)
- **PR multi-match**: Link to ALL matching tasks

## Open Questions
- None — all requirements and gaps fully clarified

## Scope Boundaries
- INCLUDE: Task CRUD, ID system, JIRA link decoupling, sync rework, UI changes
- EXCLUDE: (TBD)
