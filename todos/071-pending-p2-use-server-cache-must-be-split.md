---
status: pending
priority: p2
issue_id: '071'
tags: [code-review, architecture, llm-prompts, server-actions]
dependencies: []
---

# Split `'use server'` file and `react.cache()` data helper into separate files

## Problem Statement

The plan co-locates `'use server'` (marking all exports as Server Actions,
callable from the client via POST) with `react.cache()` (a Server Component
render-phase deduplication primitive). These are semantically incompatible in
the same file. `'use server'` at the file level means every exported async
function becomes a Server Action endpoint. `cache()` is meaningless on a Server
Action and creates a false impression of request-level deduplication for
client-invoked calls.

Additionally, the project pattern in `features/agents/api/agent-profiles.ts`
shows `revalidatePath(path, 'layout')` — not `'page'`. The plan's use of
`'page'` deviates from the established convention.

## Findings

- Plan proposes `'use server'` +
  `export const getLlmPromptData = cache(async ...)` in the same file
- `cache()` from React only deduplicates within a **Server Component render
  tree** (per request)
- Server Actions are invoked as POST requests from the client — `cache()` has no
  effect there
- `features/agents/api/agent-profiles.ts` uses `revalidatePath(path, 'layout')`
  consistently (5 occurrences)
- Plan uses `revalidatePath(path, 'page')` — inconsistent with project
  convention

## Proposed Solutions

### Option 1: Split into two files (Recommended)

**Approach:**

- `features/llm-prompts/api/llm-prompts.ts` — `'use server'` mutations only
  (update, reset, seed, list)
- `features/llm-prompts/api/llm-prompt-data.ts` — NO `'use server'`, exports
  `getLlmPromptData` wrapped in `cache()` for Server Components

```ts
// llm-prompt-data.ts — no 'use server' directive
import { cache } from 'react';
export const getLlmPromptData = cache(async (orgId: number, id: number) => {
  const { data } = await httpClient<LlmPromptProps>(...);
  return data;
});
```

**Pros:** Semantically correct; clear separation of RSC data helpers vs Server
Actions **Cons:** Two files instead of one **Effort:** 30 minutes **Risk:** Low

---

### Option 2: Use `unstable_cache` from Next.js instead

**Approach:** Replace `react.cache()` with Next.js `unstable_cache` which IS
invalidated by `revalidatePath`. Keep everything in the Server Action file.

```ts
'use server';
import { unstable_cache } from 'next/cache';
export const getLlmPromptData = unstable_cache(
  async (orgId: number, id: number) => { ... },
  ['llm-prompt'],
  { tags: ['llm-prompts'] }
);
```

**Pros:** Works in both RSC and Server Action contexts; actually invalidatable
**Cons:** `unstable_cache` requires cache tags for granular invalidation; more
config **Effort:** 45 minutes **Risk:** Medium (unstable API)

## Recommended Action

Option 1 — split into two files. This matches the pattern used elsewhere in the
project (`api/agent-profiles.ts` for mutations, `features/*/api/*.ts` for data
helpers in some cases). Also fix `revalidatePath` to use `'layout'` to match the
project convention.

## Technical Details

**Affected files:**

- `features/llm-prompts/api/llm-prompts.ts` — `'use server'` mutations only
- `features/llm-prompts/api/llm-prompt-data.ts` — new file, no `'use server'`,
  `cache()` wrapper
- Plan document — update Server Actions section

## Acceptance Criteria

- [ ] `getLlmPromptData` lives in a file without `'use server'`
- [ ] Mutation actions (`updateLlmPrompt`, `resetLlmPrompt`, `seedLlmPrompts`)
      have `'use server'`
- [ ] `revalidatePath` calls use `'layout'` type argument (matching project
      convention)
- [ ] `app/dashboard/agents/prompts/page.tsx` imports `getLlmPromptData` from
      the non-server-action file

## Work Log

### 2026-05-25 - Discovered during plan technical review

**By:** Claude Code

**Actions:**

- Identified semantic incompatibility of `'use server'` + `cache()` co-location
- Verified project convention is `'layout'` via
  `features/agents/api/agent-profiles.ts`
- Proposed file split approach

---
