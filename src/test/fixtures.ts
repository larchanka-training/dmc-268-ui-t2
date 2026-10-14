import type { PullRequest } from '@/entities/pull-request'
import type { ReviewComment } from '@/entities/review-comment'

export const TEST_PR: PullRequest = {
  id: '42',
  number: 42,
  title: 'Add user metadata',
  author: { name: 'Ada Lovelace' },
  sourceBranch: 'feature/user-meta',
  targetBranch: 'main',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-02T12:30:00.000Z',
  reviewStatus: 'changes_requested',
  score: 72,
  verdict: 'request_changes',
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
    line: 12,
    severity: 'info',
    title: 'Naming nit',
    body: 'Prefer a more **descriptive** name.',
  },
  {
    id: 'c1',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 12,
    severity: 'critical',
    title: 'Unvalidated error',
    body: 'Use `UserNotFoundError` instead of a generic error.',
    suggestedFix: FIX_DIFF,
  },
  {
    id: 'c2',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 12,
    severity: 'warning',
    title: 'Generic Error',
    body: 'Generic errors are hard to catch.',
  },
  {
    id: 'c5',
    filePath: 'src/api/user.ts',
    side: 'old',
    line: 11,
    severity: 'info',
    title: 'Old request had no meta',
    body: 'The removed call did not request metadata.',
  },
  {
    id: 'c4',
    filePath: 'src/legacy/old-helper.ts',
    side: 'old',
    line: 2,
    severity: 'warning',
    title: 'Removed export still used',
    body: '`other` is still imported elsewhere.',
  },
  {
    id: 'c6',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 99,
    severity: 'critical',
    title: 'Comment outside diff',
    body: 'This line is not part of the diff.',
  },
  {
    id: 'c7',
    filePath: 'src/missing.ts',
    side: 'new',
    line: 1,
    severity: 'info',
    title: 'File is not in the diff',
    body: 'The file is gone from this PR.',
  },
]
