import { screen, waitFor, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'

const path = '/repos/repo-1/rule-playground'

it('opens Rule Playground through the authenticated application shell', async () => {
  renderWithRouter(path)
  expect(await screen.findByRole('heading', { level: 1, name: 'Rule Playground' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Repos' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: 'Симулировать ревью' })).toBeInTheDocument()
  expect(screen.getByText('Введите код и правила, затем запустите симуляцию.')).toBeInTheDocument()
})

it('switches Code / Diff and keeps both editable drafts and rules', async () => {
  const { user } = renderWithRouter(path)
  await user.type(screen.getByLabelText('Путь файла'), 'src/demo.ts')
  await user.type(screen.getByLabelText('Исходный код'), 'const answer = 42')
  await user.type(screen.getByLabelText('.review/rules.md'), '# Security\n## SEC-1: Validate\nValidate input.')
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  expect(screen.queryByLabelText('Путь файла')).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Unified diff'), '+const answer = 43')
  await user.click(screen.getByRole('button', { name: 'Code' }))
  expect(screen.getByLabelText('Исходный код')).toHaveValue('const answer = 42')
  expect(screen.getByLabelText('Путь файла')).toHaveValue('src/demo.ts')
  expect(screen.getByLabelText('.review/rules.md')).toHaveValue('# Security\n## SEC-1: Validate\nValidate input.')
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  expect(screen.getByLabelText('Unified diff')).toHaveValue('+const answer = 43')
})

it('validates required fields beside the editors without sending a request', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const { user } = renderWithRouter(path)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(screen.getByLabelText('Путь файла')).toHaveAccessibleDescription('Укажите относительный путь файла.')
  expect(screen.getByLabelText('Исходный код')).toHaveAccessibleDescription('Введите исходный код.')
  expect(screen.getByLabelText('.review/rules.md')).toHaveAccessibleDescription('Введите правила ревью.')
  expect(screen.getByLabelText('Исходный код')).toHaveAttribute('aria-invalid', 'true')
  expect(fetch).not.toHaveBeenCalled()
})

const ruleText = '# Security\n## SEC-1: Validate input\nValidate input.'
async function fillCode(user: ReturnType<typeof renderWithRouter>['user']) {
  await user.type(screen.getByLabelText('Путь файла'), 'src/demo.ts')
  await user.type(screen.getByLabelText('Исходный код'), 'const answer = 42')
  await user.type(screen.getByLabelText('.review/rules.md'), ruleText)
}

it('sends the exact Code DTO with cookie credentials, CSRF and a transport idempotency key', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('/api/v1/repositories/repo-1/rule-simulations')
  expect(init?.method).toBe('POST')
  expect(init?.credentials).toBe('include')
  const headers = new Headers(init?.headers)
  expect(headers.get('Content-Type')).toBe('application/json')
  expect(headers.get('X-CSRF-Token')).toBe('csrf')
  expect(headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/)
  expect(JSON.parse(String(init?.body))).toEqual({
    input: { kind: 'code', path: 'src/demo.ts', source: 'const answer = 42' },
    rules: { format: 'rules-md/1', markdown: ruleText },
  })
})

it('shows loading and prevents duplicate submissions while a request is pending', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Симуляция выполняется…')
  const pending = screen.getByRole('button', { name: 'Симуляция выполняется…' })
  expect(pending).toBeDisabled()
  expect(screen.getByLabelText('Исходный код')).toBeDisabled()
  expect(screen.getByLabelText('.review/rules.md')).toBeDisabled()
  await user.click(pending)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('reports an HTTP error and preserves all entered text for a manual retry', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Gateway failed', { status: 502 }))
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не удалось выполнить симуляцию. Введённый текст сохранён. Повторите попытку.',
  )
  expect(screen.getByLabelText('Исходный код')).toHaveValue('const answer = 42')
  expect(screen.getByLabelText('Путь файла')).toHaveValue('src/demo.ts')
  expect(screen.getByLabelText('.review/rules.md')).toHaveValue(ruleText)
  expect(screen.getByRole('button', { name: 'Симулировать ревью' })).toBeEnabled()
})

it('shows the real SERVICE_UNAVAILABLE refusal without a fabricated success or automatic retry', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is unavailable.',
        request_id: 'request-1',
        retryable: false,
        retry_after: null,
      },
      { status: 503 },
    ),
  )
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '503 SERVICE_UNAVAILABLE: сервис симуляции временно недоступен. Введённый текст сохранён. Попробуйте позже.',
  )
  expect(screen.queryByText('Замечаний нет.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('.review/rules.md')).toHaveValue(ruleText)
  expect(fetch).toHaveBeenCalledTimes(1)
})

const unifiedDiff =
  'diff --git a/src/demo.ts b/src/demo.ts\n--- a/src/demo.ts\n+++ b/src/demo.ts\n@@ -1 +1 @@\n-const answer = 41\n+const answer = 42\n'

it('sends only the discriminated Diff input and the edited rules', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 503 }))
  const { user } = renderWithRouter(path)
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  await user.type(screen.getByLabelText('Unified diff'), unifiedDiff)
  await user.type(screen.getByLabelText('.review/rules.md'), ruleText)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    input: { kind: 'diff', unified_diff: unifiedDiff },
    rules: { format: 'rules-md/1', markdown: ruleText },
  })
})

it('rejects an undocumented API success instead of interpreting it as zero findings', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ findings: [] }))
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
  expect(screen.queryByText('Замечаний нет.')).not.toBeInTheDocument()
})

