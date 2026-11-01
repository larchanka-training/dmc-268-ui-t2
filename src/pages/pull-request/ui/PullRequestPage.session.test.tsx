import { act, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  ApiPullRequestDataSource,
  MOCK_DEFAULT_REVIEW_ID,
  MOCK_PULL_REQUESTS,
  MOCK_REVIEWS,
} from '@/entities/pull-request'
import { meQueryKey } from '@/entities/session'
import { fakeMe, renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

test('switching accounts reloads review metadata, PR, diff and findings without sharing cached private content', async () => {
  const fixture = MOCK_REVIEWS[MOCK_DEFAULT_REVIEW_ID]
  let secondAccount = false
  const secondRequests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input)
      if (secondAccount) secondRequests.push(path)
      if (path.includes('/pull-requests?'))
        return Response.json({ items: secondAccount ? [] : MOCK_PULL_REQUESTS, next_cursor: null })
      if (path.endsWith('/diff')) return Response.json(secondAccount ? { files: [] } : fixture.diff)
      if (path.includes('/findings?'))
        return Response.json({ items: secondAccount ? [] : fixture.findings, next_cursor: null })
      return Response.json({
        ...fixture.review,
        summary: secondAccount ? 'Fresh response for the second account.' : 'Private summary for the first account.',
      })
    }),
  )
  const { queryClient } = renderWithRouter(`/reviews/${MOCK_DEFAULT_REVIEW_ID}`, {
    dataSource: new ApiPullRequestDataSource(),
  })
  await screen.findByText('Private summary for the first account.')
  expect(screen.getAllByTestId('file-section').length).toBeGreaterThan(0)
  expect(screen.getAllByTestId('comment-card').length).toBeGreaterThan(0)
  expect(screen.getByTestId('pr-author')).toBeInTheDocument()
  secondAccount = true
  await act(async () => {
    queryClient.setQueryData(meQueryKey, { ...fakeMe, user: { ...fakeMe.user, id: 'second-user', login: 'grace' } })
  })
  expect(await screen.findByText('Fresh response for the second account.')).toBeInTheDocument()
  expect(screen.queryByText('Private summary for the first account.')).not.toBeInTheDocument()
  expect(screen.queryByTestId('pr-author')).not.toBeInTheDocument()
  expect(screen.queryByTestId('file-section')).not.toBeInTheDocument()
  expect(screen.queryByTestId('comment-card')).not.toBeInTheDocument()
  expect(secondRequests.some((path) => path.endsWith('/diff'))).toBe(true)
  expect(secondRequests.some((path) => path.includes('/findings?'))).toBe(true)
  expect(secondRequests.some((path) => path.includes('/pull-requests?'))).toBe(true)
})
