import { useCommentThreadsQuery } from '@/entities/comment'
import { useDiffQuery } from '@/entities/diff'
import { DiffViewer } from '@/widgets/diff-viewer'

const MOCK_MR_ID = '123'

export function ReviewPage() {
  const diffQuery = useDiffQuery(MOCK_MR_ID)
  const commentsQuery = useCommentThreadsQuery(MOCK_MR_ID)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">Merge Request #{MOCK_MR_ID} — Review</h1>

      {diffQuery.isLoading && <p className="text-sm text-muted-foreground">Загрузка диффа...</p>}
      {diffQuery.isError && <p className="text-sm text-destructive">Не удалось загрузить дифф.</p>}

      <div className="flex flex-col gap-4">
        {diffQuery.data?.map((file) => (
          <DiffViewer key={file.id} file={file} threads={commentsQuery.data ?? []} />
        ))}
      </div>
    </div>
  )
}
