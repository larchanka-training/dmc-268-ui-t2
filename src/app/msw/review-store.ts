import type { PublicationStatus, ReviewStatus } from '@/entities/review'

/**
 * Dev-only review scenarios. Each review's clock starts on its first request, so a page
 * reload replays the run: context → LLM chunks → publication.
 *
 * - `demo-review`: happy path over SSE.
 * - `demo-review-failed`: fails during LLM analysis.
 * - `demo-review-polling`: SSE answers 503, so the UI falls back to polling.
 */
export const MSW_REVIEW_IDS = ['demo-review', 'demo-review-failed', 'demo-review-polling'] as const

interface Step {
  atMs: number
  status: ReviewStatus
  publicationStatus: PublicationStatus
  completedChunks: number
}

const PLANNED_CHUNKS = 3

const HAPPY_PATH: Step[] = [
  { atMs: 0, status: 'QUEUED', publicationStatus: 'NOT_READY', completedChunks: 0 },
  { atMs: 1500, status: 'FETCHING_DIFF', publicationStatus: 'NOT_READY', completedChunks: 0 },
  { atMs: 3000, status: 'PARSING_CONTEXT', publicationStatus: 'NOT_READY', completedChunks: 0 },
  { atMs: 4500, status: 'LLM_PROCESSING', publicationStatus: 'NOT_READY', completedChunks: 0 },
  { atMs: 6500, status: 'LLM_PROCESSING', publicationStatus: 'NOT_READY', completedChunks: 1 },
  { atMs: 8500, status: 'LLM_PROCESSING', publicationStatus: 'NOT_READY', completedChunks: 2 },
  { atMs: 10500, status: 'COMPLETED', publicationStatus: 'PENDING', completedChunks: 3 },
  { atMs: 13000, status: 'COMPLETED', publicationStatus: 'PUBLISHED', completedChunks: 3 },
]

const FAILED_IN_ANALYSIS: Step[] = [
  ...HAPPY_PATH.slice(0, 5),
  { atMs: 7500, status: 'FAILED', publicationStatus: 'NOT_READY', completedChunks: 1 },
]

const SCENARIOS: Record<(typeof MSW_REVIEW_IDS)[number], Step[]> = {
  'demo-review': HAPPY_PATH,
  'demo-review-failed': FAILED_IN_ANALYSIS,
  'demo-review-polling': HAPPY_PATH,
}

const startedAt = new Map<string, number>()

function isKnownReview(reviewId: string): reviewId is (typeof MSW_REVIEW_IDS)[number] {
  return (MSW_REVIEW_IDS as readonly string[]).includes(reviewId)
}

/** Current step and its 1-based sequence, or `null` for an unknown review. */
export function currentReviewStep(reviewId: string): (Step & { sequence: number }) | null {
  if (!isKnownReview(reviewId)) {
    return null
  }
  if (!startedAt.has(reviewId)) {
    startedAt.set(reviewId, Date.now())
  }
  const elapsed = Date.now() - (startedAt.get(reviewId) ?? 0)
  const steps = SCENARIOS[reviewId]
  let index = 0
  while (index + 1 < steps.length && steps[index + 1].atMs <= elapsed) {
    index += 1
  }
  return { ...steps[index], sequence: index + 1 }
}

export function reviewDetailWire(reviewId: string) {
  const step = currentReviewStep(reviewId)
  if (!step) {
    return null
  }
  const terminal = ['COMPLETED', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(step.status)
  return {
    id: reviewId,
    repository_id: 'repo-demo',
    pull_request_number: 42,
    status: step.status,
    requested_head_sha: 'f00dbabe',
    snapshot: null,
    progress: { completed_chunks: step.completedChunks, planned_chunks: step.atMs >= 4500 ? PLANNED_CHUNKS : 0 },
    summary:
      step.status === 'COMPLETED'
        ? 'Найдено 6 замечаний: 1 critical, 2 high, 2 medium, 1 low. Основные риски — обработка ошибок и SQL-запросы.'
        : null,
    coverage: null,
    usage: null,
    publication_status: step.publicationStatus,
    created_at: '2026-10-24T08:00:00Z',
    started_at: '2026-10-24T08:00:01Z',
    finished_at: terminal ? '2026-10-24T08:00:30Z' : null,
    retry_at: null,
    error:
      step.status === 'FAILED' ? { code: 'LLM_UNAVAILABLE', message: 'Model is unavailable.', retryable: false } : null,
  }
}

export function reviewSnapshotWire(reviewId: string) {
  const step = currentReviewStep(reviewId)
  if (!step) {
    return null
  }
  return {
    schema_version: 1,
    review_id: reviewId,
    sequence: step.sequence,
    status: step.status,
    publication_status: step.publicationStatus,
  }
}

export function hasCapturedDiff(reviewId: string): boolean {
  const step = currentReviewStep(reviewId)
  return step !== null && step.status !== 'QUEUED' && step.status !== 'FETCHING_DIFF'
}

const line = (
  kind: 'added' | 'deleted' | 'context',
  content: string,
  oldLine: number | null,
  newLine: number | null,
) => ({
  kind,
  content,
  old_line: oldLine,
  new_line: newLine,
})

export const mockReviewDiffWire = {
  files: [
    {
      path: 'src/api/user.ts',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 10,
          old_lines: 5,
          new_start: 10,
          new_lines: 8,
          lines: [
            line('context', 'export async function getUser(id: string) {', 10, 10),
            line('deleted', '  const response = await client.get(`/users/${id}`)', 11, null),
            line('added', '  const response = await client.get(`/users/${id}`, { withMeta: true })', null, 11),
            line('added', '  if (!response.ok) {', null, 12),
            line('added', '    throw new UserNotFoundError(id)', null, 13),
            line('added', '  }', null, 14),
            line('context', '  return response.data', 12, 15),
            line('deleted', '  // TODO: cache', 13, null),
            line('context', '}', 14, 16),
            line('added', '', null, 17),
          ],
        },
      ],
    },
    {
      path: 'src/db/orders.ts',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 20,
          old_lines: 4,
          new_start: 20,
          new_lines: 6,
          lines: [
            line('context', 'export async function findOrders(customer: string) {', 20, 20),
            line('deleted', "  return db.query('SELECT * FROM orders WHERE customer = $1', [customer])", 21, null),
            line('added', '  const rows = await db.raw(`SELECT * FROM orders WHERE customer = ${customer}`)', null, 21),
            line('added', '  for (const row of rows) row.items = await loadItems(row.id)', null, 22),
            line('added', '  return rows', null, 23),
            line('context', '}', 22, 24),
          ],
        },
      ],
    },
    {
      path: 'src/ui/OrderList.tsx',
      previous_path: null,
      status: 'added',
      hunks: [
        {
          old_start: 0,
          old_lines: 0,
          new_start: 1,
          new_lines: 5,
          lines: [
            line('added', "import { useOrders } from './useOrders'", null, 1),
            line('added', '', null, 2),
            line('added', 'export function OrderList() {', null, 3),
            line('added', '  const orders = useOrders()', null, 4),
            line('added', '  return <ul>{orders.map((o) => <li>{o.title}</li>)}</ul>', null, 5),
          ],
        },
      ],
    },
  ],
}

