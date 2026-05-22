---
title: 'fix: Sync meetings list org filter with layout OrganizationSelector'
type: fix
status: completed
date: 2026-05-21
deepened: 2026-05-21
---

# fix: Sync Meetings List Org Filter with Layout OrganizationSelector

## Enhancement Summary

**Deepened on:** 2026-05-21 **Research agents used:** Kieran TypeScript
reviewer, Performance oracle, Julik races reviewer, Architecture strategist,
Code simplicity reviewer, Pattern recognition specialist, Security sentinel,
Unit test booster, Framework docs researcher, Best practices researcher, Scope &
feasibility analyst

### Key Improvements Discovered

1. **Use `key={cookieOrgId}` instead of mid-render detection** — for this
   specific component (no persistent children, no URL-writing mount effects)
   remounting is simpler, correct, and eliminates 2 extra state variables
2. **Use `getOrganizationId()` from `shared/lib/`, not inline `cookies()`** —
   avoids duplicating the shared utility
3. **`router.replace` (not `router.push`) for org changes** — filter changes
   must not pollute browser history
4. **`MeetingsListFiltersBar` needs a `<Suspense>` wrapper** —
   `useSearchParams()` requires it; `next build` will fail without it
5. **`String(organizations[0]?.id) ?? ''` is a silent bug** —
   `String(undefined)` returns `"undefined"`, not `''`
6. **Cross-feature import violation** — `features/meetings` imports from
   `features/teams`; fix at same time
7. **Critical race: concurrent `router.refresh()` + `router.replace()`** —
   disable filter bar while org refresh is in flight

### New Considerations Discovered

- The meetings API (`getMeetingsList`) does NOT filter by `organization_id` —
  fixing UI sync corrects the Teams dropdown but not actual data scoping
  (separate task)
- `secure` flag inconsistency in `organization.ts` vs `auth.ts` cookie settings
  (security finding — fix separately)
- Missing `Content-Security-Policy` header in `next.config.ts` (security finding
  — separate task)
- `nuqs` library is the community standard for typed URL param management if the
  project grows more complex filters

---

## Overview

На странице `/dashboard/meetings/list` фильтр-бар содержит dropdown выбора
организации, который **не синхронизирован** с глобальным `OrganizationSelector`
в layout. Это порождает рассинхрон: если пользователь выбрал org A в header, то
на странице Meetings в filter bar будет org B (первая в списке). Аналогично —
если пользователь меняет org в filter bar, header это не отражает.

---

## Problem Statement

### Текущее поведение

| Компонент                                | Механизм хранения                                  |
| ---------------------------------------- | -------------------------------------------------- |
| `OrganizationSelector` (layout header)   | httpOnly cookie `organization_id`, 7 дней          |
| `MeetingsListFiltersBar` (meetings page) | `useState` с инициализацией `organizations[0]?.id` |

`MeetingsListFiltersBar`:

- файл: `features/meetings/ui/meetings-list-filters-bar.tsx:38`
- инициализирует `organizationId` из первого элемента массива, **игнорируя
  cookie**
- cookie org → filter bar org: **не синхронизированы** при первой загрузке
  страницы
- filter bar org → cookie org: **не синхронизированы** никогда

Дополнительно: `organizationId` в filter bar используется **только** для
загрузки списка Teams в dropdown (`useEffect` → `getTeams(organizationId)`). Он
**не попадает** в `MeetingsListFilters` и не влияет на API-запрос списка встреч
(это отдельная задача).

### Воспроизведение gap'а

1. В header выбрать Org A (не первую в списке)
2. Перейти на `/dashboard/meetings/list`
3. Filter bar показывает Org B (`organizations[0]`) → Teams dropdown грузит
   teams Org B
4. Header показывает Org A — рассинхрон

### Известные edge cases

- **Смена org в header пока уже на странице Meetings**: `useState` не реагирует
  на изменение props после маунта — нужен механизм синхронизации
