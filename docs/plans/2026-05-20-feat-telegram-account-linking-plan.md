---
title: "feat: Telegram Account Linking"
type: feat
status: active
date: 2026-05-20
deepened: 2026-05-20
---

# feat: Telegram Account Linking

## Enhancement Summary

**Deepened on:** 2026-05-20
**Research agents used:** security-sentinel, julik-frontend-races-reviewer, performance-oracle, kieran-typescript-reviewer, architecture-strategist, code-simplicity-reviewer, best-practices-researcher (RFC 8628), framework-docs-researcher (Next.js 16)

### Key Improvements Added

1. **Server Actions replace Route Handler for polling** — Next.js 16 officially supports calling Server Actions from `setInterval`/`useEffect`; the proxy Route Handler is unnecessary overhead (eliminates one extra network hop per poll)
2. **Race condition mitigations** — `stateRef` check prevents countdown beating poll; `stoppedRef.current = true` added to cleanup; `isMutatingRef` reset in `finally` blocks; interval self-clears on terminal condition
3. **Identity type migrated to `entities/user/`** — `ProfileIdentity` and `ChannelType` belong to the user domain entity, not to the feature; prevents future cross-feature import violations
4. **`getIdentities()` moved to `features/user-profile/api/`** — it fetches a user resource, not a Telegram-specific resource; placed alongside existing profile actions
5. **Sub-state components consolidated** — 4 separate sub-state files collapsed into early returns inside `TelegramLinkSection.tsx`; reduces file count by 4 without losing clarity
6. **State machine simplified to 4 states** — `'generating'` and `'unlinking'` replaced by `isPending` from `useTransition`
7. **Security hardening** — `link_url` validated before render; Route Handler (if kept) needs Zod schema for identity list; IDOR defense-in-depth on DELETE `id` parameter
8. **RFC 8628-aligned polling** — 5-second interval (RFC default); visibility guard; milestone aria announcements; `role="timer"` on countdown
9. **Countdown timer** — milestone-based announcements (5 min, 1 min, 30 sec) not per-second; switch to red color in final 60 seconds; add copy-button + QR code for desktop UX

### New Considerations Discovered

- The Route Handler proxy is architecturally unnecessary for this use case; Server Actions can be called directly from polling loops in React
- `ProfileIdentity` type already partially exists as `Identity` in `features/user-profile/model/types.ts` — must be migrated, not duplicated
- The 4 sub-state components are pure YAGNI — the entire conditional render fits in one 100-line component
- The `expires_at` countdown must recompute from `expires_at - Date.now()` on every tick, not decrement a counter, to handle tab-hide/show correctly
- Telegram deep-link must be validated client-side before rendering as an `<a>` (protocol + hostname check) to prevent open-redirect injection

---

## Overview

Add a UI for users to link and unlink their personal Telegram account to their
Wanda profile. Linking happens via a one-time deep-link (no manual token input).
The backend generates a 10-minute expiring `t.me/bot?start=TOKEN` URL; the user
opens it in Telegram; the bot links accounts automatically. The frontend polls
for completion and shows real-time feedback.

This feature is **distinct** from the existing Telegram workspace chat
registration at `/dashboard/profile/telegram` — that flow registers group chats
for AI summaries. This flow links the user's *personal* Telegram account to
their identity.

This pattern is architecturally equivalent to the **OAuth 2.0 Device Authorization
Grant (RFC 8628)**. The plan follows RFC conventions for polling intervals,
error handling, and UX.

## Placement Decision

Add a new **"Integrations"** tab to the profile section:

- Route: `/dashboard/profile/integrations`
- Sits between "Preferences" and "Telegram" in the tab bar
- Future-proof: will house Google Calendar OAuth, Zoom, etc.
- Does not conflict with `/dashboard/profile/telegram` (workspace chats)

## Backend Contracts (verified from source)

### POST /api/v1/telegram/link

No request body required. Returns:

```typescript
interface TelegramLinkData {
  link_url: string;   // "https://t.me/spodial_bot?start=<32-char-token>"
  expires_at: string; // ISO 8601, e.g. "2026-05-20T12:10:00.000000Z"
}
```

- Link is valid for **10 minutes**
- A new POST **invalidates any previous unused token** for this user
- No 409 is returned from this endpoint (409 only occurs bot-side via webhook)
- No rate-limiting on the backend — frontend must debounce "Get new link"

