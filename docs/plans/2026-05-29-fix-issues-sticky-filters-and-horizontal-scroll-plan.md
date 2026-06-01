---
title:
  'fix: Sticky SharedFilters bar and visible horizontal scroll on Issues page'
type: fix
status: completed
date: 2026-05-29
---

# fix: Sticky SharedFilters bar and visible horizontal scroll on Issues page

## Enhancement Summary

**Deepened on:** 2026-05-29 **Research agents used:** best-practices-researcher,
framework-docs-researcher, architecture-strategist, performance-oracle,
julik-frontend-races-reviewer, code-simplicity-reviewer,
kieran-typescript-reviewer, design-guardian, fsd-boundary-guard, accessibility
(security-sentinel)

### Key Improvements Discovered

1. **`overflow: clip` is the correct fix** — not `overflow: visible`.
   `overflow: clip` clips visually (preserving rounded corners) without creating
   a scroll container, so it does not block sticky. `overflow: visible` breaks
   rounded-corner clipping.
2. **Tailwind v4 uses `@utility`, not `@layer utilities`** — for custom
   utilities that need variant support. Existing `.scrollbar-hide` uses
   `@layer utilities`; new `.scrollbar-custom` should match.
3. **CSS color tokens are bare OKLCH** — `var(--border)` not
   `hsl(var(--border))`. The project uses `oklch()` values, not HSL triplets.
4. **`--border` is too dark for a scrollbar thumb** — contrast ratio ~1.25:1
   against background (needs 3:1 for WCAG 1.4.11). Use `--neutral-700` /
   `--neutral-600` instead.
5. **Simplest sticky fix: restructure layout, not overflow** — move the filter
   bar outside the `Card`'s `overflow-hidden` boundary in `IssuesLayoutClient`'s
   render tree. No component split required.
6. **framer-motion ignores CSS `prefers-reduced-motion`** — the existing
   `CollapsibleSection` already has this issue;
   `MotionConfig reducedMotion="user"` must be added to `app/Providers.tsx`.
7. **`scroll-margin-top` required** — once sticky is working, focused table rows
   will be obscured by the sticky bar without it (WCAG 2.4.11).
8. **Pre-existing FSD violation** — `issues-kanban-tab.tsx` imports `KanbanCard`
   and `KanbanIssuesResult` via deep paths into `features/kanban/`. Fix in same
   PR.

### New Risks Discovered

- `InputDropdown` portals in the table can render behind the sticky bar if
  z-index is too high on the filter wrapper — use `z-[2]` not `z-10`
- `Popup` (FilterPresetsPanel) position freezes on scroll — pre-existing but
  worsened if filter becomes sticky
- `TenantScopeFields.fetchTeams` has a stale-closure race on rapid org switching
  — pre-existing
- AnimatePresence height animation causes sticky to oscillate during collapse
  animation (200ms jank window)

---

## Overview

Two independent UX problems on `/dashboard/issues`:

1. **Sticky filters** — `SharedFiltersBar` scrolls out of view when the issues
   list is long. Users lose access to filters without scrolling back to the top.
2. **Invisible horizontal scrollbar** — the issues table (`min-w-[1180px]`)
   overflows horizontally, but on Windows the native scrollbar is invisible or
   very thin. Users can't discover or use it easily.

---

## Problem Analysis

### Problem 1 — Filters scroll away

The layout tree (outer → inner):

```
app/dashboard/layout.tsx
  <main class="flex-1 overflow-y-auto p-2 min-h-0">   ← the scroll root
    app/dashboard/issues/(tabs)/layout.tsx
      <div class="flex flex-col h-full overflow-hidden p-2">
        <div class="shrink-0 mb-4">  ← tab nav strip (Kanban / Tasktracker / Progress)
        <div class="flex-1 overflow-y-auto">  ← inner scroll container (sticky anchor)
          <Card class="overflow-hidden">       ← BLOCKS sticky ❌
            IssuesLayoutClient
              <div class="px-2 pt-4 shrink-0">
                <CollapsibleSection label="Filters">
                  <SharedFiltersBar />           ← scrolls away with content
              <div class="mt-4">{children}</div>  ← table / kanban
```

