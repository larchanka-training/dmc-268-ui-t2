# **TEST\_PLAN: AI Code Reviewer**

## **1\. Введение и цели (Overview & Objectives)**

> * **Цель документа:** Определение комплексной стратегии, уровней тестирования, архитектуры тестового окружения и критериев приемки для сервиса автоматического код-ревью на базе LLM.  
> * **Объект тестирования:**
>   * **Backend:** сервис AI-ревьюера (парсеры git diff, сборщик контекста проекта, генератор промптов, интеграция с LLM API, обработка вебхуков платформ GitLab/GitHub).  
>   * **Frontend:** веб-клиент ревью (`dmc-268-ui-t2`, Vite + React + TypeScript, FSD): страница ревью MR, diff-viewer с разворотом контекста, треды комментариев (в т.ч. AI-агента), композер комментария, API-клиент и состояние (TanStack Query + Zustand). Архитектура — [`FRONTEND_ARCHITECTURE.md`](./FRONTEND_ARCHITECTURE.md).  
> * **Ключевой фокус:** Минимизация раздражающего шума для разработчиков (высокий Precision), надежное выявление критических дефектов и уязвимостей (Recall), устойчивость к галлюцинациям, а также корректное и доступное отображение результатов ревью в UI.

## **2\. Область тестирования (Scope)**

**In-Scope:**

> * **Детерминированная логика (backend):** парсинг diff/patch, фильтрация файлов по маскам, расчет токенов, валидация входящих и исходящих JSON-схем.  
> * **Интеграции (backend):** обработка событий webhook (Merge Request Hook), публикация inline-комментариев и общего резюме через Git API, сохранение логов и кэширование.  
> * **Frontend:** рендер diff (строки, номера, маркеры, якоря комментариев), разворот контекста, треды и черновики комментариев, состояния загрузки/ошибки/пустых данных, контракт UI ↔ API, доступность (a11y), светлая/тёмная тема, производительность рендера больших diff, размер бандла.  
> * **Статический анализ (оба контура):** typecheck, lint, форматирование, соблюдение FSD-границ импортов.  
> * **Оценка качества LLM (LLM Evaluation):** корректность логических замечаний, стиль и синтаксис, проверка на галлюцинации и применимость рекомендаций.  
> * **Нефункциональные требования:** P95 задержки анализа, устойчивость к сбоям внешнего API (429/500), обработка больших diff.

**Out-of-Scope:**

> * Дообучение (fine-tuning) или тестирование внутренних весов базовой модели вендора.  
> * Нагрузочное тестирование самого инстанса GitLab/GitHub.  
> * Тестирование внутренностей сторонних UI-библиотек (Radix UI, TanStack Query, Zustand) — тестируется только наше использование их публичного API.  
> * Token-level подсветка синтаксиса в diff-viewer (не реализована, см. FRONTEND\_ARCHITECTURE §5).

## **3\. Уровни тестирования (Testing Pyramid)**

### **3.1. Unit Testing**

> * **Объекты (backend):** парсер git diff и git patch, фильтры игнорируемых файлов (lock-файлы, бинарники), валидация структуры ответа от LLM по JSON-схеме, калькулятор размера контекстного окна.  
> * **Объекты (frontend):** чистые функции (`getLineAnchor`, `contextRangeKey`, `cn`), Zustand-сторы (`add-review-comment`, `expand-diff-context`), формирование `queryKey`. Подробно — §3.5.  
> * **Инструменты:** Pytest (backend) / Vitest (frontend).  
> * **Изоляция:** 100% внешних сетевых вызовов (Git API, LLM API, HTTP к backend из UI) строго мокируются.

### **3.2. Integration Testing**

> * **Объекты (backend):** прием и валидация webhooks от Git-платформы, авторизация бота и права на постинг комментариев, взаимодействие с базой данных (кэширование контекста), логика ретраев (exponential backoff) при сбоях LLM API.  
> * **Объекты (frontend):** контракт UI ↔ API (проекции diff / coverage / findings / comments из `GET /reviews/{id}`), retry-политика `query-client.ts`, инвалидация кэша по `queryKey`. Подробно — §3.5.  
> * **Инструменты:** Testcontainers, WireMock / VCR.py (backend); MSW + валидация фикстур по OpenAPI/JSON Schema бэкенда (frontend).

