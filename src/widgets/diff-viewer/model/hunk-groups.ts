import type { DiffHunk, DiffLine } from '@/entities/diff'

export type HunkBlock = { kind: 'hunk'; index: number } | { kind: 'gap'; key: string; rows: number }

function hunkHasComment(hunk: DiffHunk, byLine: ReadonlyMap<DiffLine, readonly unknown[]>): boolean {
  return hunk.lines.some((line) => (byLine.get(line)?.length ?? 0) > 0)
}

/** Open hunks that hold a comment. Consecutive quiet hunks become one gap. */
export function groupHunks(
  hunks: readonly DiffHunk[],
  byLine: ReadonlyMap<DiffLine, readonly unknown[]>,
  openGapKeys: ReadonlySet<string>,
): HunkBlock[] {
  const blocks: HunkBlock[] = []
  let pending: { headers: string[]; rows: number; indexes: number[] } | null = null

  const flush = () => {
    if (!pending) return
    const key = pending.headers.join('\n')
    if (openGapKeys.has(key)) {
      for (const index of pending.indexes) blocks.push({ kind: 'hunk', index })
    } else {
      blocks.push({ kind: 'gap', key, rows: pending.rows })
    }
    pending = null
  }

  hunks.forEach((hunk, index) => {
    if (hunkHasComment(hunk, byLine)) {
      flush()
      blocks.push({ kind: 'hunk', index })
      return
    }
    pending ??= { headers: [], rows: 0, indexes: [] }
    pending.headers.push(hunk.header)
    pending.rows += hunk.lines.length
    pending.indexes.push(index)
  })
  flush()
  return blocks
}
