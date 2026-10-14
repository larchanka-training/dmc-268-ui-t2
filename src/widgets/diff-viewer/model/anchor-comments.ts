import type { DiffFile, DiffLine } from '@/entities/diff'
import { sortBySeverity, type ReviewComment, type Severity } from '@/entities/review-comment'

export interface AnchoredComments {
  /** Замечания, привязанные к строкам diff (внутри — уже отсортированы по severity) */
  byLine: Map<DiffLine, ReviewComment[]>
  /** Замечания к файлу из diff, но к строке вне diff. Ключ — DiffFile.path */
  outOfDiffByFile: Map<string, ReviewComment[]>
  /** Замечания к файлам, которых нет в diff */
  orphans: ReviewComment[]
}

const lineKey = (side: 'old' | 'new', line: number) => `${side}:${line}`

/**
 * old-ключ получают del- и context-строки, new-ключ — add- и context-строки.
 * Так old-замечание ложится на удалённую строку, а new — на добавленную.
 */
function buildLineIndex(file: DiffFile): Map<string, DiffLine> {
  const index = new Map<string, DiffLine>()
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.oldNo !== null) {
        const key = lineKey('old', line.oldNo)
        if (!index.has(key)) index.set(key, line)
      }
      if (line.newNo !== null) {
        const key = lineKey('new', line.newNo)
        if (!index.has(key)) index.set(key, line)
      }
    }
  }
  return index
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function anchorComments(files: readonly DiffFile[], comments: readonly ReviewComment[]): AnchoredComments {
  const fileByPath = new Map<string, DiffFile>()
  for (const file of files) {
    for (const path of [file.newPath, file.oldPath]) {
      if (path !== null && !fileByPath.has(path)) fileByPath.set(path, file)
    }
  }
  const indexes = new Map<DiffFile, Map<string, DiffLine>>()

  const byLine = new Map<DiffLine, ReviewComment[]>()
  const outOfDiff = new Map<string, ReviewComment[]>()
  const orphans: ReviewComment[] = []

  for (const comment of comments) {
    const file = fileByPath.get(comment.filePath)
    if (!file) {
      orphans.push(comment)
      continue
    }
    let index = indexes.get(file)
    if (!index) {
      index = buildLineIndex(file)
      indexes.set(file, index)
    }
    const line = index.get(lineKey(comment.side, comment.line))
    if (line) pushTo(byLine, line, comment)
    else pushTo(outOfDiff, file.path, comment)
  }

  for (const [line, list] of byLine) byLine.set(line, sortBySeverity(list))
  for (const [path, list] of outOfDiff) outOfDiff.set(path, sortBySeverity(list))

  return { byLine, outOfDiffByFile: outOfDiff, orphans: sortBySeverity(orphans) }
}

/** Замечания под одной строкой таблицы (в split — под парой ячеек), одной стопкой. */
export function commentsForRow(
  byLine: ReadonlyMap<DiffLine, ReviewComment[]>,
  cells: readonly (DiffLine | null)[],
): ReviewComment[] {
  const unique = new Set(cells.filter((cell): cell is DiffLine => cell !== null))
  const merged: ReviewComment[] = []
  for (const line of unique) merged.push(...(byLine.get(line) ?? []))
  return sortBySeverity(merged)
}

/** id первого замечания каждого severity в порядке отображения: файлы → строки → вне diff → вне PR. */
export function firstCommentIdBySeverity(
  files: readonly DiffFile[],
  anchored: AnchoredComments,
): Partial<Record<Severity, string>> {
  const result: Partial<Record<Severity, string>> = {}
  const visit = (comments: readonly ReviewComment[] | undefined) => {
    for (const comment of comments ?? []) result[comment.severity] ??= comment.id
  }

  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) visit(anchored.byLine.get(line))
    }
    visit(anchored.outOfDiffByFile.get(file.path))
  }
  visit(anchored.orphans)
  return result
}

/** Сколько замечаний относится к файлу (строки diff + вне diff). */
export function commentCountForFile(file: DiffFile, anchored: AnchoredComments): number {
  let count = anchored.outOfDiffByFile.get(file.path)?.length ?? 0
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) count += anchored.byLine.get(line)?.length ?? 0
  }
  return count
}

/** id замечания → путь файла diff, в котором оно показывается. Замечания вне PR-файлов не входят. */
export function fileOfComments(files: readonly DiffFile[], anchored: AnchoredComments): Map<string, string> {
  const result = new Map<string, string>()
  const add = (comments: readonly ReviewComment[] | undefined, path: string) => {
    for (const comment of comments ?? []) result.set(comment.id, path)
  }
  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) add(anchored.byLine.get(line), file.path)
    }
    add(anchored.outOfDiffByFile.get(file.path), file.path)
  }
  return result
}
