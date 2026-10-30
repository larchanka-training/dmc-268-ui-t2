import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { meQueryKey, useMeQuery } from '@/entities/session'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'
export interface DailyFindings {
  date: string
  security: number
  correctness: number
  performance: number
  maintainability: number
}
export interface Analytics {
  period: { date_from: string; date_to: string; timezone: 'UTC' }
  totals: { reviews: number; findings: number }
  findings_by_day: DailyFindings[]
  average_duration_ms: number | null
  duration_sample_count: number
}

export class InsightsHttpError extends NonRetryableError {
  constructor(readonly status: number) {
    super(
      status === 403 || status === 404
        ? 'This repository is unavailable or access was revoked.'
        : `Could not load repository insights (${status}).`,
    )
  }
}

export async function fetchAnalytics(repositoryId: string, days: number, signal?: AbortSignal): Promise<Analytics> {
  const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/analytics?days=${days}`, {
    credentials: 'include',
    signal,
  })
  if (!response.ok) throw new InsightsHttpError(response.status)
  return response.json() as Promise<Analytics>
}

export function useAnalytics(repositoryId: string, days: number) {
  const client = useQueryClient()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: ['repository-insights', userId, repositoryId, 'analytics', days],
    queryFn: async ({ signal }) => {
      try {
        return await fetchAnalytics(repositoryId, days, signal)
      } catch (error) {
        if (error instanceof InsightsHttpError && error.status === 401) {
          client.removeQueries({ queryKey: ['repository-insights'], type: 'inactive' })
          await client.resetQueries({ queryKey: meQueryKey })
        }
        throw error
      }
    },
    enabled: Boolean(repositoryId && userId),
  })
}

export interface Quotas {
  starts_per_hour: {
    limit: number
    used: number
    remaining: number
    resets_at: string | null
    scope: 'repository_user'
  }
  active_jobs: { limit: number; used: number; remaining: number; scope: 'repository' }
  daily_tokens: { status: 'unavailable' }
}

export function useQuotas(repositoryId: string) {
  const client = useQueryClient()
  const userId = useMeQuery().data?.user.id
  return useQuery({
    queryKey: ['repository-insights', userId, repositoryId, 'quotas'],
    queryFn: async ({ signal }): Promise<Quotas> => {
      const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/quotas`, {
        credentials: 'include',
        signal,
      })
      if (response.status === 401) await client.resetQueries({ queryKey: meQueryKey })
      if (!response.ok) throw new InsightsHttpError(response.status)
      return response.json() as Promise<Quotas>
    },
    enabled: Boolean(repositoryId && userId),
  })
}

export interface AuditReview {
  id: string
  pull_request_number: number
  requested_head_sha: string
  status: string
  publication_status: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  trigger_type: string
  actor: { id: string; login: string | null } | null
  usage: {
    input_tokens: number | null
    output_tokens: number | null
    reserved_input_tokens: number
    reserved_output_tokens: number
    status: 'complete' | 'incomplete' | 'unavailable'
  }
  limit_reasons: ('file_limit' | 'line_limit' | 'token_budget')[]
  cost: { amount: null; currency: null; status: 'unavailable' }
}
export interface AuditPage {
  items: AuditReview[]
  next_cursor: string | null
}

export function useAudit(repositoryId: string, days: number, status = '') {
  const client = useQueryClient()
  const userId = useMeQuery().data?.user.id
  return useInfiniteQuery({
    queryKey: ['repository-insights', userId, repositoryId, 'audit', days, status],
    initialPageParam: null as string | null,
    getNextPageParam: (page: AuditPage) => page.next_cursor ?? undefined,
    queryFn: async ({ signal, pageParam }): Promise<AuditPage> => {
      const params = new URLSearchParams({ days: String(days), limit: '20' })
      if (status) params.set('status', status)
      if (pageParam) params.set('cursor', pageParam)
      const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/reviews?${params}`, {
        credentials: 'include',
        signal,
      })
      if (response.status === 401) await client.resetQueries({ queryKey: meQueryKey })
      if (!response.ok) throw new InsightsHttpError(response.status)
      return response.json() as Promise<AuditPage>
    },
    enabled: Boolean(repositoryId && userId),
  })
}
