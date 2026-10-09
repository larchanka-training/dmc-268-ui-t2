import type { Repository } from '@/entities/repository'

/** Seed pool for MSW — fresh session has none connected. */
export const MSW_AVAILABLE_SEED: Repository[] = [
  {
    id: 'avail-1',
    provider: 'github',
    externalId: 'gh-1001',
    fullName: 'acme/payments-api',
    defaultBranch: 'main',
  },
  {
    id: 'avail-2',
    provider: 'github',
    externalId: 'gh-1002',
    fullName: 'acme/web-dashboard',
    defaultBranch: 'main',
  },
  {
    id: 'avail-3',
    provider: 'github',
    externalId: 'gh-1003',
    fullName: 'acme/worker-jobs',
    defaultBranch: 'develop',
  },
]

const connectedByExternalId = new Map<string, Repository>()

export function listConnectedRepositories(): Repository[] {
  return Array.from(connectedByExternalId.values())
}

export function listAvailableRepositories(): Repository[] {
  const connectedIds = new Set(connectedByExternalId.keys())
  return MSW_AVAILABLE_SEED.filter((repo) => !connectedIds.has(repo.externalId))
}

export function connectRepositoryInStore(provider: string, externalId: string): Repository | 'conflict' | 'not_found' {
  if (connectedByExternalId.has(externalId)) {
    return 'conflict'
  }
  const seed = MSW_AVAILABLE_SEED.find((repo) => repo.externalId === externalId && repo.provider === provider)
  if (!seed) {
    return 'not_found'
  }
  const connected: Repository = {
    ...seed,
    id: `connected-${seed.externalId}`,
  }
  connectedByExternalId.set(externalId, connected)
  return connected
}

/** Test/dev helper — not used by production UI. */
export function resetRepositoryStore(): void {
  connectedByExternalId.clear()
}
