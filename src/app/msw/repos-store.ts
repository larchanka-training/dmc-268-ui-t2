import type { AvailableRepositoryWire, RepositoryWire } from '@/entities/repository/model/types'

/** Seed pool for MSW — fresh session has none connected. external_id matches OpenAPI digit pattern. */
export const MSW_AVAILABLE_SEED: AvailableRepositoryWire[] = [
  {
    provider: 'github',
    external_id: '1001',
    owner: 'acme',
    name: 'payments-api',
  },
  {
    provider: 'github',
    external_id: '1002',
    owner: 'acme',
    name: 'web-dashboard',
  },
  {
    provider: 'github',
    external_id: '1003',
    owner: 'acme',
    name: 'worker-jobs',
  },
]

const connectedByExternalId = new Map<string, RepositoryWire>()

function toConnectedWire(seed: AvailableRepositoryWire, role: 'reviewer' | 'admin' = 'reviewer'): RepositoryWire {
  return {
    id: `connected-${seed.external_id}`,
    provider: 'github',
    external_id: seed.external_id,
    owner: seed.owner,
    name: seed.name,
    role,
    capabilities: {
      can_start_review: true,
      can_manage_settings: role === 'admin',
    },
  }
}

export function listConnectedRepositoryPage(): { items: RepositoryWire[]; next_cursor: null } {
  return { items: Array.from(connectedByExternalId.values()), next_cursor: null }
}

export function listAvailableRepositoryPage(): { items: AvailableRepositoryWire[]; next_cursor: null } {
  const connectedIds = new Set(connectedByExternalId.keys())
  return {
    items: MSW_AVAILABLE_SEED.filter((repo) => !connectedIds.has(repo.external_id)),
    next_cursor: null,
  }
}

export function connectRepositoryInStore(
  provider: string,
  externalId: string,
): { status: 'created' | 'existing'; repository: RepositoryWire } | { status: 'not_found' } {
  const existing = connectedByExternalId.get(externalId)
  if (existing && existing.provider === provider) {
    return { status: 'existing', repository: existing }
  }
  const seed = MSW_AVAILABLE_SEED.find((repo) => repo.external_id === externalId && repo.provider === provider)
  if (!seed) {
    return { status: 'not_found' }
  }
  const connected = toConnectedWire(seed)
  connectedByExternalId.set(externalId, connected)
  return { status: 'created', repository: connected }
}

/** Test/dev helper — not used by production UI. */
export function resetRepositoryStore(): void {
  connectedByExternalId.clear()
}
