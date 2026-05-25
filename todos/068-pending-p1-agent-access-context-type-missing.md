---
status: pending
priority: p1
issue_id: "068"
tags: [code-review, typescript, fsd, llm-prompts]
dependencies: []
---

# Fix missing `AgentAccessContext` type — compile error in plan

## Problem Statement

The plan for `features/llm-prompts/lib/access.ts` imports `AgentAccessContext` from `@/features/agents`. This type does not exist — `features/agents/index.ts` re-exports `getAgentAccessContext` (a function) but never exports a named `AgentAccessContext` type. The import will fail at compile time. Additionally, importing from a sibling feature is an FSD boundary violation (`features/A` must not import from `features/B`).

## Findings

- `features/agents/lib/access.ts` — no `AgentAccessContext` type exported anywhere
- `features/agents/index.ts` — only re-exports the function `getAgentAccessContext` and `canManageAgents`
- FSD rule in CLAUDE.md: "features/A must NOT import from features/B"
- A pre-existing violation exists (`features/issues/api/issues.ts` imports from `features/agents`) — the plan must not repeat it
- The actual context type is the anonymous inline return type of `getAgentAccessContext()`

## Proposed Solutions

### Option 1: Use `Awaited<ReturnType<>>` utility (Recommended)

**Approach:** In `features/llm-prompts/lib/access.ts`, derive the type without importing it:
```ts
import { getAgentAccessContext } from '@/features/agents';
type AgentCtx = Awaited<ReturnType<typeof getAgentAccessContext>>;

export function isOrgManager(context: AgentCtx): boolean {
  return context.activeOrganization?.pivot?.role === 'manager';
}
```
This still imports a function from a sibling feature — marginal FSD violation for a utility function.

**Pros:** No new type exports needed; always in sync with the source
**Cons:** Still a cross-feature dependency (minor)
**Effort:** 15 minutes
**Risk:** Low

---

### Option 2: Move shared access context type to `entities/organization/model/types.ts` (Correct FSD)

**Approach:** Export `OrganizationAccessContext` (or similar) from `entities/organization/`. Both `features/agents` and `features/llm-prompts` import from `entities/` — no cross-feature dependency.

**Pros:** Architecturally correct FSD; no cross-feature coupling
**Cons:** Requires refactoring `features/agents/lib/access.ts` to use the entity type
**Effort:** 1–2 hours
**Risk:** Low (additive change to entities)

---

### Option 3: Pass context as plain object from server page component

**Approach:** In `app/dashboard/agents/prompts/page.tsx`, call `getAgentAccessContext()` directly and pass only the `role` string as a prop to the UI component. No shared type needed in `features/llm-prompts/`.
```ts
const { activeOrganization } = await getAgentAccessContext();
const canEdit = activeOrganization?.pivot?.role === 'manager';
return <LlmPromptsList canEdit={canEdit} />;
```

**Pros:** Zero cross-feature dependency; simplest type surface
**Cons:** Page component does the access logic; harder to test in isolation
**Effort:** 30 minutes
**Risk:** Low

## Recommended Action

Option 3 for MVP — pass `canEdit: boolean` prop from the server page component. Avoids all cross-feature coupling and type gymnastics. Revisit Option 2 when the `entities/organization/` entity is more fully developed.

## Technical Details

**Affected files:**
- `features/llm-prompts/lib/access.ts` — remove cross-feature import
- `app/dashboard/agents/prompts/page.tsx` — compute `canEdit` here
- `app/dashboard/agents/prompts/[id]/page.tsx` — same

## Acceptance Criteria

- [ ] `features/llm-prompts/` has no imports from `@/features/agents`
- [ ] `isOrgManager` logic is accessible without a cross-feature import
- [ ] TypeScript compiles without error on `features/llm-prompts/lib/access.ts`
- [ ] FSD boundary guard reports no violations for the new slice

## Work Log

### 2026-05-25 - Discovered during plan technical review

**By:** Claude Code

**Actions:**
- Verified `AgentAccessContext` does not exist in `features/agents/index.ts`
- Confirmed FSD violation in existing `features/issues/api/issues.ts` (pre-existing)
- Proposed three resolution strategies

---
