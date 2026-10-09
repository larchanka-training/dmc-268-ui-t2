import type { ConnectRepositoryBody, Repository } from '@/entities/repository/model/types'
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
  return (await response.json()) as Repository[]
}

export async function fetchAvailableRepositories(): Promise<Repository[]> {
  const response = await repositoryFetch(REPOSITORIES_AVAILABLE_PATH)
  if (!response.ok) {
    throw new RepositoryHttpError(response.status)
  }
  return (await response.json()) as Repository[]
}

export async function connectRepository(body: ConnectRepositoryBody): Promise<Repository> {
  const response = await repositoryFetch(REPOSITORIES_CONNECT_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new RepositoryHttpError(response.status)
  }
  return (await response.json()) as Repository
}