- **Смена org в filter bar**: header не реагирует (cookie не обновляется) — и не
  должен (unidirectional)
- **URL с `?team_id=X`**: команда из другой org остаётся в URL при смене org в
  filter bar — нужно сбрасывать
- **Cookie org не в списке orgs**: нет fallback-логики (deleted/deactivated org)
  — `getOrganizationId()` гарантирует redirect при отсутствии cookie, но не
  гарантирует что ID в cookie всё ещё валиден
- **Single-org пользователь**: dropdown скрыт (`organizations.length > 1`),
  проблема не воспроизводится
- **Concurrent race**: пользователь меняет org в header → `router.refresh()`
  in-flight → одновременно меняет фильтр в bar → `router.replace()` → два
  navigation-запроса с разными состояниями

### Важный scope gap

**Встречи из разных org показываются в общем списке.** `getMeetingsList`
принимает `MeetingsListFilters` без `organization_id` — сервер не фильтрует по
org. Данный fix корректирует только UI-рассинхрон Teams dropdown. Добавление
`organization_id` в API-запрос — **отдельная задача**.

---

## Proposed Solution

### Стратегия: `key` prop remounting + unidirectional cookie → UI

**Рекомендация из code simplicity review:** Использовать `key={cookieOrgId}` на
`MeetingsListFiltersBar` вместо mid-render detection pattern.

**Почему `key` подходит здесь (но не в `IssuesLayoutClient`):**

`MeetingsListFiltersBar` обладает следующими свойствами, при которых remount —
правильная семантика:

- Нет persistent children (нет children props, нет subtree для сохранения)
- Нет URL-writing mount effects (нет `useEffect` на mount для URL cleanup, в
  отличие от IssuesLayoutClient)
- Нет `FiltersContext` или `filtersVersion` счётчика
- При смене org все три state переменные (`organizationId`, `teams`,
  `teamUsers`) должны сброситься — это именно то, что делает remount
- Org change = "start over with this org" — правильная семантика

Это устраняет:

- `prevCookieOrgId` state (не нужен)
- mid-render if-block (не нужен)
- `resolveOrgId` helper (не нужен — fallback откладывается на потом)
- Риск concurrent-mode тиринга от mid-render setState

**Итоговое решение:**

1. **`app/dashboard/meetings/list/page.tsx`** вызывает `getOrganizationId()` из
   `shared/lib/` (не `cookies()` напрямую) и передаёт результат как
   `cookieOrgId: string` в `MeetingsListFiltersBar` с `key={cookieOrgId}`
2. **`MeetingsListFiltersBar`** принимает `cookieOrgId: string`, инициализирует
   `useState<string>(cookieOrgId)` (простая инициализация без IIFE)
3. При смене org в filter bar — `router.replace` (не `router.push`) внутри
   `startTransition` с удалением `team_id` и `user_id` из params; cookie не
   трогается
4. При смене org в header → `router.refresh()` → Server Component rerenders →
   `key` изменяется → `MeetingsListFiltersBar` полностью remounts с правильным
   initial state

> **Альтернатива (mid-render detection):** Если в будущем
> `MeetingsListFiltersBar` обретёт persistent children или URL-writing effects,
> перейти на паттерн `IssuesLayoutClient` с `prevCookieOrgId` state.

---

## Technical Approach

### Затрагиваемые файлы

| Файл                                                 | Изменение                                                                                                                                                          | Строки               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `app/dashboard/meetings/list/page.tsx`               | `getOrganizationId()` + `cookieOrgId` prop + `key` + `<Suspense>` wrapper                                                                                          | ~+8 строк            |
| `features/meetings/ui/meetings-list-filters-bar.tsx` | `cookieOrgId` prop + исправленный `useState` init + `router.replace` в org onChange + исправление `String(undefined)` bug + `disabled={isPending}` на org dropdown | ~+15 строк изменений |
| `features/meetings/ui/meetings-list-filters-bar.tsx` | Исправить cross-feature import `@/features/teams` → `@/entities/team`                                                                                              | -1/+1 строка         |

