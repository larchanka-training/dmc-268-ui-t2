import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Review, ReviewStreamHandlers } from '@/entities/pull-request'
import { createFakeDataSource } from '@/test/fake-data-source'
import { renderWithRouter } from '@/test/render-with-router'
import { TEST_REVIEW, TEST_REVIEW_PATH } from '@/test/fixtures'

async function renderReview(review: Partial<Review>, entry = TEST_REVIEW_PATH) {
  renderWithRouter(entry, {
    dataSource: createFakeDataSource({ getReview: async () => ({ ...TEST_REVIEW, ...review }) }),
  })
  return screen.findByRole('region', { name: 'Статус проверки' })
}

const stage = (progress: HTMLElement, label: string) => within(progress).getByText(label).closest('li') as HTMLElement

const shownFiles = () => screen.getAllByTestId('file-section').map((el) => el.getAttribute('data-file-path'))

describe('PullRequestPage: review progress', () => {
  it('shows a SKIPPED publication as skipped, not as a running step', async () => {
    const progress = await renderReview({ status: 'COMPLETED', publicationStatus: 'SKIPPED' })

    expect(stage(progress, 'Публикация')).toHaveTextContent('пропущено')
    expect(stage(progress, 'Публикация')).not.toHaveAttribute('aria-current')
  })

  it('shows an UNKNOWN publication apart from a failed one', async () => {
    const progress = await renderReview({ status: 'COMPLETED', publicationStatus: 'UNKNOWN' })

    expect(stage(progress, 'Публикация')).toHaveTextContent('статус неизвестен')
    expect(stage(progress, 'Публикация')).not.toHaveTextContent('ошибка')
  })

  it('shows skipped files that share one reason on one line', async () => {
    const progress = await renderReview({
      status: 'PARTIAL',
      publicationStatus: 'PENDING',
      coverage: {
        included: [],
        skipped: [
          { path: 'docs/a.md', ranges: [], reason: 'file_limit' },
          { path: 'docs/b.md', ranges: [], reason: 'file_limit' },
        ],
        context_quality: 'full',
      },
    })

    expect(within(progress).getByTestId('review-skipped-note')).toHaveTextContent('Не вошло в анализ')
    const groups = within(progress).getAllByTestId('review-skipped-group')
    expect(groups).toHaveLength(1)
    const text = groups[0].textContent ?? ''
    expect(text.indexOf('docs/a.md')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('docs/a.md')).toBeLessThan(text.indexOf('лимит файлов'))
    expect(groups[0]).toHaveTextContent('docs/b.md')
    expect(groups[0]).not.toHaveTextContent('не вошло из-за')
  })

  it('shows one line per skipped reason', async () => {
    const progress = await renderReview({
      status: 'PARTIAL',
      coverage: {
        included: [],
        skipped: [
          { path: 'docs/a.md', ranges: [], reason: 'file_limit' },
          { path: 'src/big.ts', ranges: [], reason: 'line_limit' },
        ],
        context_quality: 'degraded',
      },
    })

    const groups = within(progress).getAllByTestId('review-skipped-group')
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveTextContent('docs/a.md')
    expect(groups[0]).toHaveTextContent('лимит файлов')
    expect(groups[1]).toHaveTextContent('src/big.ts')
    expect(groups[1]).toHaveTextContent('лимит строк')
    expect(progress).not.toHaveTextContent('degraded')
  })

  it('adds no skipped note when coverage is missing', async () => {
    const progress = await renderReview({ coverage: null })
    expect(within(progress).queryByTestId('review-skipped-note')).not.toBeInTheDocument()
  })

  it('adds no skipped note when nothing was skipped', async () => {
    const progress = await renderReview({
      coverage: { included: [], skipped: [], context_quality: 'full' },
    })
    expect(within(progress).queryByTestId('review-skipped-note')).not.toBeInTheDocument()
  })

  it('keeps the failure reason next to skipped files', async () => {
    const progress = await renderReview({
      status: 'FAILED',
      publicationStatus: 'NOT_READY',
      error: { reasonCode: 'LLM_TIMEOUT', retryable: false, retryAt: null },
      coverage: {
        included: [],
        skipped: [{ path: 'docs/a.md', ranges: [], reason: 'token_budget' }],
        context_quality: 'diff_only',
      },
    })

    const skipped = within(progress).getByTestId('review-skipped-group')
    expect(skipped).toHaveTextContent('docs/a.md')
    expect(skipped).toHaveTextContent('лимит токенов')
    expect(skipped.textContent?.indexOf('docs/a.md')).toBeLessThan(skipped.textContent?.indexOf('лимит токенов') ?? -1)
    expect(within(progress).getByTestId('review-error-reason')).toHaveTextContent('Причина: модель не ответила вовремя')
  })

  it('shows why a review failed', async () => {
    await renderReview({
      status: 'FAILED',
      publicationStatus: 'NOT_READY',
      error: { reasonCode: 'LLM_TIMEOUT', retryable: true, retryAt: null },
    })

    expect(screen.getByTestId('review-error-reason')).toHaveTextContent('модель не ответила вовремя')
    expect(screen.getByTestId('review-error-reason')).toHaveTextContent('можно повторить позже')
  })

  it('shows that a person stopped the review', async () => {
    await renderReview({
      status: 'FAILED',
      publicationStatus: 'NOT_READY',
      error: { reasonCode: 'USER_CANCELLED', retryable: false, retryAt: null },
    })

    expect(screen.getByTestId('review-error-reason')).toHaveTextContent('остановлено человеком')
    expect(screen.getByTestId('review-error-reason')).not.toHaveTextContent('можно повторить позже')
  })

  it('applies a status from the live stream and refetches diff and findings', async () => {
    let review: Review = { ...TEST_REVIEW, status: 'LLM_PROCESSING', publicationStatus: 'NOT_READY', finishedAt: null }
    let stream: ReviewStreamHandlers | undefined
    const getDiff = vi.fn(createFakeDataSource().getDiff)
    const getReviewComments = vi.fn(createFakeDataSource().getReviewComments)
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getReview: async () => review,
        getDiff,
        getReviewComments,
        subscribeReview: (_id, handlers) => {
          stream = handlers
          return () => {}
        },
      }),
    })
    const progress = await screen.findByRole('region', { name: 'Статус проверки' })
    expect(within(progress).getByRole('status')).toHaveTextContent('Анализ моделью')
    await waitFor(() => expect(stream).toBeDefined())

    review = { ...review, status: 'COMPLETED', publicationStatus: 'PUBLISHED' }
    stream?.onSnapshot({ sequence: 2, status: 'COMPLETED', publicationStatus: 'PUBLISHED' })

    await waitFor(() => expect(within(progress).getByRole('status')).toHaveTextContent('Анализ завершён'))
    await waitFor(() => expect(getDiff).toHaveBeenCalledTimes(2))
    expect(getReviewComments).toHaveBeenCalledTimes(2)
  })

  it('switches to polling when the stream is unavailable', async () => {
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getReview: async () => ({ ...TEST_REVIEW, status: 'QUEUED', publicationStatus: 'NOT_READY' }),
        subscribeReview: (_id, handlers) => {
          handlers.onFallback()
          return () => {}
        },
      }),
    })

    expect(await screen.findByText('Обновляется периодически')).toBeInTheDocument()
  })
})

describe('PullRequestPage: finding filters', () => {
  it('shows every file without filters', async () => {
    await renderReview({})

    expect(shownFiles()).toHaveLength(3)
  })

  it('keeps only files with matching findings when filtered by severity from the URL', async () => {
    await renderReview({}, `${TEST_REVIEW_PATH}?severity=high`)

    await waitFor(() => expect(shownFiles()).toEqual(['src/api/user.ts', 'src/legacy/old-helper.ts']))
    expect(screen.getByTestId('severity-count-critical')).toHaveTextContent('0')
    expect(screen.getByTestId('severity-count-high')).toHaveTextContent('2')
  })

  it('offers to reset filters that match nothing', async () => {
    await renderReview({}, `${TEST_REVIEW_PATH}?q=no-such-text`)

    const reset = await screen.findByRole('button', { name: 'Сбросить фильтры' })
    reset.click()

    await waitFor(() => expect(shownFiles()).toHaveLength(3))
  })
})
