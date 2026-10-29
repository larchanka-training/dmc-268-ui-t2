import { reviewEventsStreamPath } from '@/entities/pull-request/model/paths'
import type { ReviewSnapshot, ReviewSnapshotWire } from '@/entities/pull-request/model/review-snapshot'
import { isReviewSettled, parseReviewSnapshot } from '@/entities/pull-request/model/review-snapshot'

/** The subset of `EventSource` the stream needs; lets tests drive it without a network. */
export interface ReviewEventSource {
  readonly readyState: number
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void
  close(): void
}

export interface ReviewStreamHandlers {
  onSnapshot: (snapshot: ReviewSnapshot) => void
  /** SSE is unusable for this review; the caller should switch to polling. */
  onFallback: () => void
}

export interface ReviewStreamOptions {
  createEventSource?: (url: string) => ReviewEventSource
}

function createBrowserEventSource(url: string): ReviewEventSource {
  return new EventSource(url, { withCredentials: true })
}

const EVENT_SOURCE_CLOSED = 2
const RECONNECT_DELAY_MS = 1000
const MAX_FRESH_RECONNECTS = 1
const MAX_BROWSER_RETRIES = 3

/** Subscribes to `GET /reviews/{id}/events/stream`. Returns a function that closes the stream. */
export function openReviewStream(
  reviewId: string,
  handlers: ReviewStreamHandlers,
  { createEventSource = createBrowserEventSource }: ReviewStreamOptions = {},
): () => void {
  let source: ReviewEventSource
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let failedReconnects = 0
  let browserRetries = 0

  function connect() {
    source = createEventSource(reviewEventsStreamPath(reviewId))
    source.addEventListener('review.snapshot', (event) => {
      const snapshot = parseReviewSnapshot(JSON.parse(event.data) as ReviewSnapshotWire)
      failedReconnects = 0
      browserRetries = 0
      handlers.onSnapshot(snapshot)
      // The server ends the response here; without closing, EventSource would reconnect forever.
      if (isReviewSettled(snapshot)) {
        source.close()
      }
    })
    source.addEventListener('error', () => {
      if (source.readyState !== EVENT_SOURCE_CLOSED) {
        // The browser retries on its own; cap it so a dead proxy does not leave the UI frozen.
        browserRetries += 1
        if (browserRetries >= MAX_BROWSER_RETRIES) {
          source.close()
          handlers.onFallback()
        }
        return
      }
      // CLOSED means the browser will not retry (non-200 such as 409 EVENT_REPLAY_UNAVAILABLE).
      // A brand-new EventSource carries no Last-Event-ID, so it resyncs from a fresh snapshot.
      if (failedReconnects >= MAX_FRESH_RECONNECTS) {
        handlers.onFallback()
        return
      }
      failedReconnects += 1
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
    })
  }

  connect()
  return () => {
    clearTimeout(reconnectTimer)
    source.close()
  }
}
