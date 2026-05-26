---
title:
  'fix: Team Pending Invites — filter by status, expired badges, edge cases'
type: fix
status: completed
date: 2026-05-22
---

# fix: Team Pending Invites — filter by status, expired badges, edge cases

## Enhancement Summary

**Deepened on:** 2026-05-22  
**Research agents used:** TypeScript reviewer, race conditions reviewer,
security sentinel, code simplicity reviewer, performance oracle, architecture
strategist, pattern recognition specialist, best-practices researcher, unit test
booster

### Key Improvements Added by Research

1. **Filter belongs in `getTeamInvites` API layer**, not in `app/page.tsx` (FSD
   architectural rule)
2. **`router.refresh()` on error is wrong** — vetoed by both race conditions
   reviewer and performance oracle; `revalidatePath` in the Server Action is
   already sufficient; confirmed risk of `isPending` getting stuck in Next.js 16
3. **`new Date(null)` guard required** — `new Date(null)` evaluates to the Unix
   epoch, making null-expiry invites appear expired without a guard
4. **Backend IDOR found** — cross-team invite cancel possible (backend-only fix,
   documented for backend team)
5. **Unify two `new Date(expires_at)` calls** into a single `expiresDate`
   variable
6. **Remove Content-Type addition** — `getAuthHeaders()` already sets it; adding
   it is noise
7. **Naming**: use `isPastExpiry` not `isExpired` to distinguish client-computed
   temporal check from server-reported `status`
8. **`InviteStatusBadge`** — existing pattern in codebase; inline `<span>` is
   the anti-pattern
9. **Backend pagination** — `DEFAULT_LIMIT=10`; large invite history is not an
   issue; document `?status=pending` as future backend optimization
10. **Timezone** — confirmed Laravel serializes with `Z` suffix (UTC);
    `new Date(isoString)` comparison is safe

---

## Overview

The **Pending Invites** section in
`features/teams/ui/dashboard/team-dashboard-tab-people.tsx` shows invites that
have already been cancelled, accepted, or expired — because the backend `index`
endpoint returns all invites (all statuses) and the frontend never filters them.
The result is that users see "Pending" rows with an X button for invites that
are long gone.

Additionally, there are several UX edge cases: expired-but-still-pending invites
have no visual indicator, and the UI badge is hardcoded to "Pending" regardless
of the actual `invite.status`.

All findings are grounded in the backend code at
`/Users/slavapopov/Documents/WandaAsk_backend/`.

---

## Bug Analysis

### Bug 1 — CRITICAL: No `status === 'pending'` filter on the fetched invite list

**Location:** `app/dashboard/teams/page.tsx:85–86`

```ts
// BUG: invitesResult.value is TeamInvite[] with ALL statuses
const pendingInvites =
  invitesResult.status === 'fulfilled' ? invitesResult.value : [];
```

**Root cause:** The backend controller `TeamInviteController::index()` (line 61)
calls `$team->invites()` — the raw `HasMany` relationship with **no status
scope**. It returns all invites: `pending`, `accepted`, `cancelled`, `expired`.

```php
// backend: TeamInviteController.php line 61
$invites = $team->invites();           // ← no ->pending() scope
$invites = $invites->orderByDesc('created_at')->get();
```

The `Invite` model has a `scopePending` and `scopeValid` method that are unused
by the index action. The backend defaults to `DEFAULT_LIMIT=10` (from
`PaginatedRequestTrait`), so at most 10 invites are returned — but they include
all statuses in the last 10 records.

**Fix:** Move the filter into `getTeamInvites` (the API layer, not
`app/page.tsx`):

```ts
// features/teams/api/team.ts — inside getTeamInvites
export async function getTeamInvites(
  teamId: number | string,
): Promise<TeamInvite[]> {
  const { data } = await httpClientList<TeamInvite>(
    `${API_URL}/teams/${teamId}/invites`,
  );
  return (data ?? []).filter((inv) => inv.status === 'pending');
}
```

