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

  it('shows why a review failed', async () => {
    await renderReview({
      status: 'FAILED',
      publicationStatus: 'NOT_READY',
      error: { reasonCode: 'LLM_TIMEOUT', retryable: true, retryAt: null },
    })

    expect(screen.getByTestId('review-error-reason')).toHaveTextContent('модель не ответила вовремя')
    expect(screen.getByTestId('review-error-reason')).toHaveTextContent('можно повторить позже')
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
