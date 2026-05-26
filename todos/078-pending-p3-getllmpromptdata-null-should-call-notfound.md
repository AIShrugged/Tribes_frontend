---
status: pending
priority: p3
issue_id: '078'
tags: [code-review, typescript, llm-prompts]
dependencies: [071]
---

# `getLlmPromptData` returning `null` should trigger `notFound()` in page component

## Problem Statement

The plan's `getLlmPromptData` returns `LlmPromptProps | null`. Callers (Server
Component pages) must null-check the result. If a developer forgets this check,
TypeScript may still allow downstream access (e.g., if the null is cast away).
The Next.js App Router convention is to call `notFound()` immediately after a
null response from a data helper, producing a proper 404 page.

## Findings

- Plan: `getLlmPromptData` returns `LlmPromptProps | null`
- `app/dashboard/agents/prompts/[id]/page.tsx` must handle the null case
- Next.js convention: `if (!data) notFound();` immediately after the fetch
- Existing pattern: `features/agents/api/agent-profiles.ts` throws `ServerError`
  on 404 rather than returning null — which triggers the error boundary, not the
  404 page

## Proposed Solutions

### Option 1: Call `notFound()` in page.tsx on null return (Recommended)

```tsx
// app/dashboard/agents/prompts/[id]/page.tsx
export default async function PromptEditPage({ params }) {
  const ctx = await getAgentAccessContext();
  const prompt = await getLlmPromptData(
    ctx.activeOrganizationId,
    Number(params.id),
  );
  if (!prompt) notFound();
  // ... render
}
```

**Pros:** Standard Next.js pattern; produces proper 404 page; TypeScript narrows
type after check **Cons:** None **Effort:** 5 minutes **Risk:** Low

---

### Option 2: Throw inside `getLlmPromptData` instead of returning null

```ts
export const getLlmPromptData = cache(async (orgId, id) => {
  const { data } = await httpClient<LlmPromptProps>(...);
  if (!data) notFound(); // Next.js notFound() can be called anywhere in the RSC tree
  return data; // TypeScript knows this is non-null after the check
});
```

**Pros:** Callers never need to null-check; cleaner page code **Cons:**
`getLlmPromptData` has a side effect (navigation); mixing data and routing
concerns

## Recommended Action

Option 1 — null-check and call `notFound()` in the page component. This is the
Next.js App Router convention and keeps the data helper pure.

## Technical Details

**Affected files:**

- `app/dashboard/agents/prompts/[id]/page.tsx` — add null check + `notFound()`

## Acceptance Criteria

- [ ] Page calls `notFound()` when `getLlmPromptData` returns null
- [ ] TypeScript type is narrowed to `LlmPromptProps` (non-null) after the check
- [ ] Returns proper Next.js 404 page for invalid prompt IDs

## Work Log

### 2026-05-25 - Discovered during plan TypeScript review

**By:** Claude Code

---
