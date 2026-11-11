import { act, fireEvent, screen, within, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'
import { meQueryKey } from '@/entities/session'

afterEach(() => vi.unstubAllGlobals())

const settings = {
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

const preview = {
  default_branch: 'release/next',
  instructions: ['[SEC-1] Security: <img src=x onerror=alert(1)>'],
  provenance: {
    parser_version: 'rules-md/1',
    path: '.review/rules.md',
    tenant: 'user-1',
    repository_external_id: '1',
    revision: 'a'.repeat(40),
    blob_sha: 'b'.repeat(40),
    content_digest: 'c'.repeat(64),
    state: 'valid',
    diagnostics: [],
    severities: { 'SEC-1': 'high' },
    allowed_rule_refs: ['SEC-1'],
  },
}

function readResponse(input: RequestInfo | URL, current = settings, etag = '"opaque:A"') {
  return String(input).endsWith('/rules-preview')
    ? Response.json(preview)
    : Response.json(current, { headers: { ETag: etag } })
}

test('the authenticated repository settings route reads actual canonical controls including high severity', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input) => readResponse(input)),
  )
  renderWithRouter('/repos/one/settings')
  expect(await screen.findByRole('checkbox', { name: 'Automatic reviews' })).not.toBeChecked()
  expect(screen.getByLabelText('Base branches')).toHaveValue('main')
  expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('high')
  expect(screen.getByRole('link', { name: 'Review history' })).toHaveAttribute('href', '/audit?repository=one')
})

test('saves all three preferences through a complete conditional PUT and displays the accepted version', async () => {
  const writes: RequestInit[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writes.push(init)
        return Response.json(
          { ...settings, ...JSON.parse(String(init.body)), version: 'version-b' },
          { headers: { ETag: '"opaque:B"' } },
        )
      }
      return readResponse(_input)
    }),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.clear(screen.getByLabelText('Base branches'))
  await user.type(screen.getByLabelText('Base branches'), 'main\nrelease/v1')
  await user.selectOptions(screen.getByLabelText('Publication minimum severity'), 'critical')
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  expect(await screen.findByRole('status', { name: 'Settings saved' })).toHaveTextContent('version-b')
  expect(writes).toHaveLength(1)
  expect(writes[0].headers).toEqual({
    'Content-Type': 'application/json',
    'X-CSRF-Token': 'csrf',
    'If-Match': '"opaque:A"',
  })
  expect(JSON.parse(String(writes[0].body))).toEqual({
    rules: { instructions: ['Keep tenant isolation.'] },
    ignores: { globs: ['generated/**'] },
    max_starts_per_hour: 7,
    max_active_jobs: 2,
    output_language: 'ru',
    surrounding_lines: 12,
    auto_review_enabled: true,
    base_branches: ['main', 'release/v1'],
    minimum_severity: 'critical',
  })
})

test('keeps a pending replacement visibly saving and prevents duplicate submissions', async () => {
  let complete!: (response: Response) => void
  let writes = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writes += 1
        return new Promise<Response>((resolve) => {
          complete = resolve
        })
      }
      return readResponse(_input, settings, '"A"')
    }),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  const save = await screen.findByRole('button', { name: 'Save preferences' })
  await user.click(save)
  expect(save).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Saving preferences')
  await user.click(save)
  expect(writes).toBe(1)
  complete(Response.json({ ...settings, auto_review_enabled: true }, { headers: { ETag: '"B"' } }))
  await screen.findByRole('status', { name: 'Settings saved' })
})

test('pasted branch lines save exact names without surrounding whitespace or empty lines', async () => {
  let savedBranches: string[] | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        savedBranches = JSON.parse(String(init.body)).base_branches
        return Response.json(
          { ...settings, base_branches: savedBranches, version: 'version-b' },
          { headers: { ETag: '"B"' } },
        )
      }
      return readResponse(input)
    }),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  const branches = await screen.findByLabelText('Base branches')
  await user.clear(branches)
  await user.type(branches, ' main \n develop \n\n')
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByRole('status', { name: 'Settings saved' })
  expect(savedBranches).toEqual(['main', 'develop'])
})

