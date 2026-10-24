import { describe, expect, it } from 'vitest'
import { highlightHunk } from '@/entities/diff/lib/highlight-hunk'
import type { DiffHunk, DiffLine } from '@/entities/diff/model/types'

const context = (no: number, content: string): DiffLine => ({ type: 'context', oldNo: no, newNo: no, content })
const del = (no: number, content: string): DiffLine => ({ type: 'del', oldNo: no, newNo: null, content })
const add = (no: number, content: string): DiffLine => ({ type: 'add', oldNo: null, newNo: no, content })

const hunkOf = (lines: DiffLine[]): DiffHunk => ({
  header: '@@ -1,3 +1,3 @@',
  oldStart: 1,
  oldLines: 3,
  newStart: 1,
  newLines: 3,
  section: '',
  lines,
})

const typesOf = (tokens: { types: string[] }[] | undefined) => tokens?.flatMap((t) => t.types) ?? []

describe('highlightHunk', () => {
  it('highlights a deleted line using the context before it (multi-line comment)', () => {
    const open = context(1, '/**')
    const removed = del(2, ' * old note')
    const close = context(3, ' */')
    const tokens = highlightHunk(hunkOf([open, removed, add(2, ' * new note'), close]), 'typescript')

    expect(typesOf(tokens.get(removed))).toContain('comment')
  })

  it('takes context tokens from the new side', () => {
    const line = context(1, 'const a = 1')
    const tokens = highlightHunk(hunkOf([line, del(2, 'x'), add(2, 'y')]), 'typescript')

    expect(
      tokens
        .get(line)
        ?.map((t) => t.content)
        .join(''),
    ).toBe('const a = 1')
  })
})