> **Why here, not `app/page.tsx`?** The project CLAUDE.md rule is explicit:
> `app/` handles routing only, no business logic. Filtering by status is a
> business rule ("show only actionable invites"), not routing logic. The FSD
> architectural boundary requires this logic to live in `features/teams/api/`.
> The function name `getTeamInvites` (in a manager context) already implies it
> returns the pending queue — this makes the contract explicit.

> **Future optimization:** If the backend adds `?status=pending` query param
> support to the controller (it has `scopePending` on the model ready), switch
> to: `${API_URL}/teams/${teamId}/invites?status=pending` and remove the
> client-side filter.

---

### Bug 2: Expired-but-status-pending invites shown without visual warning

**Location:**
`features/teams/ui/dashboard/team-dashboard-tab-people.tsx:426–458`
(`PendingInviteRow`)

The `expires_at` is shown as a label ("Expires May 23"), but if `expires_at` is
**in the past** the invite is effectively dead. The backend marks invites as
`expired` lazily (only on the `accept` redirect flow). So an invite can have
`status = 'pending'` in the DB while being past its expiry date — the frontend
must handle this client-side temporal gap.

**Fix:** Detect client-side expiry using a unified `expiresDate` variable
(avoids parsing the ISO string twice):

```ts
// Unify: parse once, use for both isExpired and label
const expiresDate =
  invite.expires_at !== null ? new Date(invite.expires_at) : null;
// null guard required: new Date(null) = Unix epoch (1970), causing false positives
const isPastExpiry = expiresDate !== null && expiresDate < new Date();
```

Then:

- Badge: red "Expired" when `isPastExpiry`, amber "Pending" otherwise
- Label: `"Expired May 23"` vs `"Expires May 23"` with matching color
- X button: stays active — cancelling expired-but-still-pending invites succeeds
  (`isPending()` on the backend checks `status === PENDING`, which is still
  true; only `INVITE_ALREADY_ACCEPTED` returns 409)

> **Naming:** Use `isPastExpiry` not `isExpired` to make clear this is a
> client-side temporal estimate, not a server-reported state. The server's
> `status === 'expired'` means the backend confirmed it; `isPastExpiry` means
> the expiry timestamp has passed locally.

> **Timezone safety:** Laravel serializes `datetime` cast fields via Carbon with
> a `Z` suffix (UTC). The controller docs confirm this:
> `"expires_at": "2026-02-17T10:00:00.000000Z"`. So
> `new Date(invite.expires_at)` parses correctly as UTC everywhere. The
> comparison is safe.

---

### Bug 3: Hardcoded "Pending" badge ignores `invite.status`

**Location:** `features/teams/ui/dashboard/team-dashboard-tab-people.tsx:444`

```tsx
<span className='text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 flex-shrink-0'>
  Pending
</span>
```

This raw `<span>` is the same anti-pattern eliminated by the April 2026
unified-status-badge refactor (which produced `IssueStatusBadge`,
`MeetingTaskStatusBadge`, `AgentRunStatusBadge`). The invite badge should follow
the same structure.

**Fix:** Replace with a `STATUS_BADGE` config map covering all four statuses
(for type-completeness and future resilience), with `isPastExpiry` as an
override:

```ts
const STATUS_BADGE: Record<
  TeamInvite['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-400' },
  accepted: {
    label: 'Accepted',
    className: 'bg-emerald-500/10 text-emerald-400',
  },
  expired: { label: 'Expired', className: 'bg-red-500/10 text-red-400' },
};

// In the component:
const badge = isPastExpiry
  ? STATUS_BADGE['expired'] // client-side override for stale-but-pending invites
  : STATUS_BADGE[invite.status];
```

> After Bug 1 fix, only `status === 'pending'` invites reach this component —
> but having the full map provides TypeScript completeness, documents all valid
> states, and makes the component resilient to future changes.

---

### Bug 4 (REMOVED from plan): `router.refresh()` on error — DO NOT ADD

The original plan proposed adding `router.refresh()` to the error branch of
`handleCancel`. **This is wrong and must not be implemented.** Reasons:

1. **Wrong semantics:** When a cancel fails (e.g. network error), the server
   state is unchanged. Calling `router.refresh()` re-runs all 6 parallel API
   fetches (`cache: 'no-store'`) for no reason — the list will be identical.
2. **`isPending` stuck bug:** There is a confirmed regression in Next.js 15/16
   where `revalidatePath` inside a Server Action + `useTransition` can cause
   `isPending` to never reset. The `cancelTeamInvite` Server Action already
   calls `revalidatePath('/dashboard/teams')` — adding `router.refresh()` on top
   amplifies this risk.
3. **UX confusion:** Calling `router.refresh()` after an error makes the list
   flash with no visible change, which looks like a success to the user.

The `revalidatePath('/dashboard/teams')` in `cancelTeamInvite` is the correct
mechanism for cache invalidation. `router.refresh()` should only be called on
**success**, and only if the revalidation hasn't already triggered a re-render
(which it typically does via the Next.js router cache).

The correct `handleCancel`:

```tsx
const handleCancel = () => {
  startTransition(async () => {
    const result = await cancelTeamInvite(teamId, invite.id);
    if (result.error) {
      toast.error(result.error);
      // No router.refresh() here — server state is unchanged, revalidatePath handles cache
    } else {
      toast.success('Invitation cancelled');
      router.refresh(); // Re-render to remove the cancelled row from the list
    }
  });
};
```

---

### Bug 5 (REMOVED from plan): `sendInvite` Content-Type header — DO NOT ADD

`getAuthHeaders()` at `shared/lib/getAuthToken.ts:16–17` already sets
`'Content-Type': 'application/json'` as a default on every request. Adding it
again to `sendInvite` is pure noise — future readers will wonder if
`getAuthHeaders()` does NOT set it, or if there's something special about this
call. Drop this change entirely.

---

### Bug 6 (edge case): Section hidden when `!isManager`, but invites are still fetched

**Location:** `app/dashboard/teams/page.tsx:64`

`getTeamInvites(resolvedTeamId)` runs unconditionally. The `isManager` flag is
derived from `dashboard?.viewer.id` + `team.members.find(...)` — but this
derivation is fragile (org-level managers not in `team.members` get
`isManager = false`). Fixing this properly requires the backend to expose
`viewer.is_manager` in `TeamDashboardData`.

**Decision:** Accept this limitation. The cost is one extra HTTP call per page
load for non-managers (bounded to 10 invites by `DEFAULT_LIMIT`). Tracking for
future backend sprint.

---

## Security Notes (Backend — not frontend fixes)

Discovered by security review, documented here for the backend team:

1. **Cross-team IDOR on DELETE** (Critical):
   `DELETE /teams/{team}/invites/{invite}` — Laravel resolves `{invite}`
   independently, no scope binding. An org member can cancel invite `{invite}`
   belonging to a different team by changing the ID in the URL. The backend
   `InvitePolicy::delete` only checks `isOrganizationMember(team.organization)`,
   not `invite.team_id === team.id`. **Fix:** Add
   `abort_unless($invite->team_id === $team->id, 403)` in
   `TeamInviteController::destroy()`.

2. **All org members can manage invites** (High): `InvitePolicy` uses
   `isOrganizationMember` instead of `isOrganizationManager`. Any employee can
   call the list/cancel endpoints directly. `User::isOrganizationManager()`
   exists at `app/Models/User.php:132` but is unused by the policy. **Fix:**
   Change policy methods to `isOrganizationManager`.

> These are backend-only fixes. The frontend `isManager` guard is purely
> cosmetic until the policy is tightened server-side.

---

## Files to Change

| File                                                        | Change                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `features/teams/api/team.ts`                                | Filter `status === 'pending'` inside `getTeamInvites` return                                |
| `features/teams/ui/dashboard/team-dashboard-tab-people.tsx` | `PendingInviteRow`: unified `expiresDate`, `isPastExpiry`, dynamic badge via `STATUS_BADGE` |
| ~~`app/dashboard/teams/page.tsx`~~                          | ~~Filter~~ — moved to API layer, no changes needed                                          |
| ~~`features/teams/api/team.ts` (sendInvite)~~               | ~~Content-Type header~~ — removed from plan                                                 |

