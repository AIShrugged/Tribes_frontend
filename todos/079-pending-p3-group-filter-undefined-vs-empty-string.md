---
status: pending
priority: p3
issue_id: '079'
tags: [code-review, llm-prompts, api]
dependencies: []
---

# Specify "All groups" group filter value — `undefined` not empty string

## Problem Statement

The plan's `getLlmPrompts` accepts `group?: LlmPromptGroup` but does not specify
what value is passed when "All groups" is selected in the filter UI. If the
caller passes `group=""` (empty string), the backend receives `?group=` which
may behave unexpectedly. The correct behavior is to omit the `group` parameter
entirely (pass `undefined`) when "All groups" is selected.

## Findings

- `getLlmPrompts(orgId, { group: undefined })` → no `?group=` query param →
  backend returns all prompts ✓
- `getLlmPrompts(orgId, { group: '' })` → `?group=` query param → backend does
  `WHERE slug LIKE '.%'` → returns nothing ✗
- The plan's `LlmPromptGroup` union does not include `''` (empty string) so
  TypeScript should catch this if typed correctly
- The client-side filter in `llm-prompts-list.tsx` must pass `undefined` to the
  group filter when "All" is selected

## Proposed Solutions

### Option 1: Use `undefined` for "All groups" selection (Recommended)

```ts
// In llm-prompt-group-filter.tsx
const handleGroupSelect = (group: LlmPromptGroup | null) => {
  setActiveGroup(group ?? undefined);
  // Update URL: group=undefined → remove ?group= param
};

// In filter logic
const filtered = activeGroup
  ? prompts.filter((p) => p.slug.startsWith(activeGroup + '.'))
  : prompts;
```

**Effort:** 15 minutes (clarify in plan) **Risk:** Low

## Recommended Action

Document explicitly in the plan: "All groups" selection sets `activeGroup` state
to `undefined` (not empty string). URL param is removed when `undefined`. Group
filter passes `undefined` to the filter function.

## Technical Details

**Affected files:**

- `features/llm-prompts/ui/llm-prompt-group-filter.tsx`
- Plan document — add note on group filter "All" behavior

## Acceptance Criteria

- [ ] "All groups" selection results in no `?group=` URL param
- [ ] Client-side filter passes `undefined` (not `''`) to filter function
- [ ] TypeScript types enforce `LlmPromptGroup | undefined` not
      `LlmPromptGroup | ''`

## Work Log

### 2026-05-25 - Discovered during plan TypeScript review

**By:** Claude Code

---
