export function ReviewNotFound({ reviewId }: { reviewId: string }) {
  return (
    <div data-testid="review-not-found" className="py-12 text-center">
      <h1 className="text-xl font-semibold">Ревью не найдено</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ревью «{reviewId}» не существует или недоступно.</p>
    </div>
  )
}