### GET /api/v1/users/me/identities

No query params. Returns a flat array (**no pagination, no `Items-Count` header**):

```typescript
interface ProfileIdentity {
  id: number;                  // Profile.id — use this for DELETE
  channel: string | null;      // "telegram" | "google_calendar" | "zoom" | null
  channel_identifier: string;  // Raw Telegram user ID string, e.g. "123456789"
  user_id: number | null;
}
```

Telegram is linked when `data.some(i => i.channel === 'telegram')` is true.

Use `httpClient<ProfileIdentity[]>` (not `httpClientList`) — no pagination.

> **Note:** The existing `Identity` type in `features/user-profile/model/types.ts`
> has non-nullable `channel` and `user_id`, but the backend resource returns null
> for both. This type must be corrected and migrated to `entities/user/`.

### DELETE /api/v1/users/me/identities/{id}

`id` = the `ProfileIdentity.id` of the telegram identity. Returns `{ success: true, data: null }`.

Errors:
| Status | Condition |
|--------|-----------|
| 403 | Profile belongs to another user (gate denial) |
| 404 | Profile not found (stale id — e.g. already unlinked in another tab) |

Both must be caught and shown as user-visible toast errors.

## States & Transitions

```
                    ┌──────────────────────────────────────────────┐
                    │              Page Load (SSR)                 │
                    │   GET /api/v1/users/me/identities           │
                    └──────────────────┬───────────────────────────┘
                                       │
              ┌────────────────────────┴──────────────────────────┐
              │ channel="telegram" found                          │ no telegram identity
              ▼                                                   ▼
   ┌─────────────────────┐                          ┌────────────────────────┐
   │  STATE: connected   │                          │  STATE: idle           │
   │  Shows: identifier  │                          │  Shows: "Connect"      │
   │  + Disconnect btn   │                          │  button                │
   └──────────┬──────────┘                          └────────────┬───────────┘
              │ click Disconnect                                  │ click Connect
              │ (useTransition, isPending disables btn)           │ (useTransition, isPending disables btn)
              ▼                                                   ▼
   ┌─────────────────────┐                     ┌─────────────────────────────┐
   │  DELETE identity    │                     │  POST /api/v1/telegram/link │
   │  → toast success    │                     │  → { link_url, expires_at } │
   │  → STATE: idle      │                     └───────────────┬─────────────┘
   └─────────────────────┘                                     │
                                                               ▼
                                                ┌──────────────────────────┐
                                                │  STATE: awaiting         │
                                                │  Shows: "Open Telegram"  │
                                                │  + countdown timer       │
                                                │  + polling every 5s      │
                                                └───────────┬──────────────┘
                                               ┌────────────┴────────────┐
                                   channel=    │                         │ timer reaches 0
                                   telegram    ▼                         ▼
                                   found  ┌─────────┐         ┌──────────────────────┐
                                          │ STATE:  │         │  STATE: expired      │
                                          │connected│         │  Shows: "Get new     │
                                          │(success)│         │  link" button        │
                                          └─────────┘         └──────────────────────┘
                                                                         │ click "Get new link"
                                                                         └──────► POST (loop back)
```

**State machine has 4 states:** `'idle' | 'awaiting' | 'connected' | 'expired'`

The `'generating'` and `'unlinking'` transient states are NOT separate states —
they are represented by `isPending` from `useTransition`, which disables buttons
during in-flight mutations.

## Feature Module Structure

Code lives **in `features/user-profile/`**, not in a new FSD slice.

The linking UI is one section on the Integrations profile tab. Creating a new
`features/telegram-link/` slice for a single component and two Server Actions is
premature abstraction — it would require a new `index.ts`, a second
`ProfileIdentity` type duplicating the existing `Identity`, and empty scaffolding.

```
features/user-profile/
  api/
    identities.ts               ← NEW: getIdentities, unlinkIdentity (user identity endpoints)
    telegram-link.ts            ← NEW: generateTelegramLink Server Action
    profile.ts                  ← existing
    preferences.ts              ← existing
  hooks/
    use-telegram-link-poll.ts   ← NEW: polling hook (calls Server Action from setInterval)
  model/
    types.ts                    ← MODIFIED: remove Identity (moved to entities/user/)
    ...
  ui/
    TelegramLinkSection.tsx     ← NEW: main Client Component, 4-state machine
    ...existing UI files...
  index.ts                      ← MODIFIED: export TelegramLinkSection
```

