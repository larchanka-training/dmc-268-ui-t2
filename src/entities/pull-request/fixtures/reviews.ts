import type { DiffWire } from '@/entities/diff'
import type { FindingWire } from '@/entities/review-comment'
import type { PullRequestWire, ReviewDetailWire } from '@/entities/pull-request/model/types'

/**
 * Моки в wire-формате бэкенда (OpenAPI `ReviewDetail`, `PullRequest`, `Diff`, `Finding`).
 * Их отдают и MockPullRequestDataSource, и MSW-хендлеры — через те же parse-функции, что и реальный API.
 */
export interface ReviewFixture {
  review: ReviewDetailWire
  /** `GET /reviews/{id}/diff`; null — 404, diff ещё не сохранён */
  diff: DiffWire | null
  findings: FindingWire[]
}

/** Совпадает с id подключённого репозитория в MSW (`connected-<external_id>`). */
export const MOCK_REPOSITORY_ID = 'connected-1001'
const REPOSITORY_EXTERNAL_ID = '1001'

export const MOCK_DEFAULT_REVIEW_ID = '9b2f4c1e-3a7d-4e8b-b6c5-1d0f2a9e8c42'
const SKIPPED_REVIEW_ID = '5e8a1d3c-7b2f-4c9e-a1d4-6f3b8e2c0a43'
const PENDING_REVIEW_ID = 'c4d7e2a9-1f6b-4a3e-9d8c-2b5e7f1a0c44'

const ref = (name: string, sha: string) => ({ repository_external_id: REPOSITORY_EXTERNAL_ID, ref: name, sha })

/** Открытые PR репозитория (`GET /repositories/{id}/pull-requests`). */
export const MOCK_PULL_REQUESTS: PullRequestWire[] = [
  {
    number: 42,
    title: 'Add user metadata to the API client',
    author: { login: 'ada-lovelace' },
    state: 'OPEN',
    source: ref('feature/user-meta', '5d6e7f8a9b0c1d2e3f405162738495a6b7c8d9e0'),
    base: ref('main', '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d'),
  },
  {
    number: 43,
    title: 'Merge main into docs branch',
    author: { login: 'grace-hopper' },
    state: 'OPEN',
    source: ref('docs/refresh', '2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e'),
    base: ref('main', '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d'),
  },
  {
    number: 44,
    title: 'Speed up report generation',
    author: { login: 'alan-turing' },
    state: 'OPEN',
    source: ref('perf/reports', '3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f'),
    base: ref('main', '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d'),
  },
]

