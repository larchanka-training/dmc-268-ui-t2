/** Same-origin API paths under `/api/v1` (reviews contract SoT). */
const API_V1 = '/api/v1'

export const reviewPath = (reviewId: string) => `${API_V1}/reviews/${encodeURIComponent(reviewId)}`
export const reviewEventsStreamPath = (reviewId: string) => `${reviewPath(reviewId)}/events/stream`
