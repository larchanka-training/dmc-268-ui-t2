export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface RepositorySettings {
  version: string
  created_at: string
  rules: { instructions: string[] }
  ignores: { globs: string[] }
  max_starts_per_hour: number
  max_active_jobs: number
  output_language: string
  surrounding_lines: number
  auto_review_enabled: boolean
  base_branches: string[]
  minimum_severity: Severity
}

export interface SettingsSnapshot {
  settings: RepositorySettings
  etag: string
}

export type ReviewPreferences = Pick<RepositorySettings, 'auto_review_enabled' | 'base_branches' | 'minimum_severity'>

export interface RepositoryRulesPreview {
  default_branch: string
  instructions: string[]
  provenance: {
    parser_version: 'rules-md/1'
    path: '.review/rules.md'
    tenant: string
    repository_external_id: string
    revision: string
    blob_sha: string | null
    content_digest: string | null
    state: 'absent' | 'empty' | 'valid' | 'invalid'
    diagnostics: string[]
    severities: Record<string, Severity>
    allowed_rule_refs: string[]
  }
}
