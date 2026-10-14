import { tokenizeLines, type HighlightToken } from '@/entities/diff/lib/tokenize'
import type { DiffHunk, DiffLine } from '@/entities/diff/model/types'

export type HunkTokens = Map<DiffLine, HighlightToken[]>

const cache = new WeakMap<DiffHunk, Map<string | null, HunkTokens>>()

function tokenizeSide(lines: DiffLine[], language: string | null, into: HunkTokens) {
  const tokens = tokenizeLines(lines.map((l) => l.content).join('\n'), language)
  lines.forEach((line, i) => {
    if (!into.has(line)) into.set(line, tokens[i] ?? [])
  })
}

/**
 * Токены для каждой строки hunk. Старая и новая сторона токенизируются отдельно
 * (чтобы многострочные комментарии/строки не «склеивались» между del и add).
 * Результат кэшируется по hunk и языку.
 */
export function highlightHunk(hunk: DiffHunk, language: string | null): HunkTokens {
  let byLanguage = cache.get(hunk)
  if (!byLanguage) {
    byLanguage = new Map()
    cache.set(hunk, byLanguage)
  }
  const cached = byLanguage.get(language)
  if (cached) return cached

  const result: HunkTokens = new Map()
  // сначала новая сторона: context берёт токены оттуда
  tokenizeSide(
    hunk.lines.filter((l) => l.type !== 'del'),
    language,
    result,
  )
  tokenizeSide(
    hunk.lines.filter((l) => l.type === 'del'),
    language,
    result,
  )
  byLanguage.set(language, result)
  return result
}
