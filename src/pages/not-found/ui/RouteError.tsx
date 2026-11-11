export function RouteError() {
  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <p aria-hidden="true" className="text-6xl font-bold tracking-tight text-muted-foreground/60">
        500
      </p>
      <h1 className="text-xl font-semibold text-foreground">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground">Произошла непредвиденная ошибка. Попробуйте обновить страницу.</p>
      <button
        type="button"
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent/60 focus-visible:outline focus-visible:outline-2"
        onClick={() => window.location.reload()}
      >
        Обновить страницу
      </button>
    </div>
  )
}
