export function PullRequestNotFound({ prId }: { prId: string }) {
  return (
    <div data-testid="pr-not-found" className="py-12 text-center">
      <h1 className="text-xl font-semibold">PR не найден</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pull request «{prId}» не существует или был удалён.</p>
    </div>
  )
}
