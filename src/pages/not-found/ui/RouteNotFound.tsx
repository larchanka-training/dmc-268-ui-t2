import { Link } from 'react-router'

export function RouteNotFound() {
  return (
    <div data-testid="route-not-found" className="py-12 text-center">
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Проверьте адрес или{' '}
        <Link to="/" className="underline">
          вернитесь на главную
        </Link>
        .
      </p>
    </div>
  )
}
