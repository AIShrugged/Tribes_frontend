---
title: 'fix: Calendar Feature — Bug Audit & Gap Analysis (Personal + Org)'
type: fix
status: active
date: 2026-05-21
deepened: 2026-05-21
---

# fix: Calendar Feature — Bug Audit & Gap Analysis (Personal + Org)

## Enhancement Summary

**Deepened on:** 2026-05-21 **Research agents used:**
kieran-typescript-reviewer, performance-oracle, security-sentinel,
architecture-strategist, code-simplicity-reviewer, best-practices-researcher,
julik-frontend-races-reviewer (7 agents)

### Key Improvements Added

1. **Bug count corrected** — BUG-02 is already fixed in the codebase
   (`parseEventDate` exists and handles ISO 8601); BUG-03 is less critical than
   stated (redirect stub still works); BUG-07 is backend-contract question, not
   an actionable frontend fix
2. **New bugs discovered** — `CalendarAttachedToast` double-fire race in
   StrictMode; `OrgCalendarView` O(n²) `events.find` in renderEvent;
   `CalendarCells` widget is dead code; `not-found.tsx` links to stale route
3. **FSD violation discovered** — `OrgCalendarView` in `features/meetings/`
   directly imports `features/calendar/` and `features/event/` (cross-feature
   imports); it should move to `widgets/`
4. **Security systemic gap** — No `middleware.ts` for dashboard routes; auth
   enforcement is opt-in, not declarative
5. **Performance patterns** — `unstable_cache` for per-day fetches; debounce
   month navigation; `useTransition` + `isPending` for skeleton feedback;
   `Promise.allSettled` for org pagination
6. **Race conditions** — Month navigation is safe in SSR but backend load spike
   is real; `CalendarAttachedToast` needs a `useRef` fire-once guard;
   `DayDetailPanel` must clear `?day=` on month switch

### New Considerations Discovered

- `httpClient` wrapping `redirect()` requires re-throwing non-`ServerError` to
  let Next.js `NEXT_REDIRECT` propagate
- `CalendarCells` widget (`widgets/calendar-view/ui/CalendarCells.tsx`) is
  exported but never imported — delete it
- `getEvent`, `getEvents`, `getCalendarEvents`, `getMeetingTasks` in
  `calendar-events.ts` also use raw `fetch` (plan only listed `source.ts`)
- `ApiResponse<T>` in `shared/types/common.ts` uses wrong field name (`error` vs
  `message` per CLAUDE.md envelope)
- Modal animation `duration: 0.2` (200ms) is 4x too long — creates perceived
  jank
- `next.config.ts` has `staleTimes.dynamic: 0` — increasing to 30s eliminates
  re-fetches on back-navigation

---

## Overview

Comprehensive audit of the Personal Calendar (`/dashboard/meetings/calendar`)
and Organization Calendar (`/dashboard/meetings/organization`) pages. Research
revealed **8 confirmed bugs** (2 of which are partially addressed or need
reclassification), **9 missing flows/gaps**, and **3 unanswered architectural
questions** that block correct behavior. This plan documents all findings and
provides a prioritized remediation roadmap.

---

## 1. Ответы на поставленные вопросы

### 1.1. Может ли пользователь видеть пересечения встреч и общую загрузку?

**Ответ: Нет.** Пересечения и загрузка не реализованы нигде в кодовой базе.

- Поиск по `overlap`, `intersection`, `conflict`, `busy`, `collision` по всем
  calendar-файлам вернул 0 совпадений.
- В `cells.tsx` события одного дня просто складываются в CSS flex-колонку:
  одновременные встречи визуально неотличимы от последовательных.
- Бэкенд тоже не имеет серверной детекции пересечений времени для
  `calendar-events`. Единственное `IssueConflictDetector` — это детектор
  конфликтов решений (issue), не временных слотов встреч.
- **Статус**: не реализовано — только клиентская реализация возможна (week/day
  view требует колонок-алгоритм; month view — density badges).

### 1.2. Агрегация событий / отображение пересечений / фильтр по командам/участникам

#### Агрегация из подключённых календарей

**Частично реализована бэкендом, не реализована фронтом.**

- Бэкенд: `CalendarEventSyncService` синхронизирует события из Google Calendar
  через модель `Source` (один Google-аккаунт на пользователя). Ключ дедупликации
  — `(url, starts_at)`. Все события подключённого Google Calendar доступны через
  `GET /calendar-events`.
- Фронт: источники не сегментированы — все события из всех источников смешаны в
  единый `EventProps[]`. Нет UI, который показывал бы «из какого календаря» то
  или иное событие. Поле `Source.type` подразумевает будущую мультипровайдерную
  поддержку (есть тип `microsoft_outlook`), но OAuth для неё не реализован.
- **Вывод**: агрегация работает автоматически на уровне бэкенда, но пользователь
  не видит из какого источника пришло событие и не может управлять несколькими
  источниками.

#### Отображение пересечений

**Не реализовано.** See §1.1. Для month view — достаточно density badge (цвет
ячейки по количеству событий). Для week/day view нужен column-split алгоритм
(см. §8.3).

#### Фильтр по командам/участникам

**Реализован только на вкладке Meetings List, отсутствует в обеих вкладках
Calendar.**

- `GET /calendar-events` поддерживает: `scope`, `team_id`, `user_id`,
  `participant_id` — бэкенд готов.
- `MeetingsListFiltersBar` (scope + org + team + participant) работает только
  для `/dashboard/meetings/list`.
