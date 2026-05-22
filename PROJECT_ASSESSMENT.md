# Оценка проекта AI Ask Wanda Frontend

**Дата:** 22 мая 2026 _(предыдущая: 18 марта 2026)_

## Общие данные

| Метрика        | 18.03.2026                         | 22.05.2026                         | Δ        |
| -------------- | ---------------------------------- | ---------------------------------- | -------- |
| Стек           | Next.js 16 + React 19 + TypeScript | Next.js 16 + React 19 + TypeScript | —        |
| Архитектура    | Feature Sliced Design (FSD)        | Feature Sliced Design (FSD)        | —        |
| Файлов TS/TSX  | ~530                               | **782**                            | +252     |
| Строк кода     | ~40,200                            | **~64,700**                        | +24,500  |
| Features       | 19 модулей                         | **22 модуля**                      | +3       |
| Entities       | 5                                  | **9**                              | +4       |
| Widgets        | 2                                  | **4**                              | +2       |
| Коммиты всего  | ~221                               | **774**                            | +553     |
| Unit-тесты     | 169 suite / 1,158 tests ✅         | **144 suite / 1,004 tests** ✅     | −25/−154 |
| TS-ошибки      | 38 (в тестах)                      | **9 (в тестах)**                   | −29      |
| ESLint ошибки  | ? (npm run lint сломан)            | **4 ошибки**                       | фикс     |
| loading.tsx    | 20                                 | **51**                             | +31      |
| Custom agents  | 8                                  | **12**                             | +4       |

---

## История оценок

| Дата       | Файлов | LOC    | Features | Unit-тестов | TS ошибок | Общая оценка |
| ---------- | ------ | ------ | -------- | ----------- | --------- | ------------ |
| 13.03.2026 | ~514   | ~35k   | 19       | 1,022       | 41        | ⭐⭐⭐⭐     |
| 18.03.2026 | ~530   | ~40k   | 19       | 1,158       | 38        | ⭐⭐⭐⭐½    |
| 22.05.2026 | **782**| **~65k** | **22** | **1,004**   | **9**     | ⭐⭐⭐⭐½    |

---

---

## 🟢 Сильные стороны

### 1. Архитектура — отлично, рост без деградации

- **FSD** выдержан при масштабировании с 19 до 22 features: чёткая изоляция
  (ui/, api/, model/, types.ts, index.ts) соблюдена во всех модулях
- Все 22 features имеют `index.ts` — публичный API соблюдён
- **Entities** выросли с 5 до 9: добавлены `artifact`, `issue`, `source`,
  `telegram` — правильное место для cross-feature доменных типов
- **Widgets** выросли с 2 до 4: `calendar-view`, `dashboard-chat`, `layout`,
  `meeting` — крупные composite-секции вынесены из features
- `shared/ui/` имеет 16 подпапок UI-кита (badge, button, card, input, modal,
  navigation, popup, stats, table, typography и др.)

### 2. TypeScript — значительно улучшилось

- **TS ошибки сократились с 38 до 9** (все в тестовых файлах, не в
  production-коде)
- `httpClient` возвращаемый тип сужен до `{ data: T }` — устранена проверка
  `data ?? undefined` у всех вызывающих
- **Ноль `any`** в продакшн-коде — строгая типизация соблюдена
- Новые backend contracts синхронизированы: agents, teams, calendar, meetings

### 3. Инфраструктура Next.js — масштабная

- **51 loading.tsx** (+31 от прошлой оценки) — каждый маршрут имеет скелетон
- **3 error boundaries** (app, dashboard, global-error) — ошибки обработаны
- React Compiler включён, `optimizePackageImports` на 7 тяжёлых пакетах
- Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, CSP
- SSR-first: **197 client-компонентов**, **46 server-actions файлов** — баланс
  сохранён несмотря на рост
- Redirects в `next.config.ts` для устаревших маршрутов

### 4. Новые возможности (март–май 2026)

- **`features/issues/`** — полный issue tracker: list/kanban/goals/progress/detail
- **`features/agents/`** — AI agent profiles/tasks/activity с memories tab
- **`features/meetings/`** — бот-присутствие (BotPillIndicator), team/participant фильтры в календаре
- **`features/telegram/`** — привязка Telegram аккаунта через deep-link
- **`features/today-briefing/`** — Today дашборд с task stats, activity feed
- **`features/decisions/`**, **`features/onboarding/`** — новые модули
- **Mobile**: FAB + bottom-sheet drawer для chat на мобильных
- **`entities/artifact/`** — все 8 типов артефактов изолированы в entity

### 5. Code quality

