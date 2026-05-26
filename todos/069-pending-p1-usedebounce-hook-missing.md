---
status: pending
priority: p1
issue_id: '069'
tags: [code-review, typescript, llm-prompts, hooks]
dependencies: []
---

# Add `useDebounce` hook to `shared/hooks/` — required by LLM prompts plan

## Problem Statement

The LLM prompts plan relies on `useDebounce` for both placeholder highlight
computation (100ms) and search filtering (150ms), but this hook does not exist
anywhere in the project. `shared/hooks/` exports only `useInfiniteScroll`,
`useModal`, `usePopup`, and `useTableSort`. Without this hook, the highlighted
textarea and search features cannot be implemented.

## Findings

- `shared/hooks/` — confirmed: no `useDebounce` export
- Plan references `const debouncedValue = useDebounce(value, 100)` with no
  library import
- No debounce utility in `shared/lib/` either
- The project already uses `lodash.debounce` or similar in some places — check
  if a dep is already available

## Proposed Solutions

### Option 1: Add custom `useDebounce` to `shared/hooks/` (Recommended)

**Approach:** Implement a simple hook with no new dependencies:

```ts
// shared/hooks/use-debounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

Export from `shared/hooks/index.ts`.

**Pros:** Zero new dependency; 10 lines; reusable across codebase **Cons:** None
meaningful **Effort:** 30 minutes **Risk:** Low

---

### Option 2: Use `use-debounce` npm package

**Approach:** `npm install use-debounce` — provides `useDebounce` and
`useDebouncedCallback`.

**Pros:** Battle-tested, TypeScript first, has `useDebouncedCallback` for the
mirror update use case **Cons:** Adds a dependency for something trivially
implementable **Effort:** 15 minutes **Risk:** Low

---

### Option 3: Use `useDebouncedCallback` pattern inline

**Approach:** Replace `useDebounce(value, delay)` with `useCallback` +
`useRef`-based timeout in the component itself. Avoids adding a hook to shared.

**Pros:** No shared dependency **Cons:** Verbose; less reusable; must be
duplicated for search filter **Effort:** 45 minutes **Risk:** Low

## Recommended Action

Option 1 — add a minimal `useDebounce` hook to `shared/hooks/use-debounce.ts`
and export it from the index. This is a standard project utility, not a
feature-specific concern.

## Technical Details

**Affected files:**

- `shared/hooks/use-debounce.ts` — new file
- `shared/hooks/index.ts` — add export

## Acceptance Criteria

- [ ] `useDebounce<T>(value: T, delay: number): T` exported from
      `@/shared/hooks`
- [ ] Works correctly under React 19 / React Compiler (no memoization conflicts)
- [ ] Used in `llm-prompt-form.tsx` for highlight debounce at 250ms
- [ ] Used in `llm-prompts-list.tsx` for search debounce at 150ms

## Work Log

### 2026-05-25 - Discovered during plan technical review

**By:** Claude Code

**Actions:**

- Confirmed `useDebounce` absent from `shared/hooks/`
- Confirmed no equivalent in `shared/lib/`
- Proposed three implementation strategies

---
