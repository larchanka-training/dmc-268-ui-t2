import type { DiffFile, DiffHunk, DiffLine } from '@/entities/diff/model/types'

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/
const GIT_HEADER = /^diff --git a\/(.+) b\/(.+)$/
const BINARY_FILES = /^Binary files (.+) and (.+) differ$/
const NO_NEWLINE_MARKER = '\\'
const DEV_NULL = '/dev/null'

interface FileDraft {
  oldPath: string | null
  newPath: string | null
  isBinary: boolean
  hunks: DiffHunk[]
}

interface HunkCursor {
  hunk: DiffHunk
  oldLeft: number
  newLeft: number
  oldNo: number
  newNo: number
}

function newDraft(oldPath: string | null = null, newPath: string | null = null): FileDraft {
  return { oldPath, newPath, isBinary: false, hunks: [] }
}

/** `a/src/x.ts\t2024-01-01` → `src/x.ts`; `/dev/null` → null */
function cleanPath(raw: string): string | null {
  let path = raw.split('\t')[0].trim()
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1)
  if (path === DEV_NULL) return null
  return path.replace(/^[ab]\//, '')
}

function finalizeFile(draft: FileDraft): DiffFile {
  const { oldPath, newPath } = draft
  let additions = 0
  let deletions = 0
  for (const hunk of draft.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') additions += 1
      else if (line.type === 'del') deletions += 1
    }
  }

  let status: DiffFile['status'] = 'modified'
  if (oldPath === null && newPath !== null) status = 'added'
  else if (newPath === null && oldPath !== null) status = 'deleted'
  else if (oldPath !== newPath) status = 'renamed'

  return {
    oldPath,
    newPath,
    path: newPath ?? oldPath ?? '',
    status,
    isBinary: draft.isBinary,
    hunks: draft.hunks,
    additions,
    deletions,
  }
}

function startHunk(match: RegExpMatchArray, header: string): HunkCursor {
  const oldStart = Number(match[1])
  const oldLines = match[2] === undefined ? 1 : Number(match[2])
  const newStart = Number(match[3])
  const newLines = match[4] === undefined ? 1 : Number(match[4])
  return {
    hunk: { header, oldStart, oldLines, newStart, newLines, section: match[5].trim(), lines: [] },
    oldLeft: oldLines,
    newLeft: newLines,
    oldNo: oldStart,
    newNo: newStart,
  }
}

/** Разбирает строку внутри hunk. Возвращает false, если строка к hunk не относится. */
function consumeHunkLine(cursor: HunkCursor, line: string): boolean {
  const exhausted = cursor.oldLeft <= 0 && cursor.newLeft <= 0
  const lines = cursor.hunk.lines

  if (line.startsWith(NO_NEWLINE_MARKER)) {
    const last = lines[lines.length - 1]
    if (last) last.noNewline = true
    return true
  }
  if (exhausted) return false

  const marker = line[0]
  let parsed: DiffLine
  if (marker === '+') {
    parsed = { type: 'add', oldNo: null, newNo: cursor.newNo, content: line.slice(1) }
    cursor.newNo += 1
    cursor.newLeft -= 1
  } else if (marker === '-') {
    parsed = { type: 'del', oldNo: cursor.oldNo, newNo: null, content: line.slice(1) }
    cursor.oldNo += 1
    cursor.oldLeft -= 1
  } else if (marker === ' ' || line === '') {
    // Пустая строка без пробела — «обрезанная» редакторами пустая context-строка
    parsed = { type: 'context', oldNo: cursor.oldNo, newNo: cursor.newNo, content: line.slice(1) }
    cursor.oldNo += 1
    cursor.newNo += 1
    cursor.oldLeft -= 1
    cursor.newLeft -= 1
  } else {
    return false
  }
  lines.push(parsed)
  return true
}

/**
 * Разбирает unified diff (формат `git diff`) в файлы, hunks и строки.
 * Допускает diff без заголовка файла (только `@@`-блоки) — так выглядит suggestedFix.
 */
export function parseUnifiedDiff(raw: string): DiffFile[] {
  const input = raw.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
  if (input[input.length - 1] === '') input.pop()

  const files: DiffFile[] = []
  let draft: FileDraft | null = null
  let cursor: HunkCursor | null = null

  const closeFile = () => {
    if (draft) files.push(finalizeFile(draft))
    draft = null
    cursor = null
  }

  for (const line of input) {
    if (cursor && consumeHunkLine(cursor, line)) continue
    cursor = null

    const git = GIT_HEADER.exec(line)
    if (git) {
      closeFile()
      draft = newDraft(git[1], git[2])
      continue
    }

    const hunkMatch = HUNK_HEADER.exec(line)
    if (hunkMatch) {
      draft ??= newDraft()
      cursor = startHunk(hunkMatch, line)
      draft.hunks.push(cursor.hunk)
      continue
    }

    if (line.startsWith('--- ')) {
      // Без `diff --git` (обычный `diff -u`) каждая пара ---/+++ открывает новый файл
      if (!draft || draft.hunks.length > 0) {
        closeFile()
        draft = newDraft()
      }
      draft.oldPath = cleanPath(line.slice(4))
      continue
    }
    if (!draft) continue

    if (line.startsWith('+++ ')) draft.newPath = cleanPath(line.slice(4))
    else if (line.startsWith('new file mode')) draft.oldPath = null
    else if (line.startsWith('deleted file mode')) draft.newPath = null
    else if (line.startsWith('rename from ')) draft.oldPath = line.slice('rename from '.length)
    else if (line.startsWith('rename to ')) draft.newPath = line.slice('rename to '.length)
    else if (line.startsWith('GIT binary patch')) draft.isBinary = true
    else {
      const binary = BINARY_FILES.exec(line)
      if (binary) {
        draft.isBinary = true
        if (binary[1] === DEV_NULL) draft.oldPath = null
        if (binary[2] === DEV_NULL) draft.newPath = null
      }
    }
  }
  closeFile()

  return files
}
