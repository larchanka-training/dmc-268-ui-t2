import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseUnifiedDiff } from '@/entities/diff'
import { ReviewNotFoundError } from '@/entities/pull-request'
import { createFakeDataSource } from '@/test/fake-data-source'
import { renderWithRouter } from '@/test/render-with-router'
import { TEST_REVIEW, TEST_REVIEW_PATH } from '@/test/fixtures'

async function renderLoaded(entry = TEST_REVIEW_PATH) {
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
  it('shows title, number, author, branches and review dates', async () => {
    await renderLoaded()

    expect(screen.getByTestId('pr-number')).toHaveTextContent('#42')
    expect(screen.getByTestId('pr-author')).toHaveTextContent('ada-lovelace')
    expect(screen.getByTestId('pr-author-avatar')).toBeInTheDocument()
    expect(screen.getByTestId('pr-branches')).toHaveTextContent('feature/user-meta → main')
    expect(screen.getByTestId('review-created')).toHaveAttribute('datetime', '2026-03-01T10:00:00.000Z')
    expect(screen.getByTestId('review-finished')).toHaveAttribute('datetime', '2026-03-02T12:30:00.000Z')
    expect(screen.getByTestId('review-summary')).toHaveTextContent('Looks mostly fine.')
  })

  it('falls back to the PR number when the PR is no longer open', async () => {
    renderWithRouter(TEST_REVIEW_PATH, { dataSource: createFakeDataSource({ getPullRequest: async () => null }) })

    expect(await screen.findByRole('heading', { level: 1, name: /Pull request #42/ })).toBeInTheDocument()
    expect(screen.queryByTestId('pr-author')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pr-branches')).not.toBeInTheDocument()
  })

  it('does not show a finish date for an unfinished review', async () => {
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getReview: async () => ({ ...TEST_REVIEW, status: 'LLM_PROCESSING', finishedAt: null }),
      }),
    })

    expect(await screen.findByTestId('review-status')).toHaveAttribute('data-status', 'LLM_PROCESSING')
    expect(screen.queryByTestId('review-finished')).not.toBeInTheDocument()
  })

  it('shows review status, score and verdict', async () => {
    await renderLoaded()

    expect(screen.getByTestId('review-status')).toHaveAttribute('data-status', 'COMPLETED')
    expect(screen.getByTestId('review-status')).toHaveTextContent('Ревью завершено')
  })

  it('shows publication status next to the review status', async () => {
    await renderLoaded()

    expect(screen.getByTestId('publication-status')).toHaveAttribute('data-status', 'PUBLISHED')
    expect(screen.getByTestId('publication-status')).toHaveTextContent('Опубликовано')
  })

  it('shows publication status independently of the review status', async () => {
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getReview: async () => ({ ...TEST_REVIEW, status: 'COMPLETED', publicationStatus: 'FAILED' }),
      }),
    })

    expect(await screen.findByTestId('publication-status')).toHaveAttribute('data-status', 'FAILED')
    expect(screen.getByTestId('publication-status')).toHaveTextContent('Публикация не удалась')
    expect(screen.getByTestId('review-status')).toHaveAttribute('data-status', 'COMPLETED')
  })

  it('shows severity counters for all comments (including out-of-diff)', async () => {
    await renderLoaded()

    const summary = screen.getByTestId('severity-summary')
    expect(within(summary).getByRole('button', { name: /critical/i })).toHaveTextContent('2')
    expect(within(summary).getByRole('button', { name: /high/i })).toHaveTextContent('2')
    expect(within(summary).getByRole('button', { name: /medium/i })).toHaveTextContent('1')
    expect(within(summary).getByRole('button', { name: /low/i })).toHaveTextContent('2')
  })

  it('a severity badge keeps only that level and opens its first comment', async () => {
    const { user, router } = await renderLoaded()

    await user.click(within(screen.getByTestId('severity-summary')).getByRole('button', { name: /high/i }))

    expect(router.state.location.hash).toBe('#comment-c2')
    expect(new URLSearchParams(router.state.location.search).get('severity')).toBe('high')
    expect(screen.getAllByTestId('comment-card').map((card) => card.getAttribute('data-severity'))).toEqual([
      'high',
      'high',
    ])
  })

  it('Дальше opens the first comment and then the next one', async () => {
    const { user, router } = await renderLoaded()

    expect(screen.getByText('7 замечаний')).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Дальше' })
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled()

    await user.click(next)
    expect(router.state.location.hash).toBe('#comment-c5')
    expect(document.querySelector('[data-comment-id="c5"]')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('1 из 7')).toBeInTheDocument()

    await user.click(next)
    expect(router.state.location.hash).toBe('#comment-c1')
    expect(screen.getByText('2 из 7')).toBeInTheDocument()
  })

  it('walks every card, including out-of-diff and the PR orphan, and stops at the ends', async () => {
    const { user, router } = await renderLoaded()
    const next = screen.getByRole('button', { name: 'Дальше' })
    const prev = screen.getByRole('button', { name: 'Назад' })

    expect(prev).toBeDisabled()
    for (const id of ['c5', 'c1', 'c2', 'c3', 'c6', 'c4', 'c7']) {
      await user.click(next)
      expect(router.state.location.hash).toBe(`#comment-${id}`)
    }
    expect(next).toBeDisabled()

    await user.click(prev)
    expect(router.state.location.hash).toBe('#comment-c4')
  })

  it('keeps severity badges only in the header', async () => {
    await renderLoaded()

    const filters = screen.getByRole('region', { name: 'Фильтры замечаний' })
    expect(within(filters).queryByRole('button', { name: /critical/i })).not.toBeInTheDocument()
    expect(within(filters).queryByText(/Показано/)).not.toBeInTheDocument()
  })

  it('clicking the active severity clears it and stays on the open comment', async () => {
    const { user, router } = await renderLoaded()
    const high = within(screen.getByTestId('severity-summary')).getByRole('button', { name: /high/i })

    await user.click(high)
    await user.click(high)

    expect(new URLSearchParams(router.state.location.search).get('severity')).toBeNull()
    expect(router.state.location.hash).toBe('#comment-c2')
    expect(screen.getAllByTestId('comment-card')).toHaveLength(7)
  })

  it('choosing a file opens its first comment', async () => {
    const { user, router } = await renderLoaded()

    await user.selectOptions(screen.getByRole('combobox', { name: /Файл/ }), 'src/legacy/old-helper.ts')

    expect(new URLSearchParams(router.state.location.search).get('file')).toBe('src/legacy/old-helper.ts')
    expect(router.state.location.hash).toBe('#comment-c4')
  })

  it('opening a card makes it current, and closing it leaves the mark', async () => {
    const { user, router } = await renderLoaded()
    const card = document.querySelector('[data-comment-id="c1"]') as HTMLElement
    const toggle = within(card).getByRole('button')

    await user.click(toggle)

    expect(router.state.location.hash).toBe('#comment-c1')
    expect(card).toHaveAttribute('aria-current', 'true')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)

    expect(router.state.location.hash).toBe('#comment-c1')
    expect(card).toHaveAttribute('aria-current', 'true')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('drops the hash when search excludes the current comment', async () => {
    const { user, router } = await renderLoaded()
    const scroll = Element.prototype.scrollIntoView as unknown as { mock: { contexts: Element[] } }

    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    expect(router.state.location.hash).toBe('#comment-c5')
    const scrolled = scroll.mock.contexts.length

    await user.type(screen.getByPlaceholderText('Поиск по тексту замечаний'), 'Unvalidated')

    expect(router.state.location.hash).toBe('')
    expect(document.querySelector('[aria-current="true"]')).toBeNull()
    expect(scroll.mock.contexts.length).toBe(scrolled)

    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    expect(router.state.location.hash).toBe('#comment-c1')
  })

  it('keeps the current comment when search still includes it', async () => {
    const { user, router } = await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    await user.type(screen.getByPlaceholderText('Поиск по тексту замечаний'), 'Old request')

    expect(router.state.location.hash).toBe('#comment-c5')
    expect(document.querySelector('[data-comment-id="c5"]')).toHaveAttribute('aria-current', 'true')
  })

  it('keeps a selected level clickable when its count falls to zero', async () => {
    const { user } = await renderLoaded()
    const low = within(screen.getByTestId('severity-summary')).getByRole('button', { name: /low/i })

    await user.click(low)
    await user.type(screen.getByPlaceholderText('Поиск по тексту замечаний'), 'Unvalidated')

    expect(low).toBeEnabled()
  })
})

