import { useSearchParams, Navigate } from 'react-router-dom'
import { ContinueWithGithubButton } from '@/features/login-with-github'
import { useMeQuery } from '@/entities/session'
import { resolveReturnUrl } from '@/shared/lib/return-url'

export function LoginPage() {
  const [params] = useSearchParams()
  const meQuery = useMeQuery()
  const oauthError = params.get('error')

  if (meQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Checking session…</p>
      </main>
    )
  }

  if (meQuery.isSuccess) {
    const dest = resolveReturnUrl(params.get('returnUrl'))
    return <Navigate to={dest} replace />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="text-sm text-muted-foreground">Continue with your GitHub account to open the cabinet.</p>
        </div>
        {oauthError ? (
          <p className="text-sm text-destructive" role="alert">
            Sign-in was cancelled or failed. You can try again.
          </p>
        ) : null}
        <ContinueWithGithubButton />
      </div>
    </main>
  )
}
