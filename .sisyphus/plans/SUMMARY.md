# AI Command Center - Project Summary

## What We're Building

A **local-first desktop cockpit** (Tauri + Svelte) that gives you full visibility and control over AI agents automating your development workflow. Think of it as mission control for your JIRA tickets — you see every ticket flowing through automated stages (Implement → Review → Test), with live agent output, checkpoint approvals, and the ability to intervene at any point.

---

## Key Features (v1 MVP)

### 1. **Kanban Dashboard**
- Visual board showing JIRA tickets in stage columns
- **Smart filtering**: Only shows tickets assigned to you (configurable)
- Real-time status updates (running, paused, completed, failed)
- Click any ticket to see live agent logs and checkpoint details

### 2. **Checkpoint-Based Agent Control**
- Agent pauses at key points for your approval:
  - After reading ticket (shows proposed approach)
  - After implementation (shows diff summary)
  - Before creating PR (shows PR details)
  - On error (asks for help)
- You approve/reject from the UI, agent continues

### 3. **PR Comment Response**
- Automatically detects new PR comments (polling GitHub every 30-60s)
- Shows all comments in dashboard with checkboxes
- You select which comments the agent should address
- Agent resumes same session, fixes issues or responds

### 4. **Live Agent Monitoring**
- Real-time streaming output from OpenCode
- See exactly what the agent is doing (files changed, commands run, etc.)
- Full transparency into the AI's work

### 5. **State Persistence**
- SQLite database stores everything
- Close and reopen the app — resume exactly where you left off
- Full history of agent sessions, logs, checkpoints

---

## Technical Architecture

```
Desktop App (Tauri)
├─ Frontend: Svelte + TypeScript
│  └─ Kanban board, live logs, checkpoint UI, PR comments
├─ Backend: Rust
│  ├─ OpenCode process manager (spawn/monitor)
│  ├─ Orchestrator (checkpoint-based control)
│  ├─ JIRA sync (poll every 60s)
│  ├─ GitHub poller (poll every 30-60s)
│  └─ SQLite database
└─ External Services
   ├─ OpenCode (assumes installed, spawns `opencode web`)
   ├─ JIRA Cloud (API tokens)
   └─ GitHub (REST API)
```

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Desktop framework** | Tauri 2.0 | 96% smaller than Electron, native feel, Rust backend |
| **Frontend** | Svelte + TypeScript | Lightweight, fast, great DX |
| **Agent CLI** | OpenCode | User's current tool, has TypeScript SDK |
| **OpenCode integration** | Spawn `opencode web`, connect via REST API | Assumes installed, cleanest approach |
| **Agent autonomy** | Checkpoint-based | Pauses at key points for approval |
| **PR comments** | Batch & present | User selects which comments agent addresses |
| **Concurrency** | 5+ tickets in parallel | Full pipeline support |
| **JIRA transitions** | Hybrid (some auto, some manual) | Auto: In Progress → In Review. Manual: everything else |
| **JIRA filtering** | Assigned to me (default ON) | Uses JQL: `assignee = currentUser()` |
| **Webhooks** | Polling for v1 | Simpler (no tunnel), upgrade to webhooks in v2 |
| **Persistence** | SQLite | Full state survives restart |

---

## Workflow Example

**Scenario**: You have a JIRA ticket "PROJ-123: Add user authentication"

1. **You**: Drag ticket from "To Do" to "In Progress" in the cockpit
2. **Agent**: Reads JIRA ticket, proposes approach → **PAUSES**
3. **You**: See proposal in UI: "Add JWT middleware, hash passwords, write tests" → Click **Approve**
4. **Agent**: Implements the solution → **PAUSES**
5. **You**: See diff summary: "Modified 3 files, added 2 tests" → Click **Approve**
6. **Agent**: Creates PR with title/description → **PAUSES**
7. **You**: See PR details → Click **Approve**
8. **Agent**: PR created successfully → Ticket auto-moves to "In Review"
9. **Reviewer**: Leaves 3 comments on the PR
10. **Cockpit**: Detects new comments, shows badge "3 new comments"
11. **You**: Click ticket, see comments, select 2 to address → Click **Address Selected**
12. **Agent**: Resumes same session, fixes the 2 issues, pushes updates
13. **Done**: PR updated, comments resolved

---

## Implementation Plan

### Phase 1: Foundation (10 hours)
- Tauri + Svelte scaffold
- SQLite database
- OpenCode process manager
- REST API client

### Phase 2: JIRA Integration (6 hours)
- JIRA API client
- Background polling service
- Tauri commands

### Phase 3: GitHub Integration (6 hours)
- GitHub API client
- PR comment poller
- Tauri commands

### Phase 4: Orchestrator (9 hours)
- State machine for checkpoint-based control
- Checkpoint detection logic
- PR comment response orchestration

### Phase 5: Frontend (20 hours)
- Kanban board
- Detail panel (tabs: overview, logs, checkpoints, comments)
- Live log viewer (SSE streaming)
- Checkpoint approval UI
- PR comment batch UI
- Settings panel

### Phase 6: Polish & Testing (11 hours)
- Error handling
- OpenCode installation check
- Integration tests
- E2E tests (Playwright)
- Package for macOS

**Total**: ~62 hours (~8 full days)

---

## Success Criteria

✅ User can see JIRA tickets in Kanban board  
✅ User can start ticket implementation from dashboard  
✅ Agent pauses at checkpoints for approval  
✅ User can see live agent logs streaming  
✅ Agent creates PR automatically after approval  
✅ User can see new PR comments in dashboard  
✅ User can select comments and trigger agent to address them  
✅ App persists state across restarts  
✅ App handles errors gracefully  

---

## What's NOT in v1 (Deferred to v2+)

- JIRA write operations (manual transitions from dashboard)
- Automated testing phase (AI runs test suite)
- System tray + notifications
- GitHub webhooks (using polling for v1)
- Cloud deployment / always-on server
- Multi-user / team features

---

## Next Steps

1. **Review this plan** — Confirm scope, architecture, priorities
2. **Set up dev environment** — Install Tauri, Rust, Svelte tooling
3. **Start Phase 1** — Build foundation (Tauri + OpenCode integration)
4. **Iterate** — Complete each phase, test, move to next
5. **Deploy v1** — Package for macOS, test on your machine
6. **Use it for real work** — Gather feedback, identify pain points
7. **Plan v2** — Prioritize enhancements based on usage

---

## Questions?

- Want to adjust the scope (add/remove features)?
- Want to change the architecture (different tech stack)?
- Want to dive deeper into any specific component?
- Ready to start building?

Let me know and we'll refine the plan or kick off implementation!