### **3.3. End-to-End (E2E) Testing**

> * **Объекты (backend pipeline):** сквозной пайплайн: создание тестового MR → отправка Webhook → вызов AI-сервиса → сборка контекста → публикация inline-комментариев и резолюции в ветку MR.  
> * **Объекты (frontend):** пользовательский сценарий в браузере: открыть ReviewPage → развернуть контекст хунка → начать комментарий на строке → ввести текст → отправить/отменить. Подробно — §3.5.  
> * **Инструменты:** изолированный тестовый репозиторий, Git API SDK (backend); Playwright (frontend).

### **3.4. LLM Evaluation (Бенчмарк качества)**

> * **Объекты:** системные промпты, Few-Shot примеры, ранжирование критичности замечаний, проверка на галлюцинации.  
> * **Инструменты:** кастомный бенчмарк-раннер на Pytest / DeepEval / Promptfoo.

### **3.5. Frontend Testing (пирамида UI)**

Фронтенд — `dmc-268-ui-t2`. Тест-раннер на момент написания не установлен; его добавление отслеживается в [`follow-ups/add-vitest-hard-tdd-gate.md`](./follow-ups/add-vitest-hard-tdd-gate.md). До появления раннера действует «soft TDD» из `AGENTS.md`; после — обязательный red → green по процедуре `.agents/skills/tdd/SKILL.md`.

| Уровень | Что тестируем | Инструменты | Контур CI |
| :---- | :---- | :---- | :---- |
| **Static** | типы, lint, формат, FSD-границы импортов («только вниз по слоям», без горизонтальных импортов между слайсами) | `tsc --noEmit`, `eslint --max-warnings 0`, `prettier --check`, `stylelint`, `steiger` или `eslint-plugin-boundaries` | PR |
| **Unit** | `getLineAnchor`, `contextRangeKey`, `cn`; сторы: `openComposer` / `updateDraftText` / `closeComposer` (в т.ч. `updateDraftText` при `draft === null` — no-op), `expandContext` / `isExpanded`; состав `queryKey` | Vitest | PR |
| **Component** | `DiffLineRow`, `DiffHunkView`, `DiffViewer`, `CommentThread`, `CommentComposer`, `ReviewPage`: рендер, интеракции, состояния loading / error / empty | Vitest + React Testing Library + `@testing-library/user-event`, jsdom или happy-dom. Обёртка: `QueryClientProvider` с `retry: false`; сброс Zustand-сторов в `beforeEach` | PR |
| **Integration (API boundary)** | контракт UI ↔ API, retry-политика, инвалидация кэша, обработка 4xx/5xx | MSW; фикстуры валидируются по OpenAPI/JSON Schema бэкенда | PR |
| **E2E** | сквозной сценарий ReviewPage (см. §3.3) | Playwright. Smoke (3–5 сценариев) на замоканном API — в PR; полный набор против staging — nightly | PR (smoke) / Nightly |
| **Accessibility** | `aria-label` кнопок gutter, фокус и клавиатурная навигация, контраст diff-цветов в обеих темах | `vitest-axe` (component), `@axe-core/playwright` (E2E) | PR |
| **Visual regression** *(кандидат)* | diff-viewer как наиболее «хрупкая» вёрстка | Playwright screenshots или Storybook + Chromatic | Nightly |
| **Performance** | рендер diff \> 2500 строк, бюджет размера бандла | Playwright `performance.measure`; `size-limit` | PR (bundle) / Nightly (render) |

**Правила для UI-тестов:**

