import { describe, expect, it } from 'vitest'
import { parseDiff } from '@/entities/diff/lib/parse-diff-wire'
import type { DiffWire } from '@/entities/diff/model/wire'

const WIRE: DiffWire = {
  files: [
    {
      path: 'src/a.ts',
      previous_path: null,
      status: 'modified',
      hunks: [
        {
          old_start: 10,
          old_lines: 2,
          new_start: 10,
          new_lines: 3,
          lines: [
            { kind: 'context', content: 'a', old_line: 10, new_line: 10 },
            { kind: 'deleted', content: 'b', old_line: 11, new_line: null },
            { kind: 'added', content: 'c', old_line: null, new_line: 11 },
            { kind: 'added', content: 'd', old_line: null, new_line: 12 },
          ],
        },
      ],
    },
    { path: 'src/new.ts', previous_path: null, status: 'added', hunks: [] },
    { path: 'src/gone.ts', previous_path: null, status: 'deleted', hunks: [] },
    { path: 'src/to.ts', previous_path: 'src/from.ts', status: 'renamed', hunks: [] },
  ],
}

describe('parseDiff (OpenAPI Diff → DiffFile[])', () => {
  it('maps line kinds and numbers, builds the hunk header and counts +/-', () => {
    const [file] = parseDiff(WIRE)

    expect(file.hunks[0].header).toBe('@@ -10,2 +10,3 @@')
    expect(file.hunks[0].lines.map((line) => [line.type, line.oldNo, line.newNo])).toEqual([
      ['context', 10, 10],
      ['del', 11, null],
      ['add', null, 11],
      ['add', null, 12],
    ])
    expect([file.additions, file.deletions]).toEqual([2, 1])
    expect(file.isBinary).toBe(false)
  })

  it('derives old/new paths from status and previous_path', () => {
    const paths = parseDiff(WIRE).map((file) => [file.status, file.oldPath, file.newPath, file.path])

    expect(paths).toEqual([
      ['modified', 'src/a.ts', 'src/a.ts', 'src/a.ts'],
      ['added', null, 'src/new.ts', 'src/new.ts'],
      ['deleted', 'src/gone.ts', null, 'src/gone.ts'],
      ['renamed', 'src/from.ts', 'src/to.ts', 'src/to.ts'],
    ])
  })

  it('returns no files for a saved empty diff', () => {
    expect(parseDiff({ files: [] })).toEqual([])
  })
})