---

## Acceptance Criteria

- [x] Cancelled, accepted, and expired invites are **never** shown in the
      Pending Invites section
- [x] Invites with `expires_at` in the past show red "Expired" badge, "Expired
      May 23" label
- [x] Invites with `expires_at` in the future show amber "Pending" badge,
      "Expires May 23" label
- [x] Invites with `expires_at: null` show amber "Pending" badge, no date label
- [x] The X (cancel) button remains active for past-expiry invites (cancel still
      works on backend)
- [x] `handleCancel` does NOT call `router.refresh()` on error
- [x] `handleCancel` calls `router.refresh()` on success
- [x] No TypeScript errors in strict mode (`npm run build` passes)
- [x] `new Date(null)` does NOT incorrectly mark null-expiry invites as expired

---

## Implementation Steps

### Step 1 — Move filter into `getTeamInvites` (Bug 1)

`features/teams/api/team.ts`, function `getTeamInvites` (currently line 211):

```ts
// Before
export async function getTeamInvites(
  teamId: number | string,
): Promise<TeamInvite[]> {
  const { data } = await httpClientList<TeamInvite>(
    `${API_URL}/teams/${teamId}/invites`,
  );
  return data ?? [];
}

// After
export async function getTeamInvites(
  teamId: number | string,
): Promise<TeamInvite[]> {
  const { data } = await httpClientList<TeamInvite>(
    `${API_URL}/teams/${teamId}/invites`,
  );
  return (data ?? []).filter((inv) => inv.status === 'pending');
}
```

No changes needed to `app/dashboard/teams/page.tsx` — `invitesResult.value` will
now already be filtered.

---

### Step 2 — Dynamic badge + expired indicator in `PendingInviteRow` (Bugs 2 & 3)

Replace `PendingInviteRow` in
`features/teams/ui/dashboard/team-dashboard-tab-people.tsx`:

```tsx
// ─── Status badge config ──────────────────────────────────────────────────────

const INVITE_STATUS_BADGE: Record<
  TeamInvite['status'],
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/10 text-red-400' },
  accepted: {
    label: 'Accepted',
    className: 'bg-emerald-500/10 text-emerald-400',
  },
  expired: { label: 'Expired', className: 'bg-red-500/10 text-red-400' },
};

// ─── Pending invite row ───────────────────────────────────────────────────────

interface PendingInviteRowProps {
  invite: TeamInvite;
  teamId: number;
}

function PendingInviteRow({ invite, teamId }: PendingInviteRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Unified parse: avoids calling new Date(invite.expires_at) twice
  const expiresDate =
    invite.expires_at !== null ? new Date(invite.expires_at) : null;
  // isPastExpiry: client-side temporal check for invites the backend hasn't marked expired yet.
  // new Date(null) would be epoch (1970) — the null guard here prevents that false positive.
  const isPastExpiry = expiresDate !== null && expiresDate < new Date();

  const badge = isPastExpiry
    ? INVITE_STATUS_BADGE['expired']
    : INVITE_STATUS_BADGE[invite.status];

  const expiresLabel = expiresDate
    ? expiresDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelTeamInvite(teamId, invite.id);

      if (result.error) {
        toast.error(result.error);
        // No router.refresh() here: server state is unchanged on error.
        // revalidatePath('/dashboard/teams') in the Server Action handles cache invalidation.
      } else {
        toast.success('Invitation cancelled');
        router.refresh();
      }
    });
  };

  return (
    <div className='flex items-center gap-3 p-3 rounded-[var(--radius-card)] border border-border bg-card/50'>
      <div className='flex-1 min-w-0'>
        <p className='text-sm text-foreground truncate'>{invite.email}</p>
        {expiresLabel && (
          <p
            className={`text-xs mt-0.5 ${isPastExpiry ? 'text-red-400' : 'text-muted-foreground'}`}
          >
            {isPastExpiry
              ? `Expired ${expiresLabel}`
              : `Expires ${expiresLabel}`}
          </p>
        )}
      </div>

      <span
        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}
      >
        {badge.label}
      </span>

      <ButtonIcon
        aria-label={`Cancel invite for ${invite.email}`}
        icon={<X className='size-4' />}
        variant='danger'
        size='sm'
        disabled={isPending}
        onClickAction={handleCancel}
        className='flex-shrink-0'
      />
    </div>
  );
}
```

