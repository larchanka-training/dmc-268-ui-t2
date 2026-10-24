import type { ReviewComment } from '@/entities/review-comment'
import type { PullRequest } from '@/entities/pull-request/model/types'

export interface PullRequestFixture {
  pullRequest: PullRequest
  diff: string
  comments: ReviewComment[]
}

export const MOCK_DEFAULT_PR_ID = '42'

const DIFF_42 = `diff --git a/src/api/user.ts b/src/api/user.ts
index 1a2b3c4..5d6e7f8 100644
--- a/src/api/user.ts
+++ b/src/api/user.ts
@@ -10,4 +10,7 @@ export async function getUser
 export async function getUser(id: string) {
-  const response = await client.get('/users/' + id)
+  const response = await client.get('/users/' + id, { withMeta: true })
+  if (!response.ok) {
+    throw new Error('User not found: ' + id)
+  }
   return response.data
 }
@@ -30,3 +33,4 @@ export function parseUser
 export function parseUser(raw: unknown): User {
-  return raw as User
+  const user = raw as User
+  return { ...user, name: user.name.trim() }
 }
diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 2b3c4d5..6e7f8a9 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,5 +1,7 @@
 import { cva } from 'class-variance-authority'
-export function Button({ label }: { label: string }) {
-  return <button className="btn">{label}</button>
+export function Button({ label, disabled }: { label: string; disabled?: boolean }) {
+  return (
+    <button className="btn" disabled={disabled}>{label}</button>
+  )
 }
 export default Button
diff --git a/src/styles/theme.css b/src/styles/theme.css
index 3c4d5e6..7f8a9b0 100644
--- a/src/styles/theme.css
+++ b/src/styles/theme.css
@@ -3,3 +3,4 @@
 :root {
-  --primary: #222;
+  --primary: #1d4ed8;
+  --primary-fg: #fff;
 }
diff --git a/package.json b/package.json
index 4d5e6f7..8a9b0c1 100644
--- a/package.json
+++ b/package.json
@@ -5,5 +5,6 @@
   "scripts": {
     "dev": "vite",
-    "build": "tsc && vite build"
+    "build": "tsc && vite build",
+    "test": "vitest run"
   },
   "dependencies": {
diff --git a/src/legacy/old-helper.ts b/src/legacy/old-helper.ts
deleted file mode 100644
index 5e6f7a8..0000000
--- a/src/legacy/old-helper.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function legacyFormat(value: string) {
-  return value.toUpperCase()
-}
diff --git a/src/features/new-feature.ts b/src/features/new-feature.ts
new file mode 100644
index 0000000..6f7a8b9
--- /dev/null
+++ b/src/features/new-feature.ts
@@ -0,0 +1,4 @@
+export function featureFlag(name: string): boolean {
+  // TODO: read from remote config
+  return localStorage.getItem(name) === '1'
+}
diff --git a/src/utils/format.ts b/src/utils/formatters.ts
similarity index 85%
rename from src/utils/format.ts
rename to src/utils/formatters.ts
index 7a8b9c0..8b9c0d1 100644
--- a/src/utils/format.ts
+++ b/src/utils/formatters.ts
@@ -1,3 +1,3 @@
 export function formatName(name: string) {
-  return name.trim()
+  return name.trim().toLowerCase()
 }
diff --git a/public/logo.png b/public/logo.png
index 8b9c0d1..9c0d1e2 100644
Binary files a/public/logo.png and b/public/logo.png differ
`

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

