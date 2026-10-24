import { expect, test } from 'vitest'
import { nextPollDelayMs, reviewRefetchIntervalMs, type PublicationStatus, type ReviewStatus } from '@/entities/review'

test('polls every 3 seconds while the status keeps changing', () => {
  expect(nextPollDelayMs(0)).toBe(3000)
})

test('doubles the delay for each unchanged poll and caps it at 15 seconds', () => {
  expect([1, 2, 3, 10].map(nextPollDelayMs)).toEqual([6000, 12000, 15000, 15000])
})

const review = (status: ReviewStatus, publicationStatus: PublicationStatus = 'NOT_READY') => ({
  status,
  publicationStatus,
})

test('while SSE is live, LLM analysis still refetches detail every 5 seconds for chunk progress', () => {
  expect(reviewRefetchIntervalMs({ transport: 'stream', review: review('LLM_PROCESSING'), unchangedPolls: 0 })).toBe(
    5000,
  )
})

test.each(['QUEUED', 'PARSING_CONTEXT'] as const)('while SSE is live, %s relies on the stream alone', (status) => {
  expect(reviewRefetchIntervalMs({ transport: 'stream', review: review(status), unchangedPolls: 0 })).toBe(false)
})

test('polling fallback uses the 3→15 s backoff in every active status', () => {
  expect(reviewRefetchIntervalMs({ transport: 'polling', review: review('QUEUED'), unchangedPolls: 0 })).toBe(3000)
  expect(reviewRefetchIntervalMs({ transport: 'polling', review: review('LLM_PROCESSING'), unchangedPolls: 2 })).toBe(
    12000,
  )
})

test.each(['stream', 'polling'] as const)('a settled review is never refetched (%s)', (transport) => {
  expect(reviewRefetchIntervalMs({ transport, review: review('COMPLETED', 'PUBLISHED'), unchangedPolls: 0 })).toBe(
    false,
  )
})
