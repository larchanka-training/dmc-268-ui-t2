export function PageLoading() {
  return (
    <p role="status" className="py-8 text-center text-sm text-muted-foreground">
      Загрузка…
    </p>
  )
}

export function PageError() {
  return (
    <p role="alert" className="py-8 text-center text-sm text-destructive">
      Не удалось загрузить ревью. Попробуйте обновить страницу.
    </p>
  )
}

export function DiffPending() {
  return (
    <p
      data-testid="diff-pending"
      className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground"
    >
      Diff ещё не сохранён — ревью пока не дошло до этого шага.
    </p>
  )
}

export function EmptyDiff() {
  return (
    <p
      data-testid="empty-diff"
      className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground"
    >
      Diff пуст — в этом PR нет изменений файлов.
    </p>
  )
}