test('unchanged preferences cannot create a new settings version', async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL) => readResponse(input))
  vi.stubGlobal('fetch', fetch)
  renderWithRouter('/repos/one/settings')
  const save = await screen.findByRole('button', { name: 'Save preferences' })
  expect(save).toBeDisabled()
  fireEvent.submit(save.closest('form')!)
  expect(fetch.mock.calls.some((call) => (call as unknown as [unknown, RequestInit?])[1]?.method === 'PUT')).toBe(false)
})

test('a retryable settings refusal waits for retry_after before restoring the editor', async () => {
  vi.useFakeTimers()
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/settings') && ++reads === 1)
        return Response.json({ code: 'SERVICE_UNAVAILABLE', retryable: true, retry_after: 1 }, { status: 503 })
      return readResponse(input)
    }),
  )
  try {
    renderWithRouter('/repos/one/settings')
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(reads).toBe(1)
    await act(async () => vi.advanceTimersByTimeAsync(999))
    expect(reads).toBe(1)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(reads).toBe(2)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('keeps dirty full baseline and ETag through background refresh, preserves conflict edits until explicit discard', async () => {
  const changed = {
    ...settings,
    version: 'version-b',
    max_active_jobs: 99,
    rules: { instructions: ['Other administrator rules.'] },
    minimum_severity: 'medium',
  }
  let current = settings
  const writes: RequestInit[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writes.push(init)
        return Response.json({ code: 'SETTINGS_VERSION_CONFLICT', retryable: false }, { status: 409 })
      }
      return readResponse(_input, current, current === settings ? '"A"' : '"B"')
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  current = changed
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['repository-settings'] })
  })
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings changed on the server')
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('high')
  expect(writes).toHaveLength(1)
  expect(new Headers(writes[0].headers).get('If-Match')).toBe('"A"')
  expect(JSON.parse(String(writes[0].body)).rules).toEqual({ instructions: ['Keep tenant isolation.'] })
  expect(JSON.parse(String(writes[0].body)).max_active_jobs).toBe(2)
  await user.click(screen.getByRole('button', { name: 'Reload current settings and discard edits' }))
  expect(await screen.findByLabelText('Publication minimum severity')).toHaveValue('medium')
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).not.toBeChecked()
})

test('shows file-only preview with default-branch SHA provenance and renders hostile criteria as plain text', async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL) => readResponse(input))
  vi.stubGlobal('fetch', fetch)
  renderWithRouter('/repos/one/settings')
  const region = await screen.findByRole('region', { name: 'Current file criteria' })
  expect(await within(region).findByText(preview.instructions[0])).toBeInTheDocument()
  expect(within(region).getByText('release/next')).toBeInTheDocument()
  expect(within(region).getByText('.review/rules.md')).toBeInTheDocument()
  expect(within(region).getByText('a'.repeat(40))).toBeInTheDocument()
  expect(within(region).queryByRole('img')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith(
    '/api/v1/repositories/one/rules-preview',
    expect.objectContaining({ credentials: 'include' }),
  )
})

test.each([
  ['absent', 'Root rules file is absent.'],
  ['empty', 'Root rules file is empty.'],
  ['invalid', 'Root rules file is invalid. No file criteria are applied.'],
])('distinguishes the %s preview content state from a provider error', async (state, message) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/rules-preview')
        ? Response.json({
            ...preview,
            instructions: [],
            provenance: {
              ...preview.provenance,
              state,
              diagnostics: state === 'invalid' ? ['invalid_structure:1'] : [],
            },
          })
        : readResponse(input),
    ),
  )
  renderWithRouter('/repos/one/settings')
  const region = await screen.findByRole('region', { name: 'Current file criteria' })
  expect(await within(region).findByText(message)).toBeInTheDocument()
  if (state === 'invalid') expect(within(region).getByText('invalid_structure:1')).toBeInTheDocument()
  expect(within(region).queryByRole('alert')).not.toBeInTheDocument()
})

