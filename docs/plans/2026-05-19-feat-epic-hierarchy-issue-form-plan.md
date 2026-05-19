---
title: feat: Epic / Task hierarchy in Issue form
type: feat
status: completed
date: 2026-05-19
---

# feat: Epic / Task hierarchy in Issue form

## Enhancement Summary

**Deepened on:** 2026-05-19  
**Research agents used:** TypeScript reviewer, Code simplicity reviewer, Architecture strategist, Performance oracle, Pattern recognition specialist, Race condition reviewer, Spec-flow analyzer, Data integrity guardian, Best practices researcher, Learnings checker

### Key Improvements Added
1. **Critical backend bug found:** `IssueController::store()` has dead code — `epic_id` is never passed when creating an issue. Must be fixed before frontend work makes sense.
2. **Remove `'use client'`** from `EpicChildIssues` — it's a pure Server Component.
3. **`EpicChildIssues` wraps its own Card** following the `IssueLinkedTask` precedent, not the page.
4. **Use `IssueStatusBadge`** instead of `Badge variant='default'` for status display.
5. **`savedEpicIdRef` pattern** to prevent silent data loss when user switches type epic→task and back.
6. **`IssueUpsertDTO.epic_id` must be required** (not optional `?`) to guarantee PATCH always sends the field.
7. **Epic picker visible in edit mode** even when `epics` list is empty, if issue already has an `epic_id`.

### New Considerations Discovered
- Backend `store()` dead code means creating a task linked to an epic silently loses the `epic_id`
- `childIssues` always eager-loaded for every issue detail (not conditional on `type === 'epic'`) — minor backend perf note
- `getEpics()` returns full `Issue` objects where `EpicOption` shape is sufficient — minor over-fetching
- `base_type` vs literal `'epic'` check — orgs with custom epic-typed issue types won't be covered by `type === 'epic'` guard (out of scope, but noted)
- `getEpics()` is unscoped — shows epics from all orgs; no re-fetch when org changes in the form (out of scope, but noted)
- `resetField('epic_id')` is cleaner than `setValue('epic_id', '')` — resets errors + touched state too

---

## Понял правильно — краткое резюме

Перед реализацией подтверждаю, что понял задачу корректно:

1. **Иерархия двухуровневая:** Epic → Task(s). Глубже — нельзя.
   - Эпик может содержать **неограниченное** кол-во задач.
   - Задача принадлежит **не более чем одному** эпику (`epic_id` FK, nullable).
   - Задача не может иметь дочерних задач.
   - Эпик не может быть дочерним эпиком (у эпика нет поля `epic_id`).

2. **В форме создания/редактирования:**
   - Если `type === 'epic'` → поле **Epic** (привязка к другому эпику) **не показываем**. Вместо этого показываем список дочерних задач (read-only на детальной странице).
   - Если `type !== 'epic'` (обычная задача) → показываем **поле Epic** (autocomplete по эпикам команды).

3. **Отвязать эпик** — значение `epic_id = null` при сохранении (опция "None" в дропдауне).

4. **Детальная страница эпика** должна показывать список `child_issues` (дочерних задач).

5. **Backend поддерживает** (commit `0f67fe3b`): `IssueResource` возвращает `epic_id`, `epic`, `child_issues`; контроллер загружает `childIssues` eager на detail endpoint. **НО: в `store()` есть критический баг — `epic_id` не сохраняется при создании.**

---

## Что сейчас работает и что нет

### ✅ Уже сделано на фронтенде

| Что | Где |
|-----|-----|
| Типы `epic_id`, `epic`, `child_issues` в `Issue` | `features/issues/model/types.ts` |
| `EpicOption` интерфейс | `features/issues/model/types.ts` |
| `epic_id` в `IssueUpsertDTO` и `IssueFilters` | `features/issues/model/types.ts` |
| `getEpics()` server action | `features/issues/api/issues.ts:361` |
| Epic dropdown в `IssueForm` | `features/issues/ui/issue-form.tsx:321-334` |
| Передача `epics` в create и detail pages | `app/dashboard/issues/(create)/create/page.tsx`, `app/dashboard/issues/[id]/page.tsx` |

### ❌ Нужно реализовать

1. **Скрыть поле Epic когда `type === 'epic'`** — сейчас Epic picker показывается для всех типов.
2. **Показать список дочерних задач** на детальной странице эпика (`child_issues`), когда `type === 'epic'`.
3. **Новый компонент `EpicChildIssues`** — Server Component, read-only список задач.
4. **Сбросить `epic_id`** при смене типа на `'epic'`, восстановить при обратной смене.
5. **Исправить `IssueUpsertDTO.epic_id`** — сделать обязательным (убрать `?`).

### ⚠️ Баг в backend (блокер)

