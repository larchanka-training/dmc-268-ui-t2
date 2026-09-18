# Frontend Architecture — DMC-268 UI (Team 2)

Документ описывает архитектуру фронтенд-приложения для сервиса автоматизированного код-ревью. Приложение — веб-клиент, который отображает Merge Request, диффы с подсветкой изменений, треды комментариев ревьюера (в т.ч. AI-агента) и позволяет разворачивать дополнительный контекст вокруг изменений.

---

## 1. Архитектурный подход: Feature-Sliced Design (FSD)

### Почему FSD, а не Clean Architecture

| Критерий | Clean Architecture | Feature-Sliced Design |
| --- | --- | --- |
| Единица декомпозиции | технический слой (use case, entity, gateway) | предметная фича/сущность продукта |
| Ориентация | серверные и доменно-тяжёлые приложения | UI-приложения на React/Vue |
| Изоляция | через интерфейсы и DI-контейнеры | через публичный API слайса (`index.ts`) и правило импортов «сверху вниз» |
| Порог входа для React-команды | выше (нужно проектировать абстракции над UI) | ниже (готовая конвенция именно для компонентных фреймворков) |

Наше приложение — это прежде всего UI над двумя доменами (diff/review и comments), без сложной бизнес-логики на клиенте (вся аналитика — на бэкенде/AI Gateway). Здесь важнее предсказуемая навигация по коду и явные границы фич, чем абстрагирование от фреймворка. Поэтому выбран **FSD**.

### Слои и правило зависимостей

Зависимости идут строго сверху вниз: слой может импортировать только из слоёв **ниже** себя. Горизонтальные импорты между слайсами одного слоя запрещены (взаимодействие — через слой выше).

```
┌─────────────────────────────────────────────────────────────┐
│ app        — инициализация: провайдеры, роутинг, глобальные  │
│              стили, композиция корня приложения               │
├─────────────────────────────────────────────────────────────┤
│ pages      — страницы-маршруты (например, страница ревью MR) │
├─────────────────────────────────────────────────────────────┤
│ widgets    — самостоятельные композиционные блоки UI          │
│              (DiffViewer, MRHeader, CommentsPanel)             │
├─────────────────────────────────────────────────────────────┤
│ features   — пользовательские сценарии с побочным эффектом    │
│              (add-review-comment, expand-diff-context,        │
│               resolve-thread, request-duo-review)              │
├─────────────────────────────────────────────────────────────┤
│ entities   — бизнес-сущности предметной области: модели,      │
│              их API-хуки и минимальное UI-представление       │
│              (diff, comment, merge-request, review-status)     │
├─────────────────────────────────────────────────────────────┤
│ shared     — переиспользуемый код без знания о домене:        │
│              UI-кит, утилиты, конфигурация API-клиента        │
└─────────────────────────────────────────────────────────────┘
```

Каждый слайс (например, `entities/diff`) экспортирует наружу только то, что положено в его `index.ts` — остальные модули считаются деталями реализации и не импортируются напрямую из других слайсов.

### Дерево каталогов