test('refresh fetches a new default branch snapshot and replaces the visible source and criteria', async () => {
  let current = preview
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/rules-preview') ? Response.json(current) : readResponse(input),
    ),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  const region = await screen.findByRole('region', { name: 'Current file criteria' })
  await within(region).findByText(preview.instructions[0])
  current = {
    ...preview,
    default_branch: 'main',
    instructions: ['[SEC-2] Bind tenant.'],
    provenance: { ...preview.provenance, revision: 'd'.repeat(40) },
  }
  await user.click(within(region).getByRole('button', { name: 'Refresh file criteria' }))
  expect(await within(region).findByText('[SEC-2] Bind tenant.')).toBeInTheDocument()
  expect(within(region).getByText('d'.repeat(40))).toBeInTheDocument()
  expect(within(region).queryByText(preview.instructions[0])).not.toBeInTheDocument()
})

test('a preview provider failure is explicit and stops presenting the previously cached criteria as current', async () => {
  let unavailable = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/rules-preview') && unavailable
        ? Response.json({ code: 'SERVICE_UNAVAILABLE', retryable: false, retry_after: 37 }, { status: 503 })
        : readResponse(input),
    ),
  )
  const { user, router } = renderWithRouter('/repos/one/settings')
  const region = await screen.findByRole('region', { name: 'Current file criteria' })
  await within(region).findByText(preview.instructions[0])
  unavailable = true
  await user.click(within(region).getByRole('button', { name: 'Refresh file criteria' }))
  expect(await within(region).findByRole('alert')).toHaveTextContent('Could not load file criteria')
  expect(within(region).queryByText(preview.instructions[0])).not.toBeInTheDocument()
  expect(within(region).queryByText('Root rules file is absent.')).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/repos/one/settings')
})

test('a reader keeps file preview and history while admin-only settings denial hides all controls without logout', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/settings')
        ? Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
        : readResponse(input),
    ),
  )
  const { router } = renderWithRouter('/repos/one/settings')
  expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access is required to edit preferences')
  expect(await screen.findByText(preview.instructions[0])).toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save preferences' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Review history' })).toHaveAttribute('href', '/audit?repository=one')
  expect(router.state.location.pathname).toBe('/repos/one/settings')
})

test('unsupported legacy settings show an explicit migration state without inventing a canonical draft', async () => {
  let legacy = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/settings') && legacy
        ? Response.json({ code: 'LEGACY_SETTINGS_UNSUPPORTED' }, { status: 409, headers: { ETag: '"legacy:A"' } })
        : readResponse(input),
    ),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported legacy settings')
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(await screen.findByText(preview.instructions[0])).toBeInTheDocument()
  legacy = false
  await user.click(screen.getByRole('button', { name: 'Refresh settings' }))
  expect(await screen.findByRole('checkbox', { name: 'Automatic reviews' })).not.toBeChecked()
})

test('a historical language that cannot be preserved by canonical PUT never becomes a writable guessed baseline', async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL) => readResponse(input, { ...settings, output_language: 'en' }))
  vi.stubGlobal('fetch', fetch)
  renderWithRouter('/repos/one/settings')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This historical output language cannot be preserved by the current settings form',
  )
  expect(screen.queryByRole('button', { name: 'Save preferences' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(await screen.findByText(preview.instructions[0])).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'PUT' }))
})

test('settings401 rechecks the real session and redirects to login with the exact return path', async () => {
  const paths: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      paths.push(path)
      return path.endsWith('/settings') || path.endsWith('/me')
        ? new Response(null, { status: 401 })
        : readResponse(input)
    }),
  )
  const { router } = renderWithRouter('/repos/one/settings?tab=rules')
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(router.state.location.search).toBe('?returnUrl=%2Frepos%2Fone%2Fsettings%3Ftab%3Drules')
  expect(paths).toContain('/api/v1/me')
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(screen.queryByText(preview.instructions[0])).not.toBeInTheDocument()
})

test('preview401 also rechecks the session rather than keeping authenticated settings visible', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      return path.endsWith('/rules-preview') || path.endsWith('/me')
        ? new Response(null, { status: 401 })
        : readResponse(input)
    }),
  )
  const { router } = renderWithRouter('/repos/one/settings')
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
})

test('a replacement401 rechecks session and hides the draft behind the existing login boundary', async () => {
  let expired = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        expired = true
        return new Response(null, { status: 401 })
      }
      if (String(input).endsWith('/me') && expired) return new Response(null, { status: 401 })
      return readResponse(input)
    }),
  )
  const { user, router } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
})