- Ни Personal Calendar, ни Org Calendar не имеют никакого Filter UI.
- `GET /calendar-events/organization` поддерживает только `date_from`/`date_to`
  — `team_id` и `user_id` на уровне бэкенда **не поддерживаются** для
  орг-календаря (это ограничение бэкенда, не только фронта).

### 1.3. Аналитика багов и edge-cases

Подробно разобрано в §2 и §3 ниже.

---

## 2. Confirmed Bugs (reclassified after deep research)

### 🔴 BUG-01 — EventPopupAll renders empty list (CRITICAL)

**Impact:** All users on both calendars. Any day with >3 events shows a broken
modal.

**Location:** `features/event/ui/event-popup-all.tsx:35–37`

```tsx
// Current — broken:
{
  list.map((event) => {
    return <div key={event.id} />; // ← renders nothing
  });
}
```

The `map` renders a bare `<div />` for every event. The modal opens and shows
only the date header and a column of invisible divs.

**Note from TypeScript review:** The existing test in this file
(`container.querySelectorAll('.p-4 > div')`) asserts on the broken empty div
count — it is codifying broken behavior. The test must also be updated.

**Secondary issue (line 22):** `getWeekdayAndDay(list[0].starts_at)` is called
unconditionally — add an empty-array guard.

**Fix approach (FSD-compliant):** Per architecture review, `EventPopupAll`
should accept a `renderItem?: (event: EventProps) => ReactNode` callback prop
following the same dependency-injection pattern already used in
`Cells`/`Calendar`. This avoids cross-feature imports:

- `CalendarPage` (widget) injects `(event) => <CalendarEvent event={event} />`
- `OrgCalendarView` injects org-specific renderer

The component itself stays in `features/event/` as a pure layout shell.

**Fix needed:**

- Add `renderItem?: (event: EventProps) => ReactNode` prop to `EventPopupAll`
- Default to a minimal title+time row if not provided
- Add null guard: `if (!list.length) return null;`
- Update the test to assert on visible content, not empty div count

---

### 🔴 BUG-02 — getWeekdayAndDay date parser (PARTIALLY ADDRESSED)

