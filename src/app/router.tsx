import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/app/guards/RequireAuth'
import { useMeQuery } from '@/entities/session'
import { ConnectRepoPage } from '@/pages/connect-repo'
import { LoginPage } from '@/pages/login'
import { OAuthCallbackPage } from '@/pages/oauth-callback'
import { ReposPage } from '@/pages/repos'
import { ReviewPage } from '@/pages/review'
import { AppShell } from '@/widgets/app-shell'

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

function AuthenticatedShell() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route element={<AuthenticatedShell />}>
        <Route path="/repos" element={<ReposPage />} />
        <Route path="/repos/connect" element={<ConnectRepoPage />} />
        <Route path="/review" element={<ReviewPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
