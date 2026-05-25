---
status: pending
priority: p1
issue_id: "060"
tags: [code-review, architecture, chat, agent-native, design]
dependencies: []
---

# createChat Plan: Cookie Injection Causes Silent Behavioral Regressions

## Problem Statement

The deepened plan for `feat: Pass organization_id on chat creation` proposes to read `organization_id` from the active-org cookie **inside** `createChat`, making the cookie the unconditional authority. This causes two silent behavioral regressions that block the plan as written:

1. **Personal unscoped chats break.** `DashboardChatPanel` calls `createChat(null)` to create a personal, unscoped chat. The UI explicitly describes these as "not permanently bound." After the plan, every call to `createChat` stamps the cookie's `organization_id` on the chat — including this one — silently violating the UI's own description.

2. **Agent-native parity gap.** The `organization_id` cookie represents the *human user's currently-selected org* in the browser session. AI agent tasks (`features/agents/model/types.ts:116`) have their own persistent `organization_id` stored in the database. If `createChat` reads the browser cookie, an autonomous agent creates chats scoped to the *user's current session org* — not its own task org. The mismatch breaks agent context coherence.

## Findings

**Finding 1 — DashboardChatPanel silent behavioral regression**

`/Users/slavapopov/Documents/WandaAsk_frontend/widgets/dashboard-chat/ui/DashboardChatPanel.tsx:46` calls `createChat(null)`. Current behavior: no `organization_id` sent → backend creates unbound chat (allowed). After plan: cookie is always read → chat gets org-scoped regardless of caller intent.

The modal's helper text (`features/chat/ui/chat-form-modal.tsx:139`) states personal web chats are "not permanently bound" — this plan makes that statement false for all chat creation paths including the personal one.

**Finding 2 — Agent-native parity gap**

`AgentTask.organization_id` (`features/agents/model/types.ts:116`) and `AgentTaskPayload.organization_id` (line 141) represent the agent task's persistent org binding. The cookie represents the human user's active session org. These can differ. Baking the cookie into `createChat` removes the ability for any non-browser caller to scope chats to the correct org.

## Proposed Solutions

### Option 1 (Recommended): Keep `organization_id` as explicit parameter; default in UI (not in server action)

- `createChat` keeps `Partial<ChatUpsertDTO>` as its parameter type
- Simplify the signature by removing the `string | null` union arm (the real complexity)
- UI callers that want the active org pass it explicitly: read cookie in the component or parent Server Component, pass to `createChat`
- The personal-chat path (`DashboardChatPanel`) passes `{}` or `{ organization_id: null }` explicitly

**Pros:** Primitive stays reusable, agent calls work, personal chats work, no behavioral regression
**Cons:** UI components must read the cookie — 1-2 more lines at call sites
**Effort:** Small | **Risk:** Low

### Option 2: Two separate server actions

- `createChatForActiveOrg()` — reads cookie internally, always scopes to cookie org
- `createChat(payload)` — accepts explicit org, no cookie read, used by agents/DashboardChatPanel

**Pros:** Clear separation of concerns
**Cons:** Two functions for essentially the same operation — unnecessary duplication
**Effort:** Small | **Risk:** Low

### Option 3: Keep plan as-is, accept regressions

Accept that personal chats now become org-scoped and that agent use cases aren't supported yet.

**Pros:** Minimal code change
**Cons:** Silent behavioral regression; closes off agent parity
**Effort:** Smallest | **Risk:** High

## Recommended Action

Option 1. The actual bug to fix is the overloaded `string | null | Partial<ChatUpsertDTO>` union signature — simplify that, and pass `organization_id` explicitly from the call sites that need it. The `ChatFormModal` parent (`ChatPage`) already fetches `organizations` — it can also call `getOrganizationId()` and thread it down.

## Technical Details

**Affected files:**
- `features/chat/api/chats.ts` — simplify union signature, keep `organization_id` as optional param
- `features/chat/ui/chat-form-modal.tsx` — pass `organization_id` from parent or read via context
- `widgets/dashboard-chat/ui/DashboardChatPanel.tsx` — pass `organization_id: null` explicitly
- `docs/plans/2026-05-25-feat-chat-creation-organization-id-plan.md` — update plan to Option 1

## Acceptance Criteria

- [ ] `createChat()` called with no `organization_id` creates an unbound (personal) chat — same as today
- [ ] `createChat({ organization_id: 5 })` creates a chat scoped to org 5
- [ ] `DashboardChatPanel` can still create unbound personal chats
- [ ] A future agent call can pass its own `organization_id` explicitly
- [ ] No `cookies()` call inside `createChat` itself

## Work Log

### 2026-05-25 — Identified during plan technical review

**By:** Claude Code (agent-native-reviewer + code-simplicity-reviewer)

The agent-native reviewer found that the cookie-inside-action approach creates a parity gap and a behavioral regression. The simplicity reviewer confirmed the overloaded union signature is the real complexity to fix, not cookie injection.
