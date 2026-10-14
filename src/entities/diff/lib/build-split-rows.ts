import type { DiffLine, SplitRow } from '@/entities/diff/model/types'

/**
 * Выравнивает строки hunk для side-by-side:
 * context стоит с обеих сторон, подряд идущие del-строки пара́тся
 * с последующими add-строками по порядку, остаток идёт против пустой ячейки.
 */
export function buildSplitRows(lines: readonly DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.type === 'context') {
      rows.push({ left: line, right: line })
      index += 1
      continue
    }

    const dels: DiffLine[] = []
    const adds: DiffLine[] = []
    while (index < lines.length && lines[index].type === 'del') dels.push(lines[index++])
    while (index < lines.length && lines[index].type === 'add') adds.push(lines[index++])

    const height = Math.max(dels.length, adds.length)
    for (let i = 0; i < height; i += 1) {
      rows.push({ left: dels[i] ?? null, right: adds[i] ?? null })
    }
  }

  return rows
}
