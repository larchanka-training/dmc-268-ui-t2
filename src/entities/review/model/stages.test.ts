import { expect, test } from 'vitest'
import { getReviewStages } from '@/entities/review'

function states(...args: Parameters<typeof getReviewStages>) {
  return getReviewStages(...args).map((stage) => `${stage.id}:${stage.state}`)
}

test('LLM_PROCESSING marks context done and analysis active', () => {
  expect(states({ status: 'LLM_PROCESSING', publicationStatus: 'NOT_READY', plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:active',
    'publication:pending',
  ])
})

test.each(['QUEUED', 'FETCHING_DIFF', 'PARSING_CONTEXT'] as const)('%s keeps context collection active', (status) => {
  expect(states({ status, publicationStatus: 'NOT_READY', plannedChunks: 0 })).toEqual([
    'context:active',
    'analysis:pending',
    'publication:pending',
  ])
})

test('COMPLETED with PENDING publication makes publication the active step', () => {
  expect(states({ status: 'COMPLETED', publicationStatus: 'PENDING', plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:done',
    'publication:active',
  ])
})

test('COMPLETED and PUBLISHED marks every step done', () => {
  expect(states({ status: 'COMPLETED', publicationStatus: 'PUBLISHED', plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:done',
    'publication:done',
  ])
})

test.each(['FAILED', 'UNKNOWN'] as const)('publication %s marks the publication step failed', (publicationStatus) => {
  expect(states({ status: 'COMPLETED', publicationStatus, plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:done',
    'publication:failed',
  ])
})

test('PARTIAL review marks analysis as partial and still tracks publication', () => {
  expect(states({ status: 'PARTIAL', publicationStatus: 'PUBLISHED', plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:partial',
    'publication:done',
  ])
})

test('PARTIAL publication marks the publication step partial', () => {
  expect(states({ status: 'COMPLETED', publicationStatus: 'PARTIAL', plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:done',
    'publication:partial',
  ])
})

test('FAILED review with planned chunks failed during analysis and skips publication', () => {
  expect(states({ status: 'FAILED', publicationStatus: 'NOT_READY', plannedChunks: 3 })).toEqual([
    'context:done',
    'analysis:failed',
    'publication:skipped',
  ])
})

test('FAILED review without planned chunks failed during context collection', () => {
  expect(states({ status: 'FAILED', publicationStatus: 'NOT_READY', plannedChunks: 0 })).toEqual([
    'context:failed',
    'analysis:skipped',
    'publication:skipped',
  ])
})

test('SKIPPED review skips every step', () => {
  expect(states({ status: 'SKIPPED', publicationStatus: 'NOT_READY', plannedChunks: 0 })).toEqual([
    'context:skipped',
    'analysis:skipped',
    'publication:skipped',
  ])
})