**Итого: ~20-25 строк**, 2 файла.

### Страница (Server Component)

```tsx
// app/dashboard/meetings/list/page.tsx
import { getOrganizationId } from '@/shared/lib/getOrganizationId';
import { getOrganizations } from '@/features/organization';
import { Suspense } from 'react';
import { MeetingsListFiltersBar } from '@/features/meetings/ui/meetings-list-filters-bar';
import { MeetingsListSkeleton } from '@/features/meetings/ui/meetings-list-skeleton';

export default async function MeetingsListPage({ searchParams }) {
  // Параллельный fetch — не sequential await
  const [organizations, cookieOrgId] = await Promise.all([
    getOrganizations(),
    getOrganizationId(), // redirects to login if cookie absent
  ]);

  const filters = parseFilters(await searchParams);

  return (
    <>
      {/* Suspense required: useSearchParams() in MeetingsListFiltersBar */}
      <Suspense fallback={null}>
        <MeetingsListFiltersBar
          key={cookieOrgId}        {/* Forces remount on org change */}
          cookieOrgId={cookieOrgId}
          filters={filters}
          organizations={organizations}
        />
      </Suspense>

      {/* Separate Suspense for the list content */}
      <Suspense fallback={<MeetingsListSkeleton />}>
        <MeetingsListClient filters={filters} />
      </Suspense>
    </>
  );
}
```

### Filter Bar (Client Component)

```tsx
// features/meetings/ui/meetings-list-filters-bar.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
// ✅ Fix cross-feature import violation:
import { getTeams } from '@/entities/team/api/team'; // was: @/features/teams/api/team

interface Props {
  filters: MeetingsListFilters;
  organizations: OrganizationProps[];
  cookieOrgId: string; // matches IssuesLayoutClient convention
}

export function MeetingsListFiltersBar({
  filters,
  organizations,
  cookieOrgId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Simple init from cookieOrgId — component remounts (via key) when org changes
  // ✅ Avoid: String(organizations[0]?.id) ?? '' — String(undefined) === "undefined", not ''
  const [organizationId, setOrganizationId] = useState<string>(() => {
    return cookieOrgId;
  });

  // ... existing teams/teamUsers state and effects

  // Org change handler — inline arrow per codebase convention (no named handleOrgChange)
  // ✅ Uses router.replace (not push) — filter changes must not pollute history
  // ✅ Batches all param changes in one URLSearchParams object, one replace call
  const onOrgChange = (newOrgId: string) => {
    setOrganizationId(newOrgId);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('team_id');
      params.delete('user_id');
      // Note: organization_id intentionally not added to URL params —
      // org selection is cookie-driven, not URL-driven (separate future task)
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div>
      {/* Org dropdown — disabled while navigation is pending */}
      {organizations.length > 1 && (
        <InputDropdown
          value={organizationId}
          options={organizations.map((o) => ({
            value: String(o.id),
            label: o.name,
          }))}
          onChange={onOrgChange}
          disabled={isPending} // prevents double-click race
        />
      )}
      {/* ... other filters */}
    </div>
  );
}
```

### Исправление silent bug в `useState` init

```ts
// ❌ Текущий код — баг:
const defaultOrgId = String(organizations[0]?.id) ?? '';
// String(undefined) === "undefined", не '' — ?? никогда не срабатывает

// ✅ Исправление (используется в codebase):
const defaultOrgId =
  organizations[0]?.id == null ? '' : String(organizations[0].id);

// ✅ С cookieOrgId (после fix):
useState<string>(() => {
  return cookieOrgId;
});
// При key={cookieOrgId} и getOrganizationId() — cookieOrgId всегда валиден
```

### Параллелизация fetch в странице

