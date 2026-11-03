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

/** Demo seeds with scripted connect outcomes (see docs/proposals/msw-bot-connect-start-review.md). */
const BOT_ACCESS_EXTERNAL_ID = '1002'
const MISCONFIGURED_BOT_EXTERNAL_ID = '1003'
export const MSW_BOT_LOGIN = 'dmc-bot-msw'

/** Connect attempts per seed that needs the bot invited first. */
const connectAttempts = new Map<string, number>()

export type ConnectOutcome =
  | { status: 'created' | 'existing'; repository: RepositoryWire }
  | { status: 'not_found' }
  | { status: 'bot_access_required'; botLogin: string; accessUrl: string }
  | { status: 'service_unavailable' }

export function isConnectedRepositoryId(repositoryId: string): boolean {
  return Array.from(connectedByExternalId.values()).some((repo) => repo.id === repositoryId)
}

export function connectRepositoryInStore(provider: string, externalId: string): ConnectOutcome {
  const existing = connectedByExternalId.get(externalId)
  if (existing && existing.provider === provider) {
    return { status: 'existing', repository: existing }
  }
  const seed = MSW_AVAILABLE_SEED.find((repo) => repo.external_id === externalId && repo.provider === provider)
  if (!seed) {
    return { status: 'not_found' }
  }
  if (externalId === MISCONFIGURED_BOT_EXTERNAL_ID) {
    return { status: 'service_unavailable' }
  }
  if (externalId === BOT_ACCESS_EXTERNAL_ID) {
    const attempt = (connectAttempts.get(externalId) ?? 0) + 1
    connectAttempts.set(externalId, attempt)
    if (attempt === 1) {
      return {
        status: 'bot_access_required',
        botLogin: MSW_BOT_LOGIN,
        accessUrl: `https://github.com/${seed.owner}/${seed.name}/settings/access`,
      }
    }
  }
  const connected = toConnectedWire(seed, 'admin')
  connectedByExternalId.set(externalId, connected)
  return { status: 'created', repository: connected }
}

/** Test/dev helper — not used by production UI. */
export function resetRepositoryStore(): void {
  connectedByExternalId.clear()
  connectAttempts.clear()
}
