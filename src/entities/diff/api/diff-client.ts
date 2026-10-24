import type { DiffFile, DiffFileStatus, DiffLineType } from '@/entities/diff/model/types'
import { getJson } from '@/shared/api/http'

/** OpenAPI `Diff` (`GET /reviews/{id}/diff`). */
interface DiffWire {
  files: {
    path: string
    previous_path: string | null
    status: 'added' | 'modified' | 'deleted' | 'renamed'
    hunks: {
      old_start: number
      old_lines: number
      new_start: number
      new_lines: number
      lines: {
        kind: 'added' | 'deleted' | 'context'
        content: string
        old_line: number | null
        new_line: number | null
      }[]
    }[]
  }[]
}

const FILE_STATUS: Record<DiffWire['files'][number]['status'], DiffFileStatus> = {
  added: 'added',
  modified: 'modified',
  deleted: 'removed',
  renamed: 'renamed',
}

const LINE_TYPE: Record<DiffWire['files'][number]['hunks'][number]['lines'][number]['kind'], DiffLineType> = {
  added: 'added',
  deleted: 'removed',
  context: 'context',
}

export const reviewDiffPath = (reviewId: string) => `/api/v1/reviews/${encodeURIComponent(reviewId)}/diff`

function parseDiff(wire: DiffWire): DiffFile[] {
  return wire.files.map((file) => {
    const lines = file.hunks.flatMap((hunk) => hunk.lines)
    return {
      id: file.path,
      filePath: file.path,
      language: file.path.split('.').pop() ?? '',
      status: FILE_STATUS[file.status],
      additions: lines.filter((line) => line.kind === 'added').length,
      deletions: lines.filter((line) => line.kind === 'deleted').length,
      hunks: file.hunks.map((hunk, hunkIndex) => {
        const hunkId = `${file.path}#${hunkIndex}`
        return {
          id: hunkId,
          header: `@@ -${hunk.old_start},${hunk.old_lines} +${hunk.new_start},${hunk.new_lines} @@`,
          // The stored diff has no context endpoint, so hunks cannot be expanded.
          contextBefore: null,
          contextAfter: null,
          lines: hunk.lines.map((line, lineIndex) => ({
            id: `${hunkId}:${lineIndex}`,
            type: LINE_TYPE[line.kind],
            oldLineNumber: line.old_line,
            newLineNumber: line.new_line,
            content: line.content,
          })),
        }
      }),
    }
  })
}

export async function fetchReviewDiff(reviewId: string): Promise<DiffFile[]> {
  return parseDiff(await getJson<DiffWire>(reviewDiffPath(reviewId)))
}