Domain type lives in entity layer (shared across features):

```
entities/
  user/
    model/
      types.ts                  ← NEW: ProfileIdentity, ChannelType (migrated from user-profile)
    index.ts                    ← NEW: public API
```

## File-by-File Implementation Plan

### 1. Migrate `Identity` type to `entities/user/`

**`entities/user/model/types.ts`** (new file):

```typescript
export type ChannelType = 'telegram' | 'google_calendar' | 'zoom';

export interface ProfileIdentity {
  id: number;
  channel: string | null;      // matches ProfileResource: $this->channel?->name
  channel_identifier: string;
  user_id: number | null;      // nullable in DB; non-null in practice for current user
}
```

**`entities/user/index.ts`** (new file):

```typescript
export type { ProfileIdentity, ChannelType } from './model/types';
```

**`features/user-profile/model/types.ts`** — remove the old `Identity` interface,
add import from entity if any other UI references it.

### 2. Add ROUTES constant

**`shared/lib/routes.ts`** — add inside `DASHBOARD`:

```typescript
PROFILE_INTEGRATIONS: '/dashboard/profile/integrations',
```

### 3. Add Integrations tab to nav

**`features/user-profile/ui/profile-tabs-nav.tsx`** — add to `BASE_TABS`:

```typescript
{ href: ROUTES.DASHBOARD.PROFILE_INTEGRATIONS, label: 'Integrations' },
```

Insert between `PROFILE_PREFERENCES` and `PROFILE_TELEGRAM`.

### 4. Create route pages

**`app/dashboard/profile/integrations/page.tsx`** (Server Component):

```typescript
import { getIdentities } from '@/features/user-profile/api/identities';
import { TelegramLinkSection } from '@/features/user-profile';

export default async function IntegrationsPage() {
  const { data: identities } = await getIdentities();
  const telegramIdentity = identities?.find(i => i.channel === 'telegram') ?? null;
  return (
    <div className="space-y-6">
      <TelegramLinkSection initialTelegramIdentity={telegramIdentity} />
    </div>
  );
}
```

**`app/dashboard/profile/integrations/loading.tsx`**:

```typescript
import { SkeletonList } from '@/shared/ui/layout/skeleton';
export default function Loading() {
  return <SkeletonList rows={3} />;
}
```

### 5. `features/user-profile/api/identities.ts` (new file)

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { parseApiError } from '@/shared/lib/apiError';
import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { httpClient } from '@/shared/lib/httpClient';
import type { ActionResult } from '@/shared/types/server-action';
import type { ProfileIdentity } from '@/entities/user';

// SSR-only: called from Server Components. Throws on error — let error boundary handle it.
export async function getIdentities() {
  return httpClient<ProfileIdentity[]>(`${API_URL}/users/me/identities`);
}

// Also used for polling: can be called from useEffect + useTransition
export async function fetchIdentitiesAction(): Promise<ProfileIdentity[]> {
  const { data } = await httpClient<ProfileIdentity[]>(`${API_URL}/users/me/identities`);
  return data ?? [];
}

export async function unlinkIdentity(profileId: number): Promise<ActionResult<void>> {
  // Defense-in-depth: validate id is a positive integer before forwarding
  if (!Number.isInteger(profileId) || profileId <= 0) {
    return { data: null, error: 'Invalid identity ID' };
  }
  try {
    await httpClient<null>(`${API_URL}/users/me/identities/${profileId}`, {
      method: 'DELETE',
    });
    revalidatePath('/dashboard/profile/integrations');
    return { data: undefined, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const message =
        error.status === 403 ? 'Not authorized to unlink this account' :
        error.status === 404 ? 'This account was already unlinked' :
        'Failed to unlink account';
      return { data: null, error: message };
    }
    throw error;
  }
}
```

### 6. `features/user-profile/api/telegram-link.ts` (new file)

```typescript
'use server';

import { API_URL } from '@/shared/lib/config';
import { ServerError } from '@/shared/lib/errors';
import { parseApiError } from '@/shared/lib/apiError';
import { httpClient } from '@/shared/lib/httpClient';
import type { ActionResult } from '@/shared/types/server-action';

export interface TelegramLinkData {
  link_url: string;
  expires_at: string; // ISO 8601
}