describe('PullRequestPage: files', () => {
  it('lists every file of the diff with +/- stats and comment counts', async () => {
    await renderLoaded()

    const items = within(screen.getByTestId('file-list')).getAllByTestId('file-list-item')
    expect(items.map((i) => i.getAttribute('data-file-path'))).toEqual(['src/api/user.ts', 'src/legacy/old-helper.ts'])

    const stats = (item: HTMLElement) => [
      within(item).getByTestId('file-stat-add').textContent,
      within(item).getByTestId('file-stat-del').textContent,
      within(item).getByTestId('file-comment-count').textContent,
    ]
    expect(stats(items[0])).toEqual(['+2', '-1', '5'])
    expect(stats(items[1])).toEqual(['+0', '-2', '1'])
  })

  it('lists every diff path in the file filter, then a comment whose file is outside the diff', async () => {
    await renderLoaded()

    const select = screen.getByRole('combobox', { name: /Файл/ })
    expect(Array.from(select.querySelectorAll('option'), (option) => option.value)).toEqual([
      '',
      'src/api/user.ts',
      'src/legacy/old-helper.ts',
      'src/features/new-feature.ts',
      'src/missing.ts',
    ])
  })

  it('renders a section per file', async () => {
    await renderLoaded()

    expect(screen.getAllByTestId('file-section').map((s) => s.getAttribute('data-file-path'))).toEqual([
      'src/api/user.ts',
      'src/legacy/old-helper.ts',
    ])
    expect(fileSection('src/legacy/old-helper.ts')).toHaveAttribute('data-file-status', 'deleted')
  })

  it('shows a chosen comment-less file in the diff and keeps it out of the sidebar', async () => {
    const { user, router } = await renderLoaded()

    await user.selectOptions(screen.getByRole('combobox', { name: /Файл/ }), 'src/features/new-feature.ts')

    expect(screen.getAllByTestId('file-section').map((section) => section.getAttribute('data-file-path'))).toEqual([
      'src/features/new-feature.ts',
    ])
    expect(within(screen.getByTestId('file-list')).queryByTestId('file-list-item')).not.toBeInTheDocument()
    expect(within(fileSection('src/features/new-feature.ts')).getByTestId('diff-table')).toBeInTheDocument()
    expect(fileSection('src/features/new-feature.ts')).toHaveAttribute('data-file-status', 'added')
    expect(router.state.location.hash).toBe('')
  })

  it('keeps the file picker when AI finds no comments so the user can open a full file diff', async () => {
    const { user } = renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({ getReviewComments: async () => [] }),
    })
    await screen.findByRole('heading', { level: 1, name: /Add user metadata/ })

    expect(screen.getByText(/AI не нашёл замечаний/)).toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: /Файл/ })
    expect(Array.from(select.querySelectorAll('option'), (option) => option.value)).toEqual([
      '',
      'src/api/user.ts',
      'src/legacy/old-helper.ts',
      'src/features/new-feature.ts',
    ])

    await user.selectOptions(select, 'src/api/user.ts')

    expect(screen.getAllByTestId('file-section').map((section) => section.getAttribute('data-file-path'))).toEqual([
      'src/api/user.ts',
    ])
    expect(within(fileSection('src/api/user.ts')).getByTestId('diff-table')).toBeInTheDocument()
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
    const { user } = renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({ getDiff: async () => parseUnifiedDiff(binaryDiff) }),
    })
    await screen.findByRole('heading', { level: 1, name: /Add user metadata/ })

    expect(screen.queryByTestId('binary-placeholder')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: /Файл/ }), 'img/logo.png')

    expect(screen.getByTestId('binary-placeholder')).toBeInTheDocument()
  })

  it('folds a hunk that has no comment into one gap', async () => {
    const diff = `diff --git a/src/api/user.ts b/src/api/user.ts
index 1..2 100644
--- a/src/api/user.ts
+++ b/src/api/user.ts
@@ -1,1 +1,1 @@
-quiet-line-marker
+quiet-line-marker
@@ -9,1 +9,1 @@
-kept-line-marker
+kept-line-marker
`
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getDiff: async () => parseUnifiedDiff(diff),
        getReviewComments: async () => [
          {
            id: 'gap-c',
            filePath: 'src/api/user.ts',
            side: 'new',
            startLine: 9,
            line: 9,
            severity: 'high',
            category: 'correctness',
            title: 'Keep this hunk',
            explanation: '',
            evidence: '',
            recommendation: '',
          },
        ],
      }),
    })
    await screen.findByRole('heading', { level: 1, name: /Add user metadata/ })

    expect(screen.getByRole('button', { name: '2 строк без замечаний' })).toBeInTheDocument()
    const section = fileSection('src/api/user.ts')
    expect(section.textContent).not.toContain('quiet-line-marker')
    expect(section.textContent).toContain('kept-line-marker')
  })

  it('opens a gap until the level changes, and whole file shows every hunk', async () => {
    const diff = `diff --git a/src/api/user.ts b/src/api/user.ts
index 1..2 100644
--- a/src/api/user.ts
+++ b/src/api/user.ts
@@ -1,1 +1,1 @@
-quiet-line-marker
+quiet-line-marker
@@ -9,1 +9,1 @@
-kept-line-marker
+kept-line-marker
`
    const { user } = renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getDiff: async () => parseUnifiedDiff(diff),
        getReviewComments: async () => [
          {
            id: 'gap-c',
            filePath: 'src/api/user.ts',
            side: 'new',
            startLine: 9,
            line: 9,
            severity: 'high',
            category: 'correctness',
            title: 'Keep this hunk',
            explanation: '',
            evidence: '',
            recommendation: '',
          },
        ],
      }),
    })
    await screen.findByRole('heading', { level: 1, name: /Add user metadata/ })
    const section = () => fileSection('src/api/user.ts')

    await user.click(screen.getByRole('button', { name: '2 строк без замечаний' }))
    expect(section().textContent).toContain('quiet-line-marker')

    await user.click(screen.getByRole('button', { name: 'Дальше' }))
    expect(section().textContent).toContain('quiet-line-marker')

    await user.click(screen.getByRole('button', { name: 'весь файл' }))
    expect(section().textContent).toContain('quiet-line-marker')
    expect(section().textContent).toContain('kept-line-marker')

    await user.click(within(screen.getByTestId('severity-summary')).getByRole('button', { name: /high/i }))
    expect(section().textContent).not.toContain('quiet-line-marker')
    expect(section().textContent).toContain('kept-line-marker')
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
      await renderLoaded(`${TEST_REVIEW_PATH}${query}`)
      const section = fileSection('src/api/user.ts')

      // new:12 — три замечания, добавлены в порядке medium, critical, high
      expect(stackAfter(diffRow(section, { next: 12 }))).toEqual(['c1', 'c2', 'c3'])
    })

    it('anchors an old-side comment under the deleted line (old numbering)', async () => {
      await renderLoaded(`${TEST_REVIEW_PATH}${query}`)
      const section = fileSection('src/api/user.ts')
      const delRow = section.querySelector<HTMLElement>('[data-testid="diff-row"][data-old-line="11"]')

      expect(delRow).not.toBeNull()
      expect(stackAfter(delRow as HTMLElement)).toContain('c5')
      expect(stackAfter(delRow as HTMLElement)).not.toContain('c1')
    })

    it('anchors a comment on a deleted file by old numbering', async () => {
      await renderLoaded(`${TEST_REVIEW_PATH}${query}`)
      const section = fileSection('src/legacy/old-helper.ts')

      expect(stackAfter(diffRow(section, { old: 2 }))).toEqual(['c4'])
    })

    it('does not put cards after lines without comments', async () => {
      await renderLoaded(`${TEST_REVIEW_PATH}${query}`)
      const section = fileSection('src/api/user.ts')
      const plain = diffRow(section, { old: 10, next: 10 })

      expect(plain.nextElementSibling).not.toHaveAttribute('data-testid', 'comment-row')
    })

    it('makes the comment row span the full width of the table', async () => {
      await renderLoaded(`${TEST_REVIEW_PATH}${query}`)
      const row = diffRow(fileSection('src/api/user.ts'), { next: 12 })
      const cell = (row.nextElementSibling as HTMLElement).querySelector('td')

      expect(cell).toHaveAttribute('colspan')
      expect(Number(cell?.getAttribute('colspan'))).toBeGreaterThanOrEqual(2)
    })

    it('renders cards collapsed by default and expands on click and on Enter', async () => {
      const { user } = await renderLoaded(`${TEST_REVIEW_PATH}${query}`)
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
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getReviewComments: async () => [
          {
            id: 'only',
            filePath: 'src/api/user.ts',
            side: 'new',
            startLine: 12,
            line: 12,
            severity: 'low',
            category: 'correctness',
            title: 'Only',
            explanation: 'only',
            evidence: 'only',
            recommendation: 'only',
          },
        ],
      }),
    })
    await screen.findByRole('heading', { level: 1 })

    expect(screen.queryByTestId('out-of-diff-file')).not.toBeInTheDocument()
    expect(screen.queryByTestId('out-of-diff-pr')).not.toBeInTheDocument()
  })
})

