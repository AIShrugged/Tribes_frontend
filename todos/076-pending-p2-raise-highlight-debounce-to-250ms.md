---
status: pending
priority: p2
issue_id: "076"
tags: [code-review, performance, llm-prompts]
dependencies: [069, 070]
---

# Raise placeholder highlight debounce from 100ms to 250ms for large prompts

## Problem Statement

The plan specifies 100ms debounce for the placeholder highlight computation. For prompts with 10,000+ characters (realistic for complex system prompts), `buildSegments()` with regex matching runs on the main thread and takes 5–20ms. At 100ms debounce the function fires 10 times per second during fast typing — meaningful CPU load. 250ms is more appropriate: imperceptible to users (~3 frames at 60fps), but reduces main-thread pressure by 60%.

## Findings

- Plan: `const debouncedValue = useDebounce(value, 100)` for highlight
- Regex exec on 100k chars: ~1–5ms; building 100+ React elements: ~2–10ms; reconciliation: ~5–20ms
- Total per debounce tick: 8–35ms — at 100ms this is 10× per second during active typing
- At 250ms: 4× per second — acceptable for a visual effect that users perceive as "live enough"
- Search debounce at 150ms is fine (operates over a static 31-item array, negligible cost)

## Proposed Solutions

### Option 1: Set highlight debounce to 250ms (Recommended)

```ts
const debouncedPromptValue = useDebounce(watchedPrompt, 250);
```

Also remove explicit `useMemo` wrapper since React Compiler handles memoization:
```ts
// Remove this:
const segments = useMemo(() => buildSegments(debouncedPromptValue, PLACEHOLDER_PATTERN), [debouncedPromptValue]);
// Replace with:
const segments = buildSegments(debouncedPromptValue, PLACEHOLDER_PATTERN);
// React Compiler will memoize this automatically
```

**Pros:** 60% reduction in main-thread pressure; still feels live to users
**Cons:** Highlight "trails" typing by up to 250ms — acceptable for an admin editor
**Effort:** 5 minutes (change one number)
**Risk:** Low

## Recommended Action

Option 1. Change debounce to 250ms and remove the `useMemo` wrapper (React Compiler handles it — explicit `useMemo` under the Compiler is misleading).

## Technical Details

**Affected files:**
- `features/llm-prompts/ui/llm-prompt-form.tsx` — `HighlightedTextarea` component

**Dependencies:** #069 (useDebounce hook), #070 (buildSegments function)

## Acceptance Criteria

- [ ] Highlight debounce is 250ms, not 100ms
- [ ] No explicit `useMemo` on the segments computation
- [ ] React Compiler handles memoization of `buildSegments(debouncedValue, ...)` automatically

## Work Log

### 2026-05-25 - Discovered during plan performance review

**By:** Claude Code

**Actions:**
- Identified 100ms as too tight for large prompt text
- Proposed 250ms as optimal balance

---
