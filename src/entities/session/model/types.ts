/** VCS provider seam — GitHub is the Sprint 2 login path; GitLab is additive later. */
export type VcsProvider = 'github' | 'gitlab'

/**
 * UI-facing `/me` after parsing OpenAPI wire (snake_case → camelCase).
 * Wire SoT: API `openapi.yaml` schema `Me`.
 */
export interface Me {
  user: {
    id: string
    provider: string
    externalId: string
    login: string
  }
  session: {
    expiresAt: string
  }
  csrfToken: string
}

/** OpenAPI `Me` JSON body. */
export interface MeWire {
  user: {
    id: string
    provider: string
    external_id: string
    login: string
  }
  session: {
    expires_at: string
  }
  csrf_token: string
}

export function parseMe(wire: MeWire): Me {
  return {
    user: {
      id: wire.user.id,
      provider: wire.user.provider,
      externalId: wire.user.external_id,
      login: wire.user.login,
    },
    session: {
      expiresAt: wire.session.expires_at,
    },
    csrfToken: wire.csrf_token,
  }
}
