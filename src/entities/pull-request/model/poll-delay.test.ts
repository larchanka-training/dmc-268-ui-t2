import { expect, test } from 'vitest'
import {
  INITIAL_POLL_TRACKER,
  nextPollDelayMs,
  reviewRefetchIntervalMs,
  trackPoll,
  type PublicationStatus,
  type ReviewStatus,
} from '@/entities/pull-request'

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

/** Feeds responses through the tracker the way the query does: one call per fetched response. */
function delaysFor(signatures: string[]) {
  let tracker = INITIAL_POLL_TRACKER
  return signatures.map((signature, index) => {
    tracker = trackPoll(tracker, { signature, updatedAt: index + 1, transport: 'polling' })
    return reviewRefetchIntervalMs({
      transport: 'polling',
      review: review('QUEUED'),
      unchangedPolls: tracker.unchangedPolls,
    })
  })
}

test('each unchanged poll lengthens the very next delay: 3 → 6 → 12 → 15 s', () => {
  expect(delaysFor(['a', 'a', 'a', 'a', 'a'])).toEqual([3000, 6000, 12000, 15000, 15000])
})

test('a changed response resets the backoff to 3 s', () => {
  expect(delaysFor(['a', 'a', 'b'])).toEqual([3000, 6000, 3000])
})

test('repeated interval checks for the same response do not count as extra polls', () => {
  const first = trackPoll(INITIAL_POLL_TRACKER, { signature: 'a', updatedAt: 1, transport: 'polling' })
  const second = trackPoll(first, { signature: 'a', updatedAt: 2, transport: 'polling' })

  expect(trackPoll(second, { signature: 'a', updatedAt: 2, transport: 'polling' })).toBe(second)
})

test('responses that arrive over SSE never count towards the polling backoff', () => {
  const first = trackPoll(INITIAL_POLL_TRACKER, { signature: 'a', updatedAt: 1, transport: 'stream' })

  expect(trackPoll(first, { signature: 'a', updatedAt: 2, transport: 'stream' }).unchangedPolls).toBe(0)
})
