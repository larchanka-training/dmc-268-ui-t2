import { Link } from 'react-router'

export function RouteNotFound() {
  return (
    <div
      data-testid="route-not-found"
      className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <p aria-hidden="true" className="text-6xl font-bold tracking-tight text-muted-foreground/60">
        404
      </p>
      <h1 className="text-xl font-semibold text-foreground">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground">Проверьте адрес или вернитесь на главную.</p>
      <Link
        to="/"
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent/60 focus-visible:outline focus-visible:outline-2"
      >
        Вернуться на главную
      </Link>
    </div>
  )
}