describe('PullRequestPage: comment line range', () => {
  describe.each([
    ['unified', ''],
    ['split', '?view=split'],
  ])('%s mode', (_mode, query) => {
    it('marks every diff row of start_line…end_line and keeps the card under the last one', async () => {
      renderWithRouter(`${TEST_REVIEW_PATH}${query}`, {
        dataSource: createFakeDataSource({
          getReviewComments: async () => [
            {
              id: 'range',
              filePath: 'src/api/user.ts',
              side: 'new',
              startLine: 11,
              line: 12,
              severity: 'low',
              category: 'correctness',
              title: 'Range',
              explanation: 'range',
              evidence: 'range',
              recommendation: 'range',
            },
          ],
        }),
      })
      await screen.findByRole('heading', { level: 1, name: /Add user metadata/ })
      const section = fileSection('src/api/user.ts')

      // в split del old:11 и add new:11 делят одну строку, поэтому ищем по new-номеру
      const byNew = (n: number) => section.querySelector<HTMLElement>(`[data-testid="diff-row"][data-new-line="${n}"]`)!
      const context = section.querySelector<HTMLElement>('[data-old-line="10"][data-new-line="10"]')!

      expect(byNew(11)).toHaveAttribute('data-in-comment-range', 'true')
      expect(byNew(12)).toHaveAttribute('data-in-comment-range', 'true')
      expect(context).not.toHaveAttribute('data-in-comment-range')
      expect(stackAfter(byNew(12))).toEqual(['range'])
      expect(byNew(11).nextElementSibling).not.toHaveAttribute('data-testid', 'comment-row')
    })
  })
})

