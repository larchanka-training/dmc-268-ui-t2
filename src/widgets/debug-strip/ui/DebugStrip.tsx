import { useEffect, useState } from 'react'

type HealthBody = {
  status?: string
  commit?: string
}

type ApiView = { phase: 'loading' } | { phase: 'ok'; ms: number; commit: string } | { phase: 'down' }

export function DebugStrip() {
  const [pageMs] = useState(() => Math.round(performance.now()))
  const uiSha = import.meta.env.VITE_GIT_SHA || 'unknown'
  const [api, setApi] = useState<ApiView>({ phase: 'loading' })

  useEffect(() => {
    const started = performance.now()
    let active = true
    void fetch('/healthcheck')
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
        if (active) setApi({ phase: 'down' })
      })
    return () => {
      active = false
    }
  }, [])

  const apiTiming = api.phase === 'ok' ? `api ${api.ms}ms` : api.phase === 'down' ? 'api down' : 'api …'
  const commitText = api.phase === 'ok' ? ` · api ${api.commit}` : api.phase === 'down' ? ' · api unknown' : ''
  const statusLabel = api.phase === 'ok' ? 'API alive' : api.phase === 'down' ? 'API down' : null

  return (
    <p
      className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-3 py-1 text-xs text-muted-foreground"
      {...(statusLabel === null ? {} : { role: 'status' as const, 'aria-label': statusLabel })}
    >
      {`page ${pageMs}ms · ${apiTiming} · ui ${uiSha}${commitText}`}
    </p>
  )
}
