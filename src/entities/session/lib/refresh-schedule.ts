/** Refresh slightly before authoritative expiry so the cookie stays active. */
export const REFRESH_SKEW_MS = 60_000

/**
 * Milliseconds until the client should call `/auth/refresh`.
 * Invalid/missing expiry → refresh ASAP (0).
 */
export function msUntilSessionRefresh(
  expiresAtIso: string,
  nowMs: number = Date.now(),
  skewMs: number = REFRESH_SKEW_MS,
): number {
  const expiresAt = Date.parse(expiresAtIso)
  if (Number.isNaN(expiresAt)) return 0
  return Math.max(0, expiresAt - skewMs - nowMs)
}