---

## Research Insights

### FSD Architecture

**Best practice:** Business logic (status filtering) must live in `features/`,
not `app/`. Moving the filter into `getTeamInvites` is the correct FSD boundary.
`app/page.tsx` currently contains other domain logic (`isManager` derivation,
Telegram chat filtering) — these are pre-existing violations, not a license to
add more.

**Future refactor (Priority 3):** Extract `isManager` derivation from
`app/page.tsx` to a model helper in `features/teams/model/viewer-utils.ts`:

```ts
export function deriveIsManager(
  dashboard: TeamDashboardData | null,
  members: TeamMember[],
): boolean {
  const viewerId = dashboard?.viewer.id ?? null;
  if (!viewerId) return false;
  return members.find((m) => m.id === viewerId)?.role === 'manager' ?? false;
}
```

### `useTransition` + Server Actions in React 19

`startTransition(async () => { await serverAction() })` is the canonical React
19 pattern for non-form mutations (button clicks). This is correct as used in
`PendingInviteRow`.

**Known bug:** Next.js 15/16 has a confirmed regression where `revalidatePath`
inside a Server Action called via `useTransition` can cause `isPending` to stay
`true` indefinitely. Avoid adding `router.refresh()` to paths that don't need it
(error paths), as this compounds the risk.

**For form-based mutations** (not this case): prefer `useActionState` over
`useTransition`.

### Multi-row Cancel Race Condition

When multiple `PendingInviteRow` components cancel simultaneously, concurrent
`router.refresh()` calls can produce out-of-order resolutions, causing deleted
rows to briefly re-appear (ghost rows). To eliminate this, add an unmount guard:

```tsx
const cancelledRef = useRef(false);
useEffect(
  () => () => {
    cancelledRef.current = true;
  },
  [],
);

// In handleCancel success branch:
if (!cancelledRef.current) {
  router.refresh();
}
```

This is a polish item — the list rarely exceeds 5 pending invites, making
concurrent cancels unlikely. Include if the team wants belt-and-suspenders
reliability.

### Date Safety

- Laravel serializes `datetime` cast fields with `Z` (UTC) suffix:
  `"2026-02-17T10:00:00.000000Z"`
- `new Date(isoString)` correctly parses UTC timestamps on both server (Node.js)
  and client
- The app timezone `Europe/Moscow` only affects PHP's internal `now()`
  computation, not the serialized ISO string format
- The `null` guard (`invite.expires_at !== null`) is **required**:
  `new Date(null)` evaluates to the Unix epoch (January 1, 1970), which would
  make every null-expiry invite appear expired

### Performance Notes

- Each `router.refresh()` re-runs all 6 parallel fetches (`cache: 'no-store'` in
  `httpClient`). Calling it only on success (not error) is therefore both
  semantically correct and more efficient.
- `new Date()` computation per `PendingInviteRow` render: React Compiler
  (enabled in this project) memoizes stable expressions. No manual `useMemo`
  needed for the date comparison.
- The `DEFAULT_LIMIT=10` backend pagination means "all invite history" is
  bounded to 10 records — large history is not a current concern.

---

## Testing Approach

**`PendingInviteRow` test cases** (to be written after implementation):