const DIFF_42: DiffWire = {
  files: [
    {
      path: 'src/api/user.ts',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 10,
          old_lines: 4,
          new_start: 10,
          new_lines: 7,
          lines: [
            {
              kind: 'context',
              content: 'export async function getUser(id: string) {',
              old_line: 10,
              new_line: 10,
            },
            {
              kind: 'deleted',
              content: "  const response = await client.get('/users/' + id)",
              old_line: 11,
              new_line: null,
            },
            {
              kind: 'added',
              content: "  const response = await client.get('/users/' + id, { withMeta: true })",
              old_line: null,
              new_line: 11,
            },
            {
              kind: 'added',
              content: '  if (!response.ok) {',
              old_line: null,
              new_line: 12,
            },
            {
              kind: 'added',
              content: "    throw new Error('User not found: ' + id)",
              old_line: null,
              new_line: 13,
            },
            {
              kind: 'added',
              content: '  }',
              old_line: null,
              new_line: 14,
            },
            {
              kind: 'context',
              content: '  return response.data',
              old_line: 12,
              new_line: 15,
            },
            {
              kind: 'context',
              content: '}',
              old_line: 13,
              new_line: 16,
            },
          ],
        },
        {
          old_start: 30,
          old_lines: 3,
          new_start: 33,
          new_lines: 4,
          lines: [
            {
              kind: 'context',
              content: 'export function parseUser(raw: unknown): User {',
              old_line: 30,
              new_line: 33,
            },
            {
              kind: 'deleted',
              content: '  return raw as User',
              old_line: 31,
              new_line: null,
            },
            {
              kind: 'added',
              content: '  const user = raw as User',
              old_line: null,
              new_line: 34,
            },
            {
              kind: 'added',
              content: '  return { ...user, name: user.name.trim() }',
              old_line: null,
              new_line: 35,
            },
            {
              kind: 'context',
              content: '}',
              old_line: 32,
              new_line: 36,
            },
          ],
        },
      ],
    },
    {
      path: 'src/components/Button.tsx',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 1,
          old_lines: 5,
          new_start: 1,
          new_lines: 7,
          lines: [
            {
              kind: 'context',
              content: "import { cva } from 'class-variance-authority'",
              old_line: 1,
              new_line: 1,
            },
            {
              kind: 'deleted',
              content: 'export function Button({ label }: { label: string }) {',
              old_line: 2,
              new_line: null,
            },
            {
              kind: 'deleted',
              content: '  return <button className="btn">{label}</button>',
              old_line: 3,
              new_line: null,
            },
            {
              kind: 'added',
              content: 'export function Button({ label, disabled }: { label: string; disabled?: boolean }) {',
              old_line: null,
              new_line: 2,
            },
            {
              kind: 'added',
              content: '  return (',
              old_line: null,
              new_line: 3,
            },
            {
              kind: 'added',
              content: '    <button className="btn" disabled={disabled}>{label}</button>',
              old_line: null,
              new_line: 4,
            },
            {
              kind: 'added',
              content: '  )',
              old_line: null,
              new_line: 5,
            },
            {
              kind: 'context',
              content: '}',
              old_line: 4,
              new_line: 6,
            },
            {
              kind: 'context',
              content: 'export default Button',
              old_line: 5,
              new_line: 7,
            },
          ],
        },
      ],
    },
    {
      path: 'src/styles/theme.css',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 3,
          old_lines: 3,
          new_start: 3,
          new_lines: 4,
          lines: [
            {
              kind: 'context',
              content: ':root {',
              old_line: 3,
              new_line: 3,
            },
            {
              kind: 'deleted',
              content: '  --primary: #222;',
              old_line: 4,
              new_line: null,
            },
            {
              kind: 'added',
              content: '  --primary: #1d4ed8;',
              old_line: null,
              new_line: 4,
            },
            {
              kind: 'added',
              content: '  --primary-fg: #fff;',
              old_line: null,
              new_line: 5,
            },
            {
              kind: 'context',
              content: '}',
              old_line: 5,
              new_line: 6,
            },
          ],
        },
      ],
    },
    {
      path: 'package.json',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 5,
          old_lines: 5,
          new_start: 5,
          new_lines: 6,
          lines: [
            {
              kind: 'context',
              content: '  "scripts": {',
              old_line: 5,
              new_line: 5,
            },
            {
              kind: 'context',
              content: '    "dev": "vite",',
              old_line: 6,
              new_line: 6,
            },
            {
              kind: 'deleted',
              content: '    "build": "tsc && vite build"',
              old_line: 7,
              new_line: null,
            },
            {
              kind: 'added',
              content: '    "build": "tsc && vite build",',
              old_line: null,
              new_line: 7,
            },
            {
              kind: 'added',
              content: '    "test": "vitest run"',
              old_line: null,
              new_line: 8,
            },
            {
              kind: 'context',
              content: '  },',
              old_line: 8,
              new_line: 9,
            },
            {
              kind: 'context',
              content: '  "dependencies": {',
              old_line: 9,
              new_line: 10,
            },
          ],
        },
      ],
    },
    {
      path: 'src/legacy/old-helper.ts',
      previous_path: null,
      status: 'deleted',
      hunks: [
        {
          old_start: 1,
          old_lines: 3,
          new_start: 0,
          new_lines: 0,
          lines: [
            {
              kind: 'deleted',
              content: 'export function legacyFormat(value: string) {',
              old_line: 1,
              new_line: null,
            },
            {
              kind: 'deleted',
              content: '  return value.toUpperCase()',
              old_line: 2,
              new_line: null,
            },
            {
              kind: 'deleted',
              content: '}',
              old_line: 3,
              new_line: null,
            },
          ],
        },
      ],
    },
    {
      path: 'src/features/new-feature.ts',
      previous_path: null,
      status: 'added',
      hunks: [
        {
          old_start: 0,
          old_lines: 0,
          new_start: 1,
          new_lines: 4,
          lines: [
            {
              kind: 'added',
              content: 'export function featureFlag(name: string): boolean {',
              old_line: null,
              new_line: 1,
            },
            {
              kind: 'added',
              content: '  // TODO: read from remote config',
              old_line: null,
              new_line: 2,
            },
            {
              kind: 'added',
              content: "  return localStorage.getItem(name) === '1'",
              old_line: null,
              new_line: 3,
            },
            {
              kind: 'added',
              content: '}',
              old_line: null,
              new_line: 4,
            },
          ],
        },
      ],
    },
    {
      path: 'src/utils/formatters.ts',
      previous_path: 'src/utils/format.ts',
      status: 'renamed',
      hunks: [
        {
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 3,
          lines: [
            {
              kind: 'context',
              content: 'export function formatName(name: string) {',
              old_line: 1,
              new_line: 1,
            },
            {
              kind: 'deleted',
              content: '  return name.trim()',
              old_line: 2,
              new_line: null,
            },
            {
              kind: 'added',
              content: '  return name.trim().toLowerCase()',
              old_line: null,
              new_line: 2,
            },
            {
              kind: 'context',
              content: '}',
              old_line: 3,
              new_line: 3,
            },
          ],
        },
      ],
    },
  ],
}