`IssueController::store()` — строки после `return ApiResponse::success(...)` (строка ~141) являются **мёртвым кодом**. Активный `Issue::create()` в транзакции не включает `epic_id`. Результат: при создании задачи `epic_id` всегда `null`, независимо от выбора в форме.

```php
// BACKEND FIX NEEDED: app/Http/Controllers/API/v1/IssueController.php
// В DB::transaction добавить 'epic_id' => $data['epic_id'] ?? null,
$issue = Issue::create([
    'user_id'         => $data['author_id'] ?? $userId,
    'organization_id' => $data['organization_id'],
    'team_id'         => $data['team_id'] ?? null,
    'epic_id'         => $data['epic_id'] ?? null,  // <-- добавить эту строку
    'status'          => $data['status'] ?? 'open',
    'name'            => $data['name'],
    ...
]);
```

---

## Технический план

### Шаг 0 (Блокер) — Исправить backend `store()`

**Файл:** `app/Http/Controllers/API/v1/IssueController.php` (backend repo)

Добавить `'epic_id' => $data['epic_id'] ?? null,` в активный `Issue::create()` внутри `DB::transaction`. Удалить мёртвый код (duplicate `Issue::create` после `return`).

**Это нужно сделать до или одновременно с frontend изменениями.** Без этого фикса создание задачи с эпиком не работает, даже при правильном фронтенде.

---

### Шаг 1 — Исправить `IssueUpsertDTO.epic_id` в типах

**Файл:** `features/issues/model/types.ts`

```ts
// Было:
export interface IssueUpsertDTO {
  epic_id?: number | null;  // optional — WRONG
  ...
}

// Стало:
export interface IssueUpsertDTO {
  epic_id: number | null;  // required — всегда посылаем в PATCH
  ...
}
```

**Почему:** Backend PATCH использует `if ($this->has('epic_id'))` — если ключ отсутствует, старое значение сохраняется. Мы должны всегда посылать `epic_id` явно, чтобы unlink (`null`) работал корректно.

**Research insight:** Поле с `sometimes` на бэкенде требует явной передачи значения с фронта — нельзя допустить случайного omit через optional DTO.

---

### Шаг 2 — `IssueForm`: условная видимость поля Epic + сброс значения

**Файл:** `features/issues/ui/issue-form.tsx`

#### 2a. Добавить `savedEpicIdRef` для предотвращения data loss при смене типа

```tsx
// Добавить в тело компонента IssueForm:
const savedEpicIdRef = useRef<string | undefined>(undefined);
```

#### 2b. Производная переменная типа

```tsx
// Добавить под существующими watch() вызовами:
const isEpic = watch('type') === 'epic';
```

Имя `isEpic` (а не `isEpicType`) — более идиоматично.

#### 2c. Обновить onChange для Type dropdown

```tsx
onChange={(value) => {
  const previousEpicId = watch('epic_id');
  setValue('type', value as string, { shouldDirty: true });
  if (value === 'epic') {
    // Сташим текущий epic_id и сбрасываем поле
    savedEpicIdRef.current = previousEpicId;
    setValue('epic_id', '', { shouldDirty: true });
    clearErrors('epic_id');
  } else if (savedEpicIdRef.current !== undefined) {
    // Восстанавливаем при возврате к типу-не-эпику
    setValue('epic_id', savedEpicIdRef.current, { shouldDirty: true });
    savedEpicIdRef.current = undefined;
  }
  clearErrors('type');
  setRootError('');
}}
```

**Зачем `savedEpicIdRef`:** Без него пользователь, который меняет тип task→epic→task, теряет ранее выбранный эпик. В edit mode это тихая потеря данных.

#### 2d. Условный рендер Epic picker

```tsx
// Условие показа: не эпик И (есть список эпиков ИЛИ у задачи уже есть epic_id в edit mode)
{!isEpic && (epics.length > 0 || (!!issue && issue.epic_id !== null)) && (
  <InputDropdown
    label='Epic'
    options={[
      { value: '', label: 'None' },
      ...epics.map((e) => ({ value: String(e.id), label: e.name })),
    ]}
    value={watch('epic_id')}
    onChange={(value) => {
      setValue('epic_id', value as string, { shouldDirty: true });
    }}
    searchable
  />
)}
```

**Ключевое изменение:** условие `epics.length > 0 || (!!issue && issue.epic_id !== null)` — в edit mode с уже привязанным эпиком показываем поле, даже если `getEpics()` вернул пустой массив (например, при сетевом сбое).

#### 2e. Исправить falsy-coercion в payload

```tsx
// Было (некорректно — '0' даёт null):
epic_id: values.epic_id ? Number(values.epic_id) : null,

// Стало (явная проверка на пустую строку):
epic_id: values.epic_id !== '' ? Number(values.epic_id) : null,
```

---

### Шаг 3 — Компонент `EpicChildIssues` (Server Component)