```
src/
├─ main.tsx                     # bootstrap, вне слоёв FSD
├─ app/
│  ├─ App.tsx                   # корневая композиция + провайдеры
│  ├─ providers/
│  │  └─ QueryProvider.tsx      # QueryClientProvider (TanStack Query)
│  └─ styles/
│     └─ globals.css            # Tailwind directives + CSS-переменные темы
│
├─ pages/
│  └─ review/
│     ├─ ui/ReviewPage.tsx      # страница ревью конкретного MR
│     └─ index.ts
│
├─ widgets/
│  └─ diff-viewer/
│     ├─ ui/DiffViewer.tsx      # диф файла целиком: шапка + хунки
│     ├─ ui/DiffHunkView.tsx    # один хунк + кнопки разворота контекста
│     ├─ ui/DiffLineRow.tsx     # одна строка диффа
│     └─ index.ts
│
├─ features/
│  ├─ expand-diff-context/
│  │  ├─ model/store.ts         # Zustand: какие диапазоны контекста развёрнуты
│  │  └─ index.ts
│  └─ add-review-comment/
│     ├─ model/store.ts         # Zustand: черновик комментария (файл/строка/текст)
│     ├─ ui/CommentComposer.tsx
│     └─ index.ts
│
├─ entities/
│  ├─ diff/
│  │  ├─ model/types.ts         # DiffFile, DiffHunk, DiffLine, LineType
│  │  ├─ api/queries.ts         # useDiffQuery (TanStack Query)
│  │  ├─ api/mock-data.ts       # мок-данные для разработки без бэкенда
│  │  └─ index.ts
│  └─ comment/
│     ├─ model/types.ts         # Comment, CommentThread, CommentAuthor
│     ├─ ui/CommentThread.tsx   # рендер ветки обсуждения на строке
│     └─ index.ts
│
└─ shared/
   ├─ ui/                       # примитивы в конвенции shadcn/ui:
   │  ├─ button.tsx             # копируются в проект, не тянутся из node_modules
   │  ├─ badge.tsx               # как «чёрный ящик» — полный контроль над кодом
   │  ├─ avatar.tsx
   │  ├─ separator.tsx
   │  ├─ scroll-area.tsx
   │  └─ textarea.tsx
   ├─ lib/
   │  └─ cn.ts                  # clsx + tailwind-merge
   └─ config/
      └─ query-client.ts        # настройки QueryClient (staleTime, retry policy)
```

---

## 2. Выбор библиотек

### 2.1 Состояние: Zustand + TanStack Query (гибридная модель)

Состояние приложения делится на два принципиально разных типа, и для каждого используется своя библиотека — смешивать их в одном сторе не нужно:

| Тип состояния | Инструмент | Примеры |
| --- | --- | --- |
| **Серверное состояние** (данные, которые пришли с бэкенда/AI Gateway, могут устареть, требуют кэша и рефетча) | **TanStack Query** | список файлов диффа, содержимое диффа, треды комментариев, статус ревью (`pending/in_progress/completed`) |
| **Клиентское UI-состояние** (существует только в браузере, не персистентно на бэкенде) | **Zustand** | какие диапазоны контекста развёрнуты, какая строка выбрана для нового комментария, текст черновика комментария, свёрнутые/развёрнутые файлы |

Почему не смешивать в одном сторе:
- TanStack Query берёт на себя кэширование, дедупликацию запросов, инвалидацию по `queryKey`, retry и фоновый рефетч — переизобретать это в Zustand-сторе избыточно.
- Zustand не тянет за собой концепцию «устаревания» данных — она не нужна для чисто клиентских флагов UI, и его api (`create`, селекторы) значительно легче boilerplate’а Redux.

### 2.2 UI-кит: TailwindCSS + shadcn/ui-примитивы

Выбор в пользу **TailwindCSS + компоненты в конвенции shadcn/ui** (а не Ant Design целиком):

- **Diff-viewer — нестандартный UI.** Строки диффа, gutter с номерами строк, inline-треды комментариев, подсветка `+/-/context` — это верстка, которую в Ant Design пришлось бы «пробивать» через переопределение чужих CSS-классов. shadcn/ui-подход — компоненты копируются в `shared/ui` как исходный код (обёртки над Radix UI + `class-variance-authority`), поэтому их можно свободно модифицировать под нужды diff-viewer, не воюя с чужой темой.
- **Radix UI** даёт доступность (focus management, ARIA) для интерактивных примитивов (Avatar, ScrollArea, Separator) бесплатно, без необходимости писать её вручную.
- **Tailwind** — семантические цвета вынесены в CSS-переменные (`--diff-add-bg`, `--diff-del-bg`, `--diff-context-bg` и т.д.), что упрощает поддержку тёмной темы и переиспользование палитры между обычным UI и diff-специфичными элементами.
- Готовый большой UI-кит (Ant Design) остаётся кандидатом для будущих административных экранов (настройки проекта, списки MR), если потребуется скорость разработки в ущерб кастомизации — архитектура это не блокирует, т.к. `shared/ui` — заменяемый слой.

