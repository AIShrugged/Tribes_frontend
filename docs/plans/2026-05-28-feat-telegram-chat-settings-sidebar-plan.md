---
title: Move Telegram chat settings to sidebar + UX fixes
type: feat
status: active
date: 2026-05-28
---

# Move Telegram Chat Settings to Sidebar + UX Fixes

## Overview

Two targeted improvements to the Telegram chat management UX (sidebar task confirmed already done):

1. **Fix delete chat layout** — the inline confirm strip (`"Remove this chat?"`) in `telegram-chat-card.tsx` appears at the bottom of the card after the metadata grid and the warning banner, causing the card to expand unexpectedly.

2. **Remove organization field from Add chat dialog + translate Topic ID tooltip** — since `organization_id` is already pre-filled from the current org cookie, the field is redundant. Keep the Team selector. Also fix two Russian strings in the modal: `placeholder='Например: 336'` → `'e.g. 336'` and help text `'Оставьте пустым, чтобы подключить весь чат'` → `'Leave empty to connect the entire chat'`.

---

## Problem Statement

### 1. Chat settings discoverability

**Current state:**
- `/dashboard/profile/telegram/page.tsx` — `permanentRedirect` to `/dashboard/telegram`
- Sidebar has "Telegram" item (`features/menu/lib/options.ts`, position 60) pointing to `/dashboard/telegram`
- The sidebar settings gear (`SidebarFooter`) links to `ROUTES.DASHBOARD.PROFILE_PREFERENCES`

**Likely intent:** Add a child "Chats" sub-item under the "Telegram" sidebar item so the navigation makes the page more explicit and easier to find, matching the pattern used elsewhere for nested routes. Alternative interpretation: surface a "Telegram settings" link from the sidebar footer gear icon.

> ⚠️ **Clarify with user** before implementing: what exactly needs to move, and where exactly it should appear.

### 2. Delete chat layout bug

**File:** `features/telegram/ui/telegram-chat-card.tsx` lines 149–174

When `isConfirming = true`, the confirm strip renders at the bottom of the flex column, **below** both the metadata grid and the "Bot not yet in group" warning. For unbound chats, this stacks:
```
[title + trash icon (hidden)]
[metadata grid]
[warning: "Bot not yet in group"]    ← always visible for unbound chats
[Remove this chat? [Remove] [Cancel]] ← confirm strip appears below warning
```
The confirm strip should be co-located with the delete button — in the header row — not floating below an unrelated warning.

**Fix:** Move the confirm controls inline with the title row (same `flex items-start justify-between` row, replacing the trash `ButtonIcon`) so they appear at the top of the card.

### 3. Organization field in Add chat modal + Russian strings

**File:** `features/telegram/ui/add-telegram-chat-modal.tsx`

Issues:
- `TenantScopeFields` at lines 137–151 renders an Organization dropdown even though `organization_id` is always pre-set to `selectedOrganizationId` (current org from cookie). The field adds noise and can lead to accidental cross-org registration.
- Line 119: `placeholder='Например: 336'` — Russian, violates English-only UI convention
- Line 124: `Оставьте пустым, чтобы подключить весь чат` — Russian help text

**Note on team_id:** The Team selector from `TenantScopeFields` is still useful — keep it, but pass the fixed `organization_id` directly instead of letting the user pick org. Consider whether to keep `TenantScopeFields` or replace it with only the Team dropdown, passing `organizationId` as a hidden/fixed value.

---

## Technical Approach

### Task 1 — Sidebar exposure

**Option A (recommended if user wants sub-item):**

Add a `children` array to the `telegram` menu item in `features/menu/lib/options.ts`:
```ts
{
  id: 'telegram',
  label: 'Telegram',
  icon: 'send',
  href: ROUTES.DASHBOARD.TELEGRAM,
  position: 60,
  children: [
    {
      id: 'telegram-chats',
      label: 'Chats',
      icon: 'send',  // or a chat-specific icon
      href: ROUTES.DASHBOARD.TELEGRAM,
      position: 1,
    },
  ],
},
```

The `MenuNested`/`NestedMenuItem` components already support children (framer-motion collapse). No new infrastructure needed.

**Option B (if user wants settings gear to link to telegram):**

In `features/menu/ui/sidebar-footer.tsx` line 64, change:
```tsx
href={ROUTES.DASHBOARD.PROFILE_PREFERENCES}
```
to:
```tsx
href={ROUTES.DASHBOARD.TELEGRAM}
```

**Files to touch (option A):**
- `features/menu/lib/options.ts` — add children to telegram item

### Task 2 — Delete layout fix

**File:** `features/telegram/ui/telegram-chat-card.tsx`

**Current structure (simplified):**
```
<div flex-col gap-4>
  <div flex justify-between>          ← header row
    <div> title + subtitle </div>
    <div> <Badge /> {canDelete && !isConfirming && <ButtonIcon trash />} </div>
  </div>
  <div grid> metadata... </div>
  {!is_bound && <warning banner />}
  {isConfirming && <confirm strip />}  ← ❌ at bottom, after warning
</div>
```

