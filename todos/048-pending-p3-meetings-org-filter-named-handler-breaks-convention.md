---
id: "048"
priority: P3
status: pending
area: meetings
file: features/meetings/ui/meetings-list-filters-bar.tsx
---

# Do not extract `onOrgChange` as a named function — use inline arrow per file convention

## Problem

The plan proposes extracting the org change handler into a named function:

```ts
function onOrgChange(value: string) { ... }
```

All other `onChange` handlers in `meetings-list-filters-bar.tsx` are inline arrows:

```tsx
onChange={(value) => { ... }}
```

Introducing a named handler for one control breaks the file's consistent style without any benefit — the function is not reused and not tested independently.

## Required Fix

Implement as an inline arrow, consistent with every other handler in the file:

```tsx
onChange={(value) => {
  setOrganizationId(value as string)
  startTransition(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('team_id')
    params.delete('user_id')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  })
}}
```
