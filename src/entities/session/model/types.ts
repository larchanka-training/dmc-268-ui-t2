/** VCS provider seam — GitHub is the Sprint 2 login path; GitLab is additive later. */
export type VcsProvider = 'github' | 'gitlab'

/**
 * Typed auth contract sketch (SoT for FE + MSW until OpenAPI exists).
 * Paths under same-origin `/api/v1`:
 * - GET  /auth/github/start
 * - GET  /auth/github/callback
 * - POST /auth/logout
 * - GET  /me
 */
export interface MeUser {
  id: string
  displayName: string
  avatarUrl: string | null
  provider: VcsProvider
  capabilities: string[]
}