describe('PullRequestPage: states', () => {
  it('shows a loading state while data is pending', () => {
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({ getReview: () => new Promise(() => {}) }),
    })

    expect(screen.getByRole('status')).toHaveTextContent(/загрузка/i)
  })

  it('shows an error state when loading fails', async () => {
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({ getDiff: async () => Promise.reject(new Error('boom')) }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось загрузить/i)
  })

  it('shows an empty state for an empty diff but keeps the PR header', async () => {
    renderWithRouter(TEST_REVIEW_PATH, { dataSource: createFakeDataSource({ getDiff: async () => [] }) })

    expect(await screen.findByTestId('empty-diff')).toHaveTextContent(/diff пуст/i)
    expect(screen.getByRole('heading', { level: 1, name: /Add user metadata/ })).toBeInTheDocument()
    expect(screen.queryByTestId('diff-table')).not.toBeInTheDocument()
  })

  it('shows a "diff not stored yet" state when the diff is not available (404)', async () => {
    renderWithRouter(TEST_REVIEW_PATH, { dataSource: createFakeDataSource({ getDiff: async () => null }) })

    expect(await screen.findByTestId('diff-pending')).toHaveTextContent(/ещё не сохранён/i)
    expect(screen.queryByTestId('empty-diff')).not.toBeInTheDocument()
    expect(screen.getByTestId('out-of-diff-pr')).toBeInTheDocument()
  })

  it('shows "Ревью не найдено" when the data source says the review does not exist', async () => {
    renderWithRouter(TEST_REVIEW_PATH, {
      dataSource: createFakeDataSource({
        getReview: async (id) => Promise.reject(new ReviewNotFoundError(id)),
      }),
    })

    expect(await screen.findByTestId('review-not-found')).toHaveTextContent('Ревью не найдено')
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
