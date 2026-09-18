import type { CommentThread } from '@/entities/comment/model/types'

const duoAgent = { id: 'agent-duo', displayName: 'Review Agent', isAiAgent: true }
const humanReviewer = { id: 'user-1', displayName: 'Oksana Arhipova', isAiAgent: false }

export const mockCommentThreads: CommentThread[] = [
  {
    id: 'thread-1',
    filePath: 'src/api/user.ts',
    anchorLine: { side: 'new', lineNumber: 11 },
    status: 'open',
    comments: [
      {
        id: 'comment-1',
        author: duoAgent,
        body: 'Вызов `client.get` теперь принимает второй аргумент `withMeta`. Убедитесь, что все остальные вызовы `getUser` обновлены — иначе тип ответа может не совпасть с ожидаемым.',
        createdAt: '2026-09-14T10:12:00Z',
      },
      {
        id: 'comment-2',
        author: humanReviewer,
        body: 'Проверила — остальные вызовы не используют meta, поведение обратно совместимо.',
        createdAt: '2026-09-14T10:20:00Z',
      },
    ],
  },
  {
    id: 'thread-2',
    filePath: 'src/api/user.ts',
    anchorLine: { side: 'new', lineNumber: 13 },
    status: 'open',
    comments: [
      {
        id: 'comment-3',
        author: duoAgent,
        body: 'Здесь бросается `UserNotFoundError`, но выше по файлу нет обработки этого исключения на вызывающей стороне. Стоит проверить, что вызывающий код готов к новому типу ошибки.',
        createdAt: '2026-09-14T10:13:00Z',
      },
    ],
  },
]

export function fetchMockComments(mrId: string): Promise<CommentThread[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockCommentThreads), 350)
  }).then((threads) => {
    void mrId
    return threads as CommentThread[]
  })
}