```ts
// ✅ Параллельно — как в app/dashboard/issues/(tabs)/layout.tsx
const [organizations, cookieOrgId] = await Promise.all([
  getOrganizations(),
  getOrganizationId(),
]);

// ❌ Последовательно — не делать так
const organizations = await getOrganizations();
const cookieOrgId = await getOrganizationId();
```

### `useSearchParams()` и Suspense

**Next.js 15/16 требует `<Suspense>` вокруг компонента, использующего
`useSearchParams()`.**

Без него `next build` упадёт с ошибкой `missing-suspense-with-csr-bailout` в
prod-режиме. В dev ошибки нет — это делает проблему незаметной в разработке.

```tsx
// В page.tsx:
<Suspense fallback={null}>  {/* или <FiltersBarSkeleton /> */}
  <MeetingsListFiltersBar key={cookieOrgId} ... />
</Suspense>
```

Отдельный `<Suspense>` для list content предотвращает мигание всей страницы при
смене фильтра:

```tsx
<Suspense fallback={<MeetingsListSkeleton />}>
  <MeetingsListClient ... />
</Suspense>
```

---

## Race Conditions & Mitigations

Результаты Julik races review — два критических race condition:

### Race 1 (CRITICAL): Mid-render тиринг в concurrent mode

**Статус:** Устранён выбором `key` remounting вместо mid-render detection.

Паттерн `if (cookieOrgId !== prevCookieOrgId) setState()` во время render может
производить тиринг в React 19 concurrent mode: org dropdown показывает Org B, а
Teams dropdown всё ещё показывает teams Org A (один render lane обновил
`prevCookieOrgId`, другой — нет). `key` remounting атомарен и тиринга не
производит.

### Race 2 (CRITICAL): Concurrent `router.refresh()` + `router.replace()`

Пользователь меняет org в header → `router.refresh()` in-flight (300-500ms) →
одновременно меняет Team filter → `router.replace('?team_id=5')` → два
navigation request с разными состояниями cookie.

**Митигация:** Org dropdown в filter bar должен быть `disabled={isPending}`.
Дополнительно: полностью отключать filter controls пока `router.refresh()` от
header ещё не завершился. Практически — `isPending` из `useTransition`
охватывает `router.replace` из filter bar, но не охватывает `router.refresh()`
из header. Полное решение этого race — более сложная задача (потребует
`isRefreshing` state и `useEffect([cookieOrgId])` для его сброса).

**Минимальный fix для данного PR:** `disabled={isPending}` на org dropdown
(предотвращает двойной клик race внутри filter bar).

### Race 3 (MEDIUM): Stale `getTeams` response

Существующий `cancelled` flag в `getTeams` useEffect корректен. При `key`
remounting — component unmounts, все pending promises игнорируются (flag
устанавливается в cleanup). Нет риска перезаписи.

Однако: `getTeams` — Server Action, вызывается из `useEffect`. Нет
`AbortController` — in-flight network request продолжается на сервере даже после
unmount. Это не приводит к UI-коррупции, но даёт лишнюю нагрузку на backend при
быстрой смене орг. Принять как trade-off для данного fix.

### Race 4 (LOW): `startTransition` не отменяет предыдущий `router.replace`

Два быстрых клика по разным org вызовут два `router.replace`. Next.js App Router
не гарантирует отмену первого navigation. `disabled={isPending}` предотвращает
это — второй клик заблокирован пока первый pending.

---

## FSD Architecture Compliance

### Cross-feature import violation (существующая, фиксируется в этом PR)

```ts
// ❌ Текущий код в meetings-list-filters-bar.tsx:6 — нарушение FSD
import { getTeams } from '@/features/teams/api/team';

// ✅ Исправление — импорт из entities (shared domain):
import { getTeams } from '@/entities/team/api/team';
```

`features/meetings` не должен импортировать из `features/teams`. Правильный слой
— `entities/team/` (domain entity, shared across features). Этот import уже
используется в `features/issues/ui/shared-filters-bar.tsx:6`.

