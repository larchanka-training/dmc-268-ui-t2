import { useEffect, useRef, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'

type HealthBody = {
  status?: string
  commit?: string
}

type ApiView = { phase: 'loading' } | { phase: 'ok'; ms: number; commit: string } | { phase: 'down' }

const HEALTHCHECK_TIMEOUT_MS = 3000

export function DebugStrip() {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}`
  const startedAt = useRef(0)
  const [sample, setSample] = useState<{ route: string; ms: number } | null>(null)
  const pageMs = sample?.route === routeKey ? sample.ms : null
  const inFlight = useIsFetching()
  const queryClient = useQueryClient()
  const uiSha = import.meta.env.VITE_GIT_SHA || 'unknown'
  const [api, setApi] = useState<ApiView>({ phase: 'loading' })

  useEffect(() => {
    const started = performance.now()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS)
    let active = true
    void fetch('/healthcheck', { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as HealthBody
        if (!active) return
        const commit = typeof body.commit === 'string' ? body.commit.trim() : ''
        if (response.status === 200 && body.status === 'ok' && commit !== '') {
          setApi({ phase: 'ok', ms: Math.round(performance.now() - started), commit })
          return
        }
        setApi({ phase: 'down' })
      })
      .catch(() => {
        if (!active) return
        setApi({ phase: 'down' })
      })
      .finally(() => {
        window.clearTimeout(timeout)
      })
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    startedAt.current = performance.now()
  }, [routeKey])

  useEffect(() => {
    if (pageMs !== null) return
    if (inFlight > 0 || queryClient.isFetching() > 0) return
    let active = true
    const timer = window.setTimeout(() => {
      if (!active || queryClient.isFetching() > 0) return
      setSample({ route: routeKey, ms: Math.round(performance.now() - startedAt.current) })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [inFlight, pageMs, queryClient, routeKey])

  const apiTiming = api.phase === 'ok' ? `api ${api.ms}ms` : api.phase === 'down' ? 'api down' : 'api …'
  const commitText = api.phase === 'ok' ? ` · api ${api.commit}` : api.phase === 'down' ? ' · api unknown' : ''
  const statusLabel = api.phase === 'ok' ? 'API alive' : api.phase === 'down' ? 'API down' : null

  return (
    <p
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-3 py-1 text-xs text-muted-foreground"
      {...(statusLabel === null ? {} : { role: 'status' as const, 'aria-label': statusLabel })}
    >
      {`${pageMs === null ? 'page …' : `page ${pageMs}ms`} · ${apiTiming} · ui ${uiSha}${commitText}`}
    </p>
  )
}
