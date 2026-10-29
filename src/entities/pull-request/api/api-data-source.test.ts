import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiPullRequestDataSource, NotImplementedError } from '@/entities/pull-request'

afterEach(() => vi.restoreAllMocks())

describe('ApiPullRequestDataSource', () => {
  const ds = new ApiPullRequestDataSource()

  it.each([
    ['getReview', () => ds.getReview()],
    ['getPullRequest', () => ds.getPullRequest()],
    ['getDiff', () => ds.getDiff()],
    ['getReviewComments', () => ds.getReviewComments()],
  ])('%s rejects with NotImplementedError and does not call fetch', async (method, call) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await expect(call()).rejects.toThrow(new NotImplementedError(method))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
