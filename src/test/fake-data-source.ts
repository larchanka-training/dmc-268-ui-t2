import { parseUnifiedDiff } from '@/entities/diff'
import { ReviewNotFoundError } from '@/entities/pull-request'
import type { PullRequestDataSource } from '@/entities/pull-request'
import { TEST_COMMENTS, TEST_DIFF, TEST_PR, TEST_REVIEW } from '@/test/fixtures'

/** Детерминированный источник: знает только TEST_REVIEW, остальные — «не найдено». */
export function createFakeDataSource(overrides: Partial<PullRequestDataSource> = {}): PullRequestDataSource {
  const ensureKnown = (id: string) => {
    if (id !== TEST_REVIEW.id) throw new ReviewNotFoundError(id)
  }
  return {
    getReview: async (id) => {
      ensureKnown(id)
      return TEST_REVIEW
    },
    getPullRequest: async (repositoryId, number) =>
      repositoryId === TEST_REVIEW.repositoryId && number === TEST_PR.number ? TEST_PR : null,
    getDiff: async (id) => {
      ensureKnown(id)
      return parseUnifiedDiff(TEST_DIFF)
    },
    getReviewComments: async (id) => {
      ensureKnown(id)
      return TEST_COMMENTS
    },
    ...overrides,
  }
}