// Порядок намеренно «неправильный»: сортировку по severity делает UI.
const COMMENTS_42: ReviewComment[] = [
  {
    id: 'user-throw-info',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 13,
    severity: 'info',
    title: 'Add the user id to the error context',
    body: 'Consider attaching `id` as a structured field, not only in the message.',
  },
  {
    id: 'user-throw-critical',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 13,
    severity: 'critical',
    title: 'Generic Error hides the failure reason',
    body: 'Throwing a plain `Error` makes **404** indistinguishable from other failures.\n\nUse a dedicated `UserNotFoundError` so callers can handle it.',
    suggestedFix: FIX_THROW,
  },
  {
    id: 'user-throw-warning',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 13,
    severity: 'warning',
    title: 'String concatenation in error message',
    body: 'Prefer a template literal for readability.',
  },
  {
    id: 'user-old-request',
    filePath: 'src/api/user.ts',
    side: 'old',
    line: 11,
    severity: 'warning',
    title: 'Removed request did not ask for metadata',
    body: 'The old call returned no `meta`, so existing callers may rely on its shape.',
  },
  {
    id: 'user-trim-info',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 35,
    severity: 'info',
    title: 'name may be undefined',
    body: '`raw as User` is an unchecked cast, so `user.name` can be `undefined` at runtime.',
  },
  {
    id: 'user-outside-diff',
    filePath: 'src/api/user.ts',
    side: 'new',
    line: 80,
    severity: 'warning',
    title: 'Related code outside the diff',
    body: 'The `updateUser` helper below still uses the old response shape.',
  },
  {
    id: 'button-type-warning',
    filePath: 'src/components/Button.tsx',
    side: 'new',
    line: 4,
    severity: 'warning',
    title: 'Missing button type',
    body: 'A `<button>` without `type` submits forms by default.',
  },
  {
    id: 'button-type-info',
    filePath: 'src/components/Button.tsx',
    side: 'new',
    line: 4,
    severity: 'info',
    title: 'Inline children formatting',
    body: 'Move `{label}` to its own line for readability.',
  },
  {
    id: 'css-contrast-warning',
    filePath: 'src/styles/theme.css',
    side: 'new',
    line: 5,
    severity: 'warning',
    title: 'Check colour contrast',
    body: 'White on `#1d4ed8` passes AA, but hover states are not defined.',
  },
  {
    id: 'legacy-removed-warning',
    filePath: 'src/legacy/old-helper.ts',
    side: 'old',
    line: 2,
    severity: 'warning',
    title: 'Removed helper may still be used',
    body: '`legacyFormat` is still imported by the reports module.',
  },
  {
    id: 'feature-storage-critical',
    filePath: 'src/features/new-feature.ts',
    side: 'new',
    line: 3,
    severity: 'critical',
    title: 'localStorage is not available during SSR',
    body: 'Accessing `localStorage` on the server throws a `ReferenceError`.',
    suggestedFix: FIX_STORAGE,
  },
  {
    id: 'feature-todo-info',
    filePath: 'src/features/new-feature.ts',
    side: 'new',
    line: 2,
    severity: 'info',
    title: 'TODO left in code',
    body: 'Track the remote-config work in an issue.',
  },
  {
    id: 'format-lowercase-info',
    filePath: 'src/utils/formatters.ts',
    side: 'new',
    line: 2,
    severity: 'info',
    title: 'Lower-casing names changes behaviour',
    body: 'Names such as `McDonald` lose their capitalisation.',
  },
  {
    id: 'missing-file-info',
    filePath: 'src/removed-from-pr.ts',
    side: 'new',
    line: 1,
    severity: 'info',
    title: 'Comment on a file that is no longer in the PR',
    body: 'The file was reverted in a later commit.',
  },
]

export const MOCK_PULL_REQUESTS: Record<string, PullRequestFixture> = {
  '42': {
    pullRequest: {
      id: '42',
      number: 42,
      title: 'Add user metadata to the API client',
      author: { name: 'Ada Lovelace' },
      sourceBranch: 'feature/user-meta',
      targetBranch: 'main',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-02T12:30:00.000Z',
      reviewStatus: 'COMPLETED',
      publicationStatus: 'PUBLISHED',
    },
    diff: DIFF_42,
    comments: COMMENTS_42,
  },
  '43': {
    pullRequest: {
      id: '43',
      number: 43,
      title: 'Merge main into docs branch',
      author: { name: 'Grace Hopper' },
      sourceBranch: 'docs/refresh',
      targetBranch: 'main',
      createdAt: '2026-03-03T09:15:00.000Z',
      updatedAt: '2026-03-03T09:15:00.000Z',
      reviewStatus: 'SKIPPED',
      publicationStatus: 'SKIPPED',
    },
    diff: '',
    comments: [],
  },
}
