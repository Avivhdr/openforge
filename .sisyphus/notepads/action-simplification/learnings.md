# Learnings — action-simplification

## 2026-03-09 Session Start
- Plan has 11 implementation tasks + 4 verification tasks across 4 waves
- Current DB migration is V7 (line 482-514 in db/mod.rs), next is V8
- TaskRow has 13 fields currently, new columns go at positions 13, 14
- `build_claude_args` at pty_manager.rs:1237, `spawn_claude_pty` at :387
- Provider layer: ClaudeCodeProvider::start at claude_code.rs:17, resume at :47
- run_action at orchestration.rs:250 has two paths: resume (line 292) and start-fresh (line 349)
- Frontend createTask IPC at ipc.ts:4 does NOT pass prompt param (Rust command accepts it though)
- AddTaskDialog.svelte currently only has title, jiraKey, status fields
- Pre-existing LSP warnings in: SettingsActionsCard, App.svelte, KanbanBoard, OpenCodeAgentPanel, PromptInput — these are NOT caused by our changes

## Task 1: Frontend Type Updates (2026-03-09)
- **Completed**: Updated `src/lib/types.ts` with three changes:
  1. Removed `agent: string | null` from Action interface (line 351-358)
  2. Added `agent: string | null` and `permission_mode: string | null` to Task interface after `summary` field (lines 12-13)
  3. Added `'dontAsk'` to PermissionMode union type (line 389)
- **Test Updates**: Modified `src/lib/actions.test.ts` to remove `agent` field from test data
  - Changed "parses stored JSON correctly" test to check properties individually instead of deep equality
  - Removed `agent: null` from all Action test objects in other tests
- **Test Results**: All 875 tests pass ✓
- **TypeScript Check**: No new errors in types.ts (pre-existing errors in test files and actions.ts are unrelated)
- **Key Insight**: The `actions.ts` file still has `agent` field in DEFAULT_ACTIONS and createAction (Task 4 will fix this)
  - Line 26 in actions.ts explicitly adds `agent: a.agent ?? null` when loading, so tests must account for this

## 2026-03-09 Task 2: permission_mode in build_claude_args / spawn_claude_pty
- `build_claude_args` now has 5th param `permission_mode: Option<&str>` — adds `--permission-mode {mode}` BEFORE `--settings`
- `spawn_claude_pty` now has `permission_mode: Option<&str>` after `hooks_settings_path` (7th positional param, before cols/rows)
- All existing callers pass `None` (claude_code.rs start, claude_code.rs resume, claude_hooks.rs integration test)
- 13 total call sites updated (12 in pty_manager.rs tests + 1 in claude_hooks.rs); used ast_grep_replace for batch, then fixed internal call manually
- `cargo test` shows 410 pass, 3 pre-existing failures in db::tasks (task ID format, unrelated to this task)
- `cargo test build_claude_args` → 10/10 pass including 2 new tests
- Pre-existing `cargo test` limitation: needs `mkdir -p dist` to pass build step (main.rs:448 uses tauri::generate_context! which requires frontendDist to exist)
- The 3 failing db::tasks tests are pre-existing randomized task ID issues (not caused by this task)

## Task: Add agent + permission_mode columns to tasks (V8 migration)

### Pattern: Adding new nullable columns to tasks table
- V8 migration uses `M::up_with_hook("", |tx| {...})` pattern (same as V5/V6)
- Check column existence before ALTER to make idempotent: `SELECT COUNT(*) > 0 FROM pragma_table_info('tasks') WHERE name = 'column_name'`
- `ensure_tasks_columns` safety net in `db/mod.rs` also updated with new columns
- New columns added as `Option<String>` in `TaskRow` struct after `summary`

### Pattern: Updating ALL SQL query locations
- 4 SELECT queries return full TaskRow (get_tasks_for_project, get_all_tasks, get_task, get_tasks_with_jira_links)
- 1 INSERT in create_task
- 1 explicit TaskRow construction in create_task return value
- All must be updated in sync or tests will fail at column index
- Column order in SELECT must match `row.get(N)` indices

### Pattern: create_task signature changes
- Adding new Option<&str> params at end of signature preserves backward compat
- Non-test callers: commands/tasks.rs, http_server.rs — pass None, None
- Test callers in db/projects.rs also need updating

### Gotcha: Pre-existing test failures
- `test_create_task_with_prompt` and `test_create_task_prompt_defaults_to_title` were ALREADY failing in HEAD
- Both asserted `task.id == "T-1"` but V7 migration sets random 3-letter prefix
- Fix: add `db.set_config("task_id_prefix", "T").unwrap();` before creating tasks in those tests

