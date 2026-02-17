# Learnings & Conventions

This file accumulates knowledge about the codebase patterns, naming conventions, and best practices discovered during implementation.

---

## Task 1.1: Tauri 2.0 + Svelte + TypeScript Scaffold

### Key Learnings

1. **Tauri 2.0 Configuration**
   - `identifier` field must be at top level of `tauri.conf.json`, not in bundle section
   - `frontendDist` path is validated at compile time via `tauri::generate_context!()` macro
   - Icon files must exist and be valid PNG/ICO/ICNS files (created minimal 1x1 PNGs for scaffold)

2. **Rust Version Compatibility**
   - Tauri 2.10.2 requires Rust 1.88.0+ due to `time` crate dependency
   - Updated from Rust 1.86.0 to 1.93.1 via `rustup update`
   - Removed `shell-open` feature from Tauri 2.0 (doesn't exist in this version)

3. **Svelte + TypeScript Setup**
   - Must install `svelte-preprocess` as dev dependency for TypeScript support in `.svelte` files
   - Vite config must explicitly pass `preprocess: sveltePreprocess()` to svelte plugin
   - `tsconfig.json` requires `verbatimModuleSyntax: true` when using TypeScript in Svelte

4. **Project Structure**
   - Frontend: `src/` (Svelte components, TypeScript)
   - Backend: `src-tauri/` (Rust, Cargo.toml)
   - Build output: `dist/` (Vite builds here, Tauri references it)
   - Config: `vite.config.ts`, `tsconfig.json`, `src-tauri/tauri.conf.json`

5. **Build Process**
   - Frontend: `npm run build` → Vite bundles to `dist/`
   - Backend: `cargo check` validates Rust code
   - Dev: `npm run tauri:dev` runs both frontend dev server and Tauri app

### Conventions Established

- Package name: `ai-command-center` (kebab-case)
- Identifier: `com.opencode.ai-command-center` (reverse domain notation)
- Frontend entry: `src/main.ts` → mounts `App.svelte` to `#app` div
- Tauri entry: `src-tauri/src/main.rs` → minimal boilerplate with `tauri::generate_context!()`


## Task 1.2: SQLite Database Setup (2026-02-17)

### Database Module Implementation
- Created `src-tauri/src/db.rs` with complete schema for all 6 tables
- Used `rusqlite` v0.32 with "bundled" feature (includes SQLite statically)
- Database stored in Tauri app data directory via `app.path().app_data_dir()`
- Thread-safe access via `Arc<Mutex<Connection>>` wrapper

### Schema Details
- All tables use `CREATE TABLE IF NOT EXISTS` for idempotent migrations
- Foreign keys enabled via `PRAGMA foreign_keys = ON`
- Boolean fields stored as INTEGER (0/1) per SQLite convention
- Timestamps stored as INTEGER (Unix epoch)
- Default config values inserted with `INSERT OR IGNORE` to prevent duplicates

### Tauri Integration Patterns
- Database initialized in `.setup()` hook before app runs
- Database stored in Tauri managed state via `app.manage(Mutex::new(database))`
- This allows access from Tauri commands later via `State<Mutex<Database>>`

### Testing
- Added unit tests for database initialization and config operations
- Tests use temp directory and clean up after themselves
- All tests pass: `cargo test` shows 2 passed

### Dependencies Added
- `rusqlite = { version = "0.32", features = ["bundled"] }`
- "bundled" feature includes SQLite library (no system dependency needed)

### Database Location
- macOS: `~/Library/Application Support/com.opencode.ai-command-center/ai_command_center.db`
- Linux: `~/.local/share/ai-command-center/ai_command_center.db`
- Windows: `%APPDATA%\com.opencode.ai-command-center\ai_command_center.db`

### Public API Exposed
- `Database::new(db_path)` - Initialize database with migrations
- `Database::connection()` - Get Arc<Mutex<Connection>> for queries
- `Database::get_config(key)` - Get config value
- `Database::set_config(key, value)` - Set config value

### Next Steps
- CRUD operations for tickets, sessions, logs, PRs will be added in later tasks
- Tauri commands will access database via managed state
- JIRA sync service (Task 2.2) will use this database
- GitHub poller (Task 3.2) will use this database

## Task 1.3: OpenCode Process Manager (2026-02-17)

### Process Management Implementation
- Created `src-tauri/src/opencode_manager.rs` to spawn and monitor `opencode web` server
- Uses `tokio::process::Command` for async process spawning with `kill_on_drop(true)`
- Stores child process in `Arc<Mutex<Option<Child>>>` for thread-safe access
- Process spawned with: `opencode web --port 4096 --hostname 127.0.0.1`

### Health Check Pattern
- Polls `http://localhost:4096/health` every 500ms until server responds
- Uses `reqwest::Client` with 5-second timeout per request
- Overall health check timeout: 30 seconds (configurable via const)
- Blocks app startup until server is healthy (ensures API is ready before UI shows)

### Dependencies Added
- `reqwest = { version = "0.12", features = ["json"] }` - HTTP client for health checks
- `which = "6.0"` - Resolve `opencode` command in PATH
- `nix = { version = "0.29", features = ["signal", "process"] }` - Unix signal handling for graceful shutdown

### Tauri Integration
- OpenCodeManager initialized in `.setup()` hook using `tauri::async_runtime::block_on()`
- Stored in managed state via `app.manage(opencode_manager)` for access from commands
- Main function changed to `#[tokio::main] async fn main()` to support async setup

### Error Handling
- Custom `OpenCodeError` enum with descriptive error messages
- Checks if `opencode` CLI exists before spawning (returns helpful install message if missing)
- Graceful shutdown with SIGTERM first, SIGKILL after 5-second timeout (Unix only)

### Process Lifecycle
- Spawned on app startup in setup hook
- Health check blocks until server ready
- Process handle stored for cleanup
- `kill_on_drop(true)` ensures cleanup even if shutdown() not called explicitly

### Platform Considerations
- Unix: Uses `nix::sys::signal::kill()` for graceful SIGTERM shutdown
- Windows: Falls back to immediate kill (no SIGTERM support)
- Process stdout/stderr piped (can be logged in future tasks)

### Testing
- Added test to verify `opencode` command exists in PATH
- Full integration test requires running app (manual verification)

### Warnings (Expected)
- `shutdown()` method unused (will be called from app exit handler in future task)
- `child` field unused warning (accessed via Arc<Mutex> in shutdown)
- `SHUTDOWN_TIMEOUT` unused (used in Unix-specific code path)

### Next Steps
- Task 1.4 will create REST API client to communicate with this server
- Task 1.5 will implement Tauri commands that use both manager and API client
- Future task: Add proper logging for process stdout/stderr
- Future task: Implement app exit handler to call shutdown() explicitly


## Task 1.4: OpenCode REST API Client (2026-02-17)

### Implementation Details
- Created `src-tauri/src/opencode_client.rs` with complete type-safe REST API client
- Used `reqwest` v0.12 with `json` and `stream` features for HTTP client
- Added `tokio-stream` v0.1 for Stream trait support
- Added `bytes` v1.0 for SSE byte stream handling

### API Client Structure
- **OpenCodeClient** struct with connection pooling via reusable `reqwest::Client`
- Base URL configurable (default: `http://localhost:4096`)
- All methods are async and return `Result<T, OpenCodeError>`

### Implemented Functions
1. **create_session(title: String) -> Result<String>**
   - POST /sessions with JSON body `{ title: string }`
   - Returns session ID from response
   - Error handling for network, API, and parse errors

2. **send_prompt(session_id: &str, text: String) -> Result<serde_json::Value>**
   - POST /sessions/{id}/prompt with JSON body `{ parts: [{ type: "text", text: string }] }`
   - Returns raw JSON response (structure varies by OpenCode version)
   - Constructs Part struct with type="text"

3. **subscribe_events() -> Result<EventStream>**
   - GET /events for server-sent events
   - Returns EventStream wrapper with `into_stream()` method
   - Stream yields `Result<bytes::Bytes, reqwest::Error>`

4. **health() -> Result<HealthResponse>**
   - GET /health for server health check
   - Returns `{ healthy: bool, version: Option<String> }`

### Type System
- **Request types**: CreateSessionRequest, SendPromptRequest, Part
- **Response types**: CreateSessionResponse, HealthResponse
- **Error type**: OpenCodeError enum with NetworkError, ApiError, ParseError variants
- All types use serde for JSON serialization/deserialization
- CreateSessionResponse uses `#[serde(flatten)]` to capture extra fields

### Error Handling Pattern
- Custom OpenCodeError enum implements Display and std::error::Error
- Network errors: Connection failures, timeouts
- API errors: Non-2xx status codes with status and message
- Parse errors: JSON deserialization failures
- All API methods check response.status().is_success() before parsing

### Testing
- 5 unit tests covering:
  - Client creation with default and custom URLs
  - Request serialization (CreateSessionRequest, SendPromptRequest)
  - Error display formatting
- All tests pass: `cargo test opencode_client`

### Dependencies Added
- `reqwest = { version = "0.12", features = ["json", "stream"] }`
- `tokio-stream = "0.1"`
- `bytes = "1.0"`

### Integration Notes
- Module imported in main.rs but not yet used (Task 1.5 will integrate)
- Client is Clone-able for sharing across Tauri commands
- EventStream provides low-level byte stream access (SSE parsing to be added in Task 1.5)
- Base URL hardcoded to localhost:4096 (matches OpenCodeManager default port)

### API Endpoint Reference (from SDK)
- POST /sessions — Create session, returns { id: string, ... }
- POST /sessions/{id}/prompt — Send prompt, body: { parts: [{ type: "text", text: string }] }
- GET /events — Server-sent events stream
- GET /health — Health check, returns { healthy: bool, version: string }

### Next Steps
- Task 1.5 will create Tauri commands that use this client
- Task 1.5 will parse SSE events from EventStream
- Task 4.1 orchestrator will use this client for agent control