**Новый файл:** `features/issues/ui/epic-child-issues.tsx`

```tsx
// НЕТ 'use client' — это Server Component
import Link from 'next/link';

import { IssueStatusBadge } from '@/entities/issue';
import { ROUTES } from '@/shared/lib/routes';
import { Card, CardBody } from '@/shared/ui/card';

import type { Issue } from '../model/types';

interface EpicChildIssuesProps {
  issues: Issue[];
}

export function EpicChildIssues({ issues }: EpicChildIssuesProps) {
  return (
    <Card>
      <CardBody>
        <div className='flex flex-col gap-4'>
          <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
            Child Tasks
          </p>

          {issues.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No child tasks linked to this epic.
            </p>
          ) : (
            <div className='flex flex-col gap-2'>
              {issues.map((child) => (
                <Link
                  key={child.id}
                  href={`${ROUTES.DASHBOARD.ISSUES}/${child.id}`}
                  className='flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-background/30 px-4 py-3 hover:bg-background/50 transition-colors'
                >
                  <span className='truncate text-sm font-medium text-foreground'>
                    #{child.id} {child.name}
                  </span>
                  <IssueStatusBadge status={child.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
```

**Ключевые решения по сравнению с первоначальным планом:**

| Что изменено | Почему |
|---|---|
| Убран `'use client'` | Нет хуков/browser API — Server Component. Zero bundle cost. |
| `Card + CardBody` внутри компонента | Следует паттерну `IssueLinkedTask` (не `PageHeader` в page) |
| Заголовок `text-xs uppercase tracking-[0.2em]` | Паттерн `IssueLinkedTask:167-169`, не `PageHeader` |
| `IssueStatusBadge` вместо `Badge variant='default'` | Правильная семантическая окраска по статусу |
| Относительный импорт `from '../model/types'` | Инtra-feature импорт — относительный путь |
| `IssueStatusBadge` из `@/entities/issue` | FSD: entities — public, features — feature-scoped |

---

### Шаг 4 — Интеграция в детальную страницу

**Файл:** `app/dashboard/issues/[id]/page.tsx`

```tsx
import {
  getIssue,
  getIssueAttachments,
  getPersons,
  getEpics,
  IssueAttachments,
  IssueComments,
  getIssueComments,
  IssueForm,
  IssueLinkedTask,
  EpicChildIssues,  // <-- добавить
} from '@/features/issues';

// В JSX — после <IssueLinkedTask issue={issue} />:
{issue.type === 'epic' && (
  <EpicChildIssues issues={issue.child_issues ?? []} />
)}
```

Компонент оборачивает свой `Card` сам — в page добавляется только одна строка.

---

### Шаг 5 — Экспорт из `index.ts`

**Файл:** `features/issues/index.ts`

```ts
export { EpicChildIssues } from './ui/epic-child-issues';
```

---

## Схема иерархии (ERD)

```mermaid
erDiagram
    ISSUE {
        int id PK
        string name
        string type
        string status
        int epic_id FK "nullable, self-ref"
        int organization_id FK
        int team_id FK "nullable"
        int assignee_id FK "nullable"
    }

    ISSUE ||--o{ ISSUE : "epic has many child tasks (epic_id)"

    note "Rules:
    - type='epic': epic_id must be null (no parent epic)
    - type!='epic': epic_id can reference an epic
    - No deeper nesting (2 levels max)"
```

---

## Acceptance Criteria

- [x] Форма создания задачи (`type !== 'epic'`): поле Epic отображается если есть эпики ИЛИ задача уже привязана к эпику
- [x] Форма создания эпика (`type === 'epic'`): поле Epic **не отображается**
- [x] При смене типа на `'epic'` — поле `epic_id` сбрасывается, при возврате к другому типу — восстанавливается
- [x] Детальная страница задачи (не эпика): поле Epic с текущим значением или "None"
- [x] Детальная страница эпика: секция "Child Tasks" с дочерними задачами
- [x] Каждая дочерняя задача — кликабельная ссылка, статус отображается через `IssueStatusBadge`
- [x] Если у эпика нет дочерних задач — показываем "No child tasks linked to this epic."
- [x] `epic_id = null` отправляется при unlink (через "None") — поле в payload всегда присутствует
- [x] Создание задачи с выбранным эпиком — `epic_id` сохраняется на бэкенде (backend fix in commit 1f90912a)
- [x] TypeScript: нет новых ошибок типов; `IssueUpsertDTO.epic_id` обязателен (не optional)

---

## Затронутые файлы

