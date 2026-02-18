# Learnings — remove-subfolder-scanning

## Conventions & Patterns

(Subagents append findings here after each task)
# Task 2: Remove scan_repos Command + RepoInfo Struct - Learnings

**Timestamp:** 2026-02-18

## Summary
Successfully removed the `scan_repos` Tauri command and all related code from the Rust backend. All deletions completed cleanly with zero compilation errors.

## Key Findings

### 1. Deletion Sequence
- **RepoInfo struct** (git_worktree.rs:59-63): Removed cleanly, no other references
- **Repository Scanning section** (git_worktree.rs:87-127): Entire section including comment banner and function deleted
- **git2 import**: Not explicitly imported at top of file (was only used within deleted scan_repos function)
- **scan_repos Tauri command** (main.rs:229-235): Removed with proper spacing
- **invoke_handler entry** (main.rs:889): Removed from macro list

### 2. Critical Gotcha Avoided
The `invoke_handler![]` macro is where all Tauri commands are registered. Removing the function definition alone would have caused a compile error if the macro entry wasn't also removed. Both deletions were necessary and completed.

### 3. Build Verification
- `cargo build` succeeded with exit code 0
- 28 pre-existing warnings (unrelated to this task)
- No new errors introduced

### 4. QA Results
All four verification scenarios passed:
- ✅ QA1: `grep -c "scan_repos" src-tauri/src/main.rs` = 0
- ✅ QA2: `grep -c "RepoInfo" src-tauri/src/git_worktree.rs` = 0
- ✅ QA3: `grep -c "git2" src-tauri/src/git_worktree.rs` = 0
- ✅ QA4: `grep -c "create_worktree" src-tauri/src/git_worktree.rs` = 4 (intact)

## Patterns & Conventions Observed
1. **Section separators**: Code uses comment banners (`// ============...`) to organize logical sections
2. **Tauri command pattern**: All commands use `#[tauri::command]` attribute with `State<'_>` parameters
3. **Error handling**: Commands return `Result<T, String>` with `.map_err()` conversions
4. **Macro registration**: The `invoke_handler![]` macro must include all exported commands

## No Issues Encountered
- Clean deletion with no orphaned references
- No unused imports left behind
- Worktree operations remain fully functional
- No edge cases or gotchas

## Files Modified
- `src-tauri/src/git_worktree.rs`: Removed RepoInfo struct and scan_repos function
- `src-tauri/src/main.rs`: Removed scan_repos command and invoke_handler entry

## Scope Boundaries Respected
- ✅ Did NOT remove git2 from Cargo.toml (out of scope)
- ✅ Did NOT touch worktree operations (create_worktree, delete_worktree, etc.)
- ✅ Did NOT modify other Tauri commands
- ✅ Did NOT modify code outside git_worktree.rs and main.rs

## 2026-02-18 - Task 1: DB Migration repos_root_path → path

### Changes Made
- Added migration code in `Database::new()` (lines 264-279) to safely rename column for existing databases
- Migration pattern: Check if old column exists using `pragma_table_info`, then `ALTER TABLE ... RENAME COLUMN`
- Updated CREATE TABLE statement to use `path` instead of `repos_root_path`
- Renamed `ProjectRow.repos_root_path` to `ProjectRow.path`
- Updated all 4 CRUD methods: `create_project`, `get_all_projects`, `get_project`, `update_project`
- Changed function parameter names from `repos_root_path` to `path` for consistency

### Migration Pattern Used
```rust
let repos_root_path_exists: bool = conn.query_row(
    "SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name='repos_root_path'",
    [],
    |row| {
        let count: i64 = row.get(0)?;
        Ok(count > 0)
    },
)?;

if repos_root_path_exists {
    conn.execute(
        "ALTER TABLE projects RENAME COLUMN repos_root_path TO path",
        [],
    )?;
}
```

### Verification Results
- ✅ `cargo build` succeeded (exit 0, only warnings, no errors)
- ✅ `cargo test` passed (51/51 tests passed)
- ✅ `grep -c "repos_root_path" src-tauri/src/db.rs` returns 5 (all in migration code)
- Evidence saved to `.sisyphus/evidence/task-1-*.txt`

### Key Learnings
1. SQLite column renames require `ALTER TABLE ... RENAME COLUMN` (not DROP/ADD)
2. Migration must check if column exists before renaming to support both fresh and existing databases
3. The migration code itself contains the old column name (5 occurrences), which is correct
4. All SQL statements (INSERT, SELECT, UPDATE) must be updated to use new column name
5. Struct field names must match for serde serialization to work correctly

### Notes
- Did NOT modify `main.rs` (as instructed) - that will be handled by Task 2
- Did NOT touch `worktrees.repo_path` column (different field)
- Migration is idempotent - safe to run multiple times

## Task 3: Tauri Command Parameter Rename (2026-02-18)

### What Was Done
Renamed `repos_root_path` parameter to `path` in two Tauri commands:
- `create_project` (main.rs:165-173)
- `update_project` (main.rs:185-194)

Updated corresponding db method calls to use `&path` instead of `&repos_root_path`.

### Key Insights
1. **Serde Parameter Mapping**: Tauri's `invoke()` matches JSON keys to Rust parameter names via serde. Renaming the Rust parameter from `repos_root_path` to `path` means the frontend must send `{ path: "..." }` instead of `{ reposRootPath: "..." }`.

2. **Dependency Chain**: This task unblocks Task 4 (frontend types/IPC) because the frontend now knows the exact parameter names to send.

3. **Isolation**: Changes were strictly isolated to main.rs. The `start_implementation` command was intentionally left unchanged (still uses `repo_path: String` — different field).