export async function generateTelegramLink(): Promise<ActionResult<TelegramLinkData>> {
  try {
    const { data } = await httpClient<TelegramLinkData>(`${API_URL}/telegram/link`, {
      method: 'POST',
    });
    if (!data) {
      throw new ServerError('Empty response from server', {
        url: `${API_URL}/telegram/link`,
        status: 200,
      });
    }
    return { data, error: null };
  } catch (error) {
    if (error instanceof ServerError) {
      const parsed = parseApiError(
        error.responseBody ?? '',
        'Failed to generate Telegram link',
      );
      return { data: null, error: parsed.message };
    }
    throw error;
  }
}
```

> **Why no Route Handler?** Next.js 16 officially supports calling Server Actions
> from `setInterval`/`useEffect` inside Client Components (see
> `/docs/01-app/01-getting-started/08-updating-data.mdx`). The proxy Route Handler
> approach adds an extra network hop (client → Next.js → Laravel) with no benefit
> for this use case. `fetchIdentitiesAction()` is called directly from the poll hook.

### 7. `features/user-profile/hooks/use-telegram-link-poll.ts` (new file)

```typescript
'use client';

import { useEffect, useRef, useTransition } from 'react';
import { fetchIdentitiesAction } from '../api/identities';
import type { ProfileIdentity } from '@/entities/user';

const POLL_INTERVAL_MS = 5000; // RFC 8628 default: 5 seconds