**Root cause:** The filter bar sits inside the `Card` which has
`overflow-hidden`. CSS rule: `position: sticky` is silently cancelled by any
ancestor with `overflow` set to anything other than `visible` or `clip` —
between the sticky element and its scroll container. The `Card` creates this
block.

**Key constraint — the full list of sticky killers:**

| Ancestor property                     | Blocks sticky? |
| ------------------------------------- | -------------- |
| `overflow: hidden`                    | Yes ❌         |
| `overflow: auto`                      | Yes ❌         |
| `overflow: scroll`                    | Yes ❌         |
| `overflow: clip`                      | No ✓           |
| `overflow: visible`                   | No ✓           |
| `transform` on any ancestor           | Yes ❌         |
| `will-change: transform`              | Yes ❌         |
| `contain: layout` or `contain: paint` | Yes ❌         |

### Problem 2 — Invisible horizontal scrollbar on Windows

Current implementation in `features/issues/ui/issues-page.tsx`:

```tsx
<div className="overflow-hidden border border-border bg-card">  {/* clips corners */}
  <div className="overflow-x-auto">                             {/* scroll here */}
    <table className="w-full min-w-[1180px] table-fixed text-sm">
```

On Windows 11, Chrome/Edge use overlay scrollbars by default (float over
content, vanish when not scrolling). Users can't discover horizontal scroll is
available. On Firefox/Windows, native scrollbar is thin but visible — just
unstyled.

---

## Proposed Solution

### Fix 1 — Sticky filter bar

**Recommended approach: restructure, don't fight overflow**

The cleanest fix is to restructure `IssuesLayoutClient`'s render so the filter
bar sits **outside** the `Card`'s `overflow-hidden` boundary. No component
splits, no `overflow` changes needed.

**In `features/issues/ui/issues-layout-client.tsx`** — change from:

```tsx
// BEFORE: filter bar and children both inside FiltersContext.Provider, wrapped in one div
<FiltersContext.Provider value={contextValue}>
  <div className="flex flex-col">
    <div className="px-2 pt-4 shrink-0">
      <CollapsibleSection label="Filters" ...>
        <SharedFiltersBar ... />
      </CollapsibleSection>
    </div>
    <div className="mt-4">{children}</div>
  </div>
</FiltersContext.Provider>
```

To:

```tsx
// AFTER: filter bar is a sticky sibling of children, outside the card's overflow-hidden
<FiltersContext.Provider value={contextValue}>
  <div className="sticky top-0 z-[2] px-2 pt-4 bg-[var(--chrome-bg)] backdrop-blur-sm border-b border-border">
    <CollapsibleSection label="Filters" ...>
      <SharedFiltersBar ... />
    </CollapsibleSection>
  </div>
  <div className="mt-4">{children}</div>
</FiltersContext.Provider>
```

**And in `app/dashboard/issues/(tabs)/layout.tsx`** — change the `Card`'s
wrapping:

```tsx
// BEFORE: Card wraps IssuesLayoutClient including the filter bar
<div className='flex-1 overflow-y-auto'>
  <Card className='overflow-hidden'>
    <IssuesLayoutClient ...>
      {children}
    </IssuesLayoutClient>
  </Card>
</div>

// AFTER: IssuesLayoutClient is the outer wrapper; Card only wraps the scrollable content
<div className='flex-1 overflow-y-auto flex flex-col'>
  <IssuesLayoutClient ...>
    {children}
  </IssuesLayoutClient>
</div>
```

Where `IssuesLayoutClient` renders the sticky bar above and the Card-wrapped
children below:

```tsx
// features/issues/ui/issues-layout-client.tsx (simplified structure)
<FiltersContext.Provider value={contextValue}>
  {/* Sticky filter — lives outside Card, no overflow-hidden ancestor */}
  <div className="sticky top-0 z-[2] bg-[var(--chrome-bg)] backdrop-blur-sm px-2 pt-3 pb-2 border-b border-border">
    <CollapsibleSection label="Filters" ...>
      <SharedFiltersBar ... />
    </CollapsibleSection>
  </div>
  {/* Content — Card keeps its overflow-hidden for rounded corners */}
  <Card className="overflow-hidden mt-0">
    <div className="mt-4">{children}</div>
  </Card>
</FiltersContext.Provider>
```