**Target structure:**
```
<div flex-col gap-4>
  <div flex justify-between>          ← header row
    <div> title + subtitle </div>
    <div flex gap-2>
      <Badge />
      {canDelete && !isConfirming && <ButtonIcon trash />}
      {isConfirming && <confirm controls inline />}  ← ✅ in header
    </div>
  </div>
  <div grid> metadata... </div>
  {!is_bound && <warning banner />}
  {/* confirm strip removed from here */}
</div>
```

The confirm controls moved into the right side of the header row:
```tsx
{isConfirming ? (
  <div className='flex items-center gap-2'>
    <p className='text-sm text-muted-foreground whitespace-nowrap'>Remove?</p>
    <Button type='button' variant='danger' size='sm' loading={isPending} loadingText='…' onClick={handleConfirmDelete}>
      Remove
    </Button>
    <Button type='button' variant='secondary' size='sm' disabled={isPending} onClick={() => setIsConfirming(false)}>
      Cancel
    </Button>
  </div>
) : null}
```

**Note on responsive overflow:** the header row has `items-start justify-between`. On narrow screens, confirm + badge + title may overflow. Consider switching to `flex-wrap` or moving confirm to a separate row only on mobile.

### Task 3 — Remove org field + fix Russian strings

**File:** `features/telegram/ui/add-telegram-chat-modal.tsx`

**Changes:**
1. Remove `TenantScopeFields` import and usage (lines 137–151) — or replace with a team-only dropdown that receives `organizationId` as a fixed prop.
2. Pass `organization_id: selectedOrganizationId` directly in `onSubmit` (line 68) rather than from form state.
3. Remove `organization_id` from form schema validation (`features/telegram/model/schemas.ts`) or keep it as a hidden field.
4. Fix line 119: `placeholder='Например: 336'` → `placeholder='e.g. 336'`
5. Fix line 124: `'Оставьте пустым, чтобы подключить весь чат'` → `'Leave empty to connect the entire chat'`

**Team selector option:** If team assignment is still needed, create a dedicated Team selector or keep only the `team_id` part of `TenantScopeFields` by passing a fixed `organizationId`:

```tsx
<TenantScopeFields
  organizations={[]}              // pass empty to hide org dropdown
  organizationId={String(selectedOrganizationId)}
  ...
/>
```

Check if `TenantScopeFields` at `/shared/ui/input/tenant-scope-fields.tsx` hides the org selector when `organizations` is empty — if not, create a separate lean team-only selector or conditionally render only the team part.

**Form schema update** (`features/telegram/model/schemas.ts`):
- Remove `organization_id` from the Zod schema input type if it's no longer a form field
- Or make it a hidden constant passed at submission time

---

## Acceptance Criteria

- [ ] Chat settings are accessible from the sidebar in an obvious location (sub-item or footer link — confirm which)
- [ ] The "Add chat" dialog no longer shows the Organization selector; `organization_id` is taken from the current org automatically
- [ ] The "Add chat" dialog Topic ID field shows English placeholder `e.g. 336` and English help text `Leave empty to connect the entire chat`
- [ ] The Team selector in the "Add chat" dialog still works (can associate chat with a team within the current org)
- [ ] Delete confirmation controls appear in the card header row, not below the "Bot not yet in group" warning
- [ ] The card does not grow unexpectedly tall when delete is confirmed
- [ ] All existing Telegram chat CRUD operations (add, list, delete) continue to work
- [ ] No TypeScript errors, no ESLint errors
- [ ] Russian strings are absent from all JSX output

---

## Files to Change

| File | Change |
|---|---|
| `features/menu/lib/options.ts` | Add child item(s) under Telegram entry (or modify footer) |
| `features/menu/ui/sidebar-footer.tsx` | Possibly update settings gear href (option B) |
| `features/telegram/ui/telegram-chat-card.tsx` | Move confirm strip to header row |
| `features/telegram/ui/add-telegram-chat-modal.tsx` | Remove org field, fix Russian strings |
| `features/telegram/model/schemas.ts` | Remove `organization_id` from form schema (if no longer a field) |

---

## Questions to Clarify Before Starting

1. **What does "move chat settings from profile to sidebar" mean exactly?**
   - The Telegram chats page (`/dashboard/telegram`) already exists in the sidebar as "Telegram". Does the user want a sub-item "Chats" nested under it?
   - Or does the settings gear icon at the bottom of the sidebar need to link to Telegram settings instead of preferences?
   - Or is there a profile section that still shows chat settings that wasn't found in research?

2. **For the "Add chat" modal org removal:** should the Team selector remain (to associate chats with a specific team within the current org), or should both org and team selectors be removed?

---

## References

- `features/telegram/ui/add-telegram-chat-modal.tsx:119,124` — Russian strings
- `features/telegram/ui/telegram-chat-card.tsx:149-174` — confirm strip at bottom of card
- `features/telegram/ui/TelegramChatsManagement.tsx` — page container
- `app/dashboard/telegram/page.tsx` — server page, passes org data
- `features/menu/lib/options.ts` — sidebar items (add child to telegram entry here)
- `features/menu/model/types.ts` — `MenuProps` type with `children` support
- `shared/ui/input/tenant-scope-fields.tsx` — org+team cascade selector
- `app/dashboard/profile/telegram/page.tsx` — profile redirect (already points to `/dashboard/telegram`)