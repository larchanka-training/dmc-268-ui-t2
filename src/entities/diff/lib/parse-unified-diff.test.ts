import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '@/entities/diff/lib/parse-unified-diff'

const TWO_FILES = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,4 +1,5 @@ function first()
 one
-two
+TWO
+two-and-a-half
 three
 four
@@ -20,3 +21,3 @@ function second()
 twenty
-twenty-one
+TWENTY-ONE
 twenty-two
diff --git a/src/b.css b/src/b.css
index 3333333..4444444 100644
--- a/src/b.css
+++ b/src/b.css
@@ -5,2 +5,3 @@
 .a { color: red; }
+.b { color: blue; }
 .c { color: green; }
`

describe('parseUnifiedDiff: files, hunks, line numbers', () => {
  it('parses several files and hunks', () => {
    const files = parseUnifiedDiff(TWO_FILES)

    expect(files.map((f) => f.path)).toEqual(['src/a.ts', 'src/b.css'])
    expect(files[0].status).toBe('modified')
    expect(files[0].isBinary).toBe(false)
    expect(files[0].hunks).toHaveLength(2)
    expect(files[1].hunks).toHaveLength(1)
  })

  it('parses hunk header fields and section', () => {
    const [hunk1, hunk2] = parseUnifiedDiff(TWO_FILES)[0].hunks

    expect(hunk1).toMatchObject({
      header: '@@ -1,4 +1,5 @@ function first()',
      oldStart: 1,
      oldLines: 4,
      newStart: 1,
      newLines: 5,
      section: 'function first()',
    })
    expect(hunk2).toMatchObject({ oldStart: 20, oldLines: 3, newStart: 21, newLines: 3 })
  })

  it('assigns line types and old/new numbers', () => {
    const lines = parseUnifiedDiff(TWO_FILES)[0].hunks[0].lines

    expect(lines.map((l) => [l.type, l.oldNo, l.newNo, l.content])).toEqual([
      ['context', 1, 1, 'one'],
      ['del', 2, null, 'two'],
      ['add', null, 2, 'TWO'],
      ['add', null, 3, 'two-and-a-half'],
      ['context', 3, 4, 'three'],
      ['context', 4, 5, 'four'],
    ])
  })

  it('starts numbering of the second hunk from its own header', () => {
    const lines = parseUnifiedDiff(TWO_FILES)[0].hunks[1].lines

    expect(lines[0]).toMatchObject({ type: 'context', oldNo: 20, newNo: 21 })
    expect(lines[1]).toMatchObject({ type: 'del', oldNo: 21, newNo: null })
    expect(lines[2]).toMatchObject({ type: 'add', oldNo: null, newNo: 22 })
  })

  it('counts additions and deletions per file', () => {
    const [a, b] = parseUnifiedDiff(TWO_FILES)

    expect([a.additions, a.deletions]).toEqual([3, 2])
    expect([b.additions, b.deletions]).toEqual([1, 0])
  })

  it('defaults a missing hunk length to 1', () => {
    const [file] = parseUnifiedDiff(`--- a/x.txt
+++ b/x.txt
@@ -3 +3 @@
-old
+new
`)

    expect(file.hunks[0]).toMatchObject({ oldStart: 3, oldLines: 1, newStart: 3, newLines: 1 })
  })

  it('does not treat a deleted line starting with "-- " as a file header', () => {
    const [file] = parseUnifiedDiff(`--- a/q.sql
+++ b/q.sql
@@ -1,2 +1,1 @@
--- a comment
 select 1
`)

    expect(file.hunks[0].lines[0]).toMatchObject({ type: 'del', content: '-- a comment', oldNo: 1 })
    expect(file.hunks[0].lines[1]).toMatchObject({ type: 'context', content: 'select 1' })
  })

  it('ignores the trailing newline and strips CRLF', () => {
    const [file] = parseUnifiedDiff('--- a/x\r\n+++ b/x\r\n@@ -1,1 +1,1 @@\r\n-a\r\n+b\r\n')

    expect(file.hunks[0].lines.map((l) => l.content)).toEqual(['a', 'b'])
  })

  it('treats a bare empty line inside a hunk as an empty context line', () => {
    const [file] = parseUnifiedDiff(`--- a/x
+++ b/x
@@ -1,3 +1,3 @@
 a

-c
+d
`)

    expect(file.hunks[0].lines.map((l) => [l.type, l.content])).toEqual([
      ['context', 'a'],
      ['context', ''],
      ['del', 'c'],
      ['add', 'd'],
    ])
  })

  it('parses a header-less diff made only of hunks (suggested fix)', () => {
    const files = parseUnifiedDiff(`@@ -1,2 +1,2 @@
 keep
