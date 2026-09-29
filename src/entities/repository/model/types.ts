import type { VcsProvider } from '@/entities/session'

/**
 * Typed repos contract sketch (SoT for FE + MSW until OpenAPI exists).
 * Paths under same-origin `/api/v1`:
 * - GET  /repositories           — connected to the product
 * - GET  /repositories/available — not yet connected
 * - POST /repositories/connect   — body `{ provider, externalId }`
 *
 * Unauthenticated → 401 (same session story as Spec 01).
 */
export interface Repository {
  id: string
  provider: VcsProvider
  externalId: string
  fullName: string
  defaultBranch: string
}

export interface ConnectRepositoryBody {
  provider: VcsProvider
  externalId: string
}
