import { Navigate } from 'react-router'
import { useMeQuery } from '@/entities/session'

export function RootRedirect() {
  const meQuery = useMeQuery()

  if (meQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  return <Navigate to={meQuery.isSuccess ? '/repos' : '/login'} replace />
}