- **0 TODO/FIXME/HACK** — чистая кодовая база
- ESLint конфиг: security, sonarjs, unicorn, jsdoc, import order, complexity
- Husky + lint-staged + pre-push pipeline с TypeScript check и Jest CI
- **npm run lint теперь работает** (4 ошибки — не сломан как раньше)
- Telegram уведомления о пуше (коммиты, файлы, строки +/−, время)

### 6. Агентная система — расширена

- **12 Claude-агентов** (было 8): добавлены `artifact-sync`,
  `code-quality-guardian`, `frontend-architect`, `wanda-backend-navigator`
- Охват: FSD аудит, контракты, тесты, перформанс, код-ревью, E2E, дизайн,
  artifact sync, quality, архитектура, backend навигация

---

## 🟡 Замечания (средний приоритет)

### 1. TypeScript ошибки — 9 (в тестах, прогресс)

Снизились с 38 до **9**, только в тестовых файлах. `tsc --noEmit` проходит в
production-коде чисто. Оставшиеся сосредоточены в 5 файлах:
`button-copy.test.tsx`, `user-menu-popup.test.tsx`, `getAuthToken.test.ts`,
`getOrganizationId.test.ts`, `httpClient.test.ts` — все с паттерном
"Expected 1 arguments, but got 0" из-за изменения сигнатуры функций.

### 2. Дублирование зависимостей motion — не исправлено

`framer-motion@^12.23.26` и `motion@^12.23.24` оба в `dependencies` — одно и
то же (motion — ребрендинг framer-motion). Лишние ~484 КБ в бандле.

### 3. `eslint-plugin-jsdoc` в dependencies — не исправлено

По-прежнему в `dependencies` вместо `devDependencies`.

### 4. `react-hooks/exhaustive-deps: 'off'` — не исправлено

Отключённое правило — потенциальный источник stale closure багов в hooks.
Особенно критично с 197 client-компонентами.

### 5. Unit-тесты — регрессия по количеству

**144 suite / 1,004 тестов** против 169/1,158 ранее (−25 suite, −154 тестов).
При этом кодовая база выросла на 60%. Причина — вероятно, тест-файлы для
features `analysis`, `demo`, `follow-up`, `participants`, `transcript` были
удалены или перемещены при рефакторинге. Новые features (issues, agents,
today-briefing, kanban, decisions, telegram) слабо покрыты тестами.

### 6. Новые features без тестов

`kanban` — 0 тестов, `decisions` — 0 тестов, `telegram` — 0 тестов,
`today-briefing` — 0 тестов. Итого 4 features без единого test suite.

### 7. ESLint — 4 ошибки в незакоммиченных файлах

Текущий статус ветки `feat/agents-new-backend-contracts` имеет 4 ESLint ошибки
(2× unused import `TeamProps`, 1× `Array#sort` → `toSorted`, 1× setState в
effect). Нужен `npm run lint:fix` перед коммитом.

---

## 🔴 Проблемы (высокий приоритет)

### ~~1. Lint сломан~~ — ✅ исправлено (22.05.2026)

`npm run lint` теперь работает. 316 проблем (4 ошибки, 312 предупреждений) —
ESLint отрабатывает, но есть ошибки в незакоммиченных изменениях.

### ~~2. `NODE_TLS_REJECT_UNAUTHORIZED = '0'`~~ — ✅ исправлено 18.03.2026

### 1. Тест-покрытие деградировало при росте кода

**−154 теста** при +24k строк кода. Новые major features (kanban, decisions,
today-briefing, telegram) без единого тест-файла. Риск: при такой динамике
coverage threshold упадёт ниже 20% branches.

### 2. 312 ESLint предупреждений — технический долг

Sonarjs/no-duplicate-string, complexity >8, unused vars. Не блокируют сборку,
но снижают полезность линтера.

### 3. `framer-motion` + `motion` — дубль в prod-зависимостях (не исправлено)

---

## Структура features (22.05.2026)

