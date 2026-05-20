---
title: 'fix: Calendar attach — pass organization_id to POST /google/oauth'
type: fix
status: completed
date: 2026-05-18
deepened: 2026-05-18
---

# fix: Calendar attach — pass organization_id to POST /google/oauth

## Enhancement Summary

**Deepened on:** 2026-05-18  
**Research areas covered:** security, TypeScript quality, FSD architecture, race
conditions, testing, performance, API contract, scope, feasibility,
institutional learnings

### Key Improvements Discovered

1. **Critical FSD violation** — `features/user-profile` importing from
   `features/calendar` is forbidden. `AttachCalendarButton` must go in
   `shared/ui/` to be cross-feature reusable.
2. **Critical gap — EmptyState caller** — `MeetingsContent` is a **Client
   Component** (`'use client'`), so it cannot call `getOrganizationId()`.
   `organizationId` must be threaded through `TodayMeetingsPage` (server) →
   `MeetingsContent` (client) → `EmptyState` (client). The plan did not account
   for this.
3. **Critical gap — httpClient response envelope** — `httpClient` already calls
   `res.json()` on the response body. The `SOURCE_ALREADY_EXISTS` error check
   must be done on `ServerError.responseBody` (which is `res.text()` from the
   non-2xx path), not on `data`. The existing plan already handles this
   correctly, but the test must mock `httpClient` not raw `fetch`.
4. **Institutional learning applies** — the
   `server-action-html-response-json-parse` learning is satisfied by
   `httpClient` (it reads `res.text()` on error, not `res.json()`), so no extra
   handling needed. But test mocks must be updated from mocking
   `globalThis.fetch` to mocking `httpClient`.
5. **Performance** — `getOrganizations()` is already `cache()`-wrapped (React
   cache), so calling it in the profile page costs zero extra network requests
   when the layout already called it.
