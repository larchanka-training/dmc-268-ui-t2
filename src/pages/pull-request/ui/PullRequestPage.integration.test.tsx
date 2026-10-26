import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MOCK_DEFAULT_REVIEW_ID, MOCK_REVIEWS, MockPullRequestDataSource } from '@/entities/pull-request'
import type { ReviewComment } from '@/entities/review-comment'
import { renderWithRouter } from '@/test/render-with-router'
import { TEST_REVIEW_PATH } from '@/test/fixtures'

const dataSource = () => new MockPullRequestDataSource({ latencyMs: 0 })

const lineKey = (c: Pick<ReviewComment, 'filePath' | 'side' | 'line'>) => `${c.filePath}|${c.side}|${c.line}`

describe('PullRequestPage with MockPullRequestDataSource (DoD)', () => {
  it('the fixtures cover what the task requires', async () => {
    const ds = dataSource()
    const comments = await ds.getReviewComments(MOCK_DEFAULT_REVIEW_ID)
    const files = (await ds.getDiff(MOCK_DEFAULT_REVIEW_ID)) ?? []

    expect(new Set(comments.map((c) => c.severity))).toEqual(new Set(['critical', 'high', 'medium', 'low']))
    expect(comments.some((c) => c.side === 'old')).toBe(true)
    expect(comments.some((c) => c.suggestedFix)).toBe(true)

    const perLine = new Map<string, number>()
    comments.forEach((c) => perLine.set(lineKey(c), (perLine.get(lineKey(c)) ?? 0) + 1))
    expect([...perLine.values()].some((n) => n > 1)).toBe(true)

    const extensions = new Set(files.map((file) => file.path.split('.').pop()))
    for (const ext of ['ts', 'tsx', 'css', 'json']) expect(extensions).toContain(ext)
    const statuses = new Set(files.map((file) => file.status))
    for (const status of ['added', 'deleted', 'modified', 'renamed']) expect(statuses).toContain(status)
  })

  it('the default review points at an open PR of the mock repository', async () => {
    const ds = dataSource()
    const review = await ds.getReview(MOCK_DEFAULT_REVIEW_ID)

    expect(await ds.getPullRequest(review.repositoryId, review.pullRequestNumber)).toMatchObject({ number: 42 })
    expect(await ds.getPullRequest('unknown-repo', 42)).toBeNull()
  })

  it('has a skipped review with an empty diff, a pending one without a diff, and rejects unknown ids', async () => {
    const ds = dataSource()
    const idByStatus = (status: string) =>
      Object.keys(MOCK_REVIEWS).find((id) => MOCK_REVIEWS[id].review.status === status) as string

    expect(await ds.getDiff(idByStatus('SKIPPED'))).toEqual([])
    expect(await ds.getDiff(idByStatus('FETCHING_DIFF'))).toBeNull()
    await expect(ds.getReview('999')).rejects.toMatchObject({ name: 'ReviewNotFoundError' })
  })

  it.each([
    ['unified', ''],
    ['split', '?view=split'],
  ])('%s: every in-diff card directly follows its line; the rest sits in "outside diff"', async (_mode, query) => {
    const ds = dataSource()
    const comments = await ds.getReviewComments(MOCK_DEFAULT_REVIEW_ID)
    renderWithRouter(`${TEST_REVIEW_PATH}${query}`, { dataSource: ds })
    await screen.findByRole('heading', { level: 1 })

    // страница: автор, ветки, статус, скор, вердикт, файлы
    expect(screen.getByTestId('pr-author')).toBeInTheDocument()
    expect(screen.getByTestId('pr-branches')).toHaveTextContent('→')
    expect(screen.getByTestId('review-status')).toBeInTheDocument()
    expect(screen.getAllByTestId('file-section').length).toBeGreaterThanOrEqual(4)

    // все замечания отрисованы ровно один раз
    const cards = screen.getAllByTestId('comment-card')
    expect(cards).toHaveLength(comments.length)

    let anchored = 0
    for (const card of cards) {
      const id = card.getAttribute('data-comment-id') as string
      const comment = comments.find((c) => c.id === id) as ReviewComment
      const holder = card.closest('[data-testid="comment-row"]')
      if (!holder) {
        expect(card.closest('[data-testid="out-of-diff-file"], [data-testid="out-of-diff-pr"]')).not.toBeNull()
        continue
      }
      anchored += 1
      const section = card.closest('[data-testid="file-section"]') as HTMLElement
      expect(section.getAttribute('data-file-path')).toBe(comment.filePath)
      const row = holder.previousElementSibling as HTMLElement
      expect(row).toHaveAttribute('data-testid', 'diff-row')
      const attr = comment.side === 'old' ? 'data-old-line' : 'data-new-line'
      expect(row.getAttribute(attr)).toBe(String(comment.line))
    }
    expect(anchored).toBeGreaterThan(0)
    expect(
      screen.getAllByTestId('out-of-diff-file').length + screen.getAllByTestId('out-of-diff-pr').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it.each([
    ['unified', ''],
    ['split', '?view=split'],
  ])('%s: a critical card expands and shows its suggested fix as a diff', async (_mode, query) => {
    const ds = dataSource()
    const comments = await ds.getReviewComments(MOCK_DEFAULT_REVIEW_ID)
    const withFix = comments.find((c) => c.severity === 'critical' && c.suggestedFix) as ReviewComment
    const { user } = renderWithRouter(`${TEST_REVIEW_PATH}${query}`, { dataSource: ds })
    await screen.findByRole('heading', { level: 1 })

    const card = document.querySelector(`[data-comment-id="${withFix.id}"]`) as HTMLElement
    const toggle = card.querySelector('button[aria-expanded]') as HTMLElement
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(card).getByTestId('severity-badge')).toHaveTextContent('Critical')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const types = within(card)
      .getAllByTestId('fix-row')
      .map((r) => r.getAttribute('data-line-type'))
    expect(types).toContain('add')
    expect(types).toContain('del')
  })
})