4. **Build Success**: Cargo build completed successfully with no errors (only pre-existing warnings).

### Verification Evidence
- Grep: 0 remaining `repos_root_path` references in main.rs
- Build: `cargo build` exit code 0
- Code inspection: Both commands updated correctly with proper parameter names and db calls

### Lessons for Future Tasks
- Parameter renames in Tauri commands have cascading effects on frontend IPC calls
- Always verify the full dependency chain before making changes
- Isolation is critical: only modify what's necessary for the task

## Task 4 - Frontend Types & IPC Update (2026-02-18)

### What Was Done
Updated `src/lib/types.ts` and `src/lib/ipc.ts` to rename `repos_root_path` → `path` and remove `scanRepos`/`RepoInfo`.

**Files Modified:**
- `src/lib/types.ts`: Renamed `Project.repos_root_path` → `Project.path`, deleted `RepoInfo` interface
- `src/lib/ipc.ts`: Removed `RepoInfo` import, updated `createProject()`/`updateProject()` params to `path`, deleted `scanRepos()` function
- `src/components/RepoPickerDialog.svelte`: Deleted (necessary to unblock build)
- `src/App.svelte`: Removed RepoPickerDialog import/usage, updated `handleStartImplementation()` to call `startImplementation()` directly with `activeProject.path`

### Critical Insight: Plan Dependency Issue
The plan had an ordering problem: Task 4 deletes `scanRepos` from ipc.ts, but `RepoPickerDialog.svelte` (assigned to Task 5) imports `scanRepos`. This creates a build failure between tasks.

**Resolution:** To satisfy Task 4's QA requirement ("Frontend compiles after type/IPC changes"), I also deleted `RepoPickerDialog.svelte` and updated `App.svelte`. This is a minimal fix that:
1. Unblocks the build (required by QA scenarios)
2. Aligns with the overall goal (removing repo picker)
3. Implements the null guard for `activeProject` (flagged by Metis as a risk)

### Verification Results
✓ `npm run build`: SUCCESS (exit 0)
✓ `npm run test`: 54 tests passed
✓ Zero occurrences of `RepoInfo`, `scanRepos`, `reposRootPath`/`repos_root_path` in frontend code

### Key Learnings
1. **Serde Matching**: TypeScript interface field names must match Rust serde output exactly. `repos_root_path` → `path` ensures the field doesn't become `undefined` at runtime.
2. **IPC Invoke Keys**: Frontend invoke calls must match Rust parameter names. `{ name, path }` maps to Rust `name: String, path: String`.
3. **Build Blocking**: Deleting exported functions (like `scanRepos`) immediately breaks any component that imports them. Plan dependencies must account for this.
4. **Null Guards**: The `if (!activeProject)` guard is essential when accessing `activeProject.path` — prevents runtime errors if no project is selected.

### Recommendation for Future Tasks
When a task deletes exported functions/types, verify that no other components import them before the task that deletes those components. Consider reordering tasks or marking intermediate builds as "expected to fail" if dependencies can't be resolved.

## Task 5 Continuation - Component UI Updates (2026-02-18)

### What Was Done
Completed the final frontend cleanup by updating two components to use the new `path` variable and simplified UI labels:

**ProjectSetupDialog.svelte:**
- Renamed variable: `reposRootPath` → `path`
- Updated validation: `!path.trim()`
- Updated createProject call: `createProject(projectName.trim(), path.trim())`
- Updated label: "Repositories Root Path" → "Repository Path"
- Updated placeholder: "/Users/you/workspace" → "/Users/you/workspace/my-project"
- Updated button disabled condition: `!path.trim()`

**SettingsPanel.svelte:**
- Renamed variable: `reposRootPath` → `path`
- Updated reactive assignment: `currentProject?.path` (was `repos_root_path`)
- Updated updateProject call: `updateProject($activeProjectId, projectName, path)`
- Updated label: "Repos Root Path" → "Repository Path"
- Updated placeholder: "/path/to/repos" → "/path/to/repo"

### Verification Results
✓ `npm run build`: SUCCESS (58 modules transformed, built in 918ms)
✓ `npm run test`: SUCCESS (7 test files, 54 tests passed)
✓ `grep -c "reposRootPath|repos_root_path"`: 0 matches in both files

### Key Insights
1. **Type Alignment**: The `Project` interface in `types.ts` already had `path: string` (added in Task 4), so the reactive assignment `currentProject?.path` works correctly without LSP errors after rebuild.

2. **UI Label Semantics**: Changing "Repositories Root Path" → "Repository Path" and placeholder from "/Users/you/workspace" → "/Users/you/workspace/my-project" correctly reflects the new model: each project points to a single repo, not a parent folder containing multiple repos.

3. **Placeholder Consistency**: ProjectSetupDialog uses full path example ("/Users/you/workspace/my-project"), while SettingsPanel uses generic path ("/path/to/repo"). Both are appropriate for their context.

4. **Variable Naming**: Using `path` instead of `reposRootPath` is clearer and aligns with the backend `Project.path` field.

### Scope Boundaries Respected
- ✅ Did NOT touch ProjectSwitcher.svelte
- ✅ Did NOT touch JIRA/GitHub config sections
- ✅ Did NOT add new dialogs or validation logic
- ✅ Did NOT touch any other components

### Task Completion Status
Task 5 continuation is COMPLETE. All three tasks (3, 4, 5) are now ready for commit:
- Task 3: Rust command parameters renamed
- Task 4: Frontend types/IPC updated, RepoPickerDialog deleted, App.svelte updated
- Task 5: ProjectSetupDialog and SettingsPanel UI labels and variables updated

The entire "remove-subfolder-scanning" refactor is now complete across backend and frontend.
