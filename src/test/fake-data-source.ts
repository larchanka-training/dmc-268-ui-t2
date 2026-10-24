import { PullRequestNotFoundError } from '@/entities/pull-request'
import type { PullRequestDataSource } from '@/entities/pull-request'
import { TEST_COMMENTS, TEST_DIFF, TEST_PR } from '@/test/fixtures'

/** Детерминированный источник: знает только PR 42, остальные — «не найден». */
export function createFakeDataSource(overrides: Partial<PullRequestDataSource> = {}): PullRequestDataSource {
  const ensureKnown = (id: string) => {
    if (id !== TEST_PR.id) throw new PullRequestNotFoundError(id)
  }
  return {
    getPullRequest: async (id) => {
      ensureKnown(id)
      return TEST_PR
    },
    getDiff: async (id) => {
      ensureKnown(id)
      return TEST_DIFF
    },
    getReviewComments: async (id) => {
      ensureKnown(id)
      return TEST_COMMENTS
    },
    ...overrides,
  }
}