const finding = (
  id: string,
  path: string,
  side: 'OLD' | 'NEW',
  startLine: number,
  endLine: number,
  category: 'security' | 'correctness' | 'performance' | 'maintainability',
  severity: 'critical' | 'high' | 'medium' | 'low',
  title: string,
  explanation: string,
  evidence: string,
  recommendation: string,
  proposedDiffFix: string | null = null,
) => ({
  id,
  fingerprint: `fp-${id}`,
  path,
  side,
  start_line: startLine,
  end_line: endLine,
  category,
  severity,
  title,
  explanation,
  evidence,
  recommendation,
  proposed_diff_fix: proposedDiffFix,
  publication_reference: null,
})

export const mockReviewFindingsWire = [
  finding(
    'f-sql',
    'src/db/orders.ts',
    'NEW',
    21,
    21,
    'security',
    'critical',
    'SQL-инъекция через интерполяцию customer',
    'Значение customer подставляется в SQL-строку без экранирования: злоумышленник может выполнить произвольный запрос.',
    'db.raw(`SELECT * FROM orders WHERE customer = ${customer}`)',
    'Верните параметризованный запрос через db.query с плейсхолдером $1.',
    "-  const rows = await db.raw(`SELECT * FROM orders WHERE customer = ${customer}`)\n+  const rows = await db.query('SELECT * FROM orders WHERE customer = $1', [customer])",
  ),
  finding(
    'f-n1',
    'src/db/orders.ts',
    'NEW',
    22,
    22,
    'performance',
    'high',
    'N+1 запрос при загрузке позиций заказа',
    'Для каждого заказа выполняется отдельный запрос loadItems — время растёт линейно с числом заказов.',
    'for (const row of rows) row.items = await loadItems(row.id)',
    'Загрузите позиции одним запросом по списку id и сгруппируйте в памяти.',
  ),
  finding(
    'f-error',
    'src/api/user.ts',
    'NEW',
    12,
    13,
    'correctness',
    'high',
    'UserNotFoundError не обрабатывается вызывающим кодом',
    'Новый тип ошибки бросается при любом неуспешном ответе, включая 5xx, и не обрабатывается выше по стеку.',
    'throw new UserNotFoundError(id)',
    'Бросайте UserNotFoundError только для 404, остальные ошибки пробрасывайте как есть.',
  ),
  finding(
    'f-meta',
    'src/api/user.ts',
    'NEW',
    11,
    11,
    'maintainability',
    'medium',
    'Флаг withMeta меняет форму ответа',
    'С withMeta клиент возвращает обёртку с meta, но тип возвращаемого значения getUser не изменился.',
    'client.get(`/users/${id}`, { withMeta: true })',
    'Обновите тип ответа или уберите withMeta, если meta не используется.',
  ),
  finding(
    'f-key',
    'src/ui/OrderList.tsx',
    'NEW',
    5,
    5,
    'correctness',
    'medium',
    'Элементы списка без key',
    'React не сможет корректно сопоставлять элементы при обновлении списка заказов.',
    '<li>{o.title}</li>',
    'Добавьте key={o.id} к <li>.',
  ),
  finding(
    'f-todo',
    'src/api/user.ts',
    'OLD',
    13,
    13,
    'maintainability',
    'low',
    'Удалён TODO про кэширование без задачи',
    'Комментарий о кэше удалён, но кэширование не реализовано — информация потеряна.',
    '// TODO: cache',
    'Заведите задачу на кэширование или верните комментарий со ссылкой на неё.',
  ),
]