test('a failed background settings refresh preserves dirty edits and the original full conditional baseline', async () => {
  let unavailable = false
  const writes: RequestInit[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writes.push(init)
        return readResponse(input, { ...settings, auto_review_enabled: true }, '"B"')
      }
      if (String(input).endsWith('/settings') && unavailable)
        return Response.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503 })
      return readResponse(input, settings, '"A"')
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  unavailable = true
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['repository-settings', 'user-1', 'one', 'settings'] })
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load repository settings')
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  unavailable = false
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByRole('status', { name: 'Settings saved' })
  expect(new Headers(writes[0].headers).get('If-Match')).toBe('"A"')
  expect(JSON.parse(String(writes[0].body)).rules).toEqual({ instructions: ['Keep tenant isolation.'] })
})

test('a late pre-save GET cannot replace the accepted settings version when the page is reopened', async () => {
  let reads = 0
  let latest = settings
  let completeOld!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        latest = { ...settings, version: 'version-b', auto_review_enabled: true }
        return readResponse(input, latest, '"B"')
      }
      if (String(input).endsWith('/settings') && ++reads === 2)
        return new Promise<Response>((resolve) => {
          completeOld = resolve
        })
      return readResponse(input, latest, latest === settings ? '"A"' : '"B"')
    }),
  )
  const { user, queryClient, router } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  let refreshing!: Promise<void>
  act(() => {
    refreshing = queryClient.invalidateQueries({ queryKey: ['repository-settings', 'user-1', 'one', 'settings'] })
  })
  await waitFor(() => expect(completeOld).toBeTypeOf('function'))
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  await screen.findByRole('status', { name: 'Settings saved' })
  await act(async () => {
    completeOld(readResponse('/settings', settings, '"A"'))
    await refreshing
  })
  await act(async () => {
    await router.navigate('/missing-settings-test')
  })
  await act(async () => {
    await router.navigate('/repos/one/settings')
  })
  expect(await screen.findByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
})

test('a preview read denial clears sibling settings and a late settings response cannot restore access', async () => {
  let reads = 0
  let denied = false
  let completeOld!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/rules-preview') && denied)
        return Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
      if (String(input).endsWith('/settings') && ++reads === 2)
        return new Promise<Response>((resolve) => {
          completeOld = resolve
        })
      return readResponse(input)
    }),
  )
  const { user, queryClient, router } = renderWithRouter('/repos/one/settings')
  await screen.findByRole('checkbox', { name: 'Automatic reviews' })
  const region = screen.getByRole('region', { name: 'Current file criteria' })
  await within(region).findByText(preview.instructions[0])
  let refreshing!: Promise<void>
  act(() => {
    refreshing = queryClient.invalidateQueries({ queryKey: ['repository-settings', 'user-1', 'one', 'settings'] })
  })
  await waitFor(() => expect(completeOld).toBeTypeOf('function'))
  denied = true
  await user.click(within(region).getByRole('button', { name: 'Refresh file criteria' }))
  await within(region).findByRole('alert')
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument())
  await act(async () => {
    completeOld(readResponse('/settings'))
    await refreshing
  })
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(screen.queryByText(preview.instructions[0])).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/repos/one/settings')
})

test('a late accepted PUT cannot restore cached controls after a newer read-access denial', async () => {
  let denied = false
  let completeSave!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          completeSave = resolve
        })
      if (String(input).endsWith('/rules-preview') && denied)
        return Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
      return readResponse(input)
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  denied = true
  const region = screen.getByRole('region', { name: 'Current file criteria' })
  await user.click(within(region).getByRole('button', { name: 'Refresh file criteria' }))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument())
  act(() => {
    completeSave(readResponse('/settings', { ...settings, version: 'version-b', auto_review_enabled: true }, '"B"'))
  })
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(within(region).getByRole('alert')).toBeInTheDocument()
})

