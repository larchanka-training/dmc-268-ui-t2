import { http, HttpResponse } from 'msw'
import type { Analytics, AuditReview, Quotas } from '@/entities/repository-insights'
import { MOCK_REVIEWS } from '@/entities/pull-request'
import { MSW_SESSION_COOKIE, readSessionCookie } from './session-cookie'
import { listConnectedRepositoryPage } from './repos-store'

const dayMs = 86_400_000
function period(request: Request) {
  const days = Number(new URL(request.url).searchParams.get('days') ?? 30)
  const today = new Date().toISOString().slice(0, 10)
  const end = Date.parse(`${today}T00:00:00Z`)
  return { days, end, today }
}

/** Demo data only. Runtime reads the authenticated API, never these fixtures. */
function auditRows(end: number): AuditReview[] {
  return Object.values(MOCK_REVIEWS).map(({ review }, index) => ({
    id: review.id,
    pull_request_number: review.pull_request_number,
    requested_head_sha: review.requested_head_sha,
    status: review.status,
    publication_status: review.publication_status,
    created_at: new Date(end - index * dayMs + 12 * 3600_000).toISOString(),
    started_at: review.started_at ? new Date(end - index * dayMs + 12 * 3600_000 + 2000).toISOString() : null,
    finished_at: review.finished_at
      ? new Date(end - index * dayMs + 12 * 3600_000 + (index === 0 ? 100000 : 4000)).toISOString()
      : null,
    trigger_type: 'manual',
    actor: index === 2 ? null : { id: `demo-${index}`, login: index === 0 ? 'ada' : 'grace' },
    usage: {
      input_tokens: review.usage?.input_tokens ?? null,
      output_tokens: review.usage?.output_tokens ?? null,
      reserved_input_tokens: 0,
      reserved_output_tokens: 0,
      status: review.usage ? 'complete' : 'unavailable',
    },
    limit_reasons: index === 0 ? ['file_limit', 'line_limit'] : [],
    cost: { amount: null, currency: null, status: 'unavailable' },
  }))
}

function access(id: string, cookies: Record<string, string>) {
  if ((cookies[MSW_SESSION_COOKIE] ?? readSessionCookie()) !== 'ok') return new HttpResponse(null, { status: 401 })
  if (!listConnectedRepositoryPage().items.some((repo) => repo.id === id))
    return new HttpResponse(null, { status: 404 })
  return null
}

export const insightsHandlers = [
  http.get('/api/v1/repositories/:id/analytics', ({ params, request, cookies }) => {
    const error = access(String(params.id), cookies)
    if (error) return error
    const { days, end, today } = period(request)
    if (![7, 30, 90].includes(days)) return new HttpResponse(null, { status: 422 })
    const empty = String(params.id).endsWith('1002')
    const findings = Array.from({ length: days }, (_, index) => ({
      date: new Date(end - (days - index - 1) * dayMs).toISOString().slice(0, 10),
      security: empty ? 0 : index % 3,
      correctness: empty ? 0 : index % 5,
      performance: empty ? 0 : index % 2,
      maintainability: empty ? 0 : index % 4,
    }))
    const result: Analytics = {
      period: { date_from: findings[0].date, date_to: today, timezone: 'UTC' },
      totals: {
        reviews: empty ? 0 : days,
        findings: findings.reduce(
          (total, day) => total + day.security + day.correctness + day.performance + day.maintainability,
          0,
        ),
      },
      findings_by_day: findings,
      average_duration_ms: empty ? null : 98000,
      duration_sample_count: empty ? 0 : days - 1,
    }
    return HttpResponse.json(result)
  }),
  http.get('/api/v1/repositories/:id/reviews', ({ params, request, cookies }) => {
    const error = access(String(params.id), cookies)
    if (error) return error
    const url = new URL(request.url)
    const { end } = period(request)
    const status = url.searchParams.get('status')
    const rows = String(params.id).endsWith('1002')
      ? []
      : auditRows(end).filter((row) => !status || row.status === status)
    const offset = url.searchParams.get('cursor') === 'demo:2' ? 2 : 0
    return HttpResponse.json({
      items: rows.slice(offset, offset + 2),
      next_cursor: rows.length > offset + 2 ? 'demo:2' : null,
    })
  }),
  http.get('/api/v1/repositories/:id/quotas', ({ params, cookies }) => {
    const error = access(String(params.id), cookies)
    if (error) return error
    const full = String(params.id).endsWith('1003')
    const result: Quotas = {
      starts_per_hour: {
        limit: 10,
        used: full ? 10 : 3,
        remaining: full ? 0 : 7,
        resets_at: new Date((Math.floor(Date.now() / 3600_000) + 1) * 3600_000).toISOString(),
        scope: 'repository_user',
      },
      active_jobs: { limit: 2, used: full ? 2 : 1, remaining: full ? 0 : 1, scope: 'repository' },
      daily_tokens: { status: 'unavailable' },
    }
    return HttpResponse.json(result)
  }),
]
