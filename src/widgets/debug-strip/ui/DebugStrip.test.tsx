import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from '@/app/App'
import { DebugStrip } from './DebugStrip'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

test('shows page time and ui commit even when DEV is false', () => {
  vi.stubEnv('VITE_GIT_SHA', 'abc123def456')
  vi.stubEnv('DEV', false)
  vi.spyOn(performance, 'now').mockReturnValue(120.4)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  )

  render(<DebugStrip />)

  expect(screen.getByText(/page 120ms/)).toBeInTheDocument()
  expect(screen.getByText(/ui abc123def456/)).toBeInTheDocument()
})

test('shows api latency and commit when healthcheck is ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', commit: 'be123' })),
  )

  render(<DebugStrip />)

  expect(await screen.findByText(/api \d+ms/)).toBeInTheDocument()
  expect(screen.getByText(/api be123/)).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'API alive' })).toBeInTheDocument()
})

test('shows api down when the commit is blank', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', commit: ' ' })),
  )

  render(<DebugStrip />)

  expect(await screen.findByRole('status', { name: 'API down' })).toBeInTheDocument()
})

test('shows api down when healthcheck is not ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', commit: ' ' }, { status: 503 })),
  )

  render(<DebugStrip />)

  expect(await screen.findByRole('status', { name: 'API down' })).toBeInTheDocument()
  expect(screen.getByText(/api unknown/)).toBeInTheDocument()
})

test('shows api down when healthcheck fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network'))),
  )

  render(<DebugStrip />)

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