const FIX_THROW = `@@ -1,3 +1,3 @@
 if (!response.ok) {
-  throw new Error('User not found: ' + id)
+  throw new UserNotFoundError(id)
 }
`

const FIX_STORAGE = `@@ -1,3 +1,4 @@
 export function featureFlag(name: string): boolean {
-  return localStorage.getItem(name) === '1'
+  if (typeof localStorage === 'undefined') return false
+  return localStorage.getItem(name) === '1'
 }
`

const finding = (
  over: Pick<FindingWire, 'id' | 'path' | 'side' | 'start_line' | 'severity' | 'category' | 'title' | 'explanation'> &
    Partial<FindingWire>,
): FindingWire => ({
  fingerprint: `sha256:${over.id}`,
  end_line: over.start_line,
  evidence: '',
  recommendation: '',
  proposed_diff_fix: null,
  publication_reference: null,
  ...over,
})

// Порядок намеренно «неправильный»: сортировку по severity делает UI.
const FINDINGS_42: FindingWire[] = [
  finding({
    id: 'user-throw-info',
    path: 'src/api/user.ts',
    side: 'NEW',
    start_line: 13,
    severity: 'low',
    category: 'maintainability',
    title: 'Add the user id to the error context',
    explanation: 'The id is only embedded in the message text.',
    evidence: "`throw new Error('User not found: ' + id)`",
    recommendation: 'Attach `id` as a structured field, not only in the message.',
  }),
  finding({
    id: 'user-throw-critical',
    path: 'src/api/user.ts',
    side: 'NEW',
    start_line: 12,
    end_line: 13,
    severity: 'critical',
    category: 'correctness',
    title: 'Generic Error hides the failure reason',
    explanation: 'Throwing a plain `Error` makes **404** indistinguishable from other failures.',
    evidence: '`if (!response.ok)` treats every non-2xx status as "not found".',
    recommendation: 'Use a dedicated `UserNotFoundError` so callers can handle it.',
    proposed_diff_fix: FIX_THROW,
    publication_reference: 'gh-review-comment-1',
  }),
  finding({
    id: 'user-throw-warning',
    path: 'src/api/user.ts',
    side: 'NEW',
    start_line: 13,
    severity: 'high',
    category: 'maintainability',
    title: 'String concatenation in error message',
    explanation: 'Concatenation is harder to read than a template literal.',
    evidence: "`'User not found: ' + id`",
    recommendation: 'Prefer a template literal for readability.',
  }),
  finding({
    id: 'user-old-request',
    path: 'src/api/user.ts',
    side: 'OLD',
    start_line: 11,
    severity: 'high',
    category: 'correctness',
    title: 'Removed request did not ask for metadata',
    explanation: 'The old call returned no `meta`, so existing callers may rely on its shape.',
    evidence: "`client.get('/users/' + id)`",
    recommendation: 'Check every caller of `getUser` before changing the response shape.',
  }),
  finding({
    id: 'user-trim-info',
    path: 'src/api/user.ts',
    side: 'NEW',
    start_line: 35,
    severity: 'medium',
    category: 'correctness',
    title: 'name may be undefined',
    explanation: '`raw as User` is an unchecked cast, so `user.name` can be `undefined` at runtime.',
    evidence: '`user.name.trim()`',
    recommendation: 'Validate `raw` before trimming.',
  }),
  finding({
    id: 'user-outside-diff',
    path: 'src/api/user.ts',
    side: 'NEW',
    start_line: 80,
    severity: 'high',
    category: 'correctness',
    title: 'Related code outside the diff',
    explanation: 'The `updateUser` helper below still uses the old response shape.',
    evidence: '`updateUser` reads `response` without `meta`.',
    recommendation: 'Update `updateUser` in the same PR.',
  }),
  finding({
    id: 'button-type-warning',
    path: 'src/components/Button.tsx',
    side: 'NEW',
    start_line: 4,
    severity: 'high',
    category: 'correctness',
    title: 'Missing button type',
    explanation: 'A `<button>` without `type` submits forms by default.',
    evidence: '`<button className="btn" disabled={disabled}>`',
    recommendation: 'Add `type="button"`.',
  }),
  finding({
    id: 'button-type-info',
    path: 'src/components/Button.tsx',
    side: 'NEW',
    start_line: 4,
    severity: 'low',
    category: 'maintainability',
    title: 'Inline children formatting',
    explanation: 'The element and its children share one long line.',
    evidence: '`{label}</button>`',
    recommendation: 'Move `{label}` to its own line for readability.',
  }),
  finding({
    id: 'css-contrast-warning',
    path: 'src/styles/theme.css',
    side: 'NEW',
    start_line: 5,
    severity: 'high',
    category: 'maintainability',
    title: 'Check colour contrast',
    explanation: 'White on `#1d4ed8` passes AA, but hover states are not defined.',
    evidence: '`--primary-fg: #fff;`',
    recommendation: 'Define hover and focus colours together with the new palette.',
  }),
  finding({
    id: 'legacy-removed-warning',
    path: 'src/legacy/old-helper.ts',
    side: 'OLD',
    start_line: 1,
    end_line: 2,
    severity: 'high',
    category: 'correctness',
    title: 'Removed helper may still be used',
    explanation: '`legacyFormat` is still imported by the reports module.',
    evidence: '`export function legacyFormat(value: string)`',
    recommendation: 'Remove the import in the reports module or keep the helper.',
  }),
  finding({
    id: 'feature-storage-critical',
    path: 'src/features/new-feature.ts',
    side: 'NEW',
    start_line: 3,
    severity: 'critical',
    category: 'correctness',
    title: 'localStorage is not available during SSR',
    explanation: 'Accessing `localStorage` on the server throws a `ReferenceError`.',
    evidence: "`localStorage.getItem(name) === '1'`",
    recommendation: 'Guard the access with `typeof localStorage`.',
    proposed_diff_fix: FIX_STORAGE,
  }),
  finding({
    id: 'feature-todo-info',
    path: 'src/features/new-feature.ts',
    side: 'NEW',
    start_line: 2,
    severity: 'low',
    category: 'maintainability',
    title: 'TODO left in code',
    explanation: 'The remote-config work is tracked only in a comment.',
    evidence: '`// TODO: read from remote config`',
    recommendation: 'Track the remote-config work in an issue.',
  }),
  finding({
    id: 'format-lowercase-info',
    path: 'src/utils/formatters.ts',
    side: 'NEW',
    start_line: 2,
    severity: 'medium',
    category: 'correctness',
    title: 'Lower-casing names changes behaviour',
    explanation: 'Names such as `McDonald` lose their capitalisation.',
    evidence: '`name.trim().toLowerCase()`',
    recommendation: 'Keep the original case and compare case-insensitively where needed.',
  }),
  finding({
    id: 'missing-file-info',
    path: 'src/removed-from-pr.ts',
    side: 'NEW',
    start_line: 1,
    severity: 'low',
    category: 'maintainability',
    title: 'Comment on a file that is no longer in the PR',
    explanation: 'The file was reverted in a later commit.',
    evidence: 'The path is absent from the stored diff.',
    recommendation: 'No action needed.',
  }),
]

