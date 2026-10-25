import type { DiffFile, DiffHunk, DiffLine, DiffLineType } from '@/entities/diff/model/types'
import type { DiffFileWire, DiffHunkWire, DiffLineWire, DiffWire } from '@/entities/diff/model/wire'

const LINE_TYPE: Record<DiffLineWire['kind'], DiffLineType> = {
  added: 'add',
  deleted: 'del',
  context: 'context',
}

function parseLine(wire: DiffLineWire): DiffLine {
  return { type: LINE_TYPE[wire.kind], oldNo: wire.old_line, newNo: wire.new_line, content: wire.content }
}

function parseHunk(wire: DiffHunkWire): DiffHunk {
  return {
    header: `@@ -${wire.old_start},${wire.old_lines} +${wire.new_start},${wire.new_lines} @@`,
    oldStart: wire.old_start,
    oldLines: wire.old_lines,
    newStart: wire.new_start,
    newLines: wire.new_lines,
    // Бэкенд не хранит текст после второго `@@`
    section: '',
    lines: wire.lines.map(parseLine),
  }
}

function parseFile(wire: DiffFileWire): DiffFile {
  const hunks = wire.hunks.map(parseHunk)
  const lines = hunks.flatMap((hunk) => hunk.lines)
  return {
    oldPath: wire.status === 'added' ? null : (wire.previous_path ?? wire.path),
    newPath: wire.status === 'deleted' ? null : wire.path,
    path: wire.path,
    status: wire.status,
    // Бинарные файлы бэкенд не кладёт в diff (они уходят в coverage.skipped)
    isBinary: false,
    hunks,
    additions: lines.filter((line) => line.type === 'add').length,
    deletions: lines.filter((line) => line.type === 'del').length,
  }
}

export function parseDiff(wire: DiffWire): DiffFile[] {
  return wire.files.map(parseFile)
}
