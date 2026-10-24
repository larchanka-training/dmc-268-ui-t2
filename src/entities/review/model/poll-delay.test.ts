import { expect, test } from 'vitest'
import { nextPollDelayMs } from '@/entities/review'

test('polls every 3 seconds while the status keeps changing', () => {
  expect(nextPollDelayMs(0)).toBe(3000)
})

test('doubles the delay for each unchanged poll and caps it at 15 seconds', () => {
  expect([1, 2, 3, 10].map(nextPollDelayMs)).toEqual([6000, 12000, 15000, 15000])
})
