import { expect, test, vi } from 'vitest'
import { openReviewStream, type ReviewEventSource } from '@/entities/pull-request'

const CONNECTING = 0
const OPEN = 1
const CLOSED = 2

class FakeEventSource implements ReviewEventSource {
  readyState = CONNECTING
  closed = false
  private listeners: Record<string, ((event: MessageEvent<string>) => void)[]> = {}

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners[type] = [...(this.listeners[type] ?? []), listener]
  }

  close() {
    this.closed = true
    this.readyState = CLOSED
  }

  emit(type: string, data: unknown) {
    this.readyState = OPEN
    for (const listener of this.listeners[type] ?? []) {
      listener(new MessageEvent(type, { data: JSON.stringify(data) }))
    }
  }

  fail(readyState: number) {
    this.readyState = readyState
    for (const listener of this.listeners.error ?? []) {
      listener(new MessageEvent('error'))
    }
  }
}

function setup() {
  const sources: FakeEventSource[] = []
  const onSnapshot = vi.fn()
  const onFallback = vi.fn()
  const close = openReviewStream(
    'rev-1',
    { onSnapshot, onFallback },
    {
      createEventSource: (url) => {
        const source = new FakeEventSource(url)
        sources.push(source)
        return source
      },
    },
  )
  return { sources, onSnapshot, onFallback, close }
}

function snapshotWire(status: string, publicationStatus: string, sequence = 1) {
  return { schema_version: 1, review_id: 'rev-1', sequence, status, publication_status: publicationStatus }
}

test('opens the review stream and reports snapshots in UI shape', () => {
  const { sources, onSnapshot } = setup()

  sources[0].emit('review.snapshot', snapshotWire('LLM_PROCESSING', 'NOT_READY', 4))

  expect(sources[0].url).toBe('/api/v1/reviews/rev-1/events/stream')
  expect(onSnapshot).toHaveBeenCalledWith({ sequence: 4, status: 'LLM_PROCESSING', publicationStatus: 'NOT_READY' })
})

test('closes the stream once analysis is terminal and publication has settled', () => {
  const { sources } = setup()

  sources[0].emit('review.snapshot', snapshotWire('COMPLETED', 'PENDING', 5))
  expect(sources[0].closed).toBe(false)

  sources[0].emit('review.snapshot', snapshotWire('COMPLETED', 'PUBLISHED', 6))
  expect(sources[0].closed).toBe(true)
})

test.each(['FAILED', 'SKIPPED'])('closes the stream for %s analysis that never reached publication', (status) => {
  const { sources } = setup()

  sources[0].emit('review.snapshot', snapshotWire(status, 'NOT_READY'))

  expect(sources[0].closed).toBe(true)
})

test('reopens a fresh stream (no replay cursor) after the browser gives up on the first one', () => {
  vi.useFakeTimers()
  const { sources, onFallback } = setup()

  sources[0].fail(CLOSED)
  vi.advanceTimersByTime(1000)

  expect(sources).toHaveLength(2)
  expect(sources[1].url).toBe('/api/v1/reviews/rev-1/events/stream')
  expect(onFallback).not.toHaveBeenCalled()
  vi.useRealTimers()
})

test('falls back to polling when the reopened stream fails before delivering a snapshot', () => {
  vi.useFakeTimers()
  const { sources, onFallback } = setup()

  sources[0].fail(CLOSED)
  vi.advanceTimersByTime(1000)
  sources[1].fail(CLOSED)
  vi.advanceTimersByTime(5000)

  expect(onFallback).toHaveBeenCalledTimes(1)
  expect(sources).toHaveLength(2)
  vi.useRealTimers()
})

test('a delivered snapshot resets the failure budget so later drops reconnect again', () => {
  vi.useFakeTimers()
  const { sources, onFallback } = setup()

  sources[0].fail(CLOSED)
  vi.advanceTimersByTime(1000)
  sources[1].emit('review.snapshot', snapshotWire('LLM_PROCESSING', 'NOT_READY', 2))
  sources[1].fail(CLOSED)
  vi.advanceTimersByTime(1000)

  expect(sources).toHaveLength(3)
  expect(onFallback).not.toHaveBeenCalled()
  vi.useRealTimers()
})

test('gives up on endless browser retries and falls back to polling', () => {
  const { sources, onFallback } = setup()

  sources[0].fail(CONNECTING)
  sources[0].fail(CONNECTING)
  expect(onFallback).not.toHaveBeenCalled()

  sources[0].fail(CONNECTING)

  expect(onFallback).toHaveBeenCalledTimes(1)
  expect(sources[0].closed).toBe(true)
})