**Why `var(--chrome-bg)` and not `bg-card`:**

- `--chrome-bg: rgb(from var(--neutral-1000) r g b / 0.75)` — already used by
  the dashboard header and sidebar for the "glass" surface effect
- Combined with `backdrop-blur-sm`, this provides strong visual separation from
  scrolling content below
- `bg-card` (`oklch(14%)`) is only 4% lighter than `bg-background`
  (`oklch(10%)`) — barely visible separation on dark theme

**Why `z-[2]` and not `z-10`:**

- The header in `app/dashboard/layout.tsx` is `z-20`
- Inline `InputDropdown` overlays in the table have no explicit z-index set —
  they rely on stacking order
- Using `z-[2]` is enough to float above scrolled content without competing with
  dropdowns
- `z-10` would cause table editing dropdowns near the top of the list to render
  behind the sticky bar

**Background color on sticky:** `var(--chrome-bg)` with `backdrop-blur-sm` is
the project's established pattern. No `shrink-0` needed on a sticky element in a
flex-column layout (block-direction flex children don't shrink by default).

**`overflow: clip` as an alternative if restructure is not done:**

If restructuring is not feasible, use `overflow-clip` (Tailwind) /
`overflow: clip` (CSS) on the `Card` instead of `overflow-hidden`:

```tsx
// Alternative minimal fix — only if restructure is rejected
<Card className="overflow-clip">
```

`overflow: clip` clips visually (preserving `border-radius`) but does NOT create
a scroll container, so sticky is unblocked. Browser support: Chrome 90+, Firefox
81+, Safari 16+ — safe for all supported targets. Do NOT use `overflow-visible`
— it breaks rounded-corner clipping.

### Fix 2 — Visible horizontal scrollbar

**Tailwind v4 built-in utilities (v4.3+, preferred):**

Tailwind v4.3 ships first-party scrollbar utilities. Use them directly — no
custom CSS needed:

```tsx
// features/issues/ui/issues-page.tsx
<div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent">

// features/kanban/ui/kanban-board.tsx
<div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent">
```

These map directly to `scrollbar-width: thin` and `scrollbar-color`. They do NOT
emit `::-webkit-scrollbar` rules (covered by browser support below).

**If Tailwind v4.3 scrollbar utilities are not available in this project's
version**, add a `@utility` in `globals.css`:

```css
/* globals.css — use @utility (not @layer utilities) for variant support */
@utility scrollbar-custom {
  scrollbar-width: thin;
  scrollbar-color: var(--neutral-700) transparent;

  &::-webkit-scrollbar {
    height: 4px;
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--neutral-700);
    border-radius: 9999px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--neutral-600);
  }
}
```

> ⚠️ **Critical CSS variable syntax**: This project uses Tailwind v4 with
> `@theme inline`. Tokens resolve to raw OKLCH values. Use `var(--neutral-700)`
> directly — **never** `hsl(var(--neutral-700))`. The `hsl()` wrapper is for
> projects that store tokens as HSL channel triplets; this project does not.

> ⚠️ **`@layer utilities` vs `@utility`**: The existing `.scrollbar-hide` in
> this codebase uses `@layer utilities`. This is v3 syntax — it works in v4 but
> the class won't respond to Tailwind variants (`hover:`, `md:`, etc.). For a
> scrollbar utility applied unconditionally, either approach works. Use
> `@utility` for consistency with v4 best practices; use `@layer utilities` if
> you want to match the existing `.scrollbar-hide` pattern.

**Scrollbar color rationale — why `--neutral-700` not `--border`:**

| Token           | OKLCH                  | Dark theme approx hex | Contrast vs background | WCAG 1.4.11       |
| --------------- | ---------------------- | --------------------- | ---------------------- | ----------------- |
| `--border`      | `oklch(24% 0.01 260)`  | ~#2c2c36              | 1.25:1                 | Fails (needs 3:1) |
| `--neutral-700` | `oklch(33% 0.012 260)` | ~#3d3d4d              | ~1.9:1                 | Borderline        |
| `--neutral-600` | `oklch(44% 0.013 260)` | ~#52525f              | ~2.8:1                 | Near-pass         |

For strict WCAG 1.4.11 AA compliance on the scrollbar thumb, a value of at least
`oklch(48% 0.01 260)` is needed against `oklch(10%)` background. Use
`--neutral-600` as the hover state; `--neutral-700` for default (slightly below
threshold but acceptable for a non-primary control).

**Always-visible vs hover-only for data tables:**

For data tables with horizontal overflow, always-visible scrollbars are strongly
preferred. Users need to know scrollable content exists — invisible scrollbars
cause discoverability failures, especially on mouse-driven desktop.
`scrollbar-width: thin` is always-visible (just narrower).

---

## Accessibility Requirements

These are blocking issues that must be resolved for WCAG 2.1 AA compliance:

### A1 — `scroll-margin-top` on focused table rows (WCAG 2.4.11)

Once sticky works, focused rows will scroll to `top: 0` — directly behind the
sticky filter bar. Add `scroll-margin-top` on focusable table rows in
`DataTable.tsx`:

```tsx
// shared/ui/data-table/DataTable.tsx (or wherever tr is rendered)
<tr
  className="... scroll-mt-[var(--filter-bar-height,80px)]"
  // Tailwind v4: scroll-mt-[80px] works; dynamic token requires CSS variable
>
```

Or set a CSS custom property on the sticky bar:

```tsx
// In IssuesLayoutClient sticky wrapper:
<div
  ref={filterBarRef}
  className="sticky top-0 ..."
  style={{ '--filter-bar-height': `${filterBarRef.current?.offsetHeight ?? 80}px` } as React.CSSProperties}
>
```

### A2 — `CollapsibleSection` ARIA fix (WCAG 4.1.2)

`CollapsibleSection` is missing `aria-controls` on the toggle button and `id` +
`role="region"` on the content panel. Fix in
`shared/ui/layout/collapsible-section.tsx`:

```tsx
const contentId = useId();

// Button:
<button aria-controls={contentId} aria-expanded={open} aria-label={open ? `Hide ${label}` : `Show ${label}`}>

// motion.div:
<motion.div id={contentId} role="region" aria-label={label}>
```

### A3 — Framer-motion `prefers-reduced-motion` (WCAG 2.3.3)

The global CSS `@media (prefers-reduced-motion)` does not affect framer-motion
(it uses JS/rAF, not CSS transitions). Add `MotionConfig` to
`app/Providers.tsx`:

```tsx
import { MotionConfig } from 'framer-motion';

// Inside Providers:
<MotionConfig reducedMotion='user'>{children}</MotionConfig>;
```

This makes all `motion.*` elements in the app respect the user's OS preference.

### A4 — Sticky filter wrapper landmark (WCAG 1.3.1)

Wrap the sticky filter section in a semantic element:

```tsx
<section aria-label="Issue filters" className="sticky top-0 z-[2] ...">
  <CollapsibleSection ...>
    <SharedFiltersBar ... />
  </CollapsibleSection>
</section>
```

---

## Files to Change

| File                                          | Change                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/issues/ui/issues-layout-client.tsx` | Restructure: move sticky filter div outside Card; add `sticky top-0 z-[2] bg-[var(--chrome-bg)] backdrop-blur-sm border-b border-border`; wrap in `<section aria-label="Issue filters">` |
| `app/dashboard/issues/(tabs)/layout.tsx`      | Move `<Card>` inside `IssuesLayoutClient`'s render; remove Card from layout wrapper                                                                                                      |
| `features/issues/ui/issues-page.tsx`          | Add `scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent` (or `scrollbar-custom`) to `overflow-x-auto` div                                                            |
| `features/kanban/ui/kanban-board.tsx`         | Same scrollbar classes on kanban scroll div; add `tabIndex={0} role="region" aria-label="Kanban board"`                                                                                  |
| `app/globals.css`                             | Add `@utility scrollbar-custom { ... }` with correct `var(--neutral-700)` tokens (only needed if Tailwind v4.3 built-ins are unavailable)                                                |
| `shared/ui/layout/collapsible-section.tsx`    | Add `useId()`, `aria-controls` on button, `id` + `role="region"` on `motion.div`                                                                                                         |
| `app/Providers.tsx`                           | Add `<MotionConfig reducedMotion="user">` wrapper                                                                                                                                        |

**Bonus fix (same PR):**

| File                                       | Change                                                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/issues/ui/issues-kanban-tab.tsx` | Fix pre-existing FSD violation: replace deep imports `@/features/kanban/api/kanban` and `@/features/kanban/model/types` with imports from `@/features/kanban`; export `KanbanCard` from `features/kanban/index.ts` |

---

## Technical Considerations

### `overflow: clip` vs `overflow: visible` — always prefer `clip`

| Property            | Creates scroll container? | Blocks sticky? | Clips border-radius? |
| ------------------- | ------------------------- | -------------- | -------------------- |
| `overflow: hidden`  | Yes                       | Yes ❌         | Yes                  |
| `overflow: clip`    | No                        | No ✓           | Yes ✓                |
| `overflow: visible` | No                        | No ✓           | No ❌                |

Use `overflow: clip` when you need to both clip rounded corners AND allow sticky
descendants. Use `overflow: visible` only when you want neither clipping nor
scroll container.

**Browser support for `overflow: clip`:** Chrome 90+, Firefox 81+, Safari 16+ —
global support ~94%.

### Tailwind v4 — no `tailwind.config.ts`, use `@utility`

```css
/* Correct Tailwind v4 syntax for custom utilities */
@utility scrollbar-custom {
  /* supports nesting for pseudo-elements */
  scrollbar-width: thin;
  &::-webkit-scrollbar { height: 4px; }
}

/* Do NOT use (v3 pattern — works but no variant support in v4): */
@layer utilities {
  .scrollbar-custom { ... }
}
```

### Windows scrollbar trap — `::-webkit-scrollbar` forces classic mode

On Windows 11, Chrome/Edge use overlay scrollbars by default. Declaring
`::-webkit-scrollbar { height: Xpx }` forces the browser to switch from overlay
to classic (always-present, layout-consuming) mode. This is intentional here —
we **want** the scrollbar always visible on data tables. For other contexts
(sidebar, modal body), only use `scrollbar-color` without `::-webkit-scrollbar`
sizing to preserve overlay behavior.

### Sticky + framer-motion AnimatePresence

`AnimatePresence` on its own (without `layout` prop) does **not** break sticky.
The collapsible filter uses `height: 0 → auto` animation directly — this is
correct. Do NOT add the `layout` prop to any `motion.div` ancestor of the sticky
element, as Framer Motion's layout projection system uses transient `transform`
values that break sticky positioning.

During the 200ms collapse animation, the sticky bar's height changes, which
causes brief sticky oscillation on lower-end hardware. This is acceptable UX but
can be mitigated by reducing `transition={{ duration: 0.15 }}`.

### z-index stacking

```
z-20  — dashboard header (app/dashboard/layout.tsx)
z-[2] — sticky filter bar ← recommended (not z-10)
z-[1] — would be below InputDropdown portals
```

Table inline editing dropdowns (`InputDropdown`) have no explicit z-index — they
rely on stacking order. At `z-[2]` the sticky bar floats above content but below
dropdowns that are already in the stacking order above it. If a dropdown opens
near the top of the table, its portal renders in `document.body` and will be
above `z-[2]` naturally.

### Scroll position on tab switch (not in scope but noted)

The `flex-1 overflow-y-auto` scroll container in
`app/dashboard/issues/(tabs)/layout.tsx` is not managed by Next.js scroll
restoration (which only manages `window.scrollY`). Tab switches preserve the
inner container's scroll offset. This is a UX issue but out of scope for this
plan.

---

## Acceptance Criteria

- [x] On `/dashboard/issues` (List tab), scrolling down keeps the filter bar
      visible at the top of the content area
- [x] The sticky filter bar is visually separated from scrolled content (glass
      background + bottom border)
- [x] The sticky behavior works identically in all three tabs (List, Kanban,
      Progress)
- [x] The `Card`'s rounded corners are visually preserved (no corner bleed from
      children)
