import { afterEach, expect, test, vi } from 'vitest'
import { fetchRepositorySettings, replaceRepositorySettings } from './settings-client'

afterEach(() => vi.unstubAllGlobals())

export const settings = {
  version: 'version-a',
  created_at: '2026-11-04T12:00:00Z',
  rules: { instructions: ['Keep tenant isolation.'] },
  ignores: { globs: ['generated/**'] },
  max_starts_per_hour: 7,
  max_active_jobs: 2,
  output_language: 'ru',
  surrounding_lines: 12,
  auto_review_enabled: false,
  base_branches: ['main'],
  minimum_severity: 'high',
}

test('reads the full settings baseline with its opaque ETag and personal session', async () => {
  const fetch = vi.fn(async () => Response.json(settings, { headers: { ETag: '"opaque:baseline-A"' } }))
  vi.stubGlobal('fetch', fetch)
  const result = await fetchRepositorySettings('repo/one')
  expect(result).toEqual({ settings, etag: '"opaque:baseline-A"' })
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/repositories/repo%2Fone/settings',
    expect.objectContaining({ credentials: 'include' }),
  )
})

test('refuses a settings response without its ETag rather than constructing a replacement baseline', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(settings)),
  )
  await expect(fetchRepositorySettings('one')).rejects.toThrow('Settings response is incomplete')
})

test('preserves a legacy refusal and opaque recovery ETag without treating error JSON as settings', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { code: 'LEGACY_SETTINGS_UNSUPPORTED', retryable: false, retry_after: null },
        { status: 409, headers: { ETag: '"legacy:opaque"' } },
      ),
    ),
  )
  await expect(fetchRepositorySettings('one')).rejects.toMatchObject({
    status: 409,
    code: 'LEGACY_SETTINGS_UNSUPPORTED',
    etag: '"legacy:opaque"',
    retryable: false,
    retryAfter: null,
  })
})

test('replaces a complete baseline with exact If-Match, CSRF and no response metadata', async () => {
  const fetch = vi.fn(async () =>
    Response.json(
      { ...settings, version: 'version-b', auto_review_enabled: true },
      { headers: { ETag: '"opaque:B"' } },
    ),
  )
  vi.stubGlobal('fetch', fetch)
  const result = await replaceRepositorySettings(
    'one',
    { settings: { ...settings, minimum_severity: 'high' }, etag: '"opaque:A"' },
    { auto_review_enabled: true, base_branches: [], minimum_severity: 'critical' },
    'csrf-value',
  )
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/repositories/one/settings',
    expect.objectContaining({
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-value', 'If-Match': '"opaque:A"' },
      body: JSON.stringify({
        rules: { instructions: ['Keep tenant isolation.'] },
        ignores: { globs: ['generated/**'] },
        max_starts_per_hour: 7,
        max_active_jobs: 2,
        output_language: 'ru',
        surrounding_lines: 12,
        auto_review_enabled: true,
        base_branches: [],
        minimum_severity: 'critical',
      }),
    }),
  )
  expect(result.etag).toBe('"opaque:B"')
  expect(result.settings.version).toBe('version-b')
})

test('refuses an incomplete canonical document before it can become a writable hidden baseline', async () => {
  const documents = [
    { ...settings, rules: undefined },
    { ...settings, max_active_jobs: undefined },
    { ...settings, ignores: { globs: 'not-an-array' } },
    { ...settings, auto_review_enabled: 'false' },
    { ...settings, base_branches: [7] },
    { ...settings, minimum_severity: 'unknown' },
    { ...settings, minimum_severity: ['high'] },
  ]
  for (const document of documents) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(document, { headers: { ETag: '"A"' } })),
    )
    await expect(fetchRepositorySettings('one')).rejects.toThrow('Settings response is incomplete')
  }
})