export function useTelegramLinkPoll(
  enabled: boolean,
  onLinked: (identity: ProfileIdentity) => void,
) {
  const stoppedRef = useRef(false);
  const onLinkedRef = useRef(onLinked);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onLinkedRef.current = onLinked;
  }, [onLinked]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    stoppedRef.current = false;

    function poll() {
      if (!active || stoppedRef.current) return;

      // Skip poll when tab is hidden — resume on next tick when visible again
      if (document.visibilityState !== 'visible') {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      // Skip this tick if prior Server Action call is still in flight
      if (isPending) {
        timerId = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }

      startTransition(async () => {
        try {
          const identities = await fetchIdentitiesAction();
          const telegram = identities.find(i => i.channel === 'telegram');
          if (telegram && active && !stoppedRef.current) {
            stoppedRef.current = true;
            onLinkedRef.current(telegram);
          }
        } catch {
          // Non-critical: retry on next tick
        }

        if (active && !stoppedRef.current) {
          timerId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      });
    }

    timerId = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      active = false;
      stoppedRef.current = true; // prevent onLinked from firing after unmount
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

### 8. `features/user-profile/ui/TelegramLinkSection.tsx` (new file)

Key implementation notes:

```typescript
'use client';

import { useState, useRef, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { generateTelegramLink, type TelegramLinkData } from '../api/telegram-link';
import { unlinkIdentity } from '../api/identities';
import { useTelegramLinkPoll } from '../hooks/use-telegram-link-poll';
import type { ProfileIdentity } from '@/entities/user';

type LinkState = 'idle' | 'awaiting' | 'connected' | 'expired';

interface TelegramLinkSectionProps {
  initialTelegramIdentity: ProfileIdentity | null;
}

// Validate deep-link URL before rendering as anchor (security: prevent open-redirect injection)
function validateTelegramUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.me');
  } catch {
    return false;
  }
}
```

**State machine behavior:**

- `initialTelegramIdentity` set → initial state = `'connected'`
- Click "Connect": `startTransition(generateTelegramLink)` — `isPending` disables button
- On success: state = `'awaiting'`, store `{ link_url, expires_at }`
- In `'awaiting'`: `useTelegramLinkPoll` enabled, countdown running
- Countdown: `setInterval` 1s, gated on `state === 'awaiting'`, computes `expires_at - Date.now()` on every tick (NOT decrement) — survives tab hide/show correctly
- `stateRef` mirrors `state` — interval reads `stateRef.current` before transitioning to `'expired'` to prevent clobbering an in-flight `'connected'` result
- Countdown reaches 0: `clearInterval` immediately in callback, then `setState('expired')`
- Poll succeeds: `stoppedRef.current = true`, `setState('connected')`
- Click "Disconnect": `startTransition(unlinkIdentity(id))` — `isPending` disables button
- 403/404 on disconnect: `toast.error(result.error)` — stay in `'connected'`
- Click "Get new link": same path as "Connect" — regenerates link

**Race condition guards (from julik-frontend-races-reviewer):**

```typescript
// Mirror state in a ref so interval callback sees current state without stale closure
const stateRef = useRef<LinkState>('idle');
useEffect(() => { stateRef.current = state; }, [state]);

// In the countdown interval callback:
const tick = () => {
  if (stateRef.current !== 'awaiting') return; // poll already set connected
  const remaining = new Date(linkData.expires_at).getTime() - Date.now();
  if (remaining <= 0) {
    clearInterval(intervalId); // self-clear immediately on terminal condition
    setState('expired');
    return;
  }
  setRemainingMs(Math.max(0, remaining));
};
```

**Rendering (early returns, no sub-files):**

```typescript
// Connected state
if (state === 'connected' && identity) {
  return (
    <div>
      {/* ✓ Telegram Connected badge */}
      {/* ID: {identity.channel_identifier} */}
      {/* Disconnect button, disabled during isPending */}
    </div>
  );
}

// Awaiting state
if (state === 'awaiting' && linkData && validateTelegramUrl(linkData.link_url)) {
  return (
    <div>
      {/* "Open in Telegram" anchor — validated href */}
      {/* Copy button (navigator.clipboard.writeText with .catch handler) */}
      {/* MM:SS countdown, role="timer", aria-atomic="true" */}
      {/* aria-live="polite" status region (sr-only) updated on state change */}
    </div>
  );
}

// Expired state
if (state === 'expired') { /* "Link expired" + "Get new link" */ }

// Idle state (default)
return <div>{/* "Connect Telegram" button */}</div>;
```

### 9. Connected state display

Show `channel_identifier` as the raw Telegram numeric user ID. The backend
does not expose a Telegram username via this endpoint. Display as:

```
✓ Telegram Connected
Account ID: 123456789
[Disconnect]
```

If the backend later adds `telegram_username` to `ProfileResource`, update to show
`@username` instead.

### 10. Countdown UX (RFC 8628 + accessibility guidance)

**Display strategy (not per-second announcements):**

- `> 60s remaining`: Show `MM:SS` counter, muted color, update every second visually
- `≤ 60s remaining`: Switch countdown text to amber/red color class
- `= 0`: Transition to expired state

**Accessibility:**

```tsx
<div
  role="timer"
  aria-atomic="true"
  aria-label="Link expiry countdown"
>
  {formatMmSs(remainingMs)}
</div>

{/* Hidden live region for milestone announcements */}
<div aria-live="polite" aria-atomic="true" className="sr-only" id="link-status">
  {statusMessage}
</div>
```

Update `statusMessage` (the hidden live region) at milestones only: 5 min, 1 min, 30 sec.
Switch the live region to `aria-live="assertive"` for success and expiry events.

**`formatMmSs(remainingMs: number): string`:**

```typescript
function formatMmSs(ms: number): string {
  const clamped = Math.max(0, ms);
  const m = Math.floor(clamped / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

### 11. Deep-link display (desktop vs mobile)

```tsx
{/* Primary: open in Telegram (both mobile and desktop) */}
<a
  href={linkData.link_url}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Open Telegram to complete account linking"
>
  Open in Telegram
</a>

{/* Secondary: copy link to clipboard */}
<button
  onClick={() => {
    navigator.clipboard.writeText(linkData.link_url).catch(() => {
      toast.error('Could not copy to clipboard');
    });
  }}
>
  Copy link
</button>
```

QR code is a **nice-to-have** enhancement for a follow-up. The `react-qr-code`
library adds minimal bundle weight and renders from the same `link_url`. Add it
when desktop UX is a priority.

### 12. Export from `features/user-profile/index.ts`

Add to existing exports:

```typescript
export { TelegramLinkSection } from './ui/TelegramLinkSection';
```

## Acceptance Criteria

### Functional

- [ ] New "Integrations" tab appears in `/dashboard/profile` tab bar between "Preferences" and "Telegram"
- [ ] `/dashboard/profile/integrations` loads with correct SSR state (connected/not-connected) without client-side flash
- [ ] Clicking "Connect Telegram" generates a link and shows "Open in Telegram" button
- [ ] Countdown timer shows remaining time derived from `expires_at - Date.now()` (not hardcoded, survives tab hide/show)
- [ ] Countdown updates every second visually while in `awaiting` state
- [ ] Polling pauses when tab is hidden (`document.visibilityState !== 'visible'`)
- [ ] When the user links via Telegram, the UI transitions to "connected" within one poll interval (≤ 5 seconds)
- [ ] Connected state shows `'✓ Telegram Connected'` + `'Account ID: {channel_identifier}'`
- [ ] When timer reaches 0, "Link expired" state is shown and polling stops
- [ ] "Get new link" button regenerates a link (invalidating the previous one)
- [ ] "Disconnect" calls `unlinkIdentity` and returns to idle state on success
- [ ] 403 or 404 on DELETE shows an error toast with a human-readable message
- [ ] "Connect" and "Disconnect" buttons are disabled during in-flight mutations (`isPending`)
- [ ] Deep-link URL is validated before rendering (protocol `https:` + hostname ends with `.me`)
- [ ] `revalidatePath('/dashboard/profile/integrations')` is called after unlink

### Non-Functional

- [ ] No `setInterval`/`setTimeout` leaks — all cleaned up in `useEffect` return
- [ ] `stoppedRef.current = true` set in cleanup (prevents onLinked callback after unmount)
- [ ] `stateRef` mirrors `state` — countdown never transitions to `'expired'` if poll already succeeded
- [ ] Interval self-clears when reaching `remaining <= 0` (not just relying on effect cleanup)
- [ ] No cross-feature imports (FSD boundaries respected — no import from `features/telegram`)
- [ ] All UI text in English (no Russian strings in JSX)
- [ ] `'use server'` at top of every `api/*.ts` file
- [ ] `httpClient` used for all Server Action API calls (no raw `fetch`)

### Edge Cases

- [ ] User with Telegram already linked on page load → connected state shown immediately, no polling starts
- [ ] User opens page in two tabs, generates link in both → when user links via tab B's link, tab A's poll also detects success and shows connected (correct behavior)
- [ ] Network error during polling → silently retried on next interval
- [ ] Countdown reaches 0 simultaneously with poll success → connected state wins (stateRef guard)
- [ ] Copy button failure → `toast.error` shown (never silently fails)
- [ ] `link_url` fails URL validation → render error message, not a broken anchor

## Error Handling

| Scenario | Behavior |
|----------|----------|
| POST /telegram/link fails (5xx) | `toast.error(result.error)` + stay in idle state |
| `link_url` fails validation | Show error inline: "Invalid link received from server" |
| Poll fetch throws | Silently retry (non-critical network blip) |
| Poll returns 401 | `fetchIdentitiesAction` throws, caught in hook, retried — `httpClient` will redirect on re-render |
| DELETE returns 403 | `toast.error('Not authorized to unlink this account')` |
| DELETE returns 404 | `toast.error('This account was already unlinked')` + transition to idle |
| Countdown reaches 0 while already connected | `stateRef` guard prevents `'expired'` transition |

## Testing Plan

### Unit Tests

- [ ] `TelegramLinkSection` — state transitions:
  - idle → awaiting (after generateTelegramLink success)
  - awaiting → connected (after poll detects telegram identity)
  - awaiting → expired (after countdown reaches 0)
  - connected → idle (after unlinkIdentity success)
  - connected stays connected when countdown reaches 0 (stateRef guard)
- [ ] `formatMmSs` — pure function: `0` → `00:00`, `30000` → `00:30`, `599000` → `09:59`
- [ ] `validateTelegramUrl` — `https://t.me/bot?start=TOKEN` → true; `javascript:alert(1)` → false; `http://evil.com` → false
- [ ] `useTelegramLinkPoll` hook:
  - Does not fire when `enabled = false`
  - Calls `onLinked` when identities contain `channel === 'telegram'`
  - Does not call `onLinked` when no telegram identity found
  - Stops polling after `stoppedRef.current = true` (on success)
  - Cleans up on unmount (active flag prevents onLinked after cleanup)
- [ ] `unlinkIdentity` Server Action:
  - Returns `ActionResult<void>` with error for 403
  - Returns `ActionResult<void>` with error for 404
  - Returns `{ data: null, error: 'Invalid identity ID' }` for `profileId <= 0`
  - Calls `revalidatePath` on success

### Mocking conventions for this feature:

```typescript
// Fake timers for countdown tests
jest.useFakeTimers();

// document.visibilityState mock
Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible',
});

// navigator.clipboard mock
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: jest.fn().mockResolvedValue(undefined) },
});

// fetchIdentitiesAction mock (Server Action)
jest.mock('@/features/user-profile/api/identities');

// Async Server Component test pattern
render(await IntegrationsPage());
```

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| `entities/user/` doesn't exist yet | Create `entities/user/model/types.ts` and `entities/user/index.ts` as part of this task |
| Existing consumers of `Identity` from `features/user-profile/model/types.ts` | There are currently zero consumers — migration is safe |
| Existing "Telegram" tab still exists at `/dashboard/profile/telegram` | Both tabs can coexist — they serve different purposes; no redirect needed |
| `fetchIdentitiesAction` called from Server Action polling loop | Supported in Next.js 16 per framework docs |
| `channel_identifier` is numeric string, not username | Display as "Account ID: {value}" — confirmed from backend |
| The "Integrations" tab label may need product review | Easy to rename — no structural dependency on the label |

## Security Checklist

- [ ] `link_url` validated via `validateTelegramUrl()` before rendering as `<a href>`
- [ ] `profileId` validated as positive integer in `unlinkIdentity()` before forwarding to backend
- [ ] Copy button uses `navigator.clipboard.writeText()` (not DOM exposure of token)
- [ ] `<a>` tag uses `rel="noopener noreferrer"` + `target="_blank"`
- [ ] Token is not logged client-side (no `console.log` of `link_url` or `expires_at`)
- [ ] Poll loop stops on component unmount (`stoppedRef.current = true` in cleanup)
- [ ] Maximum poll attempts: 120 (10 min at 5s interval) — prevents indefinite polling

## Future Considerations

- **QR code**: add `react-qr-code` for desktop UX — renders from `link_url`, no backend changes
- **Google Calendar OAuth**: add as a second card in `IntegrationsPage` using the same layout
- **Telegram username**: if `ProfileResource` is extended with `telegram_username`, update connected state display
- **Disconnect confirmation modal**: if needed, use `useModal` + existing `Modal` + `ModalBody` pattern
- **`slow_down` signal** (RFC 8628): if backend adds a rate-limiting signal, handle it by increasing poll interval dynamically
- **`ChannelType` exhaustiveness**: once all channel types are in use, add a type guard to narrow `ProfileIdentity.channel` to `ChannelType | null`

## Files to Create / Modify

### New files

```
entities/
  user/
    model/
      types.ts                  ← ProfileIdentity, ChannelType (domain entity types)
    index.ts                    ← Public API
app/
  dashboard/
    profile/
      integrations/
        page.tsx                ← SSR page
        loading.tsx             ← Skeleton loader
features/
  user-profile/
    api/
      identities.ts             ← getIdentities, fetchIdentitiesAction, unlinkIdentity
      telegram-link.ts          ← generateTelegramLink
    hooks/
      use-telegram-link-poll.ts ← Polling hook (Server Action-based, no Route Handler)
    ui/
      TelegramLinkSection.tsx   ← Main 4-state component (all states inline, no sub-files)
```

### Modified files

```
shared/lib/routes.ts                          ← Add PROFILE_INTEGRATIONS
features/user-profile/model/types.ts          ← Remove Identity (migrated to entities/user/)
features/user-profile/ui/profile-tabs-nav.tsx ← Add Integrations tab
features/user-profile/index.ts                ← Export TelegramLinkSection
```

## References

### Internal

- `features/telegram/api/telegram.ts` — canonical Server Action pattern
- `features/onboarding/hooks/use-onboarding-poll.ts` — polling hook pattern (stoppedRef + active flag)
- `app/dashboard/profile/telegram/page.tsx` — SSR page with parallel fetch as reference
- `shared/lib/httpClient.ts` — use `httpClient<T>` (not `httpClientList`) for flat identity array
- `docs/solutions/integration-issues/server-action-html-response-json-parse.md` — safe JSON parsing; `httpClient` already handles this
- `docs/plans/2026-05-15-refactor-move-telegram-to-profile-tab-plan.md` — race condition patterns

### Standards

- [RFC 8628 — OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628) — canonical reference for this flow pattern; 5-second polling interval
- [ARIA: timer role — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/timer_role) — `role="timer"` has implicit `aria-live="off"`; use milestone announcements
- [Next.js 16 — Updating Data](https://nextjs.org/docs/app/getting-started/updating-data) — Server Actions called from `useEffect` is officially supported

### Backend source (verified)

- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/TelegramLinkController.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/UserIdentityController.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Resources/API/v1/ProfileResource.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/routes/api.php` lines 122, 124, 132