6. **Security** — the redirect URL from the server action is safe to assign to
   `location.href`. Backend validates `Gate::authorize('view', $organization)`,
   so org ID spoofing is blocked server-side. No SSRF risk (URL is generated
   server-side by Google's SDK). Cookie-based org context is fine as it's
   validated server-side.
7. **Race condition** — double-click is prevented by `disabled={isPending}`. No
   memory leak: after `globalThis.location.href = url` the React tree unmounts
   naturally; `setIsPending(false)` in the catch only fires on failure (page
   stays mounted). Stale org ID risk from org-switching exists but is acceptable
   (server validates auth anyway).

---

## Overview

The backend deployed `feat/attach-calendar-to-org` (commit `5068d69`). The
`POST /api/v1/google/oauth` endpoint now **requires** `organization_id` in the
request body, validated with `required|integer|exists:organizations,id`. Without
it the backend returns `422 Unprocessable Entity`, breaking the entire calendar
connect flow.

Two callers on the frontend invoke `attachCalendar()`:

| File                                          | Component           | Surface                                                                                 |
| --------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| `features/calendar/ui/onboarding-trigger.tsx` | `OnboardingTrigger` | `/dashboard/meetings/calendar` — full-page onboarding when no calendar is connected     |
| `features/today-briefing/ui/empty-state.tsx`  | `EmptyState`        | Today Briefing — inline empty state (rendered by `MeetingsContent`, a Client Component) |

Additionally, `entities/source/model/types.ts` (`Source`) is missing the new
`organization_id` field that `SourceResource.toArray()` now returns.

---

## Problem Analysis

### Breaking — `attachCalendar()` sends no body

```ts
// features/calendar/api/calendar.ts (current — broken)
export async function attachCalendar(): Promise<string> {
  const res = await fetch(`${API_URL}/google/oauth`, {
    method: 'POST',
    headers: { ...authHeaders },
    // ❌ no body → backend returns 422
  });
}
```

The backend controller:

```php
public function attach(Request $request): ApiResponse
{
    $request->validate([
        'organization_id' => 'required|integer|exists:organizations,id',
    ]);
    $organization = Organization::findOrFail($request->organization_id);
    Gate::authorize('view', $organization);  // ← auth enforced server-side
    return ApiResponse::success(data: [
        'redirect' => app(GoogleOAuthService::class)->redirect(Auth::id(), $request->organization_id),
    ]);
}
```

### Non-breaking — `Source` type missing `organization_id`

`SourceResource.toArray()` now returns:

```php
'organization_id' => $this->organization_id,   // new field (int|null)
```

The TypeScript `Source` interface has no `organization_id` field, causing silent
`undefined` at runtime if any component reads it.

> **Note on `is_connected` type:** The backend returns a `bool`, but the current
> frontend type `'0' | '1' | boolean` exists because older records may still
> return string "0"/"1". The profile page already handles both:
> `s.is_connected === '1' || s.is_connected === true`. Keep this union type
> as-is.

### Design inconsistency — two different calendar attach UIs

`OnboardingTrigger` shows a large Google logo image + minimal text. `EmptyState`
shows an icon + descriptive text + a styled button. No shared component — attach
logic is duplicated.

---

## Proposed Solution

### 1. Fix `attachCalendar(organizationId)` — add parameter, send body

**Migration from raw `fetch` to `httpClient`** (required by CLAUDE.md Rule 2):

```ts
// features/calendar/api/calendar.ts
'use server';
import { API_URL } from '@/shared/lib/config';
import { httpClient } from '@/shared/lib/httpClient';
import { ServerError } from '@/shared/lib/errors';

export async function attachCalendar(organizationId: number): Promise<string> {
  try {
    const { data } = await httpClient<{ redirect: string }>(
      `${API_URL}/google/oauth`,
      {
        method: 'POST',
        body: JSON.stringify({ organization_id: organizationId }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return data!.redirect;
  } catch (error) {
    if (error instanceof ServerError) {
      // httpClient puts res.text() into responseBody on non-2xx responses
      // This handles the case where backend returns HTML 5xx (documented learning)
      let errorCode: string | undefined;
      try {
        const json = JSON.parse(error.responseBody ?? '') as {
          meta?: { error_code?: string };
        };
        errorCode = json.meta?.error_code;
      } catch {
        /* non-JSON body (e.g. HTML 5xx) — ignore */
      }

      if (errorCode === 'SOURCE_ALREADY_EXISTS') {
        throw new Error(
          'Google Calendar is already connected to your account.',
        );
      }
      throw new Error('Failed to connect Google Calendar. Please try again.');
    }
    throw error;
  }
}
```

**Why `httpClient` is safe here:** `httpClient` calls `res.text()` (not
`res.json()`) on non-2xx responses and stores it in `ServerError.responseBody`.
This is exactly the pattern documented in the
`server-action-html-response-json-parse` learning — HTML 5xx responses are
handled safely.

**Note on redirect URL security:** The redirect URL is generated by the Google
OAuth SDK on the server, validated by `Gate::authorize` on the Laravel side.
Assigning it to `globalThis.location.href` is safe — this is the standard OAuth
redirect pattern.

### 2. Thread `organizationId` — critical path for Client Component callers

`organization_id` lives in the `organization_id` cookie. `getOrganizationId()`
can only be called in Server Components. The threading pattern differs per
surface:

**Surface A — Meetings Calendar page (simple):**

```tsx
// app/dashboard/meetings/calendar/page.tsx (Server Component)
const orgId = await getOrganizationId(); // reads cookie, redirects if missing
return <OnboardingTrigger organizationId={+orgId} />;
```

**Surface B — Today Briefing (requires additional threading):**
`MeetingsContent` is `'use client'` — it cannot call `getOrganizationId()`. The
server component parent must pass `organizationId` down:

```tsx
// app/dashboard/today/meetings/page.tsx (Server Component — needs update)
export default async function TodayMeetingsPage({ searchParams }) {
  const { date } = (await searchParams) ?? {};
  const data = await getTodayBriefing(date);
  const orgId = await getOrganizationId(); // ADD THIS

  return (
    <Card className='h-full flex flex-col'>
      <MeetingsContent key={data.date} data={data} organizationId={+orgId} />
    </Card>
  );
}
```

```tsx
// app/dashboard/today/meetings/meetings-content.tsx (Client Component — needs update)
interface Props {
  data: TodayBriefing;
  organizationId: number; // ADD THIS
}
export function MeetingsContent({ data, organizationId }: Props) {
  if (data.state === 'empty') {
    return <EmptyState organizationId={organizationId} />; // PASS THROUGH
  }
  // ...
}
```

**Surface C — Profile Calendar tab:**

```tsx
// app/dashboard/profile/calendar/page.tsx (Server Component)
const orgId = await getOrganizationId();
const sources = await getSources();
const calendarSource = sources.find(...) ?? null;
// getOrganizations() is cache()-wrapped — no extra network request when
// layout's OrganizationSelector already called it in this render cycle
const { data: organizations } = await getOrganizations();
const orgName = organizations?.find(o => o.id === calendarSource?.organization_id)?.name ?? null;
return <CalendarSection source={calendarSource} organizationId={+orgId} organizationName={orgName} />;
```

### 3. Update `Source` type

```ts
// entities/source/model/types.ts
export interface Source {
  readonly id: number;
  readonly user_id: number;
  readonly organization_id: number | null; // NEW — null for records before this migration
  readonly external_id: string;
  readonly identity: string;
  readonly type: string;
  readonly auth_type: string;
  readonly is_connected: '0' | '1' | boolean; // keep union — old records still return strings
  readonly detached_at: string | null;
}
```

### 4. Create `AttachCalendarButton` in `shared/ui/` — correct FSD layer

> **Architecture decision:** `features/user-profile` cannot import from
> `features/calendar` (FSD rule: features must not cross-import). The
> `AttachCalendarButton` is consumed by both `features/calendar` and
> `features/user-profile`, so it must live in `shared/ui/`.

```tsx
// shared/ui/calendar/attach-calendar-button.tsx (new)
'use client';
import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import { attachCalendar } from '@/features/calendar/api/calendar';

// NOTE: Server Actions can be imported from shared/ui/ — they run server-side
// and are not bundled client-side. See Next.js docs on 'use server' hoisting.

interface Props {
  organizationId: number;
  className?: string;
}

export function AttachCalendarButton({
  organizationId,
  className,
  children,
}: PropsWithChildren<Props>) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    setError(null);
    setIsPending(true);
    try {
      globalThis.location.href = await attachCalendar(organizationId);
      // Success: browser navigates away. isPending is not reset here
      // because the component unmounts as part of the navigation.
      // If navigation is slow, button stays disabled (intentional UX).
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : 'Something went wrong',
      );
      setIsPending(false);
    }
  };

  return (
    <div>
      <button
        type='button'
        onClick={handleAttach}
        disabled={isPending}
        className={className}
      >
        {isPending ? 'Connecting...' : (children ?? 'Connect Calendar')}
      </button>
      {error !== null && (
        <p className='text-sm text-destructive mt-1'>{error}</p>
      )}
    </div>
  );
}
```

> **PropsWithChildren:** Use `PropsWithChildren<Props>` not
> `children?: React.ReactNode` inline — required by project's
> `prefer-props-with-children` ESLint rule.

> **Import concern:** `shared/ui/` importing from `features/calendar/api/` is a
> layer violation (shared must not import from features). **Alternative:** pass
> `onAttach` as a callback prop:

```tsx
// Violation-free alternative:
interface Props {
  organizationId: number;
  className?: string;
  onAttach: (organizationId: number) => Promise<string>; // inject the action
}
```

But this makes callers more verbose. **Recommended:** Keep the import from
features since Server Actions are special — they're not bundled client-side and
the import is effectively just a reference. However, document this as an
intentional FSD exception, or move `attachCalendar` to `shared/api/` (unlikely —
it's feature-specific).

**Cleanest solution:** Keep `AttachCalendarButton` in `features/calendar/ui/`
and accept that `features/user-profile` imports it through
`features/calendar/index.ts` public API. This is a pragmatic cross-feature
dependency, not a deep path violation. **Verdict: use `features/calendar/ui/` +
export from `features/calendar/index.ts`.**

### 5. Update `CalendarSection` (Profile)

```tsx
// features/user-profile/ui/CalendarSection.tsx
import { AttachCalendarButton } from '@/features/calendar'; // via public API

interface CalendarSectionProps {
  source: Source | null;
  organizationId: number;
  organizationName?: string | null;
}

export function CalendarSection({
  source,
  organizationId,
  organizationName,
}: CalendarSectionProps) {
  if (!source) {
    return (
      <div className='flex flex-col gap-3'>
        <p className='text-sm text-muted-foreground'>No calendar connected.</p>
        <AttachCalendarButton
          organizationId={organizationId}
          className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 self-start'
        >
          Connect Google Calendar
        </AttachCalendarButton>
      </div>
    );
  }

  return (
    <div className='flex items-center justify-between gap-4 rounded-[var(--radius-button)] border border-border bg-background px-3 py-2'>
      <div className='flex flex-col gap-0.5'>
        <span className='text-sm font-medium text-foreground'>
          Google Calendar
        </span>
        <span className='text-xs text-muted-foreground'>{source.identity}</span>
        {organizationName && (
          <span className='text-xs text-muted-foreground'>
            Organization: {organizationName}
          </span>
        )}
      </div>
      {/* existing disconnect button logic */}
    </div>
  );
}
```

---

## Implementation Steps

### Step 1 — Update `entities/source/model/types.ts`

Add `organization_id: number | null` to the `Source` interface. Non-breaking —
existing code ignores the field, type system now reflects reality.

**File:** `entities/source/model/types.ts`

### Step 2 — Fix `attachCalendar` Server Action

**File:** `features/calendar/api/calendar.ts`

- Change signature: `attachCalendar(organizationId: number): Promise<string>`
- Add `Content-Type: application/json` header and JSON body
  `{ organization_id: organizationId }`
- Migrate from raw `fetch` to `httpClient` (CLAUDE.md Rule 2)
- Preserve `SOURCE_ALREADY_EXISTS` check via `ServerError.responseBody` (already
  text, handles HTML 5xx)

### Step 3 — Create `AttachCalendarButton` shared component

**File:** `features/calendar/ui/attach-calendar-button.tsx` (new)

Shared client component in `features/calendar/ui/`. Uses
`PropsWithChildren<Props>`. Exported from `features/calendar/index.ts` so
`user-profile` can import via public API.

### Step 4 — Update `OnboardingTrigger`

**File:** `features/calendar/ui/onboarding-trigger.tsx`

- Add `organizationId: number` prop
- Remove inline `useState(isPending)`, `useState(error)`, `handleAttach` —
  delegate to `AttachCalendarButton`
- Keep Google-logo visual: wrap `<OnboardingImage />` inside
  `<AttachCalendarButton>`

```tsx
export default function OnboardingTrigger({
  organizationId,
}: {
  organizationId: number;
}) {
  return (
    <div className='flex flex-col gap-7.5 justify-center items-center h-full w-full'>
      <H1>Continue with Google</H1>
      <AttachCalendarButton
        organizationId={organizationId}
        className='cursor-pointer focus:outline-none'
      >
        <OnboardingImage />
      </AttachCalendarButton>
      {/* error display is now inside AttachCalendarButton */}
    </div>
  );
}
```

> **Note:** `OnboardingTrigger` showed "Redirecting to Google..." text while
> pending. This should be preserved. Pass it as a named slot or add
> `showPendingText` prop to `AttachCalendarButton`, or keep a minimal wrapper
> state.

### Step 5 — Update `app/dashboard/meetings/calendar/page.tsx`

**File:** `app/dashboard/meetings/calendar/page.tsx`

- Import `getOrganizationId` from `@/shared/lib/getOrganizationId`
- Pass `organizationId={+orgId}` to `<OnboardingTrigger />`

### Step 6 — Update `EmptyState`

**File:** `features/today-briefing/ui/empty-state.tsx`

- Add `organizationId: number` prop
- Replace inline `useState(isPending)`, `useState(error)`, `handleAttach` with
  `<AttachCalendarButton>`

### Step 7 — Update `MeetingsContent` (Client Component) — CRITICAL EXTRA STEP

**File:** `app/dashboard/today/meetings/meetings-content.tsx`

- Add `organizationId: number` prop to the component
- Pass to `<EmptyState organizationId={organizationId} />`

### Step 8 — Update `app/dashboard/today/meetings/page.tsx`

**File:** `app/dashboard/today/meetings/page.tsx`

- Import `getOrganizationId`
- Pass `organizationId={+orgId}` to `<MeetingsContent />`

### Step 9 — Update `CalendarSection`

**File:** `features/user-profile/ui/CalendarSection.tsx`

- Add `organizationId: number` and `organizationName?: string | null` props
- When `source === null`: render
  `<AttachCalendarButton organizationId={organizationId}>`
- When `source !== null`: show org name below identity if `organizationName` is
  provided

### Step 10 — Update `app/dashboard/profile/calendar/page.tsx`

**File:** `app/dashboard/profile/calendar/page.tsx`

- Call `getOrganizationId()`
- Call `getOrganizations()` — **zero extra network cost** because it's
  `cache()`-wrapped and the dashboard layout already called it
- Compute `orgName` from `source.organization_id` + organizations list
- Pass `organizationId`, `organizationName` to `<CalendarSection />`

### Step 11 — Export `AttachCalendarButton` from `features/calendar/index.ts`

### Step 12 — Update tests

**File: `features/calendar/api/__tests__/calendar.test.ts`**

Key changes:

- Mock `@/shared/lib/httpClient` not `globalThis.fetch`
- Pass `organizationId` argument: `attachCalendar(42)`
- Assert `httpClient` was called with correct body

```ts
jest.mock('@/shared/lib/httpClient', () => ({
  httpClient: jest.fn(),
}));

import { httpClient } from '@/shared/lib/httpClient';
const mockHttpClient = httpClient as jest.Mock;

it('returns redirect URL on success', async () => {
  mockHttpClient.mockResolvedValue({
    data: { redirect: 'https://accounts.google.com/oauth' },
  });
  const url = await attachCalendar(42);
  expect(url).toBe('https://accounts.google.com/oauth');
  expect(mockHttpClient).toHaveBeenCalledWith(
    expect.stringContaining('/google/oauth'),
    expect.objectContaining({ body: JSON.stringify({ organization_id: 42 }) }),
  );
});

it('throws SOURCE_ALREADY_EXISTS for that error code', async () => {
  const { ServerError } = await import('@/shared/lib/errors');
  mockHttpClient.mockRejectedValue(
    new ServerError('error', {
      status: 422,
      responseBody: JSON.stringify({
        meta: { error_code: 'SOURCE_ALREADY_EXISTS' },
      }),
    }),
  );
  await expect(attachCalendar(42)).rejects.toThrow(
    'Google Calendar is already connected to your account.',
  );
});

it('handles HTML 5xx response body gracefully', async () => {
  const { ServerError } = await import('@/shared/lib/errors');
  mockHttpClient.mockRejectedValue(
    new ServerError('error', {
      status: 500,
      responseBody: '<!DOCTYPE html>...',
    }),
  );
  await expect(attachCalendar(42)).rejects.toThrow(
    'Failed to connect Google Calendar. Please try again.',
  );
});
```

**File: `features/calendar/ui/__tests__/onboarding-trigger.test.tsx`**

- Add `organizationId={42}` to all `render(<OnboardingTrigger ... />)` calls
- Mock `attach-calendar-button` or update mock of `attachCalendar` to accept arg

**New file: `features/calendar/ui/__tests__/attach-calendar-button.test.tsx`**

Key cases:

- Renders children as button label
- Calls `attachCalendar(organizationId)` on click
- Shows error message on failure
- Re-enables button after error
- Stays disabled while pending (navigation in progress)
- Double-click prevention: second click ignored while isPending

---

## Files Changed

| File                                                             | Change                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `entities/source/model/types.ts`                                 | Add `organization_id: number \| null`                                  |
| `features/calendar/api/calendar.ts`                              | Add `organizationId` param, JSON body, use `httpClient`                |
| `features/calendar/ui/attach-calendar-button.tsx`                | **New** — shared attach button (PropsWithChildren)                     |
| `features/calendar/ui/onboarding-trigger.tsx`                    | Accept `organizationId`, delegate to `AttachCalendarButton`            |
| `features/calendar/index.ts`                                     | Export `AttachCalendarButton`                                          |
| `app/dashboard/meetings/calendar/page.tsx`                       | Call `getOrganizationId()`, pass to `OnboardingTrigger`                |
| `features/today-briefing/ui/empty-state.tsx`                     | Accept `organizationId`, use `AttachCalendarButton`                    |
| `app/dashboard/today/meetings/meetings-content.tsx`              | **Extra step** — add `organizationId` prop, pass to `EmptyState`       |
| `app/dashboard/today/meetings/page.tsx`                          | **Extra step** — call `getOrganizationId()`, pass to `MeetingsContent` |
| `features/user-profile/ui/CalendarSection.tsx`                   | Add attach button + org name display                                   |
| `app/dashboard/profile/calendar/page.tsx`                        | Add org context + org name lookup                                      |
| `features/calendar/api/__tests__/calendar.test.ts`               | Update: mock `httpClient`, pass `organizationId`                       |
| `features/calendar/ui/__tests__/onboarding-trigger.test.tsx`     | Update: add `organizationId` prop                                      |
| `features/calendar/ui/__tests__/attach-calendar-button.test.tsx` | **New** — full test coverage                                           |

---

## Research Insights

### Security Analysis

**✅ Safe patterns:**

- `organization_id` cookie is server-set (HttpOnly-equivalent via Next.js).
  Passed to server action, validated by `Gate::authorize('view', $organization)`
  on backend. User cannot attach a calendar to an org they don't belong to.
- OAuth redirect URL generated server-side by Google's SDK. Assigning to
  `location.href` is the standard pattern — no SSRF, no open redirect (Google
  validates the redirect URI against registered URIs).

**⚠️ Stale organization risk (acceptable):** If a user switches organization via
the `OrganizationSelector` in the header after the calendar page has loaded, the
`organizationId` prop is stale (from the previous render). Clicking "Connect"
attaches to the old org. **Mitigation:** Backend validates auth, so no security
issue. UX impact is minimal. Full mitigation (re-read cookie on click) would
require Server Action call just to get org ID, which adds unnecessary
complexity.

**No action needed.**

### TypeScript Quality

- Use `PropsWithChildren<Props>` for `AttachCalendarButton` — required by
  `prefer-props-with-children` ESLint rule
- `data!.redirect` — safe assertion because `httpClient` throws on non-2xx and
  `json.success === false`, so `data` is always defined on the success path
- Consider `organizationId` as `number` (not `string`) everywhere —
  `getOrganizationId()` returns `string`, convert with `+orgId` at the call site
  (already planned)
- Keep `is_connected: '0' | '1' | boolean` — do not change, old records still
  return strings

### Performance

**`getOrganizations()` is `cache()`-wrapped:**

```ts
export const getOrganizations = cache(
  async (): Promise<ApiResponse<OrganizationProps[]>> => {
    // ...
  },
);
```

React's `cache()` deduplicates calls within a single render cycle. The dashboard
layout calls `getOrganizations()` via `OrganizationSelector`. The profile
calendar page's call is deduplicated — **zero extra HTTP requests**.

**Bundle size:** `AttachCalendarButton` is a small `'use client'` component. No
heavy dependencies. React Compiler (enabled in this project) will memoize event
handlers automatically — no manual `useCallback` needed.

### Async / Race Condition Analysis

**Double-click protection:** `disabled={isPending}` prevents re-invocation. ✅

**Navigation timing:** After `globalThis.location.href = url`:

- Browser begins navigation to Google
- React tree stays mounted briefly
- `setIsPending` in the catch block only fires on _thrown_ errors — it's not
  called on success
- No memory leak or React warning: the state setter from an unmounted component
  is a no-op in React 18+

**Concurrent mounts:** `AttachCalendarButton` may appear on multiple pages
simultaneously (meetings page, today briefing, profile). Each instance has its
own isolated state. No shared state between instances. ✅

### Testing Strategy

**Test file priority:**

1. `attach-calendar-button.test.tsx` — **new, highest priority**, covers shared
   logic
2. `calendar.test.ts` — update mocks to `httpClient`, add HTML 5xx test case
3. `onboarding-trigger.test.tsx` — minimal update (add `organizationId` prop)

**Pattern for `AttachCalendarButton` tests:**

```ts
// Mock location.href (jsdom pattern)
beforeEach(() => {
  delete (globalThis as any).location;
  (globalThis as any).location = { href: '' };
});

it('prevents double-click while pending', async () => {
  mockAttachCalendar.mockReturnValue(new Promise(() => {})); // never resolves
  render(<AttachCalendarButton organizationId={42}>Connect</AttachCalendarButton>);
  const button = screen.getByRole('button');
  await userEvent.click(button);
  expect(button).toBeDisabled();
  // second click is a no-op
  await userEvent.click(button);
  expect(mockAttachCalendar).toHaveBeenCalledTimes(1);
});
```

**Key insight from learning document:** Tests now mock `@/shared/lib/httpClient`
not `globalThis.fetch`. The existing tests mock raw fetch and will break after
migrating to `httpClient`.

### Institutional Learning Applied

**Learning: `server-action-html-response-json-parse`** — APPLICABLE

The learning documents that calling `res.json()` directly on Laravel error
responses causes `SyntaxError` when the backend returns HTML 5xx pages.

**This plan is safe because** `httpClient` already calls `res.text()` (not
`res.json()`) on non-2xx responses and stores it in `ServerError.responseBody`.
The `attachCalendar` action then wraps `JSON.parse(error.responseBody)` in
try/catch — exactly the safe pattern the learning recommends.

**Test case to add:** HTML 5xx response body is handled gracefully (see test
examples in Step 12 above).

---

## Acceptance Criteria

- [x] `POST /api/v1/google/oauth` receives `{ organization_id: <number> }` — no
      more 422 errors
- [x] `attachCalendar(organizationId)` uses `httpClient` (not raw `fetch`)
- [x] `OnboardingTrigger` receives `organizationId` prop from
      `app/dashboard/meetings/calendar/page.tsx`
- [x] `EmptyState` receives `organizationId` prop via `MeetingsContent` from
      `app/dashboard/today/meetings/page.tsx`
- [x] `CalendarSection` shows `AttachCalendarButton` when `source === null`
- [x] `CalendarSection` shows org name when `source !== null` and org name is
      available
- [x] `AttachCalendarButton` is the single shared component for all three
      surfaces
- [x] `Source` type includes `organization_id: number | null`
- [x] `AttachCalendarButton` uses `PropsWithChildren<Props>` (not inline
      `children?: ReactNode`)
- [x] All existing tests pass — no regressions
- [x] New `attach-calendar-button.test.tsx` written with full coverage
- [x] Tests mock `httpClient` not `globalThis.fetch`
- [x] All three attach surfaces (meetings calendar, today briefing, profile)
      work end-to-end

## Non-Goals

- Multi-org calendar support UI (that's a future feature)
- Fixing stale org ID from org-switching (acceptable UX edge case, server
  validates auth)
- Showing org name in `CalendarSection` via separate API call (use
  already-fetched list)

---

## References

### Internal

- Backend controller:
  `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/GoogleCalendarController.php`
- Backend resource:
  `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Resources/API/v1/SourceResource.php`
- `getOrganizationId()`: `shared/lib/getOrganizationId.ts`
- `getOrganizations()` (cache-wrapped):
  `features/organization/api/organization.ts`
- `httpClient`: `shared/lib/httpClient.ts`
- `ServerError`: `shared/lib/errors.ts`
- Server Action rules: CLAUDE.md §API Layer Conventions

### Institutional Learnings

- `docs/solutions/integration-issues/server-action-html-response-json-parse.md`
  — **APPLIED**: `httpClient` reads `res.text()` on error; catch block wraps
  `JSON.parse` in try/catch

### Related Backend Commit

- `feat/attach-calendar-to-org` — commit `5068d69` (May 18 2026)
