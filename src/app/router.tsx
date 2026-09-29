import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/guards/RequireAuth'
import { useMeQuery } from '@/entities/session'
import { LoginPage } from '@/pages/login'
import { OAuthCallbackPage } from '@/pages/oauth-callback'
import { ReposPlaceholderPage } from '@/pages/repos'

function RootRedirect() {
  const meQuery = useMeQuery()

  if (meQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  if (meQuery.isSuccess) {
    return <Navigate to="/repos" replace />
  }

  return <Navigate to="/login" replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/repos"
        element={
          <RequireAuth>
            <ReposPlaceholderPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