test('a PUT administrator denial retires editable settings but keeps the reader preview and session', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PUT' ? Response.json({ code: 'ACCESS_DENIED' }, { status: 403 }) : readResponse(input),
    ),
  )
  const { user, router } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument())
  expect(screen.getByRole('alert')).toHaveTextContent('Administrator access is required')
  expect(screen.getByText(preview.instructions[0])).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/repos/one/settings')
})

test('switching principals isolates drafts and a late old PUT cannot revive a previous session cache', async () => {
  let principal = 'A'
  let deniedA = false
  let completeSave!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          completeSave = resolve
        })
      if (path.endsWith('/me'))
        return Response.json({
          user: {
            id: principal === 'A' ? 'user-1' : 'user-2',
            provider: 'github',
            external_id: principal,
            login: principal,
          },
          session: { expires_at: '2999-01-01T00:00:00Z' },
          csrf_token: 'csrf-' + principal,
        })
      if (principal === 'A' && deniedA) return Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
      if (path.endsWith('/rules-preview'))
        return Response.json({ ...preview, instructions: [principal + ' private criteria'] })
      return readResponse(
        input,
        principal === 'A' ? settings : { ...settings, minimum_severity: 'medium', base_branches: ['develop'] },
      )
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  principal = 'B'
  await act(async () => {
    await queryClient.resetQueries({ queryKey: meQueryKey })
  })
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('medium'))
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).not.toBeChecked()
  expect(screen.getByLabelText('Base branches')).toHaveValue('develop')
  act(() => {
    completeSave(readResponse('/settings', { ...settings, version: 'accepted-A', auto_review_enabled: true }, '"A2"'))
  })
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('medium')
  expect(screen.queryByText('A private criteria')).not.toBeInTheDocument()
  principal = 'A'
  deniedA = true
  await act(async () => {
    await queryClient.resetQueries({ queryKey: meQueryKey })
  })
  await screen.findByText(/^Administrator access is required/)
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  expect(screen.queryByText('A private criteria')).not.toBeInTheDocument()
})

test('switching repositories discards the draft and a late old PUT cannot recreate an unobserved repository cache', async () => {
  let deniedOne = false
  let completeSave!: (response: Response) => void
  let completePreview!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          completeSave = resolve
        })
      if (path.includes('/one/') && deniedOne) {
        if (path.endsWith('/rules-preview'))
          return new Promise<Response>((resolve) => {
            completePreview = resolve
          })
        return Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
      }
      if (path.endsWith('/rules-preview'))
        return Response.json({
          ...preview,
          instructions: [path.includes('/one/') ? 'One private criteria' : 'Two private criteria'],
        })
      return readResponse(
        input,
        path.includes('/one/') ? settings : { ...settings, minimum_severity: 'medium', base_branches: ['develop'] },
      )
    }),
  )
  const { user, router, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  await act(async () => {
    await router.navigate('/repos/two/settings')
  })
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('medium'))
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).not.toBeChecked()
  expect(screen.getByLabelText('Base branches')).toHaveValue('develop')
  act(() => {
    completeSave(
      readResponse('/settings', { ...settings, version: 'accepted-one', auto_review_enabled: true }, '"ONE2"'),
    )
  })
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  deniedOne = true
  await act(async () => {
    await router.navigate('/repos/one/settings')
  })
  await waitFor(() => expect(completePreview).toBeTypeOf('function'))
  expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument()
  act(() => {
    completePreview(Response.json({ code: 'ACCESS_DENIED' }, { status: 403 }))
  })
  await screen.findByText(/^Administrator access is required/)
  expect(screen.queryByText('One private criteria')).not.toBeInTheDocument()
})