-old
+new
`)

    expect(files).toHaveLength(1)
    expect(files[0].hunks[0].lines.map((l) => l.type)).toEqual(['context', 'del', 'add'])
  })

  it('returns an empty list for empty input', () => {
    expect(parseUnifiedDiff('')).toEqual([])
    expect(parseUnifiedDiff('\n')).toEqual([])
  })
})

describe('parseUnifiedDiff: file kinds', () => {
  it('recognises a new file', () => {
    const [file] = parseUnifiedDiff(`diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..5555555
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const a = 1
+export const b = 2
`)

    expect(file).toMatchObject({
      status: 'added',
      oldPath: null,
      newPath: 'src/new.ts',
      path: 'src/new.ts',
      additions: 2,
      deletions: 0,
    })
    expect(file.hunks[0].lines.map((l) => [l.oldNo, l.newNo])).toEqual([
      [null, 1],
      [null, 2],
    ])
  })

  it('recognises a deleted file', () => {
    const [file] = parseUnifiedDiff(`diff --git a/src/gone.ts b/src/gone.ts
deleted file mode 100644
index 5555555..0000000
--- a/src/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const a = 1
-export const b = 2
`)

    expect(file).toMatchObject({
      status: 'deleted',
      oldPath: 'src/gone.ts',
      newPath: null,
      path: 'src/gone.ts',
      additions: 0,
      deletions: 2,
    })
    expect(file.hunks[0].lines.map((l) => [l.oldNo, l.newNo])).toEqual([
      [1, null],
      [2, null],
    ])
  })

  it('recognises a renamed file with changes', () => {
    const [file] = parseUnifiedDiff(`diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 80%
rename from src/old-name.ts
rename to src/new-name.ts
index 1111111..2222222 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,2 +1,2 @@
 keep
-before
+after
`)

    expect(file).toMatchObject({
      status: 'renamed',
      oldPath: 'src/old-name.ts',
      newPath: 'src/new-name.ts',
      path: 'src/new-name.ts',
      isBinary: false,
    })
    expect(file.hunks).toHaveLength(1)
  })

  it('recognises a pure rename without hunks', () => {
    const files = parseUnifiedDiff(`diff --git a/a.ts b/b.ts
similarity index 100%
rename from a.ts
rename to b.ts
diff --git a/c.ts b/c.ts
index 1..2 100644
--- a/c.ts
+++ b/c.ts
@@ -1 +1 @@
-x
+y
`)

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({ status: 'renamed', oldPath: 'a.ts', newPath: 'b.ts', hunks: [] })
    expect(files[1].path).toBe('c.ts')
  })

  it('recognises a binary file', () => {
    const [file] = parseUnifiedDiff(`diff --git a/img/logo.png b/img/logo.png
index 1111111..2222222 100644
Binary files a/img/logo.png and b/img/logo.png differ
`)

    expect(file).toMatchObject({ path: 'img/logo.png', isBinary: true, status: 'modified', hunks: [] })
  })

  it('recognises a new binary file', () => {
    const [file] = parseUnifiedDiff(`diff --git a/img/new.png b/img/new.png
new file mode 100644
index 0000000..2222222
Binary files /dev/null and b/img/new.png differ
`)

    expect(file).toMatchObject({ path: 'img/new.png', isBinary: true, status: 'added', oldPath: null })
  })

  it('keeps a mode-only change as a file without hunks', () => {
    const [file] = parseUnifiedDiff(`diff --git a/run.sh b/run.sh
old mode 100644
new mode 100755
`)

    expect(file).toMatchObject({ path: 'run.sh', status: 'modified', hunks: [], isBinary: false })
  })
})

describe('parseUnifiedDiff: "\\ No newline at end of file"', () => {
  const raw = `--- a/x.txt
+++ b/x.txt
@@ -1,2 +1,2 @@
 keep
-last
\\ No newline at end of file
+last
\\ No newline at end of file
`

  it('flags the preceding line and does not create a line of its own', () => {
    const lines = parseUnifiedDiff(raw)[0].hunks[0].lines

    expect(lines).toHaveLength(3)
    expect(lines[1]).toMatchObject({ type: 'del', content: 'last', noNewline: true })
    expect(lines[2]).toMatchObject({ type: 'add', content: 'last', noNewline: true })
    expect(lines[0].noNewline).toBeFalsy()
  })

  it('does not count the marker as an addition or deletion', () => {
    const [file] = parseUnifiedDiff(raw)

    expect([file.additions, file.deletions]).toEqual([1, 1])
  })

  it('flags only the side that lacks the newline', () => {
    const lines = parseUnifiedDiff(`--- a/x
+++ b/x
@@ -1 +1,2 @@
 a
+b
\\ No newline at end of file
`)[0].hunks[0].lines

    expect(lines[0].noNewline).toBeFalsy()
    expect(lines[1]).toMatchObject({ type: 'add', noNewline: true })
  })
})
