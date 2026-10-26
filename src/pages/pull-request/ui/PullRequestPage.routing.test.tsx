import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeDataSource } from '@/test/fake-data-source'
import { renderWithRouter } from '@/test/render-with-router'
import { TEST_REVIEW_ID, TEST_REVIEW_PATH } from '@/test/fixtures'

const title = () => screen.findByRole('heading', { level: 1, name: /Add user metadata/ })
const toggleOf = (id: string) =>
  document.querySelector(`[data-comment-id="${id}"] button[aria-expanded]`) as HTMLElement
const viewParam = (search: string) => new URLSearchParams(search).get('view')

describe('routing: /reviews/:reviewId', () => {
  it('loads the review taken from the URL params and its PR', async () => {
    const dataSource = createFakeDataSource()
    const calls: string[] = []
    const getReview = dataSource.getReview.bind(dataSource)
    dataSource.getReview = (id) => {
      calls.push(id)
      return getReview(id)
    }

    renderWithRouter(TEST_REVIEW_PATH, { dataSource })

    await title()
    expect(calls).toContain(TEST_REVIEW_ID)
    expect(screen.getByTestId('pr-number')).toHaveTextContent('#42')
  })

  it('shows "Ревью не найдено" for an unknown reviewId', async () => {
    renderWithRouter('/reviews/999')

    expect(await screen.findByTestId('review-not-found')).toHaveTextContent('Ревью не найдено')
  })

  it('shows a not-found screen for an unknown URL', async () => {
    renderWithRouter('/nope/at/all')

    expect(await screen.findByTestId('route-not-found')).toBeInTheDocument()
  })

  it('redirects /review to the default review', async () => {
    const { router } = renderWithRouter('/review')

    await title()
    expect(router.state.location.pathname).toBe(TEST_REVIEW_PATH)
  })

  it('renders the PR inside the app shell with the Reviews/PRs nav item active', async () => {
    renderWithRouter(TEST_REVIEW_PATH)
    await title()

    expect(screen.getByRole('link', { name: 'Reviews/PRs' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('routing: auth', () => {
  it('redirects / to /repos for a signed-in user', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    const { router } = renderWithRouter('/')

    await waitFor(() => expect(router.state.location.pathname).toBe('/repos'))
  })

  it('sends an anonymous user from a PR to /login with returnUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
    const { router } = renderWithRouter(`${TEST_REVIEW_PATH}?view=split`, { session: null })

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(`${TEST_REVIEW_PATH}?view=split`)
  })
})

describe('routing: ?view=', () => {
  it('opens side-by-side for ?view=split', async () => {
    renderWithRouter(`${TEST_REVIEW_PATH}?view=split`)
    await title()

    expect(screen.getAllByTestId('diff-table').every((t) => t.getAttribute('data-view') === 'split')).toBe(true)
    expect(screen.getByRole('button', { name: 'Side-by-side' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens unified for ?view=unified and falls back to unified for junk', async () => {
    const first = renderWithRouter(`${TEST_REVIEW_PATH}?view=unified`)
    await title()
    expect(screen.getAllByTestId('diff-table')[0]).toHaveAttribute('data-view', 'unified')
    first.unmount()

    renderWithRouter(`${TEST_REVIEW_PATH}?view=banana`)
    await title()
    expect(screen.getAllByTestId('diff-table')[0]).toHaveAttribute('data-view', 'unified')
  })

  it('updates the query parameter when the mode is toggled', async () => {
    const { user, router } = renderWithRouter(TEST_REVIEW_PATH)
    await title()

    await user.click(screen.getByRole('button', { name: 'Side-by-side' }))
    expect(viewParam(router.state.location.search)).toBe('split')

    await user.click(screen.getByRole('button', { name: 'Unified' }))
    expect(viewParam(router.state.location.search)).toBe('unified')
  })

  it('keeps the chosen mode when navigating to another file', async () => {
    const { user, router } = renderWithRouter(`${TEST_REVIEW_PATH}?view=split`)
    await title()

    await user.click(within(screen.getByTestId('file-list')).getByRole('link', { name: /old-helper\.ts/ }))

    expect(router.state.location.hash).toBe('#file-src/legacy/old-helper.ts')
    expect(viewParam(router.state.location.search)).toBe('split')
    expect(screen.getAllByTestId('diff-table')[0]).toHaveAttribute('data-view', 'split')
  })
})

describe('routing: #hash anchors', () => {
  it('expands and scrolls to the comment from #comment-<id>', async () => {
    renderWithRouter(`${TEST_REVIEW_PATH}#comment-c1`)
    await title()

    await waitFor(() => expect(toggleOf('c1')).toHaveAttribute('aria-expanded', 'true'))
    expect(toggleOf('c2')).toHaveAttribute('aria-expanded', 'false')

    const scroll = Element.prototype.scrollIntoView as unknown as { mock: { contexts: Element[] } }
    expect(scroll.mock.contexts.some((el) => el.getAttribute('data-comment-id') === 'c1')).toBe(true)
  })

  it('works in split mode too', async () => {
    renderWithRouter(`${TEST_REVIEW_PATH}?view=split#comment-c2`)
    await title()

    await waitFor(() => expect(toggleOf('c2')).toHaveAttribute('aria-expanded', 'true'))
  })

  it('expands an out-of-diff comment from the hash', async () => {
    renderWithRouter(`${TEST_REVIEW_PATH}#comment-c7`)
    await title()

    await waitFor(() => expect(toggleOf('c7')).toHaveAttribute('aria-expanded', 'true'))
  })

  it('scrolls to the file from #file-<path>', async () => {
    renderWithRouter(`${TEST_REVIEW_PATH}#file-src/legacy/old-helper.ts`)
    await title()

    await waitFor(() => {
      const scroll = Element.prototype.scrollIntoView as unknown as { mock: { contexts: Element[] } }
      expect(scroll.mock.contexts.some((el) => el.id === 'file-src/legacy/old-helper.ts')).toBe(true)
    })
  })

  it('expands a collapsed file when the hash points at a comment inside it', async () => {
    const { user, router } = renderWithRouter(TEST_REVIEW_PATH)
    await title()
    const section = screen
      .getAllByTestId('file-section')
      .find((s) => s.getAttribute('data-file-path') === 'src/legacy/old-helper.ts') as HTMLElement
    await user.click(within(section).getByRole('button', { name: 'src/legacy/old-helper.ts' }))
    expect(within(section).queryByTestId('diff-table')).not.toBeInTheDocument()

    await act(() => router.navigate({ hash: '#comment-c4' }))

    await waitFor(() => expect(toggleOf('c4')).toHaveAttribute('aria-expanded', 'true'))
    expect(within(section).getByTestId('diff-table')).toBeInTheDocument()
  })

  it('scrolls to the comment once its collapsed file has been expanded', async () => {
    const { user, router } = renderWithRouter(TEST_REVIEW_PATH)
    await title()
    const section = screen
      .getAllByTestId('file-section')
      .find((s) => s.getAttribute('data-file-path') === 'src/legacy/old-helper.ts') as HTMLElement
    await user.click(within(section).getByRole('button', { name: 'src/legacy/old-helper.ts' }))
    const scroll = Element.prototype.scrollIntoView as unknown as { mock: { contexts: Element[] } }
    const scrolledBefore = scroll.mock.contexts.length

    await act(() => router.navigate({ hash: '#comment-c4' }))

    await waitFor(() =>
      expect(scroll.mock.contexts.slice(scrolledBefore).some((el) => el.getAttribute('data-comment-id') === 'c4')).toBe(
        true,
      ),
    )
  })

  it('scrolls to the comment when a severity counter jumps into a collapsed file', async () => {
    const { user } = renderWithRouter(TEST_REVIEW_PATH)
    await title()
    const section = screen
      .getAllByTestId('file-section')
      .find((s) => s.getAttribute('data-file-path') === 'src/api/user.ts') as HTMLElement
    await user.click(within(section).getByRole('button', { name: 'src/api/user.ts' }))
    const scroll = Element.prototype.scrollIntoView as unknown as { mock: { contexts: Element[] } }
    const scrolledBefore = scroll.mock.contexts.length

    await user.click(within(screen.getByTestId('severity-summary')).getByRole('button', { name: /critical/i }))

    await waitFor(() =>
      expect(scroll.mock.contexts.slice(scrolledBefore).some((el) => el.getAttribute('data-comment-id') === 'c1')).toBe(
        true,
      ),
    )
  })
})

describe('routing: severity counters jump to the first comment', () => {
  it.each([
    ['critical', 'c1'],
    ['high', 'c2'],
    ['medium', 'c3'],
    ['low', 'c5'],
  ])('%s → #comment-%s', async (severity, id) => {
    const { user, router } = renderWithRouter(TEST_REVIEW_PATH)
    await title()

    await user.click(
      within(screen.getByTestId('severity-summary')).getByRole('button', { name: new RegExp(severity, 'i') }),
    )

    expect(router.state.location.hash).toBe(`#comment-${id}`)
    await waitFor(() => expect(toggleOf(id)).toHaveAttribute('aria-expanded', 'true'))
  })
})
