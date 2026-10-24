const BASE_POLL_MS = 3000
const MAX_POLL_MS = 15000

/** SYSTEM_DESIGN §11: poll every 3 s, backing off to 15 s while nothing changes. */
export function nextPollDelayMs(unchangedPolls: number): number {
  return Math.min(BASE_POLL_MS * 2 ** unchangedPolls, MAX_POLL_MS)
}