### Data flow через `app/`

```
app/dashboard/meetings/list/page.tsx
  ↓ await getOrganizationId()     // shared/lib — ✅ valid direction
  ↓ await getOrganizations()      // features/organization — ✅ valid
  ↓ <MeetingsListFiltersBar cookieOrgId={...} />  // features/meetings — ✅ app → features OK
```

Нет cross-feature imports. Cookie value передаётся как primitive `string` через
`app/` — корректный integration point.

### Когда НЕ извлекать в shared hook

Паттерн `useCookieOrgSync` не нужен при 2 consumers (IssuesLayoutClient +
MeetingsListFiltersBar). При использовании `key` remounting — в
MeetingsListFiltersBar нет даже аналога mid-render detection, поэтому
дублирования нет. Извлекать в `features/organization/hooks/` только при третьем
consumer.

---

## Security Notes

### httpOnly cookie → RSC prop

Передача `cookieOrgId` как RSC prop не нарушает httpOnly. httpOnly предотвращает
`document.cookie` из JS в браузере. RSC payload сериализует значение — оно видно
в Network tab DevTools. Это ожидаемое поведение для numeric ID (не credential).

Правило: никогда не передавать как RSC prop — auth tokens, session secrets, PII,
`process.env` secrets.

### Injection risk

`organizations.find(o => String(o.id) === cookieOrgId)` — чистое сравнение в
памяти. Нет DOM, нет SQL, нет URL. Cookie value используется только для lookup,
не рендерится напрямую.

### Существующая проблема (fix separately): `secure` flag inconsistency

`organization.ts` uses `secure: process.env.NODE_ENV === 'production'`, а
`auth.ts` uses
`process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_ENV === 'production'`.
В staging с `NEXT_PUBLIC_APP_ENV=production` — cookie `token` будет Secure, но
`organization_id` не будет. Исправить в отдельном PR.

---

## Acceptance Criteria

### Функциональные требования

- [ ] Пользователь выбирает Org A в header → переходит на
      `/dashboard/meetings/list` → filter bar показывает Org A, Teams dropdown
      загружает teams Org A
- [ ] Пользователь на странице `/dashboard/meetings/list` меняет org в filter
      bar → Teams dropdown обновляется → `team_id` и `user_id` сбрасываются из
      URL
- [ ] Пользователь меняет org в header **находясь на странице**
      `/dashboard/meetings/list` → Next.js выполняет `refresh()` → `key`
      изменяется → filter bar remounts с правильной org
- [ ] При смене org в filter bar cookie **не** изменяется (unidirectional:
      только cookie → UI)
- [ ] Org dropdown в filter bar задизейблен пока `isPending === true`
- [ ] Для single-org пользователей (dropdown скрыт) поведение не изменяется
- [ ] `npm run build` проходит без `missing-suspense-with-csr-bailout` ошибки

### TypeScript requirements

- [ ] `Props` в `MeetingsListFiltersBar` обновлён: добавлено
      `cookieOrgId: string`
- [ ] `searchParams` в page.tsx типизирован как
      `Promise<Record<string, string | string[] | undefined>>` (существующий
      тип)
- [ ] Нет новых `any`
- [ ] Cross-feature import `@/features/teams` заменён на `@/entities/team`

### Quality gates

- [ ] `npm run lint` — без новых ошибок
- [ ] `npm run build` — успешная сборка
- [ ] Ручная проверка: multi-org аккаунт, смена orgs в обоих направлениях
- [ ] Ручная проверка: смена org в header пока уже на странице Meetings

---

## Test Plan

### Файлы

```
features/meetings/ui/__tests__/meetings-list-filters-bar.test.tsx
app/dashboard/meetings/list/__tests__/page.test.tsx  (опционально)
```

### Mocks setup

