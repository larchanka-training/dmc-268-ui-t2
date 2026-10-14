import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '@/entities/diff/lib/parse-unified-diff'
import type { DiffLine } from '@/entities/diff/model/types'
import type { ReviewComment, Severity } from '@/entities/review-comment'
import { anchorComments, commentsForRow } from '@/widgets/diff-viewer/model/anchor-comments'

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -10,4 +10,5 @@
 keep-10
-removed-11
+added-11
+added-12
 keep-12-old
 keep-13-old
diff --git a/src/gone.ts b/src/gone.ts
deleted file mode 100644
--- a/src/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-gone-1
-gone-2
diff --git a/src/old.ts b/src/renamed.ts
similarity index 90%
rename from src/old.ts
rename to src/renamed.ts
--- a/src/old.ts
+++ b/src/renamed.ts
@@ -1 +1 @@
-before
+after
diff --git a/img/logo.png b/img/logo.png
Binary files a/img/logo.png and b/img/logo.png differ
`

const files = parseUnifiedDiff(DIFF)
const [a, gone, renamed, binary] = files
const lineOf = (file: typeof a, content: string): DiffLine => {
  const line = file.hunks.flatMap((h) => h.lines).find((l) => l.content === content)
  if (!line) throw new Error(`no line ${content}`)
  return line
}

let seq = 0
const comment = (over: Partial<ReviewComment> & { severity?: Severity } = {}): ReviewComment => {
  seq += 1
  return {
    id: `c${seq}`,
    filePath: 'src/a.ts',
    side: 'new',
    line: 11,
    severity: 'info',
    title: 't',
    body: 'b',
    ...over,
  }
}

describe('anchorComments', () => {
  it('anchors a new-side comment to an added line by its new number', () => {
    const c = comment({ side: 'new', line: 12 })
    const result = anchorComments(files, [c])

    expect(result.byLine.get(lineOf(a, 'added-12'))).toEqual([c])
    expect(result.outOfDiffByFile.size).toBe(0)
    expect(result.orphans).toEqual([])
  })

  it('anchors a new-side comment to a context line by its new number', () => {
    // keep-12-old: old 12, new 13
    const c = comment({ side: 'new', line: 13 })

    expect(anchorComments(files, [c]).byLine.get(lineOf(a, 'keep-12-old'))).toEqual([c])
  })

  it('anchors an old-side comment to the deleted line by its old number', () => {
    const c = comment({ side: 'old', line: 11 })
    const result = anchorComments(files, [c])

    expect(result.byLine.get(lineOf(a, 'removed-11'))).toEqual([c])
    expect(result.byLine.get(lineOf(a, 'added-11'))).toBeUndefined()
  })

  it('does not anchor an old-side comment to an added line with the same number', () => {
    const c = comment({ side: 'old', line: 12 })
    const result = anchorComments(files, [c])

    // old 12 is the context line keep-12-old, not the added line numbered 12 on the new side
    expect(result.byLine.get(lineOf(a, 'added-12'))).toBeUndefined()
    expect(result.byLine.get(lineOf(a, 'keep-12-old'))).toEqual([c])
  })

  it('does not anchor a new-side comment to a deleted line', () => {
    // new 11 is added-11; a deleted line has no new number
    const onGone = comment({ filePath: 'src/gone.ts', side: 'new', line: 1 })
    const result = anchorComments(files, [onGone])

    expect(result.byLine.size).toBe(0)
    expect(result.outOfDiffByFile.get('src/gone.ts')).toEqual([onGone])
  })

  it('sorts several comments on one line: critical → warning → info (stable)', () => {
    const cs = [
      comment({ id: 'i', severity: 'info' }),
      comment({ id: 'w1', severity: 'warning' }),
      comment({ id: 'c', severity: 'critical' }),
      comment({ id: 'w2', severity: 'warning' }),
    ]
    const stack = anchorComments(files, cs).byLine.get(lineOf(a, 'added-11'))

    expect(stack?.map((x) => x.id)).toEqual(['c', 'w1', 'w2', 'i'])
  })

  it('puts a comment on a line outside the diff into the file-level out-of-diff list', () => {
    const c = comment({ line: 999 })
    const result = anchorComments(files, [c])

    expect(result.byLine.size).toBe(0)
    expect(result.outOfDiffByFile.get('src/a.ts')).toEqual([c])
  })

  it('puts a comment on a missing file into orphans (PR-level)', () => {
    const c = comment({ filePath: 'src/missing.ts' })
    const result = anchorComments(files, [c])

    expect(result.orphans).toEqual([c])
    expect(result.byLine.size).toBe(0)
  })

  it('anchors comments of a deleted file by the old path and old numbers', () => {
    const c = comment({ filePath: 'src/gone.ts', side: 'old', line: 2 })

    expect(anchorComments(files, [c]).byLine.get(lineOf(gone, 'gone-2'))).toEqual([c])
  })

  it('finds a renamed file by either its old or its new path', () => {
    const byNew = comment({ filePath: 'src/renamed.ts', side: 'new', line: 1 })
    const byOld = comment({ filePath: 'src/old.ts', side: 'old', line: 1 })
    const result = anchorComments(files, [byNew, byOld])

    expect(result.byLine.get(lineOf(renamed, 'after'))).toEqual([byNew])
    expect(result.byLine.get(lineOf(renamed, 'before'))).toEqual([byOld])
  })

  it('keeps a comment on a binary file as file-level out-of-diff', () => {
    const c = comment({ filePath: 'img/logo.png', line: 1 })

    expect(anchorComments(files, [c]).outOfDiffByFile.get(binary.path)).toEqual([c])
  })

  it('sorts out-of-diff lists by severity as well', () => {
    const cs = [comment({ line: 900, id: 'i' }), comment({ line: 901, id: 'c', severity: 'critical' })]

    expect(
      anchorComments(files, cs)
        .outOfDiffByFile.get('src/a.ts')
        ?.map((x) => x.id),
    ).toEqual(['c', 'i'])
  })

  it('loses no comment', () => {
    const cs = [
      comment({ line: 11 }),
      comment({ line: 999 }),
      comment({ filePath: 'nope.ts' }),
      comment({ filePath: 'src/gone.ts', side: 'old', line: 1 }),
    ]
    const r = anchorComments(files, cs)
    const total =
      [...r.byLine.values()].flat().length + [...r.outOfDiffByFile.values()].flat().length + r.orphans.length

    expect(total).toBe(cs.length)
  })
})

describe('commentsForRow', () => {
  it('merges comments of both cells of a del/add pair, sorted by severity', () => {
    const del = lineOf(a, 'removed-11')
    const add = lineOf(a, 'added-11')
    const onOld = comment({ side: 'old', line: 11, severity: 'info', id: 'old-info' })
    const onNew = comment({ side: 'new', line: 11, severity: 'critical', id: 'new-critical' })
    const { byLine } = anchorComments(files, [onOld, onNew])

    expect(commentsForRow(byLine, [del, add]).map((x) => x.id)).toEqual(['new-critical', 'old-info'])
  })

  it('does not duplicate comments when both cells are the same context line', () => {
    const ctxLine = lineOf(a, 'keep-12-old')
    const c = comment({ side: 'new', line: 13 })
    const { byLine } = anchorComments(files, [c])

    expect(commentsForRow(byLine, [ctxLine, ctxLine])).toEqual([c])
  })

  it('ignores empty cells', () => {
    const { byLine } = anchorComments(files, [])

    expect(commentsForRow(byLine, [null, null])).toEqual([])
  })
})
