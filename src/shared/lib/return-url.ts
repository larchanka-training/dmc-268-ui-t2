/**
 * Safe same-origin return paths for post-login restore.
 * Invalid / missing / open-redirect-ish values fall back to `/repos`.
 */
export function resolveReturnUrl(raw: string | null | undefined): string {
  if (!raw) return '/repos'
  if (!raw.startsWith('/')) return '/repos'
  if (raw.startsWith('//')) return '/repos'
  if (raw.includes('://')) return '/repos'
  if (raw === '/login' || raw.startsWith('/login?')) return '/repos'
  if (raw === '/auth' || raw.startsWith('/auth/')) return '/repos'
  return raw
}
