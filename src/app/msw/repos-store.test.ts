import { beforeEach, describe, expect, it } from 'vitest'
import {
  connectRepositoryInStore,
  isConnectedRepositoryId,
  listConnectedRepositoryPage,
  resetRepositoryStore,
} from '@/app/msw/repos-store'

describe('repos-store connect outcomes', () => {
  beforeEach(() => {
    resetRepositoryStore()
  })

  it('connects 1001 on the first attempt', () => {
    const result = connectRepositoryInStore('github', '1001')

    expect(result).toMatchObject({ status: 'created', repository: { id: 'connected-1001' } })
    expect(isConnectedRepositoryId('connected-1001')).toBe(true)
  })

  it('asks for bot access on the first 1002 attempt and does not connect it', () => {
    const result = connectRepositoryInStore('github', '1002')

    expect(result).toEqual({
      status: 'bot_access_required',
      botLogin: 'dmc-bot-msw',
      accessUrl: 'https://github.com/acme/web-dashboard/settings/access',
    })
    expect(listConnectedRepositoryPage().items).toEqual([])
    expect(isConnectedRepositoryId('connected-1002')).toBe(false)
  })

  it('connects 1002 on the second attempt and replays as existing on the third', () => {
    connectRepositoryInStore('github', '1002')

    expect(connectRepositoryInStore('github', '1002')).toMatchObject({
      status: 'created',
      repository: { id: 'connected-1002' },
    })
    expect(connectRepositoryInStore('github', '1002')).toMatchObject({ status: 'existing' })
  })

  it('reports service unavailable for 1003 on every attempt and never connects it', () => {
    expect(connectRepositoryInStore('github', '1003')).toEqual({ status: 'service_unavailable' })
    expect(connectRepositoryInStore('github', '1003')).toEqual({ status: 'service_unavailable' })
    expect(isConnectedRepositoryId('connected-1003')).toBe(false)
  })

  it('keeps unknown seeds as not_found', () => {
    expect(connectRepositoryInStore('github', '9999')).toEqual({ status: 'not_found' })
  })

  it('reset clears connections and attempt counters', () => {
    connectRepositoryInStore('github', '1002')
    connectRepositoryInStore('github', '1002')
    connectRepositoryInStore('github', '1001')

    resetRepositoryStore()

    expect(listConnectedRepositoryPage().items).toEqual([])
    expect(connectRepositoryInStore('github', '1002')).toMatchObject({ status: 'bot_access_required' })
  })
})
