import type {
  AvailableRepository,
  ConnectRepositoryBody,
  Repository,
  RepositoryPageWire,
  RepositoryWire,
} from '@/entities/repository/model/types'
import { parseAvailableRepositoryPage, parseRepository, parseRepositoryPage } from '@/entities/repository/model/types'
import {
  REPOSITORIES_AVAILABLE_PATH,
  REPOSITORIES_CONNECT_PATH,
  REPOSITORIES_PATH,
} from '@/entities/repository/model/paths'

export class RepositoryHttpError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Repository request failed (${status})`)
    this.name = 'RepositoryHttpError'
    this.status = status
  }
}

/** OpenAPI `Limit` default. A cursor is valid only for the limit it was issued with. */
const REPOSITORY_PAGE_LIMIT = 20

async function repositoryFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
  })
}

function repositoryPagePath(path: string, cursor: string | null): string {
  const params = new URLSearchParams({ limit: String(REPOSITORY_PAGE_LIMIT) })
  if (cursor !== null) {
    params.set('cursor', cursor)
  }
  return `${path}?${params.toString()}`
}

async function fetchEveryPage<TWire, TItem>(
  path: string,
  parsePage: (wire: RepositoryPageWire<TWire>) => { items: TItem[]; nextCursor: string | null },
): Promise<TItem[]> {
  const items: TItem[] = []
  let cursor: string | null = null
  do {
    const response = await repositoryFetch(repositoryPagePath(path, cursor))
    if (!response.ok) {
      throw new RepositoryHttpError(response.status)
    }
    const page = parsePage((await response.json()) as RepositoryPageWire<TWire>)
    items.push(...page.items)
    cursor = page.nextCursor
  } while (cursor !== null)
  return items
}

export async function fetchConnectedRepositories(): Promise<Repository[]> {
  return fetchEveryPage(REPOSITORIES_PATH, parseRepositoryPage)
}

export async function fetchAvailableRepositories(): Promise<AvailableRepository[]> {
  return fetchEveryPage(REPOSITORIES_AVAILABLE_PATH, parseAvailableRepositoryPage)
}

export async function connectRepository(body: ConnectRepositoryBody, csrfToken: string): Promise<Repository> {
  const response = await repositoryFetch(REPOSITORIES_CONNECT_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      provider: body.provider,
      external_id: body.externalId,
    }),
  })
  if (!response.ok) {
    throw new RepositoryHttpError(response.status)
  }
  const wire = (await response.json()) as RepositoryWire
  return parseRepository(wire)
}