**Status update after research:** `shared/lib/dateFormatter.ts::parseEventDate`
already handles both formats (`yyyy-MM-dd HH:mm:ss` + ISO 8601 fallback).
Whether `getWeekdayAndDay` is broken depends on the actual runtime format.
Before implementing a fix, **verify what format `starts_at` actually returns at
runtime** (see Open Question #1).

**If ISO 8601 confirmed:**

**Location:** `features/event/lib/get-weekday-and-day.ts`

```ts
// Current:
const date = parse(dateString, 'yyyy-MM-dd HH:mm:ss', new Date());

// Fix:
import { parseEventDate } from '@/shared/lib/dateFormatter';
const date = parseEventDate(dateString);
```

**Timezone note:** `parseEventDate` falls back to `new Date(dateString)` which
parses ISO 8601 as UTC. In a Server Component (UTC runtime), this displays the
UTC day — correct for the server. Add this to tests:

```ts
it('handles ISO 8601 input', () => {
  const result = getWeekdayAndDay('2026-03-11T09:00:00.000000Z');
  expect(result.weekday).toBe('Mon');
  expect(result.day).toBe('11');
});
```

---

### 🟠 BUG-03 — detachCalendar and switchBot revalidate a stale route (MEDIUM)

**Impact:** After calendar detach or bot toggle, calendar page shows stale data
until hard refresh.

**Locations:**

- `features/calendar/api/source.ts:56,85` —
  `revalidatePath(ROUTES.DASHBOARD.CALENDAR, 'layout')` and
  `redirect(ROUTES.DASHBOARD.CALENDAR)`
- `features/event/api/calendar-events.ts:177` —
  `revalidatePath(ROUTES.DASHBOARD.CALENDAR)`
- **Missed in original plan:** `app/not-found.tsx:23` also links to
  `ROUTES.DASHBOARD.CALENDAR` (user-facing link to a redirect stub)

`ROUTES.DASHBOARD.CALENDAR = '/dashboard/calendar'` is a redirect stub. The
actual calendar lives at `ROUTES.DASHBOARD.MEETINGS_CALENDAR`. The
`revalidatePath('/dashboard/calendar', 'layout')` does NOT revalidate the actual
page.

**Revalidation scope fix:** After `detachCalendar`, invalidate both
`MEETINGS_CALENDAR` and `PROFILE_CALENDAR` — not just the stub.

**Fix needed:** Replace `ROUTES.DASHBOARD.CALENDAR` →
`ROUTES.DASHBOARD.MEETINGS_CALENDAR` in all four locations. Update
`detachCalendar` to revalidate both calendar and profile paths.

---

### 🟠 BUG-04 — Raw fetch in source.ts AND calendar-events.ts (MEDIUM)

**Impact:** Auth failures on `getSources` silently return empty arrays; 401
bypass; no request logging.

**Scope is wider than originally stated:**

- `features/calendar/api/source.ts:20–21, 43–44, 72–73` — `getSources`,
  `detachCalendar`, `detachCalendarFromProfile`
- `features/event/api/calendar-events.ts` — `getEvent`, `getEvents`,
  `getCalendarEvents`, `getMeetingTasks` also use raw `fetch` (note: `switchBot`
  already uses `httpClient`)

**Critical pattern for redirect functions:**

```ts
// ⚠️ REQUIRED pattern when httpClient wraps a function that calls redirect():
export async function detachCalendar(sourceId: number): Promise<ActionResult> {
  try {
    await httpClient(`${API_URL}/sources/${sourceId}`, { method: 'DELETE' });
    revalidatePath(ROUTES.DASHBOARD.MEETINGS_CALENDAR, 'layout');
    revalidatePath(ROUTES.DASHBOARD.PROFILE_CALENDAR, 'layout');
    redirect(ROUTES.DASHBOARD.MEETINGS_CALENDAR); // throws NEXT_REDIRECT internally
  } catch (error) {
    if (error instanceof ServerError) {
      return { data: null, error: 'Failed to disconnect Google Calendar.' };
    }
    throw error; // ← MANDATORY: re-throw NEXT_REDIRECT and unexpected errors
  }
}
```

**Without the `throw error` line, `redirect()` silently fails.**

---

### 🟠 BUG-05 — DayButton and DayDetailPanel never wired (MEDIUM — dead code)

**Impact:** Click-a-day-to-see-events UX is completely absent.

**Location:** `features/calendar/ui/day-button.tsx`,
`features/calendar/ui/day-detail-panel.tsx`

Both components are fully implemented and tested. Neither is imported anywhere
outside its own file. `DayButton` writes `?day=` search param; `DayDetailPanel`
reads `selectedDay` prop to filter events.

**FSD-compliant wiring plan:**

1. In `cells.tsx`: replace `<Day currentDay={day} />` with
   `<DayButton currentDay={day} dateKey={dateKey} isSelected={selectedDay === dateKey} />`
2. `Calendar` component (currently Server Component) needs to become a Client
   Component wrapper, or create a new client wrapper that reads
   `useSearchParams` for `?day=` and renders `DayDetailPanel` as a sibling to
   `Cells`
3. **Month switch must clear `?day=`** — update `MonthSwitcher.setMonth` to call
   `next.delete('day')` before `router.push`. Without this, navigating to
   another month leaves a stale `?day=` param that shows zero events in
   `DayDetailPanel`

---

### 🔴 BUG-06 — Org calendar missing onboarding gate and empty state (HIGH)

**Impact:** Users without connected calendar see empty org grid with no
guidance; unhandled `ServerError` can crash to dashboard error boundary.

**Location:** `app/dashboard/meetings/organization/page.tsx`

The personal calendar checks `isCalendarAttached` and renders
`OnboardingTrigger`. The org calendar has no such check. Additionally, a
malformed `?month=` param flows through `startOfMonth()` without validation,
producing an "Invalid Date" string sent to the backend.

**Fix needed:**

- Add `getSources` check + `OnboardingTrigger` fallback (mirror the personal
  calendar page)
- Add `?month=` validation: `/^\d{4}-\d{2}-\d{2}$/.test(params.month)` with
  redirect to current month on failure (same guard already in
  `meetings/list/page.tsx:71`)
- Wrap the fetch loop in try/catch to render a section-level error instead of
  crashing to dashboard boundary
- Add an empty-state component for the case where org has zero bot meetings

---

### 🟡 BUG-07 — Timezone mismatch in date params (MEDIUM — clarification needed first)

**Status:** This requires a backend contract clarification before any frontend
code changes.

**The concrete failure mode:** `toDateParam` in
`features/meetings/api/meetings.ts` uses `date.getFullYear()` / `getMonth()` /
`getDate()` — local (system) methods. On a UTC Next.js server,
`new Date(year, monthIndex, i+1)` is local = UTC, which is fine. If the server
ever runs in UTC+3, `new Date(2026, 3, 9)` midnight Moscow =
`2026-04-08T21:00:00Z` → `toISOString().slice(0,10)` = `"2026-04-08"` — one day
early.

**Safe fix (no backend coordination needed):** Replace manual date construction
with string arithmetic to avoid any timezone ambiguity:

```ts
// Before: uses Date constructor (timezone-dependent)
const toDateParam = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// After: split the month string directly, never construct a Date from user input
export async function getCalendarEventsForMonth(
  month: string,
): Promise<EventProps[]> {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate(); // day=0 → last day of prev month (safe)
  const dayRequests = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const mon = String(monthNum).padStart(2, '0');
    return getMeetingsForDate(`${year}-${mon}-${day}`);
  });
  // ...
}
```

**Also fix:** `app/dashboard/meetings/calendar/page.tsx` uses
`new Date().toISOString().slice(0, 10)` for default month — this is the UTC
date, which can be wrong for Moscow users after 21:00 local time. Pass the
current month from the client instead or use `Intl.DateTimeFormat`.

---

### 🟡 BUG-08 — Unsafe type cast masks missing creator_user_id (LOW-MEDIUM)

**Location:** `features/meetings/api/meetings.ts:113`,
`app/dashboard/meetings/calendar/page.tsx:60`

**TypeScript review finding:** `toEventProps` adapter already exists in
`features/meetings/model/utils.ts` for the org calendar path. Apply it to the
personal calendar path too — 3-line fix, not a new abstraction:

```ts
// In getCalendarEventsForMonth (meetings.ts):
import { toEventProps } from '@/features/meetings/model/utils';

const results = await Promise.all(dayRequests);
return results.flat().map(toEventProps); // removes the `as EventProps[]` cast
```

Once `getCalendarEventsForMonth` returns `EventProps[]` properly, the
`as EventProps[]` cast in `page.tsx:60` also disappears.

---

### 🆕 BUG-09 — CalendarAttachedToast double-fire in StrictMode (LOW-MEDIUM)

**Location:** `features/calendar/ui/calendar-attached-toast.tsx`

**Race condition:** In React 19 StrictMode, components are intentionally
unmounted+remounted. `CalendarAttachedToast` fires `toast.success(...)` and
`router.replace(...)` in a `useEffect` with no cleanup or idempotency guard. On
double-mount, the toast fires twice and two `router.replace` calls execute.

**Fix — useRef fire-once guard:**

```ts
export default function CalendarAttachedToast() {
  const router = useRouter();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    toast.success('Google Calendar connected successfully!');
    const url = new URL(globalThis.location.href);
    url.searchParams.delete('attached');
    router.replace(url.pathname + (url.search || ''));
  }, [router]);

  return null;
}
```

`useRef` persists across StrictMode double-invoke cycles — React intentionally
does not reset refs.

---

### 🆕 BUG-10 — OrgCalendarView O(n²) events.find in renderEvent (MEDIUM)

**Location:** `features/meetings/ui/org-calendar-view.tsx`

`renderEvent` calls `events.find(e => e.id === event.id)` for every event
render. This is O(n) per event, making the full grid O(n²) for n org meetings.
At 500 events: 250,000 iterations per render pass. The identical pattern is
already solved correctly in `cells.tsx` with an `eventsByDate` Map.

**Fix:**

```ts
// Before rendering, build a Map once:
const eventById = new Map(events.map((e) => [e.id, e]));

// In renderEvent:
const original = eventById.get(event.id);
```

---

### 🆕 BUG-11 — CalendarCells widget is dead code (LOW)

**Location:** `widgets/calendar-view/ui/CalendarCells.tsx`

This component is exported from `widgets/calendar-view/index.ts` but never
imported anywhere in the codebase. It duplicates logic already in
`CalendarPage.tsx`. Delete it and remove its export from the widget index.

---

## 3. Missing Flows & Gaps (prioritized after simplicity review)

### GAP-01 — Mobile agenda has no interactivity (HIGH UX impact)

`CalendarAgenda` shows events as static list with no click handlers. Mobile
users cannot navigate to meeting details. Fix: add
`onClick={() => router.push(ROUTES.DASHBOARD.MEETING_DETAIL(event.id))}` for
past events. For future events, a bottom-sheet is the mobile equivalent of the
desktop popover — but this can be deferred.

### GAP-02 — No filter UI on personal calendar grid (MEDIUM — backend-ready)

Both calendar tabs have zero filter UI. Backend already supports `scope`,
`team_id`, `user_id` on `GET /calendar-events`. This is a pure frontend gap for
the personal calendar. Org calendar filter requires backend changes first (see
GAP-09).

### GAP-03 — No overlap or workload visualization (LOW — no spec)

**Simplicity review verdict:** Remove from this plan. No design spec exists. The
correct approach for month view is density badges (color-code cells by event
count), not column-split overlap detection. Overlap columns belong in a future
week/day view.

### GAP-04 — No week view or day view (LOW — out of scope)

Out of scope for this bug-fix plan. Log as a separate feature request.

### GAP-05 — Personal calendar fires 31 HTTP requests per month (MEDIUM — backend blocked)

**Root cause:** Backend `GET /calendar-events` accepts only a single `?date=`
param; no `date_from`/`date_to` range exists. Frontend cannot fix this without a
backend change.

**Frontend mitigation available now:** Add concurrency cap to
`getCalendarEventsForMonth`:

```ts
// Instead of Promise.all (all 31 at once), batch in groups of 5
async function fetchWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    results.push(...(await Promise.all(batch.map((t) => t()))));
  }
  return results;
}
```

Also add **debounce to MonthSwitcher** navigation to prevent cascade on rapid
prev/next clicks:

```ts
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const setMonth = (date: Date) => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    router.push(`?month=${format(date, 'yyyy-MM-01')}`);
  }, 300);
};
```

### GAP-06 — Org calendar pagination is sequential, blocking SSR (MEDIUM — fixable now)

**Fix: first-fetch → totalCount → Promise.allSettled remaining pages:**

```ts
async function fetchAllOrgEvents(
  dateFrom: string,
  dateTo: string,
  pageSize = 100,
) {
  const first = await getOrgCalendarEvents(0, pageSize, dateFrom, dateTo);
  if (!first.hasMore) return first.data;

  const pageCount = Math.ceil(
    (first.totalCount - first.data.length) / pageSize,
  );
  const offsets = Array.from(
    { length: pageCount },
    (_, i) => (i + 1) * pageSize,
  );

  // Use allSettled — partial data better than total failure
  const settled = await Promise.allSettled(
    offsets.map((o) => getOrgCalendarEvents(o, pageSize, dateFrom, dateTo)),
  );

  return [
    first.data,
    ...settled
      .filter(
        (r): r is PromiseFulfilledResult<typeof first> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value.data),
  ].flat();
}
```

Extract this to `features/meetings/api/org-calendar.ts` as
`getAllOrgCalendarEvents()`. The `app/` page becomes a single `await` call,
fixing the FSD violation (business logic in routing layer).

### GAP-07 — Events silently truncated at 50/day (LOW — edge case)

`getMeetingsForDate` discards `hasMore`. In practice >50 events/day is unlikely.
Defer: surface `hasMore` as a UI indicator only if this becomes a reported
issue.

### GAP-08 — No skeleton during month navigation (MEDIUM — UX)

**Replace SpinLoader with shape-preserving CalendarGridSkeleton:**

```tsx
// features/calendar/ui/calendar-grid-skeleton.tsx
export function CalendarGridSkeleton() {
  return (
    <div
      className='grid grid-cols-7 border-t border-l border-[var(--border)] flex-1'
      style={{ gridTemplateRows: 'repeat(6, 1fr)' }}
    >
      {Array.from({ length: 42 }, (_, i) => (
        <div
          key={i}
          className='border border-[var(--border)] p-1 flex flex-col gap-1'
        >
          <div className='flex justify-center mb-1'>
            <Skeleton className='h-7 w-7 rounded-full' />
          </div>
          {i % 3 === 0 && <Skeleton className='h-4 w-full rounded' />}
          {i % 5 === 0 && <Skeleton className='h-4 w-3/4 rounded' />}
        </div>
      ))}
    </div>
  );
}
```

Also: wrap `router.push` in `useTransition` in `MonthSwitcher` — `isPending`
dims the month header immediately while data loads:

```tsx
const [isPending, startTransition] = useTransition();
const setMonth = (date: Date) => {
  startTransition(() => router.push(`?month=...`));
};
// dim header: <H2 className={isPending ? 'opacity-60 transition-opacity' : ''}>
```

### GAP-09 — Org calendar has no team/participant filter (BLOCKED — backend)

`GET /calendar-events/organization` does not support `team_id` or `user_id`.
Backend change required before any frontend work. Remove from this plan.

---

## 4. Architecture & API Summary

### Personal Calendar Data Flow

```
page.tsx (Server Component)
  → getSources()          [GET /sources]
  → getCalendarEventsForMonth(month)
      → concurrency-limited batches → GET /calendar-events?date=D&limit=50 × 28-31
      → results.flat().map(toEventProps)          ← BUG-08 fix: apply adapter here
  → CalendarPage (widget, Client Component)
      → Calendar (shell)
          → Cells
              → DayButton (currently Day — BUG-05 fix)
              → Event pill (up to 3/day)
              → EventExtraButton → EventPopupAll (BUG-01 fix: add renderItem prop)
          → DayDetailPanel (currently dead — BUG-05 fix)
          → CalendarAgenda (mobile — GAP-01 fix: add click handlers)
```

### Organization Calendar Data Flow

```
page.tsx (Server Component)
  → getAllOrgCalendarEvents() [extracted to features/meetings/api/org-calendar.ts]
      → first fetch → totalCount → Promise.allSettled remaining  ← GAP-06 fix
  → OrgCalendarView → widgets/org-calendar-view (after FSD fix)
      → toEventProps() adapter
      → Calendar (shell)
          → Cells → OrgCalendarEvent pill
          → EventExtraButton → EventPopupAll (same BUG-01 fix)
```

### Backend Endpoint Constraints

| Need                    | Personal `/calendar-events`    | Org `/calendar-events/organization` |
| ----------------------- | ------------------------------ | ----------------------------------- | ---------------- |
| Date range filter       | ❌ single `date` param only    | ✅ `date_from` + `date_to`          |
| Team filter             | ✅ `team_id` supported         | ❌ not supported                    |
| User/participant filter | ✅ `user_id`, `participant_id` | ❌ not supported                    |
| Scope filter            | ✅ `scope=past                 | upcoming`                           | ❌ not supported |
| Max limit               | 50                             | 100                                 |
| Order                   | implicit                       | `starts_at DESC`                    |

### FSD Violations Identified

| Violation                                                             | Location                          | Fix                                                |
| --------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| `features/meetings/` imports `features/calendar/` + `features/event/` | `org-calendar-view.tsx`           | Move to `widgets/org-calendar-view/`               |
| Business logic (pagination while-loop) in `app/`                      | `organization/page.tsx`           | Extract to `features/meetings/api/org-calendar.ts` |
| Raw `fetch` in `features/*/api/`                                      | `source.ts`, `calendar-events.ts` | Migrate to `httpClient`                            |
| Dead widget exported but unused                                       | `CalendarCells.tsx`               | Delete                                             |

---

## 5. Security Findings

### SEC-01 — No middleware.ts for dashboard routes (HIGH — systemic)

No `middleware.ts` exists at the project root. All dashboard auth enforcement is
opt-in (each Server Component individually reads the auth token via
`httpClient`). A new page that forgets to call any API function is silently
unauthenticated.

**Fix:** Create `middleware.ts` matching `/dashboard/:path*`:

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

This does not replace per-action token validation (still needed for token
expiry) but provides defense-in-depth.

### SEC-02 — 401 from getSources silently returns empty array

When `getSources` uses raw `fetch` and gets a 401, it returns `[]`. The page
falls through to `OnboardingTrigger` instead of redirecting to login. Fixed by
migrating to `httpClient` (BUG-04).

### SEC-03 — ?month= and ?day= params not validated

`?month=` in org calendar page flows into `startOfMonth()` without format
validation. A malformed param (e.g. `?month=javascript:alert(1)`) produces
`"Invalid Date"` sent to the backend.

**Fix:** Apply the same regex guard already in `meetings/list/page.tsx:71`:

```ts
if (!/^\d{4}-\d{2}-\d{2}$/.test(params.month)) {
  redirect(`?month=${format(new Date(), 'yyyy-MM-01')}`);
}
```

For `?day=` when `DayDetailPanel` is wired: validate with
`isValid(parseISO(params.day))` before rendering the panel.

### SEC-04 — OAuth redirect URL not validated client-side (LOW)

`AttachCalendarButton` assigns the URL returned from the Server Action directly
to `location.href`. The backend generates this from Google's OAuth service, so
it is safe today. Add an allowlist check for defense-in-depth:

```ts
const redirectUrl = await attachCalendar(organizationId);
if (!redirectUrl.startsWith('https://accounts.google.com/')) {
  toast.error('Invalid OAuth redirect URL');
  return;
}
globalThis.location.href = redirectUrl;
```

---

## 6. Performance Recommendations

### P0 — Immediate (no backend changes needed)

1. **Fix BUG-10 (O(n²) `events.find`)** — `OrgCalendarView`, pre-build
   `eventById` Map. 5-minute fix.
2. **Add debounce to MonthSwitcher** — prevents volley of 31+ backend requests
   on rapid prev/next clicks. 8-line fix.
3. **MonthSwitcher `useTransition`** — `isPending` gives instant visual
   feedback, removes perceived jank.

### P1 — This sprint

4. **Parallelize org calendar pagination** — `getAllOrgCalendarEvents()` with
   `Promise.allSettled`. Reduces SSR waterfall from N×RTT to 2×RTT.
5. **Add concurrency cap to `getCalendarEventsForMonth`** — limit to 5
   simultaneous day-fetches (reduces FPM pressure from 31 to 5 concurrent
   connections per user).
6. **Increase `next.config.ts` `staleTimes.dynamic`** from 0 to 30 — eliminates
   re-fetches on back-navigation. One-line change.

### P2 — Next sprint

7. **`unstable_cache` for per-day fetches** — wrap `getMeetingsForDate` with
   `revalidate: 300` and tag `'calendar-events'`. Revalidate on any mutation.
   Past months can use `revalidate: 3600`.
8. **CalendarGridSkeleton** — replace `SpinLoader` in `loading.tsx` files with
   shape-preserving skeleton. Preserves user spatial context during month
   navigation.
9. **Streaming with Suspense** — wrap only the grid data in Suspense; month
   switcher renders instantly.

### P3 — Backend coordination

10. **Add `date_from`/`date_to` to `GET /calendar-events`** — eliminates the
    31-request pattern entirely. Frontend change after backend ships: replace
    fan-out loop with a single `httpClientList` call.

---

## 7. Prioritized Remediation Plan (collapsed after simplicity review)

### Phase 1 — Critical Bug Fixes (1.5 days)

**All items are independent and can be parallelized:**

- [ ] **BUG-01**: Fix `EventPopupAll` — add `renderItem` prop, render content in
      map, add null guard, update test (`features/event/ui/event-popup-all.tsx`)
- [ ] **BUG-04**: Migrate raw `fetch` in `source.ts` (3 functions) AND
      `calendar-events.ts` (4 functions) to `httpClient`/`httpClientList`. Add
      `throw error` re-throw for `redirect()` compatibility
- [ ] **BUG-06**: Add `getSources` onboarding gate + `?month=` validation +
      try/catch + empty-state to org calendar page
      (`app/dashboard/meetings/organization/page.tsx`)
- [ ] **BUG-08 + BUG-03 combined**: Apply `toEventProps` in
      `getCalendarEventsForMonth`; fix stale route constants in `source.ts`
      (lines 56, 58, 85), `calendar-events.ts` (line 177), and
      `app/not-found.tsx`
- [ ] **BUG-09**: Add `useRef` fire-once guard to `CalendarAttachedToast`
      (`features/calendar/ui/calendar-attached-toast.tsx`)
- [ ] **BUG-10 + BUG-11**: Fix O(n²) `events.find` in `OrgCalendarView`; delete
      `CalendarCells.tsx` dead widget
- [ ] **BUG-02**: Verify actual `starts_at` format at runtime. If ISO 8601
      confirmed: fix `getWeekdayAndDay` to use `parseEventDate`; add ISO 8601
      test case

### Phase 2 — Wire Existing Implementations + Performance (1.5 days)

- [ ] **BUG-05**: Wire `DayButton` into `cells.tsx`; update `MonthSwitcher` to
      clear `?day=` on month switch; render `DayDetailPanel` as client-side
      sibling in `calendar.tsx` (`features/calendar/ui/`)
- [ ] **GAP-01**: Add `onClick` navigation to `CalendarAgenda` items for past
      events (mobile interactivity)
- [ ] **GAP-06**: Extract `getAllOrgCalendarEvents()` to
      `features/meetings/api/org-calendar.ts` with `Promise.allSettled` parallel
      pagination; update `organization/page.tsx` to a single `await`
- [ ] **GAP-05 mitigation**: Add concurrency cap (limit=5) to
      `getCalendarEventsForMonth`; add debounce + `useTransition` to
      `MonthSwitcher`
- [ ] **FSD fix**: Move `OrgCalendarView` from `features/meetings/ui/` to
      `widgets/org-calendar-view/` (resolves cross-feature import violation)

### Phase 3 — UX & Caching (1 day)

- [ ] **GAP-08**: Replace `SpinLoader` in both calendar `loading.tsx` files with
      `CalendarGridSkeleton`
- [ ] **BUG-07**: Refactor `getCalendarEventsForMonth` to use string arithmetic
      (avoid `Date` constructor for date params)
- [ ] **SEC-01**: Add `middleware.ts` for `/dashboard/:path*`
- [ ] **SEC-03**: Add `?day=` validation when wiring `DayDetailPanel`
- [ ] **Caching**: Wrap `getMeetingsForDate` in `unstable_cache` with
      `revalidate: 300`, tag `'calendar-events'`; increase `staleTimes.dynamic`
      to 30 in `next.config.ts`

### Phase 4 — Feature Additions (requires separate design + backend)

- [ ] **GAP-02**: Filter bar on personal calendar (backend supports it; pure
      frontend)
- [ ] **Week/Day view with overlap**: Requires column-split layout algorithm
      (see §8.3); new route; significant scope — treat as separate feature
- [ ] **GAP-09**: Org calendar filters — blocked on backend adding
      `team_id`/`user_id` to org endpoint

---

## 8. Research Insights

### 8.1. Timezone-Safe Date Params

**Rule:** Never use `new Date(string)` to construct a Date for a date-only param
— it is parsed as UTC midnight, not local midnight. Instead, split strings
arithmetically:

```ts
// ✅ Timezone-safe: string arithmetic, no Date constructor
const [year, monthNum] = month.split('-').map(Number);
const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// ❌ Timezone-dependent: local Date methods on server may differ from Moscow
const date = new Date(year, monthIndex, i + 1);
const dateStr = `${date.getFullYear()}-...`;
```

For displaying datetime values (ISO 8601) in the user's timezone, use
`@date-fns/tz`'s `TZDate` — but only in Client Components (Server Components run
UTC, which may show the wrong day for Moscow users).