it('displays explicitly marked mock findings with rule, severity, location and safe text', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      {
        mock: true,
        findings: [
          {
            rule: 'SEC-1: Validate input',
            severity: 'high',
            file: 'src/demo.ts',
            line: 1,
            message: '<img src=x onerror=alert(1)> Validate input before use.',
          },
        ],
      },
      { headers: { 'X-Rule-Playground-Mock': 'true' } },
    ),
  )
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Mock: демонстрационный результат, без анализа кода и LLM.',
  )
  expect(screen.getByRole('list', { name: 'Замечания' })).toHaveTextContent('SEC-1: Validate input')
  expect(screen.getByText('high')).toBeInTheDocument()
  expect(screen.getByText('src/demo.ts:1')).toBeInTheDocument()
  expect(screen.getByText('<img src=x onerror=alert(1)> Validate input before use.')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})

it('shows the mock empty state when there are no findings', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({ mock: true, findings: [] }, { headers: { 'X-Rule-Playground-Mock': 'true' } }),
  )
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByText('Замечаний нет.')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Mock:')
})

it('places backend rules diagnostics beside the rules editor and keeps the draft', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      {
        code: 'VALIDATION_FAILED',
        message: 'Request is invalid.',
        request_id: 'req-2',
        retryable: false,
        retry_after: null,
        diagnostics: [{ code: 'RULES_INVALID_SEVERITY', line: 3, message: 'Invalid severity.' }],
        diagnostics_truncated: true,
      },
      { status: 422 },
    ),
  )
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  await waitFor(() =>
    expect(screen.getByLabelText('.review/rules.md')).toHaveAccessibleDescription(/Строка 3: Invalid severity/),
  )
  expect(screen.getByLabelText('.review/rules.md')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('.review/rules.md')).toHaveAccessibleDescription(/Показаны не все ошибки правил/)
  expect(screen.getByLabelText('.review/rules.md')).toHaveValue(ruleText)
})

it('highlights the current code, rules and unified diff using the installed syntax renderer', async () => {
  const { user } = renderWithRouter(path)
  await fillCode(user)
  const code = screen.getByRole('region', { name: 'Подсветка исходного кода' })
  expect(code.querySelector('.token.keyword')).toHaveTextContent('const')
  expect(screen.getByRole('region', { name: 'Подсветка правил' })).toHaveTextContent('SEC-1')
  expect(screen.getByRole('region', { name: 'Подсветка правил' }).querySelector('.token.title')).toHaveClass(
    'text-primary',
    'font-semibold',
  )
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  await user.type(screen.getByLabelText('Unified diff'), unifiedDiff)
  expect(
    screen.getByRole('region', { name: 'Подсветка unified diff' }).querySelector('.token.inserted'),
  ).toHaveTextContent('+const answer = 42')
})

it('rejects an unsafe Code path beside that field before sending', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.clear(screen.getByLabelText('Путь файла'))
  await user.type(screen.getByLabelText('Путь файла'), '../private.ts')
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(screen.getByLabelText('Путь файла')).toHaveAccessibleDescription(/Нужен нормализованный относительный путь/)
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects Code above the published byte or logical-line limits before sending', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const { user } = renderWithRouter(path)
  await fillCode(user)
  for (const source of ['//' + 'я'.repeat(32769), Array.from({ length: 501 }, () => 'x').join('\r\n')]) {
    fireEvent.change(screen.getByLabelText('Исходный код'), { target: { value: source } })
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(screen.getByLabelText('Исходный код')).toHaveAccessibleDescription('Код: не более 64 КиБ UTF-8 и 500 строк.')
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects an oversized Diff beside its editor before sending', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const { user } = renderWithRouter(path)
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  fireEvent.change(screen.getByLabelText('Unified diff'), { target: { value: '+' + 'x'.repeat(131072) } })
  await user.type(screen.getByLabelText('.review/rules.md'), ruleText)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(screen.getByLabelText('Unified diff')).toHaveAccessibleDescription(
    'Diff: не более 128 КиБ UTF-8. До 50 файлов и 2000 изменённых строк; формат проверяет сервер.',
  )
  expect(fetch).not.toHaveBeenCalled()
})

it('bounds syntax preview work while preserving the complete editable source', async () => {
  const { user } = renderWithRouter(path)
  await user.type(screen.getByLabelText('Путь файла'), 'src/demo.ts')
  const source = 'x'.repeat(9000)
  fireEvent.change(screen.getByLabelText('Исходный код'), { target: { value: source } })
  expect(
    screen.getByRole('region', { name: 'Подсветка исходного кода' }).querySelector('code')?.textContent?.length,
  ).toBeLessThanOrEqual(4001)
  expect(
    screen.getByText('Подсветка ограничена первыми 4000 символами и 100 строками. Полный текст сохранён.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Исходный код')).toHaveValue(source)
})

it('rejects rules larger than 64 KiB UTF-8 beside the rules editor', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const { user } = renderWithRouter(path)
  await fillCode(user)
  fireEvent.change(screen.getByLabelText('.review/rules.md'), { target: { value: 'я'.repeat(32769) } })
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(screen.getByLabelText('.review/rules.md')).toHaveAccessibleDescription('Правила: не более 64 КиБ UTF-8.')
  expect(fetch).not.toHaveBeenCalled()
})

it('rechecks an expired session through the existing auth guard and retains the return URL', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
  const { user, router } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(path)
})

it('clears an old result when the user edits the rules for a new simulation', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      { mock: true, findings: [{ message: 'Old mock finding' }] },
      { headers: { 'X-Rule-Playground-Mock': 'true' } },
    ),
  )
  const { user } = renderWithRouter(path)
  await fillCode(user)
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  await screen.findByText('Old mock finding')
  await user.type(screen.getByLabelText('.review/rules.md'), '\nNew instruction.')
  expect(screen.queryByText('Old mock finding')).not.toBeInTheDocument()
  expect(screen.getByText('Введите код и правила, затем запустите симуляцию.')).toBeInTheDocument()
})