| #    | Scenario             | Assertion                                                |
| ---- | -------------------- | -------------------------------------------------------- |
| TC-1 | Future `expires_at`  | Amber "Pending" badge, "Expires May 23" label            |
| TC-2 | Past `expires_at`    | Red "Expired" badge, "Expired May 23" label              |
| TC-3 | Null `expires_at`    | "Pending" badge, no date label shown                     |
| TC-4 | Cancel success       | `toast.success` + `router.refresh` called once           |
| TC-5 | Cancel error         | `toast.error` called, `router.refresh` NOT called        |
| TC-6 | Button during flight | Button disabled while `isPending` (never-resolving mock) |

**Mock setup:**

```ts
jest.mock('@/features/teams/api/team', () => ({
  cancelTeamInvite: jest.fn(),
  kickTeamMember: jest.fn(), // also imported by the file
}));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    refresh: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
}));
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));
```

**`getTeamInvites` filter** — extract a `filterPendingInvites` helper to
`features/teams/model/` and test directly: all-pending array, mixed statuses,
empty array, all-cancelled array. This is higher-value than testing through the
Server Action.

---

## Backend Contract Verification

Verified against backend source:

| Frontend type field                                           | Backend `InviteResource::toArray()`                    | Match? |
| ------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| `id: number`                                                  | `'id' => $this->id`                                    | ✓      |
| `email: string`                                               | `'email' => $this->email`                              | ✓      |
| `status: 'pending' \| 'accepted' \| 'cancelled' \| 'expired'` | `InviteStatus` enum cases                              | ✓      |
| `expires_at: string \| null`                                  | `'expires_at' => $this->expires_at` (Carbon → UTC ISO) | ✓      |
| `accepted_at: string \| null`                                 | `'accepted_at' => $this->accepted_at`                  | ✓      |
| `created_at: string`                                          | `'created_at' => $this->created_at`                    | ✓      |

---

## Risk Assessment

| Change                               | Risk                          | Notes                                                                             |
| ------------------------------------ | ----------------------------- | --------------------------------------------------------------------------------- |
| Filter in `getTeamInvites`           | Low                           | Pure client-side filter; no backend change; all callers pass through one function |
| `isPastExpiry` + dynamic badge       | Low                           | Additive UI change; null guard prevents false positives                           |
| Remove `router.refresh()` from error | Low (correctness improvement) | Aligns with `revalidatePath` convention                                           |
| Remove Content-Type change           | Zero                          | Was never needed                                                                  |

---

## References

- `features/teams/ui/dashboard/team-dashboard-tab-people.tsx` — Pending Invites
  UI
- `features/teams/api/team.ts` — `getTeamInvites`, `cancelTeamInvite`
- `app/dashboard/teams/page.tsx` — page data orchestration
- Backend: `app/Http/Controllers/API/v1/TeamInviteController.php:61` — no status
  scope on index
- Backend: `app/Enums/InviteStatus.php` — all valid statuses
- Backend: `app/Http/Resources/API/v1/InviteResource.php` — response shape (UTC
  ISO datetimes)
- Backend: `app/Models/Invite.php` — `isPending()`, `isExpired()`,
  `markAsCancelled()` helpers
- Backend: `app/Traits/PaginatedRequestTrait.php:7` — `DEFAULT_LIMIT = 10`
- Backend: `app/Domain/Errors/InviteAlreadyAcceptedError.php` — 409 error code
  on cancel
- Backend: `app/Policies/InvitePolicy.php` — over-permissive policy (backend fix
  needed)
- React 19: `startTransition(async)` is canonical for non-form Server Action
  mutations
- Next.js 16: `isPending` stuck bug with `revalidatePath` + `useTransition` —
  avoid redundant `router.refresh()`

## Backend Team Action Items

> The following require backend changes (out of scope for this frontend fix):

1. **IDOR fix** — `TeamInviteController::destroy`: add
   `abort_unless($invite->team_id === $team->id, 403)`
2. **Policy tighten** — `InvitePolicy`: change all three methods to
   `isOrganizationManager`
3. **API filter** — `TeamInviteController::index`: add `?status=pending` query
   param support
4. **Manager flag** — `TeamDashboardService`: expose `viewer.is_manager` in
   `TeamDashboardData`
