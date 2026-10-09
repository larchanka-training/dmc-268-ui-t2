import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { consumeReturnUrl, fetchMe, logoutSession, meQueryKey, SessionHttpError } from '@/entities/session'

async function clearLeftoverSession(): Promise<void> {
  try {
    await logoutSession()
  } catch {
    // Best-effort; cookie may already be absent.
  }
}

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const started = useRef(false)

  const error = params.get('error')
  const code = params.get('code')
  const state = params.get('state')

  useEffect(() => {
    if (started.current) return
    started.current = true

    void (async () => {
      if (error) {
        await clearLeftoverSession()
        await queryClient.resetQueries({ queryKey: meQueryKey })
        navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true })
        return
      }

      // Incomplete OAuth query on the FE callback (real IdP drift / bad handoff).
      if (code !== null || state !== null) {
        if (!code || !state) {
          await clearLeftoverSession()
          await queryClient.resetQueries({ queryKey: meQueryKey })
          navigate('/login?error=missing_code', { replace: true })
          return
        }
      }

      try {
        const me = await fetchMe()
        queryClient.setQueryData(meQueryKey, me)
        navigate(consumeReturnUrl(), { replace: true })
      } catch (err) {
        await clearLeftoverSession()
        await queryClient.resetQueries({ queryKey: meQueryKey })
        if (err instanceof SessionHttpError && err.status === 401) {
          navigate('/login?error=session', { replace: true })
          return
        }
        navigate('/login?error=bootstrap', { replace: true })
      }
    })()
  }, [code, error, navigate, queryClient, state])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </main>
  )
}
