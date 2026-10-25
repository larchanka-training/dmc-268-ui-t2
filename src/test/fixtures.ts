import { MOCK_DEFAULT_REVIEW_ID, type PullRequest, type Review } from '@/entities/pull-request'
import type { ReviewComment } from '@/entities/review-comment'

/** Совпадает с id по умолчанию, чтобы редирект `/review` попадал в известное ревью. */
export const TEST_REVIEW_ID = MOCK_DEFAULT_REVIEW_ID
export const TEST_REVIEW_PATH = `/reviews/${TEST_REVIEW_ID}`

export const TEST_REVIEW: Review = {
  id: TEST_REVIEW_ID,
  repositoryId: 'repo-1',
  pullRequestNumber: 42,
  status: 'COMPLETED',
  publicationStatus: 'PUBLISHED',
  requestedHeadSha: 'abc123',
  summary: 'Looks mostly fine.',
  progress: { completedChunks: 2, plannedChunks: 2 },
  createdAt: '2026-03-01T10:00:00.000Z',
  startedAt: '2026-03-01T10:00:01.000Z',
  finishedAt: '2026-03-02T12:30:00.000Z',
  error: null,
}

export const TEST_PR: PullRequest = {
  number: 42,
  title: 'Add user metadata',
  author: { login: 'ada-lovelace' },
  sourceBranch: 'feature/user-meta',
  targetBranch: 'main',
  headSha: 'abc123',
}

/**
 * user.ts: +2 −1; old-helper.ts: +0 −2; new-feature.ts: +2 −0.
 * В user.ts: del old:11 → add new:11, add new:12.
 */
export const TEST_DIFF = `diff --git a/src/api/user.ts b/src/api/user.ts
index 1111111..2222222 100644
--- a/src/api/user.ts
+++ b/src/api/user.ts
@@ -10,4 +10,5 @@ export async function getUser
 export async function getUser(id: string) {
-  const response = await client.get(id)
+  const response = await client.get(id, { withMeta: true })
+  if (!response.ok) throw new Error(id)
   return response.data
 }
diff --git a/src/legacy/old-helper.ts b/src/legacy/old-helper.ts
deleted file mode 100644
index 3333333..0000000
--- a/src/legacy/old-helper.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const legacy = 1
-export const other = 2
diff --git a/src/features/new-feature.ts b/src/features/new-feature.ts
new file mode 100644
index 0000000..4444444
--- /dev/null
+++ b/src/features/new-feature.ts
@@ -0,0 +1,2 @@
+export const feature = true
+export const name = 'x'
`

export const FIX_DIFF = `@@ -1,2 +1,3 @@
 const a = 1
-throw new Error(id)
+if (!id) return
+throw new UserNotFoundError(id)
`

/** Код после применения FIX_DIFF: context + add */
export const FIX_RESULT = 'const a = 1\nif (!id) return\nthrow new UserNotFoundError(id)'

// Порядок намеренно перемешан: сортировку по severity должен делать код.
export const TEST_COMMENTS: ReviewComment[] = [
  {
    id: 'c3',
    filePath: 'src/api/user.ts',
    side: 'new',
    startLine: 12,
    line: 12,
    severity: 'info',
    category: 'correctness',
    title: 'Naming nit',
    explanation: 'Prefer a more **descriptive** name.',
    evidence: 'evidence',
    recommendation: 'recommendation',
  },
  {
    id: 'c1',
    filePath: 'src/api/user.ts',
    side: 'new',
    startLine: 12,
    line: 12,
    severity: 'critical',
    category: 'correctness',
    title: 'Unvalidated error',
    explanation: 'Use `UserNotFoundError` instead of a generic error.',
    evidence: 'evidence',
    recommendation: 'recommendation',
    suggestedFix: FIX_DIFF,
  },
  {
    id: 'c2',
    filePath: 'src/api/user.ts',
    side: 'new',
    startLine: 12,
    line: 12,
    severity: 'warning',
    category: 'correctness',
    title: 'Generic Error',
    explanation: 'Generic errors are hard to catch.',
    evidence: 'evidence',
    recommendation: 'recommendation',
  },
  {
    id: 'c5',
    filePath: 'src/api/user.ts',
    side: 'old',
    startLine: 11,
    line: 11,
    severity: 'info',
    category: 'correctness',
    title: 'Old request had no meta',
    explanation: 'The removed call did not request metadata.',
    evidence: 'evidence',
    recommendation: 'recommendation',
  },
  {
    id: 'c4',
    filePath: 'src/legacy/old-helper.ts',
    side: 'old',
    startLine: 2,
    line: 2,
    severity: 'warning',
    category: 'correctness',
    title: 'Removed export still used',
    explanation: '`other` is still imported elsewhere.',
    evidence: 'evidence',
    recommendation: 'recommendation',
  },
  {
    id: 'c6',
    filePath: 'src/api/user.ts',
    side: 'new',
    startLine: 99,
    line: 99,
    severity: 'critical',
    category: 'correctness',
    title: 'Comment outside diff',
    explanation: 'This line is not part of the diff.',
    evidence: 'evidence',
    recommendation: 'recommendation',
  },
  {
    id: 'c7',
    filePath: 'src/missing.ts',
    side: 'new',
    startLine: 1,
    line: 1,
    severity: 'info',
    category: 'correctness',
    title: 'File is not in the diff',
    explanation: 'The file is gone from this PR.',
    evidence: 'evidence',
    recommendation: 'recommendation',
  },
]
