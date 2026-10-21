import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { meQueryKey, useMeQuery } from '@/entities/session/api/queries'
import { refreshSession, SessionHttpError } from '@/entities/session/api/session-client'
import { msUntilSessionRefresh } from '@/entities/session/lib/refresh-schedule'

const UNAVAILABLE_RETRY_MS = 60_000

/**
 * While `/me` is loaded, schedule `POST /auth/refresh` before `expires_at`.
 * 401 clears session; 503 leaves the user signed in and retries later.
 */
export function useSessionAutoRefresh(): void {
  const queryClient = useQueryClient()
  const meQuery = useMeQuery()
  const me = meQuery.data
  const inFlight = useRef(false)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (!me?.csrfToken || !me.session.expiresAt) return

    const delay = msUntilSessionRefresh(me.session.expiresAt)
    const timer = window.setTimeout(() => {
      if (inFlight.current) return
      inFlight.current = true
      void (async () => {
        try {
          const next = await refreshSession(me.csrfToken)
          queryClient.setQueryData(meQueryKey, next)
        } catch (error) {
          if (error instanceof SessionHttpError && error.status === 401) {
            await queryClient.resetQueries({ queryKey: meQueryKey })
            return
          }
          window.setTimeout(() => setRetryNonce((n) => n + 1), UNAVAILABLE_RETRY_MS)
        } finally {
          inFlight.current = false
        }
      })()
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [me?.csrfToken, me?.session.expiresAt, queryClient, retryNonce])
}
