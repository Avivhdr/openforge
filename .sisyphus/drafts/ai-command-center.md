# Draft: AI Command Center (Cockpit)

## Requirements (confirmed)
- **Vision**: Desktop cockpit app showing JIRA tickets flowing through automated AI stages
- **Local-first**: Runs on user's Mac, portable to another machine later
- **Full control**: No cloud services like Cloudbot — own infrastructure

## Technical Decisions
- **Frontend**: Svelte + TypeScript
- **Desktop wrapper**: Tauri (from the start, not deferred)
- **Current workflow**: Uses OpenCode with slash commands (/start-work style) to trigger implementation from tickets
- **Agent CLI**: OpenCode (user's current tool, sticking with it despite archived status)
- **Testing phase**: AI runs automated tests first, then manual QA pass
- **Agent autonomy**: Checkpoint-based (pauses at key points for approval)
- **Review response**: Batch and present (collect comments, user picks which agent addresses)
- **Concurrency**: 5+ tickets in parallel across different stages
- **JIRA transitions**: Hybrid (some auto, some manual)

### Checkpoint Design (confirmed)
1. **After reading ticket** — Agent shows understanding + proposed approach → user approves
2. **After implementation** — Agent shows diff summary → user approves
3. **Before PR creation** — Agent shows PR title/description → user approves
4. **On error/stuck** — Agent pauses, asks for help in dashboard

NOT included: After tests run (tests are part of implementation)

### JIRA Transition Rules (confirmed)
- **Auto**: In Progress → In Review (when PR created successfully)
- **Manual**: Everything else (To Do → In Progress, In Review → Testing, Testing → Done)
- User controls most transitions from the dashboard

## Workflow Stages (confirmed)
1. **Implement** — JIRA ticket → AI agent implements → creates PR → tests pass
2. **Review Response** — PR comments trigger AI → fix or respond (same session context)
3. **Testing** — AI automated checks first, then manual QA with dashboard visibility
4. **Dashboard** — Real-time visibility into all tickets, agent status, intervention ability

## Research Findings

### Desktop Framework (Tauri confirmed)
- Tauri 2.0 (Oct 2024): 96% smaller bundles than Electron, 58% less memory
- Background tasks via `tauri::async_runtime::spawn` + tokio
- Child process management via Tauri Shell plugin (for spawning OpenCode)
- IPC: Commands (frontend→backend) + Events (backend→frontend, real-time)
- System tray first-class support
- Reference architecture: screenpipe (github.com/screenpipe/screenpipe)
- Rust backend for orchestration, Svelte frontend for UI

### JIRA Cloud Integration
- **Auth**: API tokens (email:token, Basic Auth) for personal/team use — simplest
- **Transitions**: 2-step process: GET available transitions → POST execute by ID
- **Custom fields**: `customfield_XXXXX` keys in fields object
- **Webhooks**: `jira:issue_updated` with `changelog.items[]` for transitions
- **Gotcha**: Rank field triggers duplicate events — filter by `changelog.field`
- **Gotcha**: No built-in signature validation — implement HMAC yourself

### GitHub Integration
- **`gh` CLI**: Handles auth, pagination, JSON parsing — great for most ops
- **3 review event types**: `pull_request_review_comment` (inline), `pull_request_review` (submissions), `issue_comment` (general PR comments)
- **Thread context**: `in_reply_to_id` for reply chains, `pull_request_review_id` for grouping
- **Signature validation**: Always verify `X-Hub-Signature-256` with HMAC
- **Webhook timeout**: Must respond within 10s → queue payloads, process async

### Webhook Receiver (local dev)
- **ngrok**: Private tunnel, local inspection UI, 40 req/min free
- **smee.io**: Free, no account, public channel (less secure)
- **Production pattern**: Fast 200 response → message queue → worker processes

### OpenCode SDK (GAME CHANGER!)
- **CRITICAL DISCOVERY**: OpenCode has a full TypeScript SDK (`@opencode-ai/sdk`)
- **Server/Client architecture**: SDK starts OpenCode server, provides type-safe client
- **NO CLI PARSING NEEDED**: Direct programmatic control via API calls

#### Key SDK Capabilities
- `createOpencode()` — Starts server + client in one call
- `session.create()` — Create new session programmatically
- `session.prompt({ path, body })` — Send prompts, get structured responses
- `session.messages({ path })` — Get all messages in a session
- `session.abort({ path })` — Cancel running session
- `event.subscribe()` — Server-sent events stream for real-time updates
- **Structured output**: Pass `format: { type: "json_schema", schema: {...} }` to get validated JSON responses
- **Context injection**: `noReply: true` flag to inject context without triggering AI response

#### Session Continuity
- Sessions have IDs, can be resumed across invocations
- `session.prompt()` on existing session continues conversation
- Perfect for checkpoint architecture: create session → prompt → pause → prompt again

#### Real-time Monitoring
- `event.subscribe()` returns SSE stream with all events
- Event types: session updates, message updates, tool executions, errors
- Stream to frontend via Tauri IPC for live log viewer

#### Tauri Integration (CONFIRMED)
- **Approach**: Assume `opencode` CLI is installed on user's system
- **Rust backend** spawns `opencode web --port 4096 --hostname 127.0.0.1` on app startup
- **Frontend** connects via HTTP client to `http://localhost:4096` (OpenCode REST API)
- **Lifecycle**: Tauri manages process (spawn on start, kill on exit)
- **Health check**: Poll `/health` endpoint to ensure server is ready before showing UI
- **Fallback**: If `opencode` not found, show setup instructions in UI

#### Architecture Flow
```
Tauri App Startup
  ↓
Rust: spawn("opencode", ["web", "--port", "4096"])
  ↓
Rust: poll http://localhost:4096/health until ready
  ↓
Frontend: HTTP client connects to localhost:4096
  ↓
Frontend: Call OpenCode REST API directly
  ↓
Frontend: Subscribe to SSE stream for real-time events
```

## Resolved Questions
- **OpenCode flow**: User runs `opencode` CLI, types `/start-work JIRA-123`. It reads JIRA ticket and implements.
- **OpenCode has `-p` flag**: Non-interactive mode, plus `--session` for continuity. Can automate.
- **Dashboard**: Kanban board (columns per stage, cards per ticket, click for details/logs)
- **Persistence**: Full SQLite — survives restart, resume where left off

## Open Questions
- How to handle OpenCode checkpoints (break into steps with separate invocations?)
- Webhook receiver strategy for PR comments (ngrok for dev, self-hosted for prod?)
- Test strategy for the cockpit app itself?
- MVP scope — what's v1 vs what comes later?
- What does the "Testing" phase dashboard look like?

## Scope Boundaries

### v1 MVP (IN SCOPE)
1. **Kanban board + ticket cards** — Core dashboard showing JIRA tickets in stage columns
2. **JIRA sync (read)** — Pull tickets from JIRA board, display in dashboard
3. **Agent orchestration** — Trigger OpenCode to implement a ticket, with discrete-step checkpoints
4. **Agent live log viewer** — Real-time streaming output from OpenCode in the dashboard
5. **PR comment detection** — Poll GitHub for new PR comments (every 30-60s)
6. **PR comment response** — Batch & present comments, user picks which agent addresses

### DEFERRED (v2+)
- JIRA transitions (write) — Move tickets between stages from dashboard
- Automated testing phase — AI runs test suite after PR approval
- System tray + notifications — Background running, alerts
- GitHub webhooks (replace polling)
- Cloud deployment / always-on server
- Multi-user / team features

### Checkpoint Architecture (confirmed)
- Orchestrator runs OpenCode in discrete phases using `-p` + `--session`:
  1. Read ticket & propose approach → PAUSE → show in dashboard → user approves
  2. Implement approved approach → PAUSE → show diff summary → user approves
  3. Create PR → PAUSE → show PR details → user approves
  4. On error at any step → PAUSE → show error → ask for help
- Each phase uses same `--session` ID for context continuity
- Between phases, state is persisted in SQLite

### Webhook Strategy (v1)
- **Polling** GitHub API every 30-60s for new PR comments
- No webhook tunnel needed for v1
- Upgrade to webhooks (ngrok/self-hosted) in v2