| Репо | Файл | Изменение |
|------|------|-----------|
| **backend** | `app/Http/Controllers/API/v1/IssueController.php` | **БАГИ-БЛОКЕР:** добавить `epic_id` в `Issue::create()`, удалить мёртвый код |
| frontend | `features/issues/model/types.ts` | `IssueUpsertDTO.epic_id: number \| null` (убрать `?`) |
| frontend | `features/issues/ui/issue-form.tsx` | `isEpic`, `savedEpicIdRef`, обновить onChange Type, условный Epic picker, исправить falsy-coercion |
| frontend | `features/issues/ui/epic-child-issues.tsx` | **Новый Server Component** |
| frontend | `features/issues/index.ts` | Экспорт `EpicChildIssues` |
| frontend | `app/dashboard/issues/[id]/page.tsx` | `{issue.type === 'epic' && <EpicChildIssues ... />}` |

---

## Out of scope (не делаем сейчас)

- Фильтрация задач по эпику в kanban/list view (UI фильтра — отдельная задача)
- Drag-and-drop назначения задачи в эпик
- Прогресс-бар эпика (% выполненных дочерних задач)
- Создание задачи прямо из страницы эпика
- Ограничение кол-ва `child_issues` на бэкенде (пагинация для крупных эпиков)
- Исправление `InputDropdown` stale timer (pre-existing bug, separate PR)

---

## Research Insights

### Conditional form fields (react-hook-form best practices)
- Поле `epic_id`, скрытое через JSX условие, **не unregistered** из формы — значение сохраняется в store (`shouldUnregister: false` — default). Правильно: при повторном показе поле появляется с текущим значением.
- Сброс значения — всегда **в `onChange` handler, не в `useEffect`**: синхронный, один рендер, консистентен с остальной формой. `useEffect` — только для async remote data loading.
- **`resetField('epic_id')`** предпочтительнее `setValue('epic_id', '')`: дополнительно очищает error state и touched state.
- `watch('type')` — один вызов наверху компонента вместо повторного в JSX — дедупликация подписки. Для новых изолированных компонентов — предпочитать `useWatch({ control, name })`.

### Открытые вопросы (out of scope, но стоит иметь в виду)
- **`base_type` vs `'epic'`**: backend `Issue::isEpic()` проверяет `issueType?.base_type === 'epic'`, но `issueTypeOptionsFromOrgs` не читает `base_type`. Организации с кастомным epic-типом (напр. key=`'project'`, base_type=`'epic'`) не будут обработаны guard-условием `type === 'epic'`. Пока в проде только дефолтный тип `'epic'`.
- **Org-scoped epics**: `getEpics()` не фильтрует по организации — показывает эпики из всех доступных орг. При смене org в форме список эпиков не обновляется. Возможна перекрёстная привязка задачи к эпику из другой орг.
- **`getEpics()` при ошибке в edit mode**: если API упал и `epics = []`, но `issue.epic_id !== null` — Epic picker скрыт, но `issue.epic` в response содержит имя/статус. Стоит рассмотреть fallback: показывать read-only отображение из `issue.epic` при пустом списке в edit mode.

### Server Component vs Client Component
- Компонент без хуков, без обработчиков событий (кроме пассивных `<Link>`) — **Server Component по умолчанию**, `'use client'` не нужен.
- `next/link` работает в Server Components.
- Нулевой вклад в клиентский bundle.

### Паттерн `IssueLinkedTask` (Pattern Recognition)
- `IssueLinkedTask` оборачивает свой `Card + CardBody` внутри компонента.
- Заголовок секции: `<p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>`.
- **Вывод:** `EpicChildIssues` должен следовать тому же паттерну.

### Data integrity (PATCH семантика)
- Backend: `epic_id` в PATCH имеет `sometimes` validation — если ключ **отсутствует**, значение не меняется.
- Следствие: `IssueUpsertDTO.epic_id` не должен быть optional (`?`), чтобы TypeScript гарантировал его присутствие в payload.
- Проверка `values.epic_id !== ''` безопаснее чем `Boolean(values.epic_id)` для маппинга в `null`.

---

## References

- Backend commit: `0f67fe3b1836b32ebe9de40fea0a6c8e0aec954f`
- Backend баг: `app/Http/Controllers/API/v1/IssueController.php:115-128` — `epic_id` missing in `Issue::create()`
- `features/issues/ui/issue-form.tsx:267-334` — блок Type + Epic
- `features/issues/ui/issue-linked-task.tsx:163-171` — паттерн Card + заголовок секции
- `features/issues/model/types.ts:216-229` — `IssueUpsertDTO`
- `features/issues/api/issues.ts:361` — `getEpics()`
- `app/dashboard/issues/[id]/page.tsx` — страница детали
- `shared/ui/input/InputDropdown.tsx` — stale timer bug (out of scope)
- Backend: `app/Http/Resources/API/v1/IssueResource.php` — `child_issues` via `whenLoaded`
- Backend: `app/Http/Controllers/API/v1/IssueController.php:214` — `findVisibleIssue` всегда грузит `childIssues`
