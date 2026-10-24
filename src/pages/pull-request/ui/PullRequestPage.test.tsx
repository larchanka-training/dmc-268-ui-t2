import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PullRequestNotFoundError } from '@/entities/pull-request'
import { createFakeDataSource } from '@/test/fake-data-source'
import { renderWithRouter } from '@/test/render-with-router'

async function renderLoaded(entry = '/pulls/42') {
  const utils = renderWithRouter(entry)
  await screen.findByRole('heading', { level: 1, name: /Add user metadata/ })
  return utils
}

const fileSection = (path: string) =>
  screen.getAllByTestId('file-section').find((el) => el.getAttribute('data-file-path') === path) as HTMLElement

/** Строка diff по номерам; в split-режиме одна строка может нести оба номера. */
function diffRow(section: HTMLElement, { old, next }: { old?: number; next?: number }) {
  const selector = [
    '[data-testid="diff-row"]',
    old != null ? `[data-old-line="${old}"]` : ':not([data-old-line])',
    next != null ? `[data-new-line="${next}"]` : ':not([data-new-line])',
  ].join('')
  const row = section.querySelector<HTMLElement>(selector)
  if (!row) throw new Error(`row not found: ${selector}`)
  return row
}

function stackAfter(row: HTMLElement) {
  const next = row.nextElementSibling as HTMLElement | null
  expect(next).not.toBeNull()
  expect(next).toHaveAttribute('data-testid', 'comment-row')
  return within(next as HTMLElement)
    .getAllByTestId('comment-card')
    .map((card) => card.getAttribute('data-comment-id'))
}

describe('PullRequestPage: metadata', () => {
  it('shows title, number, author, branches and dates', async () => {
    await renderLoaded()

    expect(screen.getByTestId('pr-number')).toHaveTextContent('#42')
    expect(screen.getByTestId('pr-author')).toHaveTextContent('Ada Lovelace')
    expect(screen.getByTestId('pr-author-avatar')).toBeInTheDocument()
    expect(screen.getByTestId('pr-branches')).toHaveTextContent('feature/user-meta → main')
    expect(screen.getByTestId('pr-created')).toHaveAttribute('datetime', '2026-03-01T10:00:00.000Z')
    expect(screen.getByTestId('pr-updated')).toHaveAttribute('datetime', '2026-03-02T12:30:00.000Z')
  })

  it('shows review status, score and verdict', async () => {
    await renderLoaded()

    expect(screen.getByTestId('review-status')).toHaveAttribute('data-status', 'COMPLETED')
    expect(screen.getByTestId('review-status')).toHaveTextContent('Ревью завершено')
  })

  it('shows severity counters for all comments (including out-of-diff)', async () => {
    await renderLoaded()

    const summary = screen.getByTestId('severity-summary')
    expect(within(summary).getByRole('button', { name: /critical/i })).toHaveTextContent('2')
    expect(within(summary).getByRole('button', { name: /warning/i })).toHaveTextContent('2')
    expect(within(summary).getByRole('button', { name: /info/i })).toHaveTextContent('3')
  })
})

describe('PullRequestPage: files', () => {
  it('lists every file of the diff with +/- stats and comment counts', async () => {
    await renderLoaded()

    const items = within(screen.getByTestId('file-list')).getAllByTestId('file-list-item')
    expect(items.map((i) => i.getAttribute('data-file-path'))).toEqual([
      'src/api/user.ts',
      'src/legacy/old-helper.ts',
      'src/features/new-feature.ts',
    ])

    const stats = (item: HTMLElement) => [
      within(item).getByTestId('file-stat-add').textContent,
      within(item).getByTestId('file-stat-del').textContent,
      within(item).getByTestId('file-comment-count').textContent,
    ]
    expect(stats(items[0])).toEqual(['+2', '-1', '5'])
    expect(stats(items[1])).toEqual(['+0', '-2', '1'])
    expect(stats(items[2])).toEqual(['+2', '-0', '0'])
  })

  it('renders a section per file', async () => {
    await renderLoaded()

    expect(screen.getAllByTestId('file-section').map((s) => s.getAttribute('data-file-path'))).toEqual([
      'src/api/user.ts',
      'src/legacy/old-helper.ts',
      'src/features/new-feature.ts',
    ])
    expect(fileSection('src/legacy/old-helper.ts')).toHaveAttribute('data-file-status', 'deleted')
    expect(fileSection('src/features/new-feature.ts')).toHaveAttribute('data-file-status', 'added')
  })

  it('collapses and expands a file', async () => {
    const { user } = await renderLoaded()
    const section = fileSection('src/api/user.ts')
    const toggle = within(section).getByRole('button', { name: 'src/api/user.ts' })

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(section).getByTestId('diff-table')).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(section).queryByTestId('diff-table')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(within(section).getByTestId('diff-table')).toBeInTheDocument()
  })

  it('marks add/del/context rows with line type, highlight class and line numbers', async () => {
    await renderLoaded()
    const section = fileSection('src/api/user.ts')

    const del = diffRow(section, { old: 11 })
    expect(del).toHaveAttribute('data-line-type', 'del')
    expect(del.className).toContain('bg-diff-del-bg')
    expect(within(del).getByTestId('line-marker')).toHaveTextContent('-')

    const add = diffRow(section, { next: 12 })
    expect(add).toHaveAttribute('data-line-type', 'add')
    expect(add.className).toContain('bg-diff-add-bg')
    expect(within(add).getByTestId('line-marker')).toHaveTextContent('+')

    const ctx = diffRow(section, { old: 12, next: 13 })
    expect(ctx).toHaveAttribute('data-line-type', 'context')
    expect(within(ctx).getByTestId('line-content')).toHaveTextContent('return response.data')
  })

  it('syntax-highlights code tokens', async () => {
    await renderLoaded()
    const row = diffRow(fileSection('src/api/user.ts'), { next: 12 })

    expect(row.querySelector('.token.keyword')).not.toBeNull()
  })

  it('shows a placeholder for binary files', async () => {
    const binaryDiff = `diff --git a/img/logo.png b/img/logo.png
index 1..2 100644
Binary files a/img/logo.png and b/img/logo.png differ
`
    renderWithRouter('/pulls/42', { dataSource: createFakeDataSource({ getDiff: async () => binaryDiff }) })

    expect(await screen.findByTestId('binary-placeholder')).toBeInTheDocument()
  })
})

