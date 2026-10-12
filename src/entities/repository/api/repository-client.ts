import type {
  AvailableRepository,
  AvailableRepositoryWire,
  ConnectRepositoryBody,
  Repository,
  RepositoryPage,
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

async function repositoryFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
  })
}

export async function fetchConnectedRepositories(): Promise<Repository[]> {
  const response = await repositoryFetch(REPOSITORIES_PATH)
  if (!response.ok) {
    throw new RepositoryHttpError(response.status)
  }
  const wire = (await response.json()) as RepositoryPageWire<RepositoryWire>
  const page: RepositoryPage<Repository> = parseRepositoryPage(wire)
  return page.items
}

export async function fetchAvailableRepositories(): Promise<AvailableRepository[]> {
  const response = await repositoryFetch(REPOSITORIES_AVAILABLE_PATH)
  if (!response.ok) {
    throw new RepositoryHttpError(response.status)
  }
  const wire = (await response.json()) as RepositoryPageWire<AvailableRepositoryWire>
  return parseAvailableRepositoryPage(wire).items
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
