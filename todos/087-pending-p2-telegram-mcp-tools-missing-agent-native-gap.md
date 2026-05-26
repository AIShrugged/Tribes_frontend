---
status: pending
priority: p2
issue_id: '087'
tags: [code-review, agent-native, mcp, telegram, backend]
dependencies: []
plan: docs/plans/2026-05-26-refactor-move-telegram-tab-to-sidebar-plan.md
---

# P2: Telegram workspace chat operations have zero MCP tool coverage (agent-native gap)

## Problem Statement

The Telegram workspace chat management feature (list/add/delete) has no
corresponding MCP tools in the `wanda-backend` MCP server. Agents cannot perform
any Telegram chat operations. This is a pre-existing gap unrelated to the route
move, but it was surfaced during this review.

Backend endpoints without MCP tools:

- `GET /api/v1/telegram/chats` — list workspace chats
- `POST /api/v1/telegram/chats` — register a group chat
- `DELETE /api/v1/telegram/chats/:id` — remove a chat

The route move from `/dashboard/profile/telegram` to `/dashboard/telegram` does
not affect agent accessibility — agents don't navigate URLs, they call MCP
tools.

## Findings

Agent-native reviewer: "0/3 Telegram chat capabilities are agent-accessible.
NEEDS WORK — the route move is safe to ship, but the feature remains entirely
agent-inaccessible until backend MCP tools are added."

Proposed tools:

- `list_telegram_workspace_chats` — calls `GET /api/v1/telegram/chats`
- `register_telegram_workspace_chat` — calls `POST /api/v1/telegram/chats` with
  `telegram_chat_id`, `organization_id`, `team_id`, `name`
- `delete_telegram_workspace_chat` — calls `DELETE /api/v1/telegram/chats/:id`

## Proposed Solutions

### Option A: Backend ticket — add 3 MCP tools to HrServer.php

File:
`/Users/slavapopov/Documents/WandaAsk_backend/app/Mcp/Servers/HrServer.php`
**Pros:** Full agent parity for this feature. **Cons:** Backend work, separate
repo and deploy. **Effort:** Medium | **Risk:** Low

### Option B: Document gap, defer to future sprint

Create this ticket, track it in the backlog, implement alongside another backend
MCP sprint. **Pros:** Doesn't block the frontend route migration. **Cons:** Gap
persists. **Effort:** Small | **Risk:** None

## Recommended Action

Option B for now — the route move should not be blocked by this. Track as a
separate backend ticket.

## Acceptance Criteria

- [ ] Three MCP tools added to `HrServer.php`: `list_telegram_workspace_chats`,
      `register_telegram_workspace_chat`, `delete_telegram_workspace_chat`
- [ ] Tools registered in `.mcp.json` tool list
- [ ] Agent can list, register, and delete Telegram workspace chats via MCP

## Work Log

- 2026-05-26: Identified during /technical_review via agent-native-reviewer
  agent.
