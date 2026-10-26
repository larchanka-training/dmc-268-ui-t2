import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CommentCard } from '@/features/review-comment-card'
import type { ReviewComment } from '@/entities/review-comment'
import { FIX_DIFF, FIX_RESULT, TEST_COMMENTS } from '@/test/fixtures'

const withFix = TEST_COMMENTS.find((c) => c.id === 'c1') as ReviewComment
const withoutFix = TEST_COMMENTS.find((c) => c.id === 'c2') as ReviewComment

function toggle(comment: ReviewComment) {
  return screen.getByRole('button', { name: new RegExp(comment.title) })
}

describe('CommentCard', () => {
  it('is collapsed by default: severity and title visible, body and fix hidden', () => {
    render(<CommentCard comment={withFix} />)

    expect(toggle(withFix)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('severity-badge')).toHaveTextContent('Critical')
    expect(screen.getByText(withFix.title)).toBeVisible()
    expect(screen.getByText(/instead of a generic error/)).not.toBeVisible()
    screen.queryAllByTestId('fix-row').forEach((row) => expect(row).not.toBeVisible())
  })

  it('expands on click and shows the body and the suggested fix', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)

    await user.click(toggle(withFix))

    expect(toggle(withFix)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/instead of a generic error/)).toBeVisible()
    expect(screen.getAllByTestId('fix-row')[0]).toBeVisible()
  })

  it('collapses again on a second click', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)

    await user.click(toggle(withFix))
    await user.click(toggle(withFix))

    expect(toggle(withFix)).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands from the keyboard with Enter', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)

    await user.tab()
    expect(toggle(withFix)).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(toggle(withFix)).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggles from the keyboard with Space', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)

    await user.tab()
    await user.keyboard(' ')
    expect(toggle(withFix)).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(toggle(withFix)).toHaveAttribute('aria-expanded', 'false')
  })

  it('links the toggle to the region it controls', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)
    await user.click(toggle(withFix))

    const regionId = toggle(withFix).getAttribute('aria-controls')
    expect(regionId).toBeTruthy()
    expect(document.getElementById(regionId as string)).toContainElement(screen.getByText(/instead of a generic error/))
  })

  it.each([
    ['critical', 'c1', 'Critical'],
    ['high', 'c2', 'High'],
    ['medium', 'c3', 'Medium'],
    ['low', 'c5', 'Low'],
  ])('shows %s severity as text, not only as colour', (severity, id, label) => {
    const comment = TEST_COMMENTS.find((c) => c.id === id) as ReviewComment
    render(<CommentCard comment={comment} />)

    const badge = screen.getByTestId('severity-badge')
    expect(badge).toHaveTextContent(label)
    expect(badge).toHaveAttribute('data-severity', severity)
  })

  it('renders the suggested fix as diff rows with add/del/context types', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)
    await user.click(toggle(withFix))

    const rows = screen.getAllByTestId('fix-row')
    expect(rows.map((r) => r.getAttribute('data-line-type'))).toEqual(['context', 'del', 'add', 'add'])
    expect(within(rows[1]).getByTestId('line-content')).toHaveTextContent('throw new Error(id)')
    expect(rows[1].className).toContain('bg-diff-del-bg')
    expect(rows[2].className).toContain('bg-diff-add-bg')
  })

  it('copies the resulting code (context + added lines) with "Copy fix"', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withFix} />)
    await user.click(toggle(withFix))

    await user.click(screen.getByRole('button', { name: /copy fix/i }))

    expect(await navigator.clipboard.readText()).toBe(FIX_RESULT)
    expect(FIX_DIFF).toContain('-throw new Error(id)') // sanity: fixture is a real diff
  })

  it('has no fix block and no copy button when there is no suggestedFix', async () => {
    const user = userEvent.setup()
    render(<CommentCard comment={withoutFix} />)
    await user.click(toggle(withoutFix))

    expect(screen.queryByRole('button', { name: /copy fix/i })).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('fix-row')).toHaveLength(0)
  })

  it('renders inline code in the explanation safely (no raw HTML)', async () => {
    const user = userEvent.setup()
    const comment: ReviewComment = { ...withFix, explanation: 'Use `safeParse` here <img src=x onerror=alert(1)>' }
    const { container } = render(<CommentCard comment={comment} />)
    await user.click(toggle(comment))

    expect(screen.getByText('safeParse').tagName).toBe('CODE')
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows explanation, evidence and recommendation as labelled sections, plus the category', async () => {
    const user = userEvent.setup()
    const comment: ReviewComment = {
      ...withoutFix,
      category: 'security',
      explanation: 'Why it is wrong',
      evidence: 'What proves it',
      recommendation: 'What to do',
    }
    render(<CommentCard comment={comment} />)
    await user.click(toggle(comment))

    expect(screen.getByRole('region', { name: 'Проблема' })).toHaveTextContent('Why it is wrong')
    expect(screen.getByRole('region', { name: 'Обоснование' })).toHaveTextContent('What proves it')
    expect(screen.getByRole('region', { name: 'Рекомендация' })).toHaveTextContent('What to do')
    expect(screen.getByTestId('comment-category')).toHaveTextContent('Безопасность')
  })

  it('shows a line range when the finding spans several lines', () => {
    render(<CommentCard comment={{ ...withoutFix, startLine: 10, line: 12 }} />)

    expect(toggle(withoutFix)).toHaveTextContent('new · 10–12')
  })

  it('exposes the comment id as the DOM id for hash links', () => {
    render(<CommentCard comment={withFix} />)

    expect(screen.getByTestId('comment-card')).toHaveAttribute('id', 'comment-c1')
    expect(screen.getByTestId('comment-card')).toHaveAttribute('data-comment-id', 'c1')
  })
})
