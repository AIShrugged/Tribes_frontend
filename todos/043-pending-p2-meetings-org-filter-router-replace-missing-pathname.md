---
id: "043"
priority: P2
status: pending
area: meetings
file: features/meetings/ui/meetings-list-filters-bar.tsx
---

# `router.replace` in org change handler must include `pathname` prefix

## Problem

The plan's `onOrgChange` pseudocode shows:

```ts
router.replace(`?${params.toString()}`, { scroll: false })
```

All existing `router.replace` calls in `meetings-list-filters-bar.tsx` use the `pathname` prefix:

```ts
router.replace(`${pathname}?${params.toString()}`, { scroll: false })
```

Using `?${params}` alone (without `pathname`) causes Next.js to treat the string as a relative URL, which on some navigations resolves incorrectly against the current pathname. The existing handlers already establish the correct pattern — the implementation must match.

## Required Fix

In the org change handler, use:

```ts
router.replace(`${pathname}?${params.toString()}`, { scroll: false })
```

`pathname` is already destructured from `usePathname()` at the top of the component.
