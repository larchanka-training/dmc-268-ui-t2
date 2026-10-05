const DEFAULT_RETURN_URL = '/repos'

/**
 * Safe same-origin return paths for post-login restore.
 * Invalid / missing / open-redirect-ish values fall back to `/repos`.
 */
export function resolveReturnUrl(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_RETURN_URL
  if (!raw.startsWith('/')) return DEFAULT_RETURN_URL
  // Backslash is treated as a path separator by URL parsers (`/\host` → external).
  if (raw.includes('\\') || raw.includes('%5c') || raw.includes('%5C')) return DEFAULT_RETURN_URL
  if (raw.startsWith('//')) return DEFAULT_RETURN_URL
  if (raw.includes('://')) return DEFAULT_RETURN_URL
  if (raw === '/login' || raw.startsWith('/login?')) return DEFAULT_RETURN_URL
  if (raw === '/auth' || raw.startsWith('/auth/')) return DEFAULT_RETURN_URL

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const resolved = new URL(raw, base)
    if (resolved.origin !== base) return DEFAULT_RETURN_URL
    if (resolved.pathname === '/login' || resolved.pathname.startsWith('/auth')) {
      return DEFAULT_RETURN_URL
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return DEFAULT_RETURN_URL
  }
}
