import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { SessionHttpError, useMeQuery } from '@/entities/session'

/** Gate protected routes: loading while `me` unknown; 401 → login with returnUrl. */
export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation()
  const meQuery = useMeQuery()

  if (meQuery.isPending || (meQuery.isFetching && !meQuery.data && !meQuery.isError)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </main>
    )
  }

  const unauthorized = meQuery.isError && meQuery.error instanceof SessionHttpError && meQuery.error.status === 401

  if (unauthorized || meQuery.isError) {
    const returnUrl = `${location.pathname}${location.search}`
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} replace />
  }

  if (!meQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </main>
    )
  }

  return children
}
