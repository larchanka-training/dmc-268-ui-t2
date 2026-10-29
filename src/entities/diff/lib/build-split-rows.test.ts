import { describe, expect, it } from 'vitest'
import { buildSplitRows } from '@/entities/diff/lib/build-split-rows'
import type { DiffLine } from '@/entities/diff/model/types'

const ctx = (oldNo: number, newNo: number, content = `c${oldNo}`): DiffLine => ({
  type: 'context',
  oldNo,
  newNo,
  content,
})
const del = (oldNo: number, content = `d${oldNo}`): DiffLine => ({ type: 'del', oldNo, newNo: null, content })
const add = (newNo: number, content = `a${newNo}`): DiffLine => ({ type: 'add', oldNo: null, newNo, content })

describe('buildSplitRows', () => {
  it('puts a context line on both sides (same object)', () => {
    const line = ctx(1, 1)
    const [row] = buildSplitRows([line])

    expect(row.left).toBe(line)
    expect(row.right).toBe(line)
  })

  it('pairs a del block with the following add block', () => {
    const [d1, a1] = [del(2), add(2)]

    expect(buildSplitRows([d1, a1])).toEqual([{ left: d1, right: a1 }])
  })

  it('pairs line by line and leaves empty cells on the right when there are more deletions', () => {
    const [d1, d2, a1] = [del(1), del(2), add(1)]

    expect(buildSplitRows([d1, d2, a1])).toEqual([
      { left: d1, right: a1 },
      { left: d2, right: null },
    ])
  })

  it('leaves empty cells on the left when there are more additions', () => {
    const [d1, a1, a2, a3] = [del(1), add(1), add(2), add(3)]

    expect(buildSplitRows([d1, a1, a2, a3])).toEqual([
      { left: d1, right: a1 },
      { left: null, right: a2 },
      { left: null, right: a3 },
    ])
  })

  it('renders a lone add or del against an empty cell', () => {
    const [a, d] = [add(5), del(7)]

    expect(buildSplitRows([a])).toEqual([{ left: null, right: a }])
    expect(buildSplitRows([d])).toEqual([{ left: d, right: null }])
  })

  it('keeps blocks separated by context lines and preserves order', () => {
    const [c1, d1, a1, c2, a2, c3] = [ctx(1, 1), del(2), add(2), ctx(3, 3), add(4), ctx(4, 5)]

    expect(buildSplitRows([c1, d1, a1, c2, a2, c3])).toEqual([
      { left: c1, right: c1 },
      { left: d1, right: a1 },
      { left: c2, right: c2 },
      { left: null, right: a2 },
      { left: c3, right: c3 },
    ])
  })

  it('pairs each del/add block independently', () => {
    const [d1, a1, d2, a2] = [del(1), add(1), del(2), add(2)]

    expect(buildSplitRows([d1, a1, d2, a2])).toEqual([
      { left: d1, right: a1 },
      { left: d2, right: a2 },
    ])
  })

  it('returns no rows for no lines', () => {
    expect(buildSplitRows([])).toEqual([])
  })
})