> * Тестировать через публичный API слайса (`index.ts`) и наблюдаемое поведение (DOM, роли, тексты), а не внутренние модули и детали реализации — см. `.agents/skills/tdd/tests-ui-typescript.md`.  
> * Мок-данные `entities/*/api/mock-data.ts` — единый источник фикстур для unit / component / MSW / Storybook; расхождение фикстур с реальной схемой API ловится контрактным тестом.  
> * Не мокировать TanStack Query и Zustand — мокируется только сетевая граница (MSW / `queryFn`).  
> * Один тест — одно поведение; ожидаемые значения — независимые литералы, не пересчёт формулой из кода.

## **4\. Методология оценки LLM (LLM Evaluation Framework)**

### **4.1. Градация критичности (Severity Levels)**

> * **CRITICAL / HIGH:** ошибки компиляции/рантайма, уязвимости безопасности (SQLi, XSS, утечки памяти/секретов), порча данных, race conditions.  
> * **MEDIUM:** архитектурные антипаттерны, неоптимальные алгоритмы (N+1, неэффективные структуры данных).  
> * **LOW / INFO (Syntax & Style):** нарушения Style Guide (PEP8, camelCase/snake\_case), опечатки в публичных API/docstring, неиспользуемые импорты и мертвый код. Требуют конкретных inline-предложений.

### **4.2. Формулы метрик качества**

> * **Precision (Точность):** TP / (TP \+ FP) — доля реальных дефектов среди всех созданных комментариев.  
> * **Recall (Полнота):** TP / (TP \+ FN) — доля найденных багов от эталонного набора.  
> * **Hallucination Rate:** (Кол-во комментариев с вымышленными методами/синтаксисом / Всего комментариев) \* 100%.  
> * **Fix Actionability Rate:** (Кол-во замечаний по стилю с готовым валидным diff-предложением / Всего замечаний по стилю) \* 100%.

### **4.3. Автоматическая оценка (LLM-as-a-Judge)**

| Критерий | Тип шкалы | Описание |
| :---- | :---- | :---- |
| **Classification** | Enum (TP, FP, DUPLICATE) | TP — совпадает по смыслу с Ground Truth; FP — ложная придирка к корректному коду; DUPLICATE — повтор мысли. |
| **Groundedness** | Binary (PASS / FAIL) | PASS — замечание строго опирается на diff и код проекта; FAIL — галлюцинация. |
| **Actionability** | Score 1–3 | 1 — общие фразы; 2 — описана проблема, но нет решения; 3 — готовый валидный diff для фикса в 1 клик. |
| **Tone** | Binary (PASS / FAIL) | PASS — конструктивный технический тон; FAIL — токсичность или пустая вода. |

## **5\. Тестовые данные и Golden Dataset**

### **5.1. Backend: Golden Dataset для LLM Evaluation**

Набор тестовых сценариев версионируется в репозитории (tests/golden\_dataset/) в виде связки diff.patch \+ spec.yaml (Ground Truth).

