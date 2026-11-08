import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from '@/app/App'
import { renderWithRouter } from '@/test/render-with-router'
import { DebugStrip } from './DebugStrip'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

function renderStrip(ui: ReactNode = <DebugStrip />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: ['/'] })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

test('shows page time and ui commit even when DEV is false', async () => {
  vi.stubEnv('VITE_GIT_SHA', 'abc123def456')
  vi.stubEnv('DEV', false)
  vi.spyOn(performance, 'now').mockReturnValue(120.4)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )

  renderStrip()

  expect(await screen.findByText(/page 0ms/)).toBeInTheDocument()
  expect(screen.getByText(/ui abc123def456/)).toBeInTheDocument()
})

test('page time waits until the page data has loaded', async () => {
  let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  let resolvePage: (value: string) => void = () => {}
  const pageData = new Promise<string>((resolve) => {
    resolvePage = resolve
  })

  function LoadingPage() {
    const query = useQuery({
      queryKey: ['debug-strip-page'],
      queryFn: () => pageData,
    })
    return <p>{query.isSuccess ? 'page ready' : 'page loading'}</p>
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )

  renderStrip(
    <>
      <LoadingPage />
      <DebugStrip />
    </>,
  )

  expect(screen.getByText('page loading')).toBeInTheDocument()
  expect(screen.queryByText(/page 250ms/)).not.toBeInTheDocument()

  now = 1250
  await act(async () => {
    resolvePage('done')
    await pageData
  })

  expect(await screen.findByText(/page 250ms/)).toBeInTheDocument()
})

test('page time starts again after navigation', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const resolvers: Record<string, (value: string) => void> = {}

  function Page({ id }: { id: string }) {
    const query = useQuery({
      queryKey: ['debug-strip-page', id],
      queryFn: () =>
        new Promise<string>((resolve) => {
          resolvers[id] = resolve
        }),
    })
    return <h1>{query.isSuccess ? id : `loading ${id}`}</h1>
  }

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <Outlet />
            <DebugStrip />
          </>
        ),
        children: [
          { path: '/one', element: <Page id="one" /> },
          { path: '/two', element: <Page id="two" /> },
        ],
      },
    ],
    { initialEntries: ['/one'] },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  now = 100
  await act(async () => {
    resolvers.one('done')
  })
  expect(await screen.findByText(/page 100ms/)).toBeInTheDocument()

  now = 100
  await act(async () => {
    await router.navigate('/two')
  })
  expect(screen.getByText(/page …/)).toBeInTheDocument()
  expect(screen.queryByText(/page 100ms/)).not.toBeInTheDocument()

  now = 180
  await act(async () => {
    resolvers.two('done')
  })
  expect(await screen.findByText(/page 80ms/)).toBeInTheDocument()
})

test('debug strip paints above page content', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )

  renderStrip()

  expect((await screen.findByText(/page /)).className).toContain('z-20')
})

test('signed-in shell leaves room under the debug strip', () => {
  renderWithRouter('/repos')

  expect(screen.getByRole('main').className).toContain('pb-16')
})

test('login page leaves room under the debug strip', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ message: 'nope' }, { status: 401 })),
  )
  renderWithRouter('/login', { session: null })

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.getByRole('main').className).toContain('pb-16')
})

test('session gate leaves room under the debug strip', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
  renderWithRouter('/repos', { session: null })

  expect(screen.getByText('Loading session…')).toBeInTheDocument()
  expect(screen.getByRole('main').className).toContain('pb-16')
})

test('root loading leaves room under the debug strip', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
  renderWithRouter('/', { session: null })

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(screen.getByRole('main').className).toContain('pb-16')
})

test('oauth callback leaves room under the debug strip', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )
  renderWithRouter('/auth/callback', { session: null })

  expect(screen.getByText('Signing you in…')).toBeInTheDocument()
  expect(screen.getByRole('main').className).toContain('pb-16')
})

test('shows api latency and commit when healthcheck is ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', commit: 'be123' })),
  )

  renderStrip()

  expect(await screen.findByText(/api \d+ms/)).toBeInTheDocument()
  expect(screen.getByText(/api be123/)).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'API alive' })).toBeInTheDocument()
})

test('shows api down when the commit is blank', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', commit: ' ' })),
  )

  renderStrip()

  expect(await screen.findByRole('status', { name: 'API down' })).toBeInTheDocument()
})

test('shows api down when healthcheck status is not 200 even if the body has a commit', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', commit: 'be123' }, { status: 503 })),
  )

  renderStrip()

  expect(await screen.findByRole('status', { name: 'API down' })).toBeInTheDocument()
  expect(screen.getByText(/api unknown/)).toBeInTheDocument()
  expect(screen.queryByText(/api be123/)).not.toBeInTheDocument()
})

test('cancels the healthcheck when the strip unmounts', () => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
  })
  vi.stubGlobal('fetch', fetchMock)

  const { unmount } = renderStrip()
  unmount()

  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
  expect(init?.signal?.aborted).toBe(true)
})

test('shows api down when the healthcheck does not answer within 3 seconds', async () => {
  vi.useFakeTimers()
  const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
  })
  vi.stubGlobal('fetch', fetchMock)

  renderStrip()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2999)
  })
  expect(screen.queryByRole('status', { name: 'API down' })).not.toBeInTheDocument()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(screen.getByRole('status', { name: 'API down' })).toBeInTheDocument()
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(true)
})

test('shows api down when healthcheck fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network'))),
  )

  renderStrip()

  expect(await screen.findByRole('status', { name: 'API down' })).toBeInTheDocument()
  expect(screen.getByText(/api down/)).toBeInTheDocument()
  expect(screen.getByText(/api unknown/)).toBeInTheDocument()
})

test('shows the debug strip outside the signed-in shell', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network'))),
  )

  render(<App />)

  expect(await screen.findByText(/page /)).toBeInTheDocument()
})

test('docker image build receives the git sha', () => {
  const dockerfile = readFileSync(resolve(repoRoot, 'Dockerfile'), 'utf8')
  expect(dockerfile).toContain('ARG GIT_SHA=unknown')
  expect(dockerfile).toContain('ENV VITE_GIT_SHA=$GIT_SHA')

  const workflow = readFileSync(resolve(repoRoot, '.github/workflows/ui-ci.yml'), 'utf8')
  const dockerBuilds = workflow.split('\n').filter((line) => line.includes('docker build'))
  expect(dockerBuilds).toHaveLength(2)
  for (const line of dockerBuilds) {
    expect(line).toContain('--build-arg GIT_SHA=')
  }
})
