---
status: pending
priority: p3
issue_id: '020'
tags: [code-review, filter-merge, dry, code-quality, issues]
dependencies: []
---

# DRY: extract shared `persons.map()` body used by both `personOptions` and `authorOptions`

## Problem Statement

`shared-filters-bar.tsx` defines `personOptions` (lines 73–82) and `authorOptions` (lines 84–92) using identical `.map()` transform logic over the `persons` prop. The only difference is the leading sentinel option. A future label/format change requires the same update in two places.

This is a minor code quality issue — not a bug — but fixing it takes 3 lines and is appropriate to include in the filter merge PR since that PR already modifies this file.

## Findings

```ts
// Lines 73–82 (personOptions)
const personOptions = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  ...persons.map((person) => ({
    value: String(person.id),
    label: person.email ? `${person.name} (${person.email})` : person.name,
  })),
];

// Lines 84–92 (authorOptions) — identical .map() body
const authorOptions = [
  { value: '', label: 'Any author' },
  ...persons.map((person) => ({
    value: String(person.id),
    label: person.email ? `${person.name} (${person.email})` : person.name,
  })),
];
```

The `.map()` body (`String(person.id)`, `email ? name (email) : name`) is copy-pasted. `sonarjs/no-duplicate-string` does not fire here (the strings differ), but the structural duplication is still a DRY violation.

React Compiler is enabled — no `useMemo` is needed; the compiler memoizes automatically.

## Proposed Solution

### Option A — Extract shared `mappedPersons` intermediate (Recommended)

```ts
const mappedPersons = persons.map((person) => ({
  value: String(person.id),
  label: person.email ? `${person.name} (${person.email})` : person.name,
}));

const personOptions = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  ...mappedPersons,
];

const authorOptions = [{ value: '', label: 'Any author' }, ...mappedPersons];
```

**Pros:** Single source of truth for the person label format, easy future change.
**Cons:** None meaningful.
**Effort:** 3 lines changed, ~5 lines total.
**Risk:** None — same runtime output.

## Recommended Action

**Option A** — extract `mappedPersons`. Include in the same PR as the filter merge (file is already being touched).

## Technical Details

- **Affected file:** `features/issues/ui/shared-filters-bar.tsx` (lines 73–92)
- **Note:** `personOptions` includes `{ value: 'unassigned', label: 'Unassigned' }` which `authorOptions` does not. The extraction must preserve this difference.

## Acceptance Criteria

- [ ] `persons.map()` body appears exactly once in the file
- [ ] `personOptions` still includes the `'unassigned'` sentinel
- [ ] `authorOptions` does not include an `'unassigned'` option
- [ ] `npm run lint` passes; no TypeScript errors

## Work Log

- 2026-05-20: Found during pattern-recognition and TypeScript review of filter merge plan.