const reviewDetail = (over: Partial<ReviewDetailWire> & Pick<ReviewDetailWire, 'id' | 'pull_request_number'>) => {
  const pr = MOCK_PULL_REQUESTS.find((item) => item.number === over.pull_request_number)
  const headSha = pr?.source.sha ?? ''
  const detail: ReviewDetailWire = {
    repository_id: MOCK_REPOSITORY_ID,
    status: 'COMPLETED',
    requested_head_sha: headSha,
    snapshot: {
      base_sha: pr?.base.sha ?? '',
      merge_base_sha: pr?.base.sha ?? '',
      head_sha: headSha,
      captured_at: '2026-03-02T12:30:05Z',
    },
    progress: { completed_chunks: 0, planned_chunks: 0 },
    summary: null,
    coverage: null,
    usage: null,
    publication_status: 'NOT_READY',
    created_at: '2026-03-02T12:30:00Z',
    started_at: null,
    finished_at: null,
    retry_at: null,
    error: null,
    ...over,
  }
  return detail
}

export const MOCK_REVIEWS: Record<string, ReviewFixture> = {
  [MOCK_DEFAULT_REVIEW_ID]: {
    review: reviewDetail({
      id: MOCK_DEFAULT_REVIEW_ID,
      pull_request_number: 42,
      status: 'COMPLETED',
      publication_status: 'PUBLISHED',
      progress: { completed_chunks: 3, planned_chunks: 3 },
      summary: 'The API client now requests user metadata; error handling around missing users needs work.',
      coverage: {
        included: [
          { path: 'src/api/user.ts', ranges: [{ start_line: 10, end_line: 36 }] },
          { path: 'src/components/Button.tsx', ranges: [{ start_line: 1, end_line: 7 }] },
          { path: 'src/features/new-feature.ts', ranges: [{ start_line: 1, end_line: 4 }] },
        ],
        skipped: [{ path: 'public/logo.png', ranges: [], reason: 'policy' }],
        context_quality: 'full',
      },
      usage: { input_tokens: 18240, output_tokens: 2311 },
      started_at: '2026-03-02T12:30:02Z',
      finished_at: '2026-03-02T12:31:40Z',
    }),
    diff: DIFF_42,
    findings: FINDINGS_42,
  },
  [SKIPPED_REVIEW_ID]: {
    review: reviewDetail({
      id: SKIPPED_REVIEW_ID,
      pull_request_number: 43,
      status: 'SKIPPED',
      publication_status: 'SKIPPED',
      created_at: '2026-03-03T09:15:00Z',
      started_at: '2026-03-03T09:15:01Z',
      finished_at: '2026-03-03T09:15:03Z',
    }),
    diff: { files: [] },
    findings: [],
  },
  [PENDING_REVIEW_ID]: {
    review: reviewDetail({
      id: PENDING_REVIEW_ID,
      pull_request_number: 44,
      status: 'FETCHING_DIFF',
      snapshot: null,
      created_at: '2026-03-04T08:00:00Z',
      started_at: '2026-03-04T08:00:02Z',
    }),
    diff: null,
    findings: [],
  },
}