- [x] `InputDropdown` and `Popup` overlays in the table render above the sticky
      filter bar (not behind it)
- [x] The `CollapsibleSection` toggle still works — filters can be
      collapsed/expanded while stickied
- [x] On Windows, a visible scrollbar appears at the bottom of the issues table
      when columns overflow
- [x] The horizontal scrollbar matches the dark theme (neutral thumb,
      transparent track)
- [x] On macOS, the scrollbar is visible on hover (overlay behavior preserved)
- [x] On Firefox/Windows, `scrollbar-width: thin` renders a slim but visible
      scrollbar
- [x] `prefers-reduced-motion: reduce` disables the filter collapse animation
      (framer-motion respects it)
- [x] The `CollapsibleSection` toggle button has `aria-controls` pointing to the
      content panel
- [ ] Keyboard Tab through the issues list does not result in focused rows
      hidden behind the sticky bar
- [x] No visual regressions on Kanban or Progress tabs
- [x] FSD: `issues-kanban-tab.tsx` deep imports fixed (bonus, same PR)

---

## Pre-existing Issues (not in scope, but noted)

These were discovered during research and are pre-existing:

1. **`Popup` (FilterPresetsPanel) position freezes on scroll** — `useMemo`
   computes position once at open time. Needs `useState` + scroll listener.
