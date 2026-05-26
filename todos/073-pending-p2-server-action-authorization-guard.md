---
status: pending
priority: p2
issue_id: '073'
tags: [code-review, security, llm-prompts, server-actions]
dependencies: [068]
---

# Add `isOrgManager` authorization guard inside mutation Server Actions

## Problem Statement

The plan lists `isOrgManager` as a requirement for Server Actions but the
implementation sketches for `updateLlmPrompt`, `resetLlmPrompt`, and
`seedLlmPrompts` omit the guard. Non-managers can invoke Server Actions directly
(e.g., via browser DevTools calling the action endpoint). The backend Laravel
policy is the final enforcement gate, but the frontend actions should fail fast
with a typed error rather than making a network round-trip to receive a 403.

This is consistent with the plan's stated security requirement: "Add
`isOrgManager` guard at top of each mutation Server Action."

## Findings

- Plan shows the `isOrgManager` requirement explicitly but implementation sketch
  lacks the guard call
- Existing `features/agents/api/agent-profiles.ts` also omits this guard —
  pre-existing gap, not a blocker here
- `httpClientAction` soft-returns 403 as
  `ActionResult { data: null, error: '...' }` — backend enforcement exists
- Without the frontend guard, an employee calling `updateLlmPrompt` silently
  fails with a backend 403 rather than being told immediately

## Proposed Solutions

### Option 1: Add guard at top of each mutation (Recommended)

```ts
export async function updateLlmPrompt(
  organizationId: number,
  promptId: number,
  payload: LlmPromptUpdatePayload,
): Promise<ActionResult<LlmPromptProps>> {
  const ctx = await getAgentAccessContext();
  if (!isOrgManager(ctx)) {
    return { data: null, error: 'You do not have permission to edit prompts.' };
  }
  // ... httpClient call
}
```

Apply the same pattern to `resetLlmPrompt` and `seedLlmPrompts`.

**Pros:** Fails fast; consistent with stated requirement; no extra network call
on 403 **Cons:** Requires resolving #068 (the `isOrgManager` /
`AgentAccessContext` type issue) first **Effort:** 30 minutes (after #068
resolved) **Risk:** Low

---

### Option 2: Trust the backend (no frontend guard)

**Approach:** Don't add the guard. Let the backend 403 flow through
`httpClientAction` naturally. `toast.error` surfaces the message.

**Pros:** Zero extra code **Cons:** Extra network round-trip on unauthorized
attempt; less explicit error feedback **Effort:** 0 **Risk:** Low (backend
always enforces)

## Recommended Action

Option 1 — the plan explicitly requires this guard. Implement after #068 is
resolved.

## Technical Details

**Affected files:**

- `features/llm-prompts/api/llm-prompts.ts` — `updateLlmPrompt`,
  `resetLlmPrompt`, `seedLlmPrompts`

**Dependencies:** #068 (AgentAccessContext type resolution)

## Acceptance Criteria

- [ ] `updateLlmPrompt` checks `isOrgManager` before calling `httpClient`
- [ ] `resetLlmPrompt` checks `isOrgManager` before calling `httpClient`
- [ ] `seedLlmPrompts` checks `isOrgManager` before calling `httpClient`
- [ ] Returns typed `ActionResult` error on unauthorized, not thrown exception

## Work Log

### 2026-05-25 - Discovered during plan technical review

**By:** Claude Code

**Actions:**

- Identified authorization guard gap in implementation sketches
- Confirmed backend enforcement exists as fallback
- Added as explicit pre-implementation requirement

---
