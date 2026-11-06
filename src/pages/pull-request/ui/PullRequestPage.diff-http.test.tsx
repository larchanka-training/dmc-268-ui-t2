import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  ApiPullRequestDataSource,
  MOCK_DEFAULT_REVIEW_ID,
  MOCK_PULL_REQUESTS,
  MOCK_REVIEWS,
} from '@/entities/pull-request'
import { reviewDiffQueryKey } from '@/entities/pull-request/api/queries'
import { fakeMe, renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const reviewId = MOCK_DEFAULT_REVIEW_ID
const fixture = MOCK_REVIEWS[reviewId]
const path = `/reviews/${reviewId}?view=split`

function successfulRead(input: RequestInfo | URL): Response {
  const url = String(input)
  if (url.endsWith('/diff')) return Response.json(fixture.diff)
  if (url.includes('/findings?')) return Response.json({ items: fixture.findings, next_cursor: null })
  if (url.includes('/pull-requests?')) return Response.json({ items: MOCK_PULL_REQUESTS, next_cursor: null })
  return Response.json({ ...fixture.review, summary: 'Retained review summary.' })
}

test('a saved diff410 is explicitly expired while retained findings remain readable without a new review', async () => {
  let writes = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        writes += 1
        throw new Error('No new review authorized')
      }
      if (String(input).endsWith('/diff'))
        return Response.json({ code: 'DIFF_EXPIRED', message: 'Stored diff has expired.' }, { status: 410 })
      return successfulRead(input)
    }),
  )
  const { user } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  expect(await screen.findByTestId('diff-expired')).toHaveTextContent(
    'Срок хранения diff истёк. Сохранённые замечания доступны ниже.',
  )
  expect(screen.getByText('Retained review summary.')).toBeInTheDocument()
  const retained = screen.getByTestId('out-of-diff-pr')
  expect(within(retained).getAllByTestId('comment-card')).toHaveLength(fixture.findings.length)
  for (const finding of fixture.findings) expect(within(retained).getByText(finding.title)).toBeInTheDocument()
  expect(within(retained).getAllByText('src/api/user.ts').length).toBeGreaterThan(0)
  await user.click(within(retained).getByRole('button', { name: /Add the user id to the error context/ }))
  expect(screen.getByRole('region', { name: 'Add the user id to the error context' })).toBeVisible()
  expect(screen.getByText('The id is only embedded in the message text.')).toBeVisible()
  expect(screen.queryByTestId('diff-pending')).not.toBeInTheDocument()
  expect(screen.queryByTestId('empty-diff')).not.toBeInTheDocument()
  expect(screen.queryByTestId('diff-table')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument()
  expect(writes).toBe(0)
})

test('a fresh diff410 replaces a previously cached diff with expiry and retained out-of-diff findings', async () => {
  let expired = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (expired && String(input).endsWith('/diff')) return new Response(null, { status: 410 })
      return successfulRead(input)
    }),
  )
  const { queryClient } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await screen.findByText('Retained review summary.')
  expect(screen.getAllByTestId('file-section').length).toBeGreaterThan(0)
  expired = true
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: reviewDiffQueryKey(reviewId, fakeMe.user.id), exact: true })
  })
  await screen.findByTestId('diff-expired')
  expect(screen.queryByTestId('file-section')).not.toBeInTheDocument()
  expect(screen.queryByTestId('diff-table')).not.toBeInTheDocument()
  expect(within(screen.getByTestId('out-of-diff-pr')).getAllByTestId('comment-card')).toHaveLength(
    fixture.findings.length,
  )
  expect(screen.getByText('Retained review summary.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a fresh diff503 after cached success shows an explicit error instead of remaining on loading', async () => {
  let refreshing = false
  let completeDiff!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (refreshing && String(input).endsWith('/diff'))
        return new Promise<Response>((resolve) => {
          completeDiff = resolve
        })
      return successfulRead(input)
    }),
  )
  const { queryClient } = renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  await screen.findByText('Retained review summary.')
  expect(screen.getAllByTestId('file-section').length).toBeGreaterThan(0)
  refreshing = true
  let refetch!: Promise<void>
  await act(async () => {
    refetch = queryClient.refetchQueries({ queryKey: reviewDiffQueryKey(reviewId, fakeMe.user.id), exact: true })
  })
  await waitFor(() => expect(completeDiff).toBeTypeOf('function'))
  expect(screen.getByText('Retained review summary.')).toBeInTheDocument()
  await act(async () => {
    completeDiff(new Response(null, { status: 503 }))
    await refetch
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить ревью.')
  expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument()
  expect(screen.queryByTestId('diff-expired')).not.toBeInTheDocument()
  expect(screen.queryByTestId('file-section')).not.toBeInTheDocument()
})

// Existing boundaries: expiry handling must not reinterpret pending, empty, or unavailable responses.
test.each([
  { status: 404, state: 'diff-pending' },
  { status: 200, state: 'empty-diff' },
  { status: 503, state: 'error' },
])('diff$status preserves the existing $state state', async ({ status, state }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/diff'))
        return status === 200 ? Response.json({ files: [] }) : new Response(null, { status })
      return successfulRead(input)
    }),
  )
  renderWithRouter(path, { dataSource: new ApiPullRequestDataSource() })
  if (state === 'error') {
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить ревью.')
    expect(screen.queryByText('Retained review summary.')).not.toBeInTheDocument()
  } else {
    await screen.findByTestId(state)
    expect(within(screen.getByTestId('out-of-diff-pr')).getAllByTestId('comment-card')).toHaveLength(
      fixture.findings.length,
    )
    expect(screen.getByText('Retained review summary.')).toBeInTheDocument()
  }
  expect(screen.queryByTestId('diff-expired')).not.toBeInTheDocument()
})