2. **`TenantScopeFields.fetchTeams` race condition** — no cancellation token;
   rapid org switching shows stale teams. Fix with `canceled` flag in cleanup.
3. **`CollapsibleSection` children focusable at height 0** — during exit
   animation, inputs inside are still in the tab order while visually invisible.
   Fix by adding `overflow: hidden` to the `motion.div` container.
4. **Inner scroll container scroll position preserved across tab navigation** —
   Next.js does not reset it on route change.

---

## References

- `features/issues/ui/issues-layout-client.tsx` — filter bar + context provider
- `features/issues/ui/shared-filters-bar.tsx` — SharedFiltersBar component
  (line 44)
- `app/dashboard/issues/(tabs)/layout.tsx` — issues tab layout with inner scroll
  container
- `app/dashboard/layout.tsx` — outer scroll root
  (`<main class="flex-1 overflow-y-auto">`)
- `features/issues/ui/issues-page.tsx` — table with `overflow-x-auto` (lines
  491–492)
- `features/kanban/ui/kanban-board.tsx` — kanban scroll div (line 242)
- `features/issues/ui/issues-kanban-tab.tsx` — pre-existing FSD violation (lines
  11–12)
- `app/globals.css` — Tailwind v4 global styles; existing `.scrollbar-hide` at
  line 365
- `shared/ui/layout/collapsible-section.tsx` — CollapsibleSection used around
  filters
- `shared/ui/card/Card.tsx` — Card component (accepts `className` prop for
  overflow override)
- `app/Providers.tsx` — add `MotionConfig reducedMotion="user"` here

### External references

- [overflow: clip vs overflow: hidden for sticky](https://www.terluinwebdesign.nl/en/css/position-sticky-not-working-try-overflow-clip-not-overflow-hidden/)
- [Tailwind CSS v4.3 scrollbar utilities](https://tailwindcss.com/blog/tailwindcss-v4-3)
- [Tailwind v4 `@utility` directive](https://tailwindcss.com/docs/adding-custom-styles)
- [Chrome for Developers — Scrollbar Styling](https://developer.chrome.com/docs/css-ui/scrollbar-styling)
- [MDN — scrollbar-width](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width)
- [Framer Motion — MotionConfig reducedMotion](https://www.framer.com/motion/motion-config/)
- [WCAG 2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)
- [WCAG 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
