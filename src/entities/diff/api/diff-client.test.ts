import { afterEach, expect, test, vi } from 'vitest'
import { fetchReviewDiff } from '@/entities/diff'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('fetchReviewDiff maps the stored review diff into viewer files', async () => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return Response.json({
        files: [
          {
            path: 'src/api/user.ts',
            previous_path: null,
            status: 'deleted',
            hunks: [
              {
                old_start: 10,
                old_lines: 2,
                new_start: 10,
                new_lines: 2,
                lines: [
                  { kind: 'context', content: 'export async function getUser(id) {', old_line: 10, new_line: 10 },
                  { kind: 'deleted', content: '  return client.get(id)', old_line: 11, new_line: null },
                  { kind: 'added', content: '  return client.get(id, meta)', old_line: null, new_line: 11 },
                ],
              },
            ],
          },
        ],
      })
    }),
  )

  const files = await fetchReviewDiff('rev-1')

  expect(calls).toEqual(['/api/v1/reviews/rev-1/diff'])
  expect(files).toEqual([
    {
      id: 'src/api/user.ts',
      filePath: 'src/api/user.ts',
      language: 'ts',
      status: 'removed',
      additions: 1,
      deletions: 1,
      hunks: [
        {
          id: 'src/api/user.ts#0',
          header: '@@ -10,2 +10,2 @@',
          contextBefore: null,
          contextAfter: null,
          lines: [
            {
              id: 'src/api/user.ts#0:0',
              type: 'context',
              oldLineNumber: 10,
              newLineNumber: 10,
              content: 'export async function getUser(id) {',
            },
            {
              id: 'src/api/user.ts#0:1',
              type: 'removed',
              oldLineNumber: 11,
              newLineNumber: null,
              content: '  return client.get(id)',
            },
            {
              id: 'src/api/user.ts#0:2',
              type: 'added',
              oldLineNumber: null,
              newLineNumber: 11,
              content: '  return client.get(id, meta)',
            },
          ],
        },
      ],
    },
  ])
})