| ID | Категория | Название сценария | Описание дефекта | Severity | Ожидание |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **TC-CLN-01** | Clean MR | Обычный рефакторинг | Чистый код по стандартам, покрытие тестами | — | FP \= 0, Status: APPROVE |
| **TC-CLN-02** | Clean MR | Сложная бизнес-логика | Нетривиальный, но полностью корректный алгоритм | — | FP \= 0, без ложных придирок |
| **TC-STY-01** | Syntax & Style | Нарушение кодстайла | Смешение camelCase и snake\_case в именах функций | LOW | Style Recall, Actionable Diff |
| **TC-STY-02** | Syntax & Style | Неиспользуемые сущности | Забытый import os, объявленная неиспользуемая переменная | LOW | Style Recall, FP \= 0 |
| **TC-STY-03** | Syntax & Style | Опечатка в API / Doc | Опечатка в ключе Swagger-схемы / docstring | INFO | Style Recall |
| **TC-SEC-01** | Security | SQL Injection | Прямая конкатенация пользовательского ввода в SQL | CRITICAL | Recall ≥ 90%, BLOCK |
| **TC-SEC-02** | Security | Утечка секретов | Хардкод приватного API-токена в коде | CRITICAL | Recall ≥ 95%, BLOCK |
| **TC-SEC-03** | Security | Path Traversal / XSS | Чтение файла по пути от пользователя без валидации | HIGH | Recall ≥ 85% |
| **TC-LOG-01** | Logic & Bugs | Off-by-one ошибка | Выход за границы массива в цикле | HIGH | Logic Recall |
| **TC-LOG-02** | Logic & Bugs | Race Condition | Мутация разделяемого состояния без блокировки | HIGH | Logic Recall |
| **TC-LOG-03** | Logic & Bugs | Утечка ресурсов | Открытие соединения без блока try...finally или with | MEDIUM | Logic Recall |
| **TC-LOG-04** | Logic & Bugs | Null Pointer / NoneType | Обращение к атрибуту без проверки на None/null | HIGH | Logic Recall |
| **TC-CTX-01** | Context-Heavy | Поломка контракта | Изменение сигнатуры функции без обновления мест вызова | HIGH | Context Retrieval Acc. |
| **TC-CTX-02** | Context-Heavy | Ложный баг контекста | Вызов метода, объявленного в базовом классе вне diff | — | FP \= 0, нет галлюцинаций |
| **TC-EDG-01** | Edge Case | Большой Diff | MR размером \> 2500 строк | INFO | Корректный чанкинг / лимиты |
| **TC-EDG-02** | Edge Case | Служебные файлы | Правки poetry.lock, package-lock.json, картинки | — | Игнорирование без спама |

### **5.2. Frontend: UI-фикстуры и тест-кейсы**

Фикстуры (`DiffFile[]`, `CommentThread[]`) живут в `src/entities/*/api/mock-data.ts` и переиспользуются всеми уровнями UI-тестов (§3.5). Edge-фикстуры (большой diff, unicode, renamed/бинарный файл) добавляются туда же или в `src/**/__fixtures__/`.

| ID | Категория | Сценарий | Ожидание | Уровень |
| :---- | :---- | :---- | :---- | :---- |
| **TC-FE-DIFF-01** | Diff render | Строки `added` / `removed` / `context` | Верные номера old/new, маркеры `+` / `-` / пробел, фон по типу строки | Component |
| **TC-FE-DIFF-02** | Diff render | Якорь комментария (`getLineAnchor`) | `removed` → `old`; `added` / `context` → `new`; строка без номеров → кнопки «+» нет | Unit + Component |
| **TC-FE-CTX-01** | Expand context | Кнопка «Показать ещё N строк» до/после хунка | Клик → «Загрузка контекста...» → строки; развёрнутый диапазон не сворачивается; ключ `${filePath}:${hunkId}:${direction}` | Component + E2E |
| **TC-FE-CMT-01** | Comment draft | Старт комментария на строке | Композер только на этой строке; ввод обновляет `draft.text`; Cancel → `draft = null`; Submit закрывает композер | Component + E2E |
| **TC-FE-CMT-02** | Comment thread | Автор `isAiAgent: true`, статус `resolved` | Бейдж AI-агента, визуальная индикация resolved, порядок комментариев по `createdAt` | Component |
| **TC-FE-STATE-01** | Page states | `isLoading` / `isError` / пустой diff / пустые треды | Соответствующие состояния без падений; ошибка не роняет соседние виджеты | Component + Integration |
| **TC-FE-API-01** | Contract | Ответ API соответствует схеме `DiffFile` / `CommentThread` | Фикстуры MSW проходят валидацию по OpenAPI/JSON Schema; 5xx → одна повторная попытка (`retry: 1`) → состояние ошибки | Integration |
| **TC-FE-EDG-01** | Edge | Diff \> 2500 строк | Рендер без фриза UI (порог ≤ 1 с на mock-данных); при необходимости — виртуализация | Performance |
| **TC-FE-EDG-02** | Edge | Unicode, табы, CRLF, строки \> 300 символов, `renamed` / бинарный файл | `overflow-x` работает, layout не ломается, бинарник отображается заглушкой | Component |
| **TC-FE-A11Y-01** | A11y | axe на ReviewPage; клавиатурная навигация до кнопки «+» и композера | 0 violations уровня critical/serious; все интерактивные элементы достижимы с клавиатуры | Component + E2E |
| **TC-FE-THEME-01** | Theme | light / dark / `prefers-color-scheme` / `data-theme` | CSS-переменные применяются; контраст diff-фонов и текста ≥ WCAG AA | Component + Visual |

