---
status: pending
priority: p3
issue_id: '019'
tags: [code-review, filter-merge, react-hooks, useEffect, stale-closure]
dependencies: []
---

# Stale closure: `onChange` missing from search debounce `useEffect` dep array

## Problem Statement

`shared-filters-bar.tsx` line 71: the `useEffect` that debounces the search input omits `onChange` from its dependency array. If `onChange` ever changes identity before the 300ms timer fires, the old (stale) closure is called instead of the current one.

This is a **pre-existing bug** (not introduced by the filter merge). ESLint's `react-hooks/exhaustive-deps` rule will flag it when this file is touched during the refactor.

## Findings

```ts
// current code (lines 63–71)
useEffect(() => {
  const timer = setTimeout(() => {
    onChange({ search: searchValue });  // ← captures onChange from closure
  }, 300);
  return () => { clearTimeout(timer); };
}, [searchValue]);  // ← onChange not listed
```

`onChange` = `handleFiltersChange` from `issues-layout-client.tsx`, defined as:

```ts
// issues-layout-client.tsx line 152
const handleFiltersChange = useCallback((patch: Partial<SharedFilters>) => {
  // ...
}, []);  // ← empty dep array = stable identity
```

Because the caller stabilises `onChange` with an empty-dep `useCallback`, the stale closure cannot fire in practice today. However:
1. ESLint will warn (or error) on this pattern — `react-hooks/exhaustive-deps`
2. Any future caller that passes an inline `onChange` (e.g. in a test or a new usage of `SharedFiltersBar`) will silently get stale updates

## Proposed Solution

### Option A — Add `onChange` to the dep array (Recommended)

```ts
}, [searchValue, onChange]);
```

Safe because `handleFiltersChange` already has stable identity via `useCallback`. No effect on behaviour, silences the lint rule.

**Pros:** Correct, minimal change, silences ESLint.
**Cons:** Depends on callers passing stable `onChange`. Callers should be verified.
**Effort:** 1 character change.
**Risk:** None for the current codebase.

### Option B — Use `useRef` to avoid the dep issue entirely

```ts
const onChangeRef = useRef(onChange);
useEffect(() => { onChangeRef.current = onChange; });

useEffect(() => {
  const timer = setTimeout(() => {
    onChangeRef.current({ search: searchValue });
  }, 300);
  return () => { clearTimeout(timer); };
}, [searchValue]);  // onChange intentionally omitted
```

**Pros:** Timer never restarts on `onChange` identity changes; most stable pattern.
**Cons:** Adds a `useRef` + a sync `useEffect`; more complex for what is a very small component.
**Effort:** Small but more verbose.
**Risk:** Slightly harder to understand.

## Recommended Action

**Option A** — add `onChange` to the dep array. Simple, correct for the current codebase. Add a one-line comment: `// onChange must be stable (useCallback) — callers should not pass inline functions`.

## Technical Details

- **Affected file:** `features/issues/ui/shared-filters-bar.tsx` (line 71)
- **ESLint rule:** `react-hooks/exhaustive-deps`
- **Should be fixed in the same PR** as the filter merge, since that PR already modifies this file

## Acceptance Criteria

- [ ] `useEffect` dep array on line 71 includes `onChange`
- [ ] `npm run lint` passes with no `react-hooks/exhaustive-deps` warning on this line
- [ ] Search debounce still works correctly (300ms delay, fires on stop typing)

## Work Log

- 2026-05-20: Found during TypeScript review of filter merge plan.