test('editing accepted preferences reports unsaved changes instead of leaving a false saved confirmation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      readResponse(
        input,
        init?.method === 'PUT' ? { ...settings, ...JSON.parse(String(init.body)) } : settings,
        init?.method === 'PUT' ? '"B"' : '"A"',
      ),
    ),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  await screen.findByRole('status', { name: 'Settings saved' })
  await user.click(screen.getByRole('checkbox', { name: 'Automatic reviews' }))
  expect(screen.queryByRole('status', { name: 'Settings saved' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
})

test('validation refusal explains exact branch constraints and preserves all edited preferences without retry', async () => {
  let writes = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        writes += 1
        return Response.json({ code: 'VALIDATION_FAILED' }, { status: 422 })
      }
      return readResponse(input)
    }),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.clear(screen.getByLabelText('Base branches'))
  await user.type(screen.getByLabelText('Base branches'), 'release/*')
  await user.click(screen.getByRole('button', { name: 'Save preferences' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Use exact Git branch names')
  expect(screen.getByLabelText('Base branches')).toHaveValue('release/*')
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  expect(writes).toBe(1)
})

test('a connected reader can open rules and settings from repositories and follow the existing audit history link', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (path.startsWith('/api/v1/repositories?'))
        return Response.json({
          items: [
            {
              id: 'one',
              provider: 'github',
              external_id: '1',
              owner: 'team',
              name: 'one',
              role: 'reviewer',
              capabilities: { can_start_review: true, can_manage_settings: false },
            },
          ],
          next_cursor: null,
        })
      if (path.endsWith('/settings')) return Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
      return readResponse(input)
    }),
  )
  const { user, router } = renderWithRouter('/repos')
  await user.click(await screen.findByRole('link', { name: 'Rules & settings' }))
  expect(router.state.location.pathname).toBe('/repos/one/settings')
  expect(await screen.findByText(preview.instructions[0])).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Review history' })).toHaveAttribute('href', '/audit?repository=one')
})

test('the repository pull-request page links the same rules and settings route before a manual start', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/pull-requests?') ? Response.json({ items: [], next_cursor: null }) : readResponse(input),
    ),
  )
  const { user, router } = renderWithRouter('/repos/one/pull-requests')
  await user.click(await screen.findByRole('link', { name: 'Rules & settings' }))
  expect(router.state.location.pathname).toBe('/repos/one/settings')
  expect(await screen.findByText(preview.instructions[0])).toBeInTheDocument()
})

test('a malformed preview200 becomes an explicit preview error while the independent settings editor stays usable', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/rules-preview') ? Response.json({ instructions: [] }) : readResponse(input),
    ),
  )
  const { user } = renderWithRouter('/repos/one/settings')
  expect(await screen.findByText(/Could not load file criteria/)).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: 'Automatic reviews' }))
  expect(screen.getByRole('button', { name: 'Save preferences' })).toBeEnabled()
})

test('an old PUT403 cannot retire a fresh authorized query and dirty draft after returning to the repository', async () => {
  let oneReads = 0
  let completeOld!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          completeOld = resolve
        })
      if (path.endsWith('/rules-preview')) return readResponse(input)
      if (path.includes('/one/')) {
        oneReads += 1
        return readResponse(
          input,
          oneReads === 1 ? settings : { ...settings, version: 'fresh-one', minimum_severity: 'critical' },
        )
      }
      return readResponse(input, { ...settings, minimum_severity: 'medium' })
    }),
  )
  const { user, router, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  await act(async () => {
    await router.navigate('/repos/two/settings')
  })
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('medium'))
  await act(async () => {
    await router.navigate('/repos/one/settings')
  })
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('critical'))
  await user.click(screen.getByRole('checkbox', { name: 'Automatic reviews' }))
  act(() => {
    completeOld(Response.json({ code: 'ACCESS_DENIED' }, { status: 403 }))
  })
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  expect(screen.getByRole('button', { name: 'Save preferences' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
  expect(screen.queryByText(/^Administrator access is required/)).not.toBeInTheDocument()
})

test('an old PUT401 cannot reset the newer valid principal session and discard its dirty draft', async () => {
  let principal = 'A'
  let completeOld!: (response: Response) => void
  let completeMe: ((response: Response) => void) | undefined
  let meReads = 0
  const meB = {
    user: { id: 'user-2', provider: 'github', external_id: 'B', login: 'B' },
    session: { expires_at: '2999-01-01T00:00:00Z' },
    csrf_token: 'csrf-B',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          completeOld = resolve
        })
      if (path.endsWith('/me')) {
        meReads += 1
        if (meReads > 1)
          return new Promise<Response>((resolve) => {
            completeMe = resolve
          })
        return Response.json(meB)
      }
      return readResponse(input, principal === 'A' ? settings : { ...settings, minimum_severity: 'medium' })
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  principal = 'B'
  await act(async () => {
    await queryClient.resetQueries({ queryKey: meQueryKey })
  })
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('medium'))
  await user.click(screen.getByRole('checkbox', { name: 'Automatic reviews' }))
  act(() => {
    completeOld(new Response(null, { status: 401 }))
  })
  await waitFor(() => expect(completeMe !== undefined || queryClient.isMutating() === 0).toBe(true))
  if (completeMe) {
    await screen.findByText('Loading session…')
    await act(async () => {
      completeMe!(Response.json(meB))
    })
  }
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  expect(await screen.findByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
})