---

## 3. Мок состояния приложения

### 3.1 Домены данных (`entities`)

```ts
// entities/diff/model/types.ts
type LineType = 'added' | 'removed' | 'context' | 'hidden'

interface DiffLine {
  id: string
  type: LineType
  oldLineNumber: number | null   // null для added-строк
  newLineNumber: number | null   // null для removed-строк
  content: string
}

interface DiffHunk {
  id: string
  header: string                 // "@@ -12,7 +12,9 @@"
  lines: DiffLine[]
  contextBefore: { startLine: number; lineCount: number } | null
  contextAfter: { startLine: number; lineCount: number } | null
}

interface DiffFile {
  id: string
  filePath: string
  language: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

// entities/comment/model/types.ts
interface CommentAuthor {
  id: string
  displayName: string
  avatarUrl?: string
  isAiAgent: boolean             // true для GitLab Duo / нашего агента
}

interface Comment {
  id: string
  author: CommentAuthor
  body: string
  createdAt: string              // ISO
}

interface CommentThread {
  id: string
  filePath: string
  anchorLine: { side: 'old' | 'new'; lineNumber: number }
  status: 'open' | 'resolved'
  comments: Comment[]
}
```

### 3.2 Серверное состояние — кэш TanStack Query

```ts
// Ключи запросов (entities/diff/api/queries.ts, entities/comment/api/queries.ts)
['merge-request', mrId]                       -> MergeRequestSummary
['merge-request', mrId, 'diff']               -> DiffFile[]
['merge-request', mrId, 'diff', filePath, 'context', { startLine, lineCount }]
                                               -> DiffLine[]   (довозка контекста)
['merge-request', mrId, 'comments']           -> CommentThread[]
```

На этапе разработки `entities/diff/api/queries.ts` использует `entities/diff/api/mock-data.ts` в качестве `queryFn` (искусственная задержка `setTimeout`, чтобы сразу проверять `isLoading`/`isError`-состояния UI). Смена на реальный HTTP-клиент — это замена одной функции `queryFn`, компоненты не меняются.

### 3.3 Клиентское UI-состояние — Zustand-сторы

```ts
// features/expand-diff-context/model/store.ts
interface ExpandedContextState {
  // ключ: `${filePath}:${hunkId}:before` | `${filePath}:${hunkId}:after`
  expandedRanges: Record<string, boolean>
  expandContext: (key: string) => void
}

// features/add-review-comment/model/store.ts
interface DraftCommentState {
  draft: {
    filePath: string
    side: 'old' | 'new'
    lineNumber: number
    text: string
  } | null
  openComposer: (target: Omit<DraftCommentState['draft'], 'text'>) => void
  updateDraftText: (text: string) => void
  closeComposer: () => void
}
```

Пример снимка состояния приложения (для сторибука/тестов):

```json
{
  "expandDiffContext": {
    "expandedRanges": {
      "src/api/user.ts:hunk-1:before": true
    }
  },
  "addReviewComment": {
    "draft": {
      "filePath": "src/api/user.ts",
      "side": "new",
      "lineNumber": 42,
      "text": "Стоит обработать случай, когда withMeta === undefined"
    }
  },
  "queryCache": {
    "['merge-request','123','diff']": "DiffFile[] — 3 файла, статус success",
    "['merge-request','123','comments']": "CommentThread[] — 2 треда, статус success"
  }
}
```

---

## 4. Базовые UI-компоненты diff-viewer (контракты)