| Feature        | api | ui  | model | hooks | tests | index | Изменение     |
| -------------- | --- | --- | ----- | ----- | ----- | ----- | ------------- |
| agents         | ✓   | ✓   | ✓     | ✓     | 3     | ✓     | 🆕 новый      |
| auth           | ✓   | ✓   | ✓     | ✗     | 6     | ✓     | −12 тестов    |
| calendar       | ✓   | ✓   | ✗     | ✗     | 16    | ✓     | +5 тестов     |
| chat           | ✓   | ✓   | ✓     | ✓     | 14    | ✓     | −7 тестов     |
| decisions      | ✓   | ✓   | ✓     | ✗     | 0     | ✓     | 🆕 новый      |
| event          | ✓   | ✓   | ✓     | ✗     | 4     | ✓     | —             |
| issues         | ✓   | ✓   | ✓     | ✓     | 5     | ✓     | 🆕 новый      |
| kanban         | ✓   | ✓   | ✓     | ✓     | 0     | ✓     | 🆕 без тестов |
| landing        | ✗   | ✓   | ✓     | ✗     | 4     | ✓     | —             |
| meeting        | ✗   | ✓   | ✓     | ✗     | 1     | ✓     | —             |
| meetings       | ✓   | ✓   | ✓     | ✗     | 4     | ✓     | переименован  |
| menu           | ✗   | ✓   | ✓     | ✗     | 3     | ✓     | —             |
| onboarding     | ✓   | ✓   | ✓     | ✓     | 2     | ✓     | 🆕 новый      |
| organization   | ✓   | ✓   | ✓     | ✗     | 8     | ✓     | −2 тестов     |
| participants   | ✓   | ✓   | ✓     | ✗     | 5     | ✓     | —             |
| summary        | ✓   | ✓   | ✓     | ✗     | 6     | ✓     | —             |
| teams          | ✓   | ✓   | ✓     | ✗     | 4     | ✓     | −10 тестов    |
| telegram       | ✓   | ✓   | ✓     | ✗     | 0     | ✓     | 🆕 без тестов |
| today-briefing | ✓   | ✓   | ✓     | ✗     | 0     | ✓     | 🆕 без тестов |
| transcript     | ✓   | ✓   | ✓     | ✗     | 6     | ✓     | —             |
| user-profile   | ✓   | ✓   | ✓     | ✓     | 3     | ✓     | —             |
| user           | ✓   | ✓   | ✓     | ✗     | 5     | ✓     | —             |

_Удалены: `analysis`, `dashboard` (переименован в `today-briefing`), `demo`,
`follow-up` (вошёл в meetings), `participants` — существует, но переименован._

---

## Структура entities (22.05.2026)

| Entity       | model | ui  | Описание                              |
| ------------ | ----- | --- | ------------------------------------- |
| artifact     | ✓     | ✓   | 8 типов артефактов с рендерерами      |
| event        | ✓     | ✓   | Доменные типы событий                 |
| issue        | ✓     | ✓   | Issue/Epic типы                       |
| organization | ✓     | ✓   | Организация                           |
| participant  | ✓     | ✓   | Участник встречи                      |
| source       | ✓     | ✓   | Источники (calendar sources)          |
| team         | ✓     | ✓   | Команда                               |
| telegram     | ✓     | ✗   | Telegram integration types            |
| user         | ✓     | ✓   | Пользователь                          |

---

## Итоговая оценка

| Категория    | 13.03.2026                         | 18.03.2026                                | 22.05.2026                                    |
| ------------ | ---------------------------------- | ----------------------------------------- | --------------------------------------------- |
| Архитектура  | ⭐⭐⭐⭐⭐                         | ⭐⭐⭐⭐⭐                                | ⭐⭐⭐⭐⭐ (22 features, выдержано FSD)        |
| Типизация    | ⭐⭐⭐⭐½ (тесты отстают)          | ⭐⭐⭐⭐½ (38 ошибок в тестах)            | ⭐⭐⭐⭐½ (9 ошибок, prod чист)               |
| Тестирование | ⭐⭐⭐⭐ (unit отлично, E2E слабо) | ⭐⭐⭐⭐½ (unit +136, E2E ×5)             | ⭐⭐⭐½ (−154 тестов при +60% кода)           |
| Code Quality | ⭐⭐⭐⭐                           | ⭐⭐⭐⭐                                  | ⭐⭐⭐⭐ (0 any, 0 TODO, но 312 lint warns)    |
| DevOps/CI    | ⭐⭐⭐ (lint сломан)               | ⭐⭐⭐½ (pipeline, lint всё ещё сломан)   | ⭐⭐⭐⭐ (lint работает, pipeline, 4 ошибки)  |
| Security     | ⭐⭐⭐ (TLS, headers хорошие)      | ⭐⭐⭐⭐ (TLS починен)                    | ⭐⭐⭐⭐ (без изменений)                      |
| **Общая**    | **⭐⭐⭐⭐ из 5**                  | **⭐⭐⭐⭐½ из 5**                        | **⭐⭐⭐⭐½ из 5**                            |

**Резюме (22.05.2026):** За 65 дней — масштабный рост: +252 файла, +24k LOC,
+3 features, +553 коммита. Архитектура выдержала масштабирование. TS-ошибки
снизились с 38 до 9. Lint починен. Главный регресс — тест-покрытие: −154
теста при росте кодовой базы на 60%. 4 новых features без тестов. Ключевая
задача следующего цикла: вернуть тесты для kanban, decisions, today-briefing,
telegram и покрыть новые API actions.