test('an aborted old GET401 body cannot reset a newer valid session and discard its dirty draft', async () => {
  let principal = 'A'
  let oldSignal: AbortSignal | undefined
  let abortOldBody!: () => void
  let completeMe: ((response: Response) => void) | undefined
  let meReads = 0
  const meB = {
    user: { id: 'user-2', provider: 'github', external_id: 'B', login: 'B' },
    session: { expires_at: '2999-01-01T00:00:00Z' },
    csrf_token: 'csrf-B',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path.endsWith('/me')) {
        meReads += 1
        if (meReads > 1)
          return new Promise<Response>((resolve) => {
            completeMe = resolve
          })
        return Response.json(meB)
      }
      if (path.endsWith('/settings') && principal === 'A') {
        oldSignal = init?.signal ?? undefined
        return new Response(
          new ReadableStream({
            start(controller) {
              abortOldBody = () => controller.error(new DOMException('Response body aborted', 'AbortError'))
            },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return readResponse(input, { ...settings, minimum_severity: 'medium' })
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await waitFor(() => expect(abortOldBody).toBeTypeOf('function'))
  principal = 'B'
  await act(async () => {
    await queryClient.resetQueries({ queryKey: meQueryKey })
  })
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('medium'))
  await user.click(screen.getByRole('checkbox', { name: 'Automatic reviews' }))
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => {
    abortOldBody()
  })
  if (completeMe) {
    await screen.findByText('Loading session…')
    await act(async () => {
      completeMe!(Response.json(meB))
    })
  }
  expect(await screen.findByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
  expect(meReads).toBe(1)
})

test('an old PUT403 cannot clear a recovered editor draft on the same still-observed settings query', async () => {
  let denied = false
  let recovered = false
  let completeOld!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          completeOld = resolve
        })
      if (String(input).endsWith('/rules-preview') && denied)
        return Response.json({ code: 'ACCESS_DENIED' }, { status: 403 })
      return readResponse(
        input,
        recovered ? { ...settings, version: 'recovered-one', minimum_severity: 'critical' } : settings,
        recovered ? '"recovered:B"' : '"initial:A"',
      )
    }),
  )
  const { user, queryClient } = renderWithRouter('/repos/one/settings')
  await user.click(await screen.findByRole('checkbox', { name: 'Automatic reviews' }))
  await user.click(await screen.findByRole('button', { name: 'Save preferences' }))
  const region = screen.getByRole('region', { name: 'Current file criteria' })
  await within(region).findByText(preview.instructions[0])
  denied = true
  await user.click(within(region).getByRole('button', { name: 'Refresh file criteria' }))
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Automatic reviews' })).not.toBeInTheDocument())
  denied = false
  recovered = true
  await user.click(within(region).getByRole('button', { name: 'Refresh file criteria' }))
  await within(region).findByText(preview.instructions[0])
  await user.click(screen.getByRole('button', { name: 'Refresh settings' }))
  await waitFor(() => expect(screen.getByLabelText('Publication minimum severity')).toHaveValue('critical'))
  await user.click(screen.getByRole('checkbox', { name: 'Automatic reviews' }))
  act(() => {
    completeOld(Response.json({ code: 'ACCESS_DENIED' }, { status: 403 }))
  })
  await waitFor(() => expect(queryClient.isMutating()).toBe(0))
  expect(screen.getByRole('checkbox', { name: 'Automatic reviews' })).toBeChecked()
  expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
  expect(screen.queryByText(/^Administrator access is required/)).not.toBeInTheDocument()
})