Ключевая идея: **diff + локальный контекст + возможность его раскрытия**, а не «голый» unified diff — это снижает вероятность того, что ревьюер (человек или AI-агент) упустит важные изменения из-за отсутствия окружения вокруг хунка.

| Компонент | Слой | Назначение |
| --- | --- | --- |
| `DiffViewer` | `widgets/diff-viewer` | Один файл целиком: шапка (путь, язык, `+N -M`, статус), список `DiffHunkView` |
| `DiffHunkView` | `widgets/diff-viewer` | Один хунк: заголовок `@@ ... @@`, строки, кнопки «Показать ещё N строк» до/после хунка |
| `DiffLineRow` | `widgets/diff-viewer` | Одна строка: номера строк (old/new), маркер `+/-/` , моноширинный контент с фоном по типу строки, gutter-кнопка «добавить комментарий» |
| `CommentThread` | `entities/comment` | Ветка обсуждения под конкретной строкой: аватар, автор (с бейджем AI-агента), тело, статус `resolved` |
| `CommentComposer` | `features/add-review-comment` | Поле ввода нового комментария/ответа в треде |

Props-контракт верхнеуровневого компонента:

```ts
interface DiffViewerProps {
  file: DiffFile
  threadsByLine: Record<string, CommentThread[]>  // ключ: `${side}:${lineNumber}`
  onExpandContext: (hunkId: string, direction: 'before' | 'after') => void
  onStartComment: (side: 'old' | 'new', lineNumber: number) => void
}
```

---

## 5. Статус выполнения

**Готово:**
- Установлены зависимости: `zustand`, `@tanstack/react-query`, `tailwindcss` (+ `postcss`/`autoprefixer`), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, Radix-примитивы (`avatar`, `separator`, `scroll-area`, `slot`).
- Настроен алиас `@/*` → `src/*` (`tsconfig.json`, `vite.config.ts`).
- Настроен `tailwind.config.js` с семантическими цветами, в т.ч. diff-специфичными (`diff-add-bg`, `diff-del-bg`, `diff-context-bg`, `diff-gutter-bg`).
- CSS-переменные темы (светлая/тёмная, включая `prefers-color-scheme` и ручной `data-theme`) в `app/styles/globals.css`.
- `shared/ui`: `button`, `badge`, `avatar`, `separator`, `scroll-area`, `textarea`, утилита `cn`.
- `shared/config/query-client.ts` + `app/providers/QueryProvider.tsx`.
- `entities/diff`: типы (`DiffFile/DiffHunk/DiffLine`), мок-данные, `useDiffQuery`/`useDiffContextQuery`.
- `entities/comment`: типы (`Comment/CommentThread`), мок-данные, `useCommentThreadsQuery`, компонент `CommentThread`.
- `features/expand-diff-context`: Zustand-стор развёрнутых диапазонов контекста.
- `features/add-review-comment`: Zustand-стор черновика комментария + `CommentComposer`.
- `widgets/diff-viewer`: `DiffLineRow` (строка с номерами/маркером/gutter-кнопкой комментария), `DiffHunkView` (хунк + разворот контекста через `useDiffContextQuery`), `DiffViewer` (файл целиком, привязка к сторам).
- `pages/review/ReviewPage` на моках, подключена в `app/App.tsx` → `src/main.tsx`.
- Проверено: `tsc --noEmit` и `vite build` проходят без ошибок; все созданные модули успешно транспилируются dev-сервером Vite (HTTP 200 на каждый файл).

**Известные ограничения / дальше:**
- Подсветка синтаксиса самого кода не реализована — строки диффа выводятся как plain text с фоном по типу строки (add/del/context); есть только «diff-подсветка», не token-level syntax highlighting.
- `CommentComposer` не имеет реальной мутации — отправка комментария только закрывает композер, без добавления в `entities/comment`.
- Визуальная проверка в браузере не проводилась (нет инструмента для рендера/скриншота в этой сессии) — корректность вёрстки стоит проверить вручную через `npm run dev`.