## **6\. Требования к тестовым стендам и окружению**

### **6.1. Архитектура стенда в CI/CD**

> 1. **Статический \+ детерминированный контур (PR / Merge Request Pipeline).** Стадии выполняются fail-fast — дешёвые раньше дорогих:  
>    1. `install` — `pnpm install --frozen-lockfile` (frontend) / зафиксированные зависимости (backend).  
>    2. `static` — lint и typecheck: `eslint . --max-warnings 0`, `tsc --noEmit`, `prettier --check .`, `stylelint "src/**/*.css"`, проверка FSD-границ (frontend); `ruff` / `mypy` (backend). Любое предупреждение линтера — падение стадии.  
>    3. `test` — Unit \+ Integration \+ Component с измерением покрытия; пороги из §7.1 применяются как fail-условие. Вызовы к LLM перехватываются фикстурами через VCR.py/WireMock; HTTP из UI — через MSW.  
>    4. `build` — `vite build` \+ проверка бюджета бандла (`size-limit`).  
>    5. `e2e-smoke` — Playwright, 3–5 сценариев на замоканном API (отдельный job).  
>    Стоимость $0. Бюджет времени: стадии 1–4 — менее 2 минут, `e2e-smoke` — не более 5 минут.  
>    Локально те же проверки: pre-commit (husky \+ lint-staged) запускает `eslint --max-warnings 0 --fix` и `prettier --write` только по staged-файлам; pre-push — `vitest run --changed`. Единая команда для фазы Close — `pnpm validate` (lint → check-types → format:check → test:coverage → build).  
> 2. **LLM Evaluation контур (Nightly / Schedule / Triggered):** запускает прогон по Golden Dataset через реальный API с оценкой моделью-судьей и расчетом метрик.  
> 3. **Frontend Nightly контур:** полный набор Playwright E2E против staging, visual regression, замер производительности рендера большого diff (TC-FE-EDG-01).

### **6.2. Конфигурация генерации LLM (Борьба со стохастичностью)**

> * temperature \= 0.0: режим Greedy Decoding для минимизации креативности и стабильности структуры ответа.  
> * seed \= \<const\> (например, 42 или 999): константный сид устраняет плавающие сбои и обеспечивает воспроизводимость результатов.

### **6.3. Политика по нестабильным тестам (Flaky Tests)**

> * Тест, упавший 2 и более раз без изменений в затрагиваемом коде, помечается как flaky и уходит в карантин (`test.skip` \+ ссылка на issue) в течение одного рабочего дня.  
> * Автоматический retry «до зелёного» в CI запрещён; допускается не более 1 retry только для E2E, и каждый такой retry логируется.  
> * Карантин не дольше 2 недель: тест либо починен, либо удалён с обоснованием.

## **7\. Критерии приемки (Definition of Done & Quality Gates)**

### **7.1. Definition of Done (DoD) для разработки**

> * Документация TEST\_PLAN.md актуализирована, новые тест-кейсы внесены в Golden Dataset (backend) или в таблицу §5.2 (frontend).  
> * Для любого исправленного бага/нового правила добавлен тест-кейс в Golden Dataset; для любого бага UI — регрессионный тест на соответствующем уровне §3.5.  
> * Изменение поведения реализуется по red → green (`.agents/skills/tdd/SKILL.md`); тесты — через публичный API модуля/слайса.  
> * 100% инженерных тестов в CI/CD зеленые; lint и typecheck — 0 ошибок и 0 предупреждений.  
> * В тестах и фикстурах отсутствуют реальные токены и секреты.  
> * Пороги покрытия кода (Code Coverage) соблюдены:

**Frontend** (Vitest \+ `@vitest/coverage-v8`, пороги — в `vitest.config.ts`):

| Область | Lines / Statements | Branches | Functions | Обоснование |
| :---- | :---- | :---- | :---- | :---- |
| **Глобальный порог (gate)** | **≥ 80%** | **≥ 70%** | **≥ 80%** | Базовый уровень; branches ниже, т.к. ветки JSX-условий дороги в покрытии |
| `features/*/model`, `entities/*/model`, `shared/lib` | ≥ 90% | ≥ 85% | ≥ 90% | Чистая логика и сторы — дёшево тестировать, дорого ломать |
| `widgets/*`, `features/*/ui`, `entities/*/ui`, `pages/*` | ≥ 75% | ≥ 65% | ≥ 75% | Покрываются компонентными тестами, часть сценариев — E2E |
| **Исключено из подсчёта** | — | — | — | `shared/ui/**` (копии shadcn/ui), `**/mock-data.ts`, `**/types.ts`, `**/index.ts` (барреллы), `main.tsx`, `App.tsx`, `*.config.*`, `*.d.ts` |

**Backend** (pytest-cov, `--cov-fail-under`):

| Область | Порог (lines) | Обоснование |
| :---- | :---- | :---- |
| Детерминированный код (парсеры, фильтры, JSON-валидация, калькулятор токенов) | ≥ 85% | Основной источник регрессий, полностью тестируется в изоляции |
| Интеграционные адаптеры (Git API, БД, очереди) | ≥ 65–70% | Часть путей достижима только на реальных сервисах |
| LLM-обвязка (промпты, парсинг ответа модели) | исключено из coverage-гейта | Качество измеряется LLM Evaluation (§4), а не покрытием строк |

**Политика покрытия:**

> * **Patch coverage ≥ 80%** на изменённые строки в PR (Codecov / `diff-cover`) — приоритетнее общего процента: новый код не «прячется» за старым покрытием.  
> * **Ratchet:** пороги в конфигурации можно только повышать; понижение — отдельный PR с обоснованием и аппрувом Tech Lead.  
> * 100% не является целью: последние 10–15% — самые дорогие и наименее полезные тесты. Приоритет — поведение, а не строки.  
> * Отчёт покрытия (HTML \+ lcov) публикуется как артефакт CI для каждого прогона.

### **7.2. Quality Gates**

**Инженерные гейты (PR pipeline, оба контура):**

| Метрика | Минимальный порог | Статус | Описание |
| :---- | :---- | :---- | :---- |
| **Lint / Typecheck** | 0 ошибок, 0 предупреждений | **BLOCKER** | `eslint --max-warnings 0`, `tsc --noEmit`, `prettier --check`, `stylelint`, FSD-границы. |
| **Unit / Component / Integration** | 100% pass | **BLOCKER** | Все детерминированные тесты зелёные. |
| **Code Coverage (global)** | ≥ 80% lines (пороги по слоям — §7.1) | **BLOCKER** | Измеряется в стадии `test`. |
| **Code Coverage (patch)** | ≥ 80% изменённых строк | **BLOCKER** | Покрытие нового/изменённого кода в PR. |
| **E2E Smoke (frontend)** | 100% pass | **BLOCKER** | 3–5 сценариев Playwright на замоканном API. |
| **Accessibility (axe)** | 0 violations critical/serious | **MAJOR** | ReviewPage и компоненты diff-viewer. |
| **Bundle Size** | ≤ 250 KB gzip (initial chunk) | **MAJOR** | Бюджет пересматривается при добавлении крупных зависимостей. |
| **Render Performance** | ≤ 1 с на diff 2500 строк (TC-FE-EDG-01) | **MAJOR** | Nightly-контур. |

**Гейты качества LLM (Nightly / Triggered):**