```ts
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace, push: mockPush })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/dashboard/meetings/list'),
}));

jest.mock('@/entities/team/api/team', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [], totalCount: 0 })),
  getTeamUsers: jest.fn(() => Promise.resolve({ data: [] })),
}));
```

### Test cases

**`describe('org initialization from cookieOrgId')`**

```
it('initializes to org matching cookieOrgId when it exists')
  → render with [ORG_A(id:1), ORG_B(id:2)], cookieOrgId='2'
  → org combobox displays 'Org B'

it('initializes to cookieOrgId even when it differs from organizations[0]')
  → render with [ORG_A, ORG_B], cookieOrgId='2'
  → assert NOT 'Org A'

it('handles empty string cookieOrgId gracefully')
  → render with [ORG_A, ORG_B], cookieOrgId=''
  → no crash; dropdown renders

it('does not render org dropdown with single org (organizations.length === 1)')
  → render with [ORG_A], cookieOrgId='1'
  → no org combobox in document
```

**`describe('key remounting — org prop change')`**

```
it('resets org state when key changes (simulates header org switch)')
  → render with key='1', cookieOrgId='1'
  → rerender with key='2', cookieOrgId='2'
  → assert org combobox displays 'Org B'
  // Note: with key change, React unmounts/remounts — useState init runs fresh
```

**`describe('org change URL behavior')`**

```
it('calls router.replace (not router.push) when org changes')
  → render with [ORG_A, ORG_B], cookieOrgId='1'
  → simulate onChange on org dropdown with newValue='2'
  → assert mockReplace called, mockPush NOT called

it('clears team_id from URL when org changes')
  → useSearchParams returns URLSearchParams('team_id=5&scope=upcoming')
  → simulate org change
  → URL passed to mockReplace does NOT contain 'team_id'

it('clears user_id from URL when org changes')
  → useSearchParams returns URLSearchParams('user_id=3')
  → simulate org change
  → URL passed to mockReplace does NOT contain 'user_id'

it('preserves scope param when org changes')
  → useSearchParams returns URLSearchParams('scope=upcoming&team_id=5')
  → simulate org change
  → URL passed to mockReplace CONTAINS 'scope=upcoming'

it('disables org dropdown while isPending is true')
  → while startTransition is pending
  → org dropdown has disabled attribute
```

**`describe('existing filter behavior unchanged')`**

```
it('renders Scope, Team, Participant dropdowns')
it('shows Clear filters button when scope is not all')
it('does not show Clear filters when all filters are default')
```

---

## Implementation Notes

### Что НЕ делать

- ❌ Не использовать `router.push` — загрязняет history (каждая смена org
  добавляет запись)
- ❌ Не вызывать `cookies()` напрямую в page.tsx — использовать
  `getOrganizationId()` из `shared/lib/`
- ❌ `String(organizations[0]?.id) ?? ''` — это баг,
  `String(undefined) === "undefined"`
- ❌ Не добавлять `organization_id` в `MeetingsListFilters` и API-вызов
  `getMeetingsList` в рамках этого fix
- ❌ Не добавлять `export const dynamic = 'force-dynamic'` —
  `getOrganizationId()` делает страницу dynamic автоматически
- ❌ Не использовать `useEffect` для derived state от props — explicit
  anti-pattern в React 18/19, вызывает видимый flicker
- ❌ Не импортировать `getTeams` из `@/features/teams` — нарушение FSD

### Почему `key` вместо mid-render detection

React docs hierarchy (react.dev "You Might Not Need an Effect"):

1. **Лучше:** вычислить во время render (без state) — не подходит, нужен state
   для Teams
2. **Хорошо:** `key` remounting — для сброса ВСЕГО state при смене identity
3. **Приемлемо:** mid-render `if (prev !== cur) setState()` — для сброса ЧАСТИ
   state
4. **Никогда:** `useEffect` для derived state от props

`MeetingsListFiltersBar` должен сбросить ВСЁ (org, teams, teamUsers) при смене
org → правильная семантика `key`.

