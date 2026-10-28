import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiPullRequestDataSource } from '@/entities/pull-request'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('createDataSource', () => {
  it('returns ApiPullRequestDataSource even when VITE_DATA_SOURCE is mock', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'mock')
    const { createDataSource } = await import('@/app/providers/create-data-source')

    expect(createDataSource()).toBeInstanceOf(ApiPullRequestDataSource)
  })
})
