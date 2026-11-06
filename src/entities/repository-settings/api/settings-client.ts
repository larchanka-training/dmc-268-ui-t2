import type { RepositorySettings, SettingsSnapshot, ReviewPreferences, RepositoryRulesPreview } from '../model/types'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'

export class SettingsHttpError extends NonRetryableError {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly etag: string | null = null,
    readonly retryable = false,
    readonly retryAfter: number | null = null,
  ) {
    super(`Settings request failed (${status})`)
  }
}

async function httpError(response: Response): Promise<SettingsHttpError> {
  let body: Record<string, unknown> = {}
  try {
    const value: unknown = await response.json()
    if (value && typeof value === 'object') body = value as Record<string, unknown>
  } catch {
    /* A non-JSON failure is still an HTTP refusal. */
  }
  return new SettingsHttpError(
    response.status,
    typeof body.code === 'string' ? body.code : undefined,
    response.headers.get('ETag'),
    body.retryable === true,
    typeof body.retry_after === 'number' ? body.retry_after : null,
  )
}

export async function fetchRepositorySettings(repositoryId: string, signal?: AbortSignal): Promise<SettingsSnapshot> {
  const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/settings`, {
    credentials: 'include',
    signal,
  })
  return settingsResponse(response)
}

async function settingsResponse(response: Response): Promise<SettingsSnapshot> {
  if (!response.ok) throw await httpError(response)
  const etag = response.headers.get('ETag')
  if (!etag) throw new NonRetryableError('Settings response is incomplete')
  const value: unknown = await response.json()
  if (
    !isRecord(value) ||
    typeof value.version !== 'string' ||
    !value.version ||
    typeof value.created_at !== 'string' ||
    typeof value.output_language !== 'string' ||
    !value.output_language ||
    !isRecord(value.rules) ||
    !strings(value.rules.instructions) ||
    !isRecord(value.ignores) ||
    !strings(value.ignores.globs) ||
    !['max_starts_per_hour', 'max_active_jobs', 'surrounding_lines'].every(
      (key) =>
        typeof value[key] === 'number' && Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 2147483647,
    ) ||
    typeof value.auto_review_enabled !== 'boolean' ||
    !strings(value.base_branches) ||
    typeof value.minimum_severity !== 'string' ||
    !['critical', 'high', 'medium', 'low'].includes(value.minimum_severity)
  ) {
    throw new NonRetryableError('Settings response is incomplete')
  }
  return { settings: value as unknown as RepositorySettings, etag }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export async function replaceRepositorySettings(
  repositoryId: string,
  baseline: SettingsSnapshot,
  preferences: ReviewPreferences,
  csrfToken: string,
): Promise<SettingsSnapshot> {
  const saved = baseline.settings
  const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/settings`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, 'If-Match': baseline.etag },
    body: JSON.stringify({
      rules: saved.rules,
      ignores: saved.ignores,
      max_starts_per_hour: saved.max_starts_per_hour,
      max_active_jobs: saved.max_active_jobs,
      output_language: saved.output_language,
      surrounding_lines: saved.surrounding_lines,
      auto_review_enabled: preferences.auto_review_enabled,
      base_branches: preferences.base_branches,
      minimum_severity: preferences.minimum_severity,
    }),
  })
  return settingsResponse(response)
}

export async function fetchRepositoryRulesPreview(
  repositoryId: string,
  signal?: AbortSignal,
): Promise<RepositoryRulesPreview> {
  const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/rules-preview`, {
    credentials: 'include',
    signal,
  })
  if (!response.ok) throw await httpError(response)
  const value: unknown = await response.json()
  if (
    !isRecord(value) ||
    typeof value.default_branch !== 'string' ||
    !value.default_branch ||
    !strings(value.instructions) ||
    !isRecord(value.provenance)
  ) {
    throw new NonRetryableError('File preview response is incomplete')
  }
  const source = value.provenance
  const sha = (item: unknown) => typeof item === 'string' && /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/.test(item)
  if (
    source.path !== '.review/rules.md' ||
    source.parser_version !== 'rules-md/1' ||
    !sha(source.revision) ||
    (source.blob_sha !== null && !sha(source.blob_sha)) ||
    (source.content_digest !== null &&
      (typeof source.content_digest !== 'string' || !/^[0-9a-f]{64}$/.test(source.content_digest))) ||
    typeof source.state !== 'string' ||
    !['absent', 'empty', 'valid', 'invalid'].includes(source.state) ||
    !strings(source.diagnostics) ||
    !source.diagnostics.every((code) => /^[a-z_]+:[0-9]+$/.test(code)) ||
    typeof source.tenant !== 'string' ||
    typeof source.repository_external_id !== 'string' ||
    !isRecord(source.severities) ||
    !Object.values(source.severities).every(
      (severity) => typeof severity === 'string' && ['critical', 'high', 'medium', 'low'].includes(severity),
    ) ||
    !strings(source.allowed_rule_refs)
  ) {
    throw new NonRetryableError('File preview response is incomplete')
  }
  return value as unknown as RepositoryRulesPreview
}