### Gotcha: sed replacement for orchestration.rs test TaskRow literals
- Avoid using sed to insert after `prompt: None,` AND `summary: None,` separately
- This creates duplicates since both lines exist in the same struct
- Better: Python script with targeted regex, or manual edits per struct

### user_version test
- `test_new_db_user_version` asserts exact version — update from 7 to 8 when adding migration

## Task 2: Remove agent field from DEFAULT_ACTIONS and createAction

**Completed:** Removed `agent: null` from:
1. DEFAULT_ACTIONS array (line 9)
2. createAction return object (line 45)
3. Simplified loadActions map to handle backward compatibility with old JSON that has `agent` field

**Implementation Details:**
- Used destructuring in loadActions map: `({ agent, ...rest }: Record<string, unknown>) => rest as unknown as Action`
- This strips the `agent` field from old stored JSON while maintaining type safety
- Double cast (`as unknown as Action`) needed because TypeScript can't infer that destructuring removes the field

**Test Results:**
- All 875 tests pass
- No LSP diagnostics
- Backward compatibility verified: loadActions correctly parses old JSON with agent field

**Key Learning:**
- Destructuring with rest operator is cleaner than conditional fallback for backward compatibility
- Double cast pattern is acceptable when the runtime behavior is correct (field is actually removed)

## Task 5: Add permission_mode param to Provider trait and callers (2026-03-09)

**Completed:** Added `permission_mode: Option<&str>` after `agent` in:
1. `Provider::start` and `Provider::resume` in `providers/mod.rs`
2. `ClaudeCodeProvider::start` and `resume` in `providers/claude_code.rs` — pass through to `spawn_claude_pty`
3. `OpenCodeProvider::start` and `resume` in `providers/opencode.rs` — accept as `_permission_mode` (ignored)
4. Three callers in `commands/orchestration.rs` — pass `None` for now
5. One additional caller in `main.rs` (startup resume path) — also updated to pass `None`

**Key Gotcha: Hidden caller in main.rs**
- Cargo test caught an additional caller at `main.rs:123` (`provider.resume(...)` in startup resume logic)
- This is NOT in `orchestration.rs`, so it was missed in the initial grep
- Always run `cargo test` to catch all broken callers after signature changes
- Pattern: startup resume calls `provider.resume` with `None, None` for prompt+agent, needs 3rd `None` for permission_mode

**Approach for new param placement:**
- `permission_mode` comes after `agent` in all method signatures
- `Permission_mode: Option<&str>` is passed through verbatim in ClaudeCode, ignored in OpenCode
- callers pass `None` until Task 7 wires actual values from the DB

**Test Results:** 413 tests pass ✓ (same count as Wave 1 baseline)

## Task 3: create_task command accepts agent + permission_mode (2026-03-09)

**Completed:** Added `agent: Option<String>` and `permission_mode: Option<String>` params to:
1. `commands/tasks.rs` - `create_task` Tauri command (after `prompt: Option<String>`)
2. `src/lib/ipc.ts` - `createTask` TypeScript wrapper (after `projectId`)
3. `src/components/AddTaskDialog.svelte` - passes `null, null` for both new params

**Key Change in tasks.rs:**
- `db.create_task(..., None, None)` → now passes `agent.as_deref(), permission_mode.as_deref()`
- Pattern: `Option<String>` in Tauri command → `Option<&str>` via `.as_deref()` to db method

**Key Change in ipc.ts:**
- Signature: `createTask(title, status, jiraKey, projectId, agent: string | null, permissionMode: string | null)`
- Invoke: adds `agent` and `permissionMode` to invoke payload (Tauri auto-converts camelCase to snake_case)

**Note on initial cargo test failure:**
- `cargo test` output showed stale compile errors from previous session (orchestration.rs and main.rs)
- These were pre-existing and already fixed by Task 5 (providers permission_mode task)
- `cargo check --message-format=short` showed no errors — tests passed: **413 pass** ✓
- `pnpm build` succeeds ✓

**Test Results:** 413 Rust tests pass, pnpm build succeeds

## Task 6: Thread agent/permission_mode from task record through run_action

- `run_action` now computes `effective_agent = agent.or(task.agent.clone())` immediately after fetching the task record.
- Both the resume path (`provider.resume(...)`) and the start-fresh path (`provider.start(...)`) now use:
  - `effective_agent.as_deref()` instead of `agent.as_deref()`
  - `task.permission_mode.as_deref()` instead of `None`
- `start_implementation` was left unchanged (still passes `None` for permission_mode — it's deprecated).
- The `run_action` IPC signature is unchanged (still `agent: Option<String>`).
- The two duplicate `let (task, project_id_owned, ...)` blocks in the file (one in `start_implementation` at line 167, one in `run_action` at line 262) required extra context in the edit to disambiguate.
