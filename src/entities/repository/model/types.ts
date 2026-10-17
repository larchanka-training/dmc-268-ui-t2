/**
 * UI-facing repository models after parsing OpenAPI wire.
 * Wire SoT: API `openapi.yaml` (Repository / AvailableRepository / pages).
 */

export interface RepositoryCapabilities {
  canStartReview: true
  canManageSettings: boolean
}

/** Connected repository (local id + role). */
export interface Repository {
  id: string
  provider: 'github'
  externalId: string
  owner: string
  name: string
  role: 'reviewer' | 'admin'
  capabilities: RepositoryCapabilities
}

/** Provider-backed repo not yet connected for this user. */
export interface AvailableRepository {
  provider: 'github'
  externalId: string
  owner: string
  name: string
}

export interface RepositoryPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface ConnectRepositoryBody {
  provider: 'github'
  externalId: string
}

/** OpenAPI connected Repository JSON. */
export interface RepositoryWire {
  id: string
  provider: 'github'
  external_id: string
  owner: string
  name: string
  role: 'reviewer' | 'admin'
  capabilities: {
    can_start_review: true
    can_manage_settings: boolean
  }
}

export interface AvailableRepositoryWire {
  provider: 'github'
  external_id: string
  owner: string
  name: string
}

export interface RepositoryPageWire<T> {
  items: T[]
  next_cursor: string | null
}

export function parseRepository(wire: RepositoryWire): Repository {
  return {
    id: wire.id,
    provider: wire.provider,
    externalId: wire.external_id,
    owner: wire.owner,
    name: wire.name,
    role: wire.role,
    capabilities: {
      canStartReview: true,
      canManageSettings: wire.capabilities.can_manage_settings,
    },
  }
}

export function parseAvailableRepository(wire: AvailableRepositoryWire): AvailableRepository {
  return {
    provider: wire.provider,
    externalId: wire.external_id,
    owner: wire.owner,
    name: wire.name,
  }
}

export function parseRepositoryPage(wire: RepositoryPageWire<RepositoryWire>): RepositoryPage<Repository> {
  return {
    items: wire.items.map(parseRepository),
    nextCursor: wire.next_cursor,
  }
}

export function parseAvailableRepositoryPage(
  wire: RepositoryPageWire<AvailableRepositoryWire>,
): RepositoryPage<AvailableRepository> {
  return {
    items: wire.items.map(parseAvailableRepository),
    nextCursor: wire.next_cursor,
  }
}

export function repositoryDisplayName(repo: { owner: string; name: string }): string {
  return `${repo.owner}/${repo.name}`
}