**References:**

- [date-fns/tz — TZDate](https://github.com/date-fns/tz)
- [Next.js parallel data fetching](https://nextjs.org/docs/app/getting-started/fetching-data)

### 8.2. Month Navigation UX Pattern

The correct Next.js 16 pattern for month navigation with instant feedback:

```tsx
// ✅ useTransition gives isPending without blocking React
const [isPending, startTransition] = useTransition();

const setMonth = (date: Date) => {
  startTransition(() => {
    router.push(`?month=${format(date, 'yyyy-MM-01')}`);
  });
};

// Dim header during pending, disable buttons
<H2 className={isPending ? 'opacity-60 transition-opacity' : ''}>
```

Do NOT use `useOptimistic` for navigation — it is designed for form mutations,
not route changes. Use `useLinkStatus` (Next.js 16) or `useTransition` with
`router.push`.

**Reference:**
[Next.js — useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)

### 8.3. Overlap Detection Algorithm (future week/day view)

For a time-position grid (week/day view), use the sweep-line column assignment
algorithm:

```ts
// Assign column positions to overlapping events
function layoutOverlappingEvents(events: CalendarEvent[]): LayoutEvent[] {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const columns: number[] = []; // tracks lastEndMinutes per column

  return sorted.map((event) => {
    let col = columns.findIndex((end) => end <= event.startMinutes);
    if (col === -1) {
      columns.push(event.endMinutes);
      col = columns.length - 1;
    } else columns[col] = event.endMinutes;
    return { ...event, column: col };
  });
  // Second pass needed to compute totalColumns per overlap group
}
```

For the **month grid**, use density badges instead — color-code cells by event
count (1-2: normal, 3-4: amber, 5+: red). Column-split is not viable in a small
month grid cell.

### 8.4. `unstable_cache` for Calendar Data

```ts
import { unstable_cache } from 'next/cache';

export const getMeetingsForDateCached = unstable_cache(
  async (dateStr: string, userId: string) => {
    // userId in cache key prevents cross-user cache pollution
    return getMeetingsForDate(dateStr);
  },
  ['calendar-events-by-date'],
  {
    revalidate: 300, // 5 min for current/future months
    tags: ['calendar-events'],
  },
);

// After any mutation:
import { revalidateTag } from 'next/cache';
revalidateTag('calendar-events');
```

Past months can use `revalidate: 3600` (1 hour) — past events don't change.

---

## 9. Open Questions

**Priority 1 (blocks correct behavior):**

1. **What format does `starts_at` actually return at runtime?** Is it
   `"2026-04-09T10:00:00.000000Z"` (ISO 8601) or `"2026-04-09 10:00:00"`
   (space-separated)? This determines whether BUG-02 needs a fix.

2. **What should `EventPopupAll` render?** Same pill as the grid? A list with
   time + title? A mini card? (BUG-01 depends on UX decision for `renderItem`
   default)

3. **After `detachCalendar`, where should the redirect land?** Personal calendar
   (showing OnboardingTrigger) or profile/calendar settings page?

**Priority 2 (UX decisions):**

4. Should clicking a day number in the personal calendar open `DayDetailPanel`?
   Components are ready — this is a UX decision, not a technical one.

5. Should the mobile agenda support bot toggle / meet link, or just navigation
   to the detail page?

6. Is there a backend roadmap for `date_from`/`date_to` on
   `GET /calendar-events`? This eliminates the 31-request problem entirely.

7. Should the org calendar show ALL org events, or only `required_bot=true`
   events as currently? This might be intentional product scope.

---

## 10. Files Affected

### Phase 1 (Critical Bug Fixes):

| File                                               | Change                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `features/event/ui/event-popup-all.tsx`            | Add `renderItem` prop; render content; null guard; update test        |
| `features/event/lib/get-weekday-and-day.ts`        | Use `parseEventDate` (if ISO 8601 confirmed)                          |
| `features/calendar/api/source.ts`                  | Use `httpClient`; fix stale `ROUTES` refs; add `throw error` re-throw |
| `features/event/api/calendar-events.ts`            | Migrate remaining raw `fetch` calls to `httpClient`                   |
| `app/dashboard/meetings/organization/page.tsx`     | Onboarding gate; `?month=` validation; try/catch; empty state         |
| `features/meetings/api/meetings.ts`                | Apply `toEventProps` in `getCalendarEventsForMonth`                   |
| `features/meetings/model/utils.ts`                 | Verify `toEventProps` covers all fields correctly                     |
| `app/not-found.tsx`                                | Update stale `ROUTES.DASHBOARD.CALENDAR` link                         |
| `features/calendar/ui/calendar-attached-toast.tsx` | Add `useRef` fire-once guard                                          |
| `features/meetings/ui/org-calendar-view.tsx`       | Fix O(n²) `events.find` → Map                                         |
| `widgets/calendar-view/ui/CalendarCells.tsx`       | **Delete** (dead code)                                                |
| `widgets/calendar-view/index.ts`                   | Remove `CalendarCells` export                                         |

### Phase 2 (Wire + Performance):

| File                                           | Change                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `features/calendar/ui/cells.tsx`               | Replace `Day` with `DayButton`; add `selectedDay` prop            |
| `features/calendar/ui/calendar.tsx`            | Add `DayDetailPanel` as client sibling; wrap in `useSearchParams` |
| `features/calendar/ui/month-switcher.tsx`      | Add debounce; `useTransition`; clear `?day=` on month switch      |
| `features/calendar/ui/calendar-agenda.tsx`     | Add `onClick` navigation for past events                          |
| `features/meetings/api/org-calendar.ts`        | Add `getAllOrgCalendarEvents()` with parallel pagination          |
| `app/dashboard/meetings/organization/page.tsx` | Use `getAllOrgCalendarEvents()`; remove while-loop                |
| `widgets/org-calendar-view/`                   | New widget: move `OrgCalendarView` from `features/meetings/`      |

### Phase 3 (UX + Security + Caching):

| File                                              | Change                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| `app/dashboard/meetings/calendar/loading.tsx`     | Replace `SpinLoader` with `CalendarGridSkeleton` |
| `app/dashboard/meetings/organization/loading.tsx` | Replace `SpinLoader` with `CalendarGridSkeleton` |
| `features/calendar/ui/calendar-grid-skeleton.tsx` | **New file**: 7×6 grid skeleton                  |
| `middleware.ts` (project root)                    | **New file**: dashboard route auth guard         |
| `next.config.ts`                                  | Increase `staleTimes.dynamic` to 30              |
| `features/meetings/api/meetings.ts`               | Wrap `getMeetingsForDate` in `unstable_cache`    |

---

## References

### Frontend Files

- `app/dashboard/meetings/calendar/page.tsx` — personal calendar page
- `app/dashboard/meetings/organization/page.tsx` — org calendar page
- `features/calendar/ui/cells.tsx` — month grid cells
- `features/calendar/ui/calendar-agenda.tsx` — mobile agenda
- `features/calendar/ui/day-button.tsx` — unwired day button (click → ?day=
  param)
- `features/calendar/ui/day-detail-panel.tsx` — unwired side panel
- `features/calendar/ui/month-switcher.tsx` — month navigation
- `features/calendar/ui/calendar-attached-toast.tsx` — OAuth success toast
  (BUG-09)
- `features/event/ui/event-popup-all.tsx` — broken overflow modal
- `features/event/lib/get-weekday-and-day.ts` — date parser
- `features/calendar/api/source.ts` — raw fetch violations
- `features/event/api/calendar-events.ts` — additional raw fetch violations
- `features/meetings/api/meetings.ts` — 31-request-per-month pattern
- `features/meetings/api/org-calendar.ts` — org calendar API
- `features/meetings/model/types.ts` — `CalendarEventListItem`
- `features/meetings/model/utils.ts` — `toEventProps` adapter
- `features/meetings/ui/org-calendar-view.tsx` — O(n²) bug + FSD violation
- `entities/event/model/types.ts` — `EventProps`
- `shared/lib/dateFormatter.ts` — `parseEventDate` (correct ISO 8601 parser)
- `shared/lib/routes.ts` — `ROUTES.DASHBOARD` constants
- `shared/lib/httpClient.ts` — `httpClient`/`httpClientList`
- `widgets/calendar-view/ui/CalendarCells.tsx` — dead code to delete

### Backend Files

- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/CalendarEvent/CalendarEventController.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Requests/API/v1/CalendarEventRequest.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Controllers/API/v1/CalendarEvent/OrganizationCalendarController.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Requests/API/v1/OrganizationCalendarRequest.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Http/Resources/API/v1/CalendarEventResource.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Models/CalendarEvent.php`
- `/Users/slavapopov/Documents/WandaAsk_backend/app/Models/Source.php`

### External References

- [date-fns/tz — TZDate, withTimeZone](https://github.com/date-fns/tz)
- [Next.js — Parallel data fetching with Promise.all](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js — Streaming with Suspense and loading.tsx](https://nextjs.org/docs/app/guides/streaming)
- [Next.js — unstable_cache for non-fetch async functions](https://nextjs.org/docs/app/guides/caching-without-cache-components)
- [Next.js — useLinkStatus for navigation pending state](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- [Next.js — useTransition with router.push](https://nextjs.org/docs/app/api-reference/functions/use-router)