describe('PullRequestPage: view mode', () => {
  it('defaults to unified', async () => {
    await renderLoaded()

    expect(screen.getAllByTestId('diff-table').every((t) => t.getAttribute('data-view') === 'unified')).toBe(true)
    expect(screen.getByRole('button', { name: 'Unified' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Side-by-side' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the markup to side-by-side and back', async () => {
    const { user } = await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Side-by-side' }))
    expect(screen.getAllByTestId('diff-table').every((t) => t.getAttribute('data-view') === 'split')).toBe(true)

    // в split del и add стоят в одной строке
    const row = diffRow(fileSection('src/api/user.ts'), { old: 11, next: 11 })
    expect(within(row).getByTestId('cell-left')).toHaveTextContent('client.get(id)')
    expect(within(row).getByTestId('cell-right')).toHaveTextContent('withMeta')

    await user.click(screen.getByRole('button', { name: 'Unified' }))
    expect(screen.getAllByTestId('diff-table').every((t) => t.getAttribute('data-view') === 'unified')).toBe(true)
  })

  it('leaves an empty cell opposite a lone addition in split mode', async () => {
    const { user } = await renderLoaded()
    await user.click(screen.getByRole('button', { name: 'Side-by-side' }))

    const row = diffRow(fileSection('src/api/user.ts'), { next: 12 })
    expect(within(row).getByTestId('cell-left')).toBeEmptyDOMElement()
    expect(within(row).getByTestId('cell-right')).toHaveTextContent('throw new Error(id)')
  })
})

describe('PullRequestPage: AI comments under their lines (DoD)', () => {
  describe.each([
    ['unified', ''],
    ['split', '?view=split'],
  ])('%s mode', (_mode, query) => {
    it('puts the card stack in the DOM right after the line it belongs to, ordered by severity', async () => {
      await renderLoaded(`/pulls/42${query}`)
      const section = fileSection('src/api/user.ts')

      // new:12 — три замечания, добавлены в порядке info, critical, warning
      expect(stackAfter(diffRow(section, { next: 12 }))).toEqual(['c1', 'c2', 'c3'])
    })

    it('anchors an old-side comment under the deleted line (old numbering)', async () => {
      await renderLoaded(`/pulls/42${query}`)
      const section = fileSection('src/api/user.ts')
      const delRow = section.querySelector<HTMLElement>('[data-testid="diff-row"][data-old-line="11"]')

      expect(delRow).not.toBeNull()
      expect(stackAfter(delRow as HTMLElement)).toContain('c5')
      expect(stackAfter(delRow as HTMLElement)).not.toContain('c1')
    })

    it('anchors a comment on a deleted file by old numbering', async () => {
      await renderLoaded(`/pulls/42${query}`)
      const section = fileSection('src/legacy/old-helper.ts')

      expect(stackAfter(diffRow(section, { old: 2 }))).toEqual(['c4'])
    })

    it('does not put cards after lines without comments', async () => {
      await renderLoaded(`/pulls/42${query}`)
      const section = fileSection('src/api/user.ts')
      const plain = diffRow(section, { old: 10, next: 10 })

      expect(plain.nextElementSibling).not.toHaveAttribute('data-testid', 'comment-row')
    })

    it('makes the comment row span the full width of the table', async () => {
      await renderLoaded(`/pulls/42${query}`)
      const row = diffRow(fileSection('src/api/user.ts'), { next: 12 })
      const cell = (row.nextElementSibling as HTMLElement).querySelector('td')

      expect(cell).toHaveAttribute('colspan')
      expect(Number(cell?.getAttribute('colspan'))).toBeGreaterThanOrEqual(2)
    })

    it('renders cards collapsed by default and expands on click and on Enter', async () => {
      const { user } = await renderLoaded(`/pulls/42${query}`)
      const card = (id: string) => document.querySelector(`[data-comment-id="${id}"]`) as HTMLElement
      const toggle = (id: string) => card(id).querySelector('button[aria-expanded]') as HTMLElement

      expect(toggle('c1')).toHaveAttribute('aria-expanded', 'false')

      await user.click(toggle('c1'))
      expect(toggle('c1')).toHaveAttribute('aria-expanded', 'true')
      expect(within(card('c1')).getByText(/instead of a generic error/)).toBeVisible()
      expect(within(card('c1')).getAllByTestId('fix-row').length).toBeGreaterThan(0)

      toggle('c2').focus()
      await user.keyboard('{Enter}')
      expect(toggle('c2')).toHaveAttribute('aria-expanded', 'true')
      expect(within(card('c2')).getByText(/hard to catch/)).toBeVisible()
    })
  })

  it('keeps the same comments under the same lines after toggling the mode', async () => {
    const { user } = await renderLoaded()
    const section = () => fileSection('src/api/user.ts')
    const before = stackAfter(diffRow(section(), { next: 12 }))

    await user.click(screen.getByRole('button', { name: 'Side-by-side' }))
    const after = stackAfter(diffRow(section(), { next: 12 }))

    expect(after).toEqual(before)
  })

  it('in split mode a del/add pair shares one stack, sorted by severity', async () => {
    const { user } = await renderLoaded()
    await user.click(screen.getByRole('button', { name: 'Side-by-side' }))

    // пара (old:11 | new:11): комментарий c5 (old) лежит под парой
    expect(stackAfter(diffRow(fileSection('src/api/user.ts'), { old: 11, next: 11 }))).toEqual(['c5'])
  })
})

describe('PullRequestPage: comments outside the diff', () => {
  it('shows a file-level "outside diff" block for a line that is not in the diff', async () => {
    await renderLoaded()
    const block = within(fileSection('src/api/user.ts')).getByTestId('out-of-diff-file')

    expect(
      within(block)
        .getAllByTestId('comment-card')
        .map((c) => c.getAttribute('data-comment-id')),
    ).toEqual(['c6'])
    expect(block).toHaveTextContent('Замечания вне diff')
  })

  it('shows a PR-level "outside diff" block for a file that is not in the diff', async () => {
    await renderLoaded()
    const block = screen.getByTestId('out-of-diff-pr')

    expect(
      within(block)
        .getAllByTestId('comment-card')
        .map((c) => c.getAttribute('data-comment-id')),
    ).toEqual(['c7'])
    expect(within(block).getByText('src/missing.ts')).toBeInTheDocument()
  })

  it('does not render out-of-diff blocks when everything is anchored', async () => {
    renderWithRouter('/pulls/42', {
      dataSource: createFakeDataSource({
        getReviewComments: async () => [
          {
            id: 'only',
            filePath: 'src/api/user.ts',
            side: 'new',
            line: 12,
            severity: 'info',
            title: 'Only',
            body: 'only',
          },
        ],
      }),
    })
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByTestId('out-of-diff-file')).not.toBeInTheDocument()
    expect(screen.queryByTestId('out-of-diff-pr')).not.toBeInTheDocument()
  })
})

describe('PullRequestPage: states', () => {
  it('shows a loading state while data is pending', () => {
    renderWithRouter('/pulls/42', {
      dataSource: createFakeDataSource({ getPullRequest: () => new Promise(() => {}) }),
    })

    expect(screen.getByRole('status')).toHaveTextContent(/загрузка/i)
  })

  it('shows an error state when loading fails', async () => {
    renderWithRouter('/pulls/42', {
      dataSource: createFakeDataSource({ getDiff: async () => Promise.reject(new Error('boom')) }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось загрузить/i)
  })

  it('shows an empty state for an empty diff but keeps the PR header', async () => {
    renderWithRouter('/pulls/42', { dataSource: createFakeDataSource({ getDiff: async () => '' }) })

    expect(await screen.findByTestId('empty-diff')).toHaveTextContent(/diff пуст/i)
    expect(screen.getByRole('heading', { level: 1, name: /Add user metadata/ })).toBeInTheDocument()
    expect(screen.queryByTestId('diff-table')).not.toBeInTheDocument()
  })

  it('shows "PR не найден" when the data source says the PR does not exist', async () => {
    renderWithRouter('/pulls/42', {
      dataSource: createFakeDataSource({
        getPullRequest: async (id) => Promise.reject(new PullRequestNotFoundError(id)),
      }),
    })

    expect(await screen.findByTestId('pr-not-found')).toHaveTextContent('PR не найден')
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
