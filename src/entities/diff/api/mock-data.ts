import type { DiffFile } from '@/entities/diff/model/types'

export const mockDiffFiles: DiffFile[] = [
  {
    id: 'file-1',
    filePath: 'src/api/user.ts',
    language: 'typescript',
    status: 'modified',
    additions: 6,
    deletions: 2,
    hunks: [
      {
        id: 'file-1-hunk-1',
        header: '@@ -10,9 +10,13 @@',
        contextBefore: { startLine: 1, lineCount: 9 },
        lines: [
          {
            id: 'l1',
            type: 'context',
            oldLineNumber: 10,
            newLineNumber: 10,
            content: 'export async function getUser(id: string) {',
          },
          {
            id: 'l2',
            type: 'removed',
            oldLineNumber: 11,
            newLineNumber: null,
            content: '  const response = await client.get(`/users/${id}`)',
          },
          {
            id: 'l3',
            type: 'added',
            oldLineNumber: null,
            newLineNumber: 11,
            content: '  const response = await client.get(`/users/${id}`, { withMeta: true })',
          },
          { id: 'l4', type: 'added', oldLineNumber: null, newLineNumber: 12, content: '  if (!response.ok) {' },
          {
            id: 'l5',
            type: 'added',
            oldLineNumber: null,
            newLineNumber: 13,
            content: '    throw new UserNotFoundError(id)',
          },
          { id: 'l6', type: 'added', oldLineNumber: null, newLineNumber: 14, content: '  }' },
          { id: 'l7', type: 'context', oldLineNumber: 12, newLineNumber: 15, content: '  return response.data' },
          { id: 'l8', type: 'context', oldLineNumber: 13, newLineNumber: 16, content: '}' },
        ],
        contextAfter: { startLine: 17, lineCount: 24 },
      },
    ],
  },
  {
    id: 'file-2',
    filePath: 'src/api/client.ts',
    language: 'typescript',
    status: 'modified',
    additions: 2,
    deletions: 1,
    hunks: [
      {
        id: 'file-2-hunk-1',
        header: '@@ -1,5 +1,6 @@',
        contextBefore: null,
        lines: [
          {
            id: 'l1',
            type: 'context',
            oldLineNumber: 1,
            newLineNumber: 1,
            content: "import { logger } from './logger'",
          },
          {
            id: 'l2',
            type: 'removed',
            oldLineNumber: 2,
            newLineNumber: null,
            content: 'export function get(path: string) {',
          },
          {
            id: 'l3',
            type: 'added',
            oldLineNumber: null,
            newLineNumber: 2,
            content: 'export function get(path: string, options?: RequestOptions) {',
          },
          { id: 'l4', type: 'context', oldLineNumber: 3, newLineNumber: 3, content: '  logger.debug(`GET ${path}`)' },
        ],
        contextAfter: { startLine: 4, lineCount: 40 },
      },
    ],
  },
]

export function fetchMockDiff(mrId: string): Promise<DiffFile[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockDiffFiles), 400)
  }).then((files) => {
    void mrId
    return files as DiffFile[]
  })
}

export function fetchMockContext(startLine: number, lineCount: number): Promise<DiffLineStub[]> {
  const lines: DiffLineStub[] = Array.from({ length: lineCount }, (_, index) => ({
    id: `ctx-${startLine + index}`,
    type: 'context',
    oldLineNumber: startLine + index,
    newLineNumber: startLine + index,
    content: `  // context line ${startLine + index}`,
  }))
  return new Promise((resolve) => setTimeout(() => resolve(lines), 200))
}

type DiffLineStub = {
  id: string
  type: 'context'
  oldLineNumber: number
  newLineNumber: number
  content: string
}