### Паттерн: `Promise.all` для параллельного fetch

```ts
// ✅ Параллельно (matching issues layout pattern):
const [organizations, cookieOrgId] = await Promise.all([
  getOrganizations(), // React cache() deduplicates — no double fetch with layout
  getOrganizationId(),
]);
```

`getOrganizations()` обёрнута в `cache()` — двойной fetch с layout не
происходит.

### Почему не URL param для org

URL params для org были рассмотрены. Их добавление означает изменение
backend-контракта (`getMeetingsList` должен поддерживать `organization_id`
filter). Это scope следующей задачи.

Альтернатива: `nuqs` library (`useQueryStates`) для типизированного URL param
management — рассмотреть если проект расширит фильтрацию.

---

## Dependencies & Risks

### Зависимости

- `shared/lib/getOrganizationId.ts` — `Promise<string>`, redirects if absent;
  никогда не возвращает null
- `getOrganizations()` — `cache()`-обёрнута, deduplicates с layout call
- `entities/team/api/team` — уже используется в
  `features/issues/ui/shared-filters-bar.tsx:6`
- Существующий `cancelled` flag в `getTeams` useEffect — корректен, race
  condition устранён

### Риски

| Риск                                                        | Вероятность                         | Митигация                                                                   |
| ----------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `useSearchParams` без Suspense → `next build` fail          | Высокая (если не добавить Suspense) | Добавить `<Suspense>` в page.tsx обязательно                                |
| Concurrent refresh + replace race                           | Средняя                             | `disabled={isPending}` на org dropdown; полное решение в следующей итерации |
| `getOrganizationId()` redirect в staging если cookie absent | Низкая                              | Ожидаемое поведение; single-org users не затронуты                          |
| `key` remount сбрасывает in-flight Teams fetch              | Низкая                              | Нормально — teams должны сброситься при смене org                           |

---

## References

### Internal

- `features/meetings/ui/meetings-list-filters-bar.tsx:38` — текущий `useState` с
  `organizations[0]`
- `features/organization/ui/organization-dropdown.tsx:148-154` —
  `router.refresh()` после cookie write
- `features/organization/api/organization.ts:182-203` — `setActiveOrganization`
  server action
- `shared/lib/getOrganizationId.ts` — server-only cookie reader,
  `Promise<string>`
- `app/dashboard/meetings/list/page.tsx` — страница (нет `cookies()` и
  `getOrganizationId` сейчас)
- `app/dashboard/issues/(tabs)/layout.tsx` — эталон:
  `Promise.all([getOrganizations(), getOrganizationId()])`
- `features/issues/ui/issues-layout-client.tsx:99-108` — эталон mid-render
  detection (для справки)
- `features/issues/ui/shared-filters-bar.tsx:6` — `@/entities/team/api/team`
  import pattern

### External

- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  — `key` vs mid-render vs useEffect hierarchy
- [React: Preserving and Resetting State with `key`](https://react.dev/learn/preserving-and-resetting-state#resetting-a-form-with-a-key)
- [Next.js: cookies() API](https://nextjs.org/docs/app/api-reference/functions/cookies)
  — async in Next.js 15+, makes page dynamic automatically
- [Next.js: useSearchParams() Suspense requirement](https://nextjs.org/docs/app/api-reference/functions/use-search-params#with-suspense)
  — required, build fails without it
- [Next.js: router.replace vs router.push](https://nextjs.org/docs/app/api-reference/functions/use-router)
  — filter changes → replace
- [How to Think About Security in Next.js (Markbåge)](https://nextjs.org/blog/security-nextjs-server-components-actions)
  — RSC props in network payload

### Documented learnings

- `docs/plans/2026-05-13-feat-issues-filters-org-awareness-plan.md` — детальный
  анализ аналогичной проблемы для Issues
- `docs/plans/2026-03-31-feat-shared-filters-tasktracker-kanban-tabs-plan.md` —
  паттерн lifted shared filters