| Метрика | Минимальный порог | Статус | Описание |
| :---- | :---- | :---- | :---- |
| **Total Precision** | ≥ 85% | **BLOCKER** | Доля корректных замечаний (не более 15% шума). |
| **Critical Recall** | ≥ 75% | **BLOCKER** | Полнота нахождения уязвимостей и критических багов. |
| **Hallucination Rate** | \< 3% | **BLOCKER** | Доля замечаний с выдуманным кодом/методами. |
| **JSON Schema Compliance** | 100% | **BLOCKER** | Строгое соблюдение контракта ответа. |
| **Style Recall** | ≥ 80% | **MAJOR** | Полнота нахождения опечаток и нарушений code style. |
| **Style Actionability** | ≥ 90% | **MAJOR** | Процент style-замечаний с валидным diff-предложением в 1 клик. |
| **P95 Latency** | ≤ 60 сек | **MAJOR** | Время анализа MR (до 300 строк diff)*. |


***Обоснование калибровки метрики P95 Latency ($\le 60$ сек на 300 строк diff)**:
> * **Размер выборки 300 строк diff:** взят как отраслевой ориентир оптимального атомарного фиче-MR (Google Engineering Practices). С точки зрения архитектуры LLM, 300 строк diff вместе с системным промптом и связанным кодом проекта укладываются в окно 4 000 – 8 000 токенов. Это позволяет отправить запрос в модель целиком без сложной фрагментации (чанкинга) и исключает потерю фокуса внимания LLM («Lost in the Middle»).
> * **Порог 60 секунд:** ориентирован на сохранение непрерывного цикла разработки (DevEx). AI-ревьюер успевает опубликовать замечания параллельно с прогоном базового CI (линтеры, компиляция, unit-тесты), пока автор еще держит контекст внесенных изменений. Лимит в 60 с (вместо 45 с) дает достаточный запас на сетевой оверхед, очереди на стороне API вендора и как минимум один автоматический ретрай при транзиентной ошибке (429/500).



### **7.3. Политика действий при нарушении Quality Gates (Go / No-Go Decision)**

```text
[PR Pipeline: static → test → build → e2e-smoke]
         │
         ├── Все инженерные гейты зелёные ─────────► Merge разрешён
         │
         ├── Нарушен BLOCKER (Lint / Typecheck / Tests / Coverage / E2E smoke)
         │       │
         │       └──► [NO-GO] Merge заблокирован до исправления в том же PR.
         │
         └── Нарушен MAJOR (A11y / Bundle Size / Render Perf)
                 │
                 └──► [CONDITIONAL PASS] Ручной аппрув Tech Lead + issue на исправление.

[Прогон LLM Benchmark]
         │
         ├── Все метрики выше порогов ───────────► [GO] Релиз разрешен
         │
         ├── Нарушен BLOCKER (Precision / Recall / Hallucinations / Schema)
         │       │
         │       └──► [NO-GO] Автоматическая блокировка пайплайна.
         │            Откат промпта / фиксация регрессии в issue.
         │
         └── Нарушен MAJOR (Latency / Style Actionability)
                 │
                 └──► [CONDITIONAL PASS] Требуется ручной аппрув Lead QA / Tech Lead.
```

## **8\. Связанные документы**

> * [`FRONTEND_ARCHITECTURE.md`](./FRONTEND_ARCHITECTURE.md) — слои FSD, контракты компонентов, мок состояния.  
> * [`SYSTEM_DESIGN_RU.md`](./SYSTEM_DESIGN_RU.md) — контракты API (`/reviews/{id}`, `ContextPayload`, coverage), используемые в контрактных тестах UI.  
> * [`follow-ups/add-vitest-hard-tdd-gate.md`](./follow-ups/add-vitest-hard-tdd-gate.md) — внедрение Vitest и переход на жёсткий TDD-гейт для UI.  
> * `.agents/skills/tdd/` — процедура red → green и примеры тестов для UI/TypeScript и Python/FastAPI.  
> * `AGENTS.md` — фазы работы агентов (Align / Execute / Close) и quality-команды.
