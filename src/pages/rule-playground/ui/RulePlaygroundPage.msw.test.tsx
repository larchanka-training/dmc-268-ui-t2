import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { reviewHandlers } from '@/app/msw/handlers'
import { clearSessionCookie, MSW_CSRF_TOKEN, setSessionCookie } from '@/app/msw/session-cookie'
import { MOCK_REPOSITORY_ID } from '@/entities/pull-request'
import { fakeMe, renderWithRouter } from '@/test/render-with-router'

const server = setupServer(...reviewHandlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setSessionCookie()
  const interceptedFetch = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
    interceptedFetch(new URL(String(input), window.location.origin), init),
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  server.resetHandlers()
  clearSessionCookie()
})

it('runs fixed MSW findings with a complete mock audit and a sparse audit through the real page', async () => {
  const { user } = renderWithRouter(`/repos/${MOCK_REPOSITORY_ID}/rule-playground`, {
    session: { ...fakeMe, csrfToken: MSW_CSRF_TOKEN },
  })
  await user.type(screen.getByLabelText('Путь файла'), 'src/demo.ts')
  await user.type(screen.getByLabelText('Исходный код'), 'const answer = 42')
  await user.type(screen.getByLabelText('.review/rules.md'), '# Security\n## SEC-1: Validate input\nValidate input.')
  await user.selectOptions(screen.getByLabelText('Сценарий development'), 'findings')
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByText('MOCK-1: Проверка входных данных')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Mock: демонстрационный результат')
  const buttons = screen.getAllByRole('button', { name: 'Подробнее' })
  expect(buttons).toHaveLength(2)
  await user.click(buttons[0])
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(inspector).toHaveTextContent('Mock: непроверенный ввод')
  expect(inspector).toHaveTextContent('src/example.ts:3–4')
  expect(inspector).toHaveTextContent('const value = request.input')
  expect(inspector).toHaveTextContent('Mock: добавьте проверку формата до send(value).')
  expect(inspector).toHaveTextContent('Mock-правило: проверять входные данные перед использованием.')
  expect(inspector).toHaveTextContent('Mock-контекст: src/example.ts:3–4')
  await user.click(buttons[1])
  const sparseInspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(sparseInspector).toHaveTextContent('Mock: имя переменной')
  expect(sparseInspector).toHaveTextContent('Связанное правило не указано')
  expect(sparseInspector).not.toHaveTextContent('request.input')
})

it('runs the fixed empty MSW scenario without claiming a real review was performed', async () => {
  const { user } = renderWithRouter(`/repos/${MOCK_REPOSITORY_ID}/rule-playground`, {
    session: { ...fakeMe, csrfToken: MSW_CSRF_TOKEN },
  })
  await user.type(screen.getByLabelText('Путь файла'), 'src/demo.ts')
  await user.type(screen.getByLabelText('Исходный код'), 'const answer = 42')
  await user.type(screen.getByLabelText('.review/rules.md'), '# Security\n## SEC-1: Validate input\nValidate input.')
  await user.selectOptions(screen.getByLabelText('Сценарий development'), 'empty')
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByText('Замечаний нет.')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Mock:')
})

const realCodeFinding = {
  rule_ref: 'SEC-1',
  path: 'src/demo.ts',
  start_line: 1,
  end_line: 2,
  title: '<img src=x onerror=alert(1)> Unchecked input',
  explanation: 'Validate before use.\n[link](javascript:alert(1))',
  evidence: 'const value = request.input\nsend(value)',
}
const realEndpoint = '/api/v1/repositories/:repositoryId/rule-simulations'
const rules = '# Security\n## SEC-1: Validate input\nValidate input.'
const code = 'const value = request.input\nsend(value)'

async function prepareRealCode() {
  const { user } = renderWithRouter(`/repos/${MOCK_REPOSITORY_ID}/rule-playground`, {
    session: { ...fakeMe, csrfToken: MSW_CSRF_TOKEN },
  })
  fireEvent.change(screen.getByLabelText('Путь файла'), { target: { value: 'src/demo.ts' } })
  fireEvent.change(screen.getByLabelText('Исходный код'), { target: { value: code } })
  fireEvent.change(screen.getByLabelText('.review/rules.md'), { target: { value: rules } })
  return user
}

it('accepts a verified real Code 200 and exposes only returned fields as safe text in the Inspector', async () => {
  server.use(http.post(realEndpoint, () => HttpResponse.json({ findings: [realCodeFinding], rejected_count: 3 })))
  const user = await prepareRealCode()
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  const result = screen.getByRole('region', { name: 'Результат симуляции' })
  expect(await within(result).findByRole('status')).toHaveTextContent('Принято замечаний: 1. Отклонено: 3.')
  const findings = within(result).getByRole('list', { name: 'Замечания' })
  expect(findings).toHaveTextContent(realCodeFinding.title)
  expect(findings).toHaveTextContent('src/demo.ts:1–2')
  const details = within(findings).getByRole('button', { name: 'Подробнее' })
  details.focus()
  await user.keyboard('{Enter}')
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(details).toHaveFocus()
  expect(details).toHaveAttribute('aria-expanded', 'true')
  expect(details).toHaveAttribute('aria-controls', inspector.id)
  expect(inspector).toHaveTextContent(realCodeFinding.title)
  expect(inspector).toHaveTextContent('src/demo.ts:1–2')
  expect(inspector).toHaveTextContent('SEC-1')
  expect(
    within(inspector).getByText(realCodeFinding.explanation, { exact: true, normalizer: (s) => s }),
  ).toBeInTheDocument()
  expect(
    within(inspector).getByText(realCodeFinding.evidence, { exact: true, normalizer: (s) => s }),
  ).toBeInTheDocument()
  expect(inspector).not.toHaveTextContent(/Mock|Рекомендация|Контекст модели|confidence|verdict|severity|category/i)
  expect(inspector.querySelector('img, a, script')).toBeNull()
  expect(within(result).getByRole('status')).not.toHaveTextContent('Mock')
  await user.keyboard(' ')
  expect(details).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
})

const realDiffFindings = [
  { ...realCodeFinding, path: 'before.py', start_line: 8, end_line: 9, side: 'old', title: 'Old finding' },
  {
    ...realCodeFinding,
    rule_ref: 'SEC-2',
    path: 'after.py',
    start_line: 20,
    end_line: 21,
    side: 'new',
    title: 'New finding',
  },
]
const unifiedDiff = '--- a/before.py\n+++ b/after.py\n@@ -8,2 +20,2 @@\n-old1\n-old2\n+new1\n+new2\n'

it.each(['Code', 'Diff'])('shows each real %s rule_ref in its finding before opening the Inspector', async (mode) => {
  server.use(
    http.post(realEndpoint, () =>
      HttpResponse.json({ findings: mode === 'Code' ? [realCodeFinding] : realDiffFindings, rejected_count: 0 }),
    ),
  )
  const user = await prepareRealCode()
  if (mode === 'Diff') {
    await user.click(screen.getByRole('button', { name: 'Diff' }))
    fireEvent.change(screen.getByLabelText('Unified diff'), { target: { value: unifiedDiff } })
  }
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  const list = await screen.findByRole('list', { name: 'Замечания' })
  expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
  const findings = within(list).getAllByRole('listitem')
  expect(findings).toHaveLength(mode === 'Code' ? 1 : 2)
  expect(within(findings[0]).getByText('SEC-1', { exact: true })).toBeInTheDocument()
  if (mode === 'Diff') {
    expect(within(findings[1]).getByText('SEC-2', { exact: true })).toBeInTheDocument()
    expect(findings[0]).not.toHaveTextContent('SEC-2')
    expect(findings[1]).not.toHaveTextContent('SEC-1')
  }
})

it('accepts a verified real Diff 200 and preserves exact paths, ranges and old/new sides', async () => {
  server.use(http.post(realEndpoint, () => HttpResponse.json({ findings: realDiffFindings, rejected_count: 1 })))
  const user = await prepareRealCode()
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  fireEvent.change(screen.getByLabelText('Unified diff'), { target: { value: unifiedDiff } })
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Принято замечаний: 2. Отклонено: 1.')
  const list = screen.getByRole('list', { name: 'Замечания' })
  expect(list).toHaveTextContent('before.py:8–9')
  expect(list).toHaveTextContent('after.py:20–21')
  expect(within(list).getByText('Сторона: old')).toBeInTheDocument()
  expect(within(list).getByText('Сторона: new')).toBeInTheDocument()
  const buttons = screen.getAllByRole('button', { name: 'Подробнее' })
  await user.click(buttons[0])
  let inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(inspector).toHaveTextContent('before.py:8–9')
  expect(inspector).toHaveTextContent('Сторона: old')
  await user.click(buttons[1])
  inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(inspector).toHaveTextContent('after.py:20–21')
  expect(inspector).toHaveTextContent('Сторона: new')
  expect(inspector).not.toHaveTextContent(/Mock|Old finding|before.py|Сторона: old/)
})

it.each(['Code', 'Diff'])(
  'shows an empty real %s 200 with its rejected count and no fabricated findings',
  async (mode) => {
    server.use(http.post(realEndpoint, () => HttpResponse.json({ findings: [], rejected_count: 2 })))
    const user = await prepareRealCode()
    if (mode === 'Diff') {
      await user.click(screen.getByRole('button', { name: 'Diff' }))
      fireEvent.change(screen.getByLabelText('Unified diff'), { target: { value: unifiedDiff } })
    }
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByText('Замечаний нет.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Принято замечаний: 0. Отклонено: 2.')
    expect(screen.getByRole('status')).not.toHaveTextContent('Mock')
    expect(screen.queryByRole('button', { name: 'Подробнее' })).not.toBeInTheDocument()
  },
)

it('rejects a mixed real/mock 200 instead of displaying a partially interpreted finding', async () => {
  server.use(
    http.post(realEndpoint, () =>
      HttpResponse.json(
        { mock: true, findings: [{ ...realCodeFinding, line: 1 }] },
        { headers: { 'X-Rule-Playground-Mock': 'true' } },
      ),
    ),
  )
  const user = await prepareRealCode()
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
  expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Исходный код')).toHaveValue(code)
})

// Boundary regressions for the strict real DTO introduced with the Code/Diff slices.
const realResult = { findings: [realCodeFinding], rejected_count: 0 }
const malformedResults: [string, unknown][] = [
  ['missing rejected count', { findings: [] }],
  ['negative rejected count', { ...realResult, rejected_count: -1 }],
  ['fractional rejected count', { ...realResult, rejected_count: 0.5 }],
  ['string rejected count', { ...realResult, rejected_count: '0' }],
  ['unsafe rejected count', { ...realResult, rejected_count: Number.MAX_SAFE_INTEGER + 1 }],
  ['unknown result field', { ...realResult, model_context: 'invented' }],
  ['non-array findings', { ...realResult, findings: {} }],
  ['too many findings', { ...realResult, findings: Array.from({ length: 101 }, () => realCodeFinding) }],
  ['null result', null],
  ['array result', []],
  ...[
    ['null finding', null],
    ['array finding', []],
    ['partial valid list', { title: 'Incomplete' }],
    ['missing rule ref', { ...realCodeFinding, rule_ref: undefined }],
    ['null rule ref', { ...realCodeFinding, rule_ref: null }],
    ['empty rule ref', { ...realCodeFinding, rule_ref: '' }],
    ['long rule ref', { ...realCodeFinding, rule_ref: 'x'.repeat(33) }],
    ['missing path', { ...realCodeFinding, path: undefined }],
    ['absolute path', { ...realCodeFinding, path: '/src/demo.ts' }],
    ['traversing path', { ...realCodeFinding, path: '../demo.ts' }],
    ['backslash path', { ...realCodeFinding, path: 'src\\demo.ts' }],
    ['NUL path', { ...realCodeFinding, path: 'src/\0demo.ts' }],
    ['zero line', { ...realCodeFinding, start_line: 0 }],
    ['fractional line', { ...realCodeFinding, end_line: 1.5 }],
    ['string line', { ...realCodeFinding, start_line: '1' }],
    ['reversed range', { ...realCodeFinding, start_line: 3, end_line: 2 }],
    ['unsafe line', { ...realCodeFinding, end_line: Number.MAX_SAFE_INTEGER + 1 }],
    ['empty title', { ...realCodeFinding, title: '' }],
    ['long title', { ...realCodeFinding, title: 'x'.repeat(201) }],
    ['long explanation', { ...realCodeFinding, explanation: 'x'.repeat(2001) }],
    ['long evidence', { ...realCodeFinding, evidence: 'x'.repeat(1001) }],
    ['wrong evidence type', { ...realCodeFinding, evidence: 1 }],
    ['Code side', { ...realCodeFinding, side: 'new' }],
    ...['severity', 'category', 'recommendation', 'confidence', 'verifier_verdict', 'model_context'].map((key) => [
      key,
      { ...realCodeFinding, [key]: 'invented' },
    ]),
  ].map(
    ([name, finding]) => [String(name), { ...realResult, findings: [realCodeFinding, finding] }] as [string, unknown],
  ),
]

it.each(malformedResults)(
  'rejects malformed real 200: %s without partial output and retains drafts',
  async (_name, body) => {
    server.use(
      http.post(
        realEndpoint,
        () => new HttpResponse(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
      ),
    )
    const user = await prepareRealCode()
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
    expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
    expect(screen.queryByText('Замечаний нет.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Путь файла')).toHaveValue('src/demo.ts')
    expect(screen.getByLabelText('Исходный код')).toHaveValue(code)
    expect(screen.getByLabelText('.review/rules.md')).toHaveValue(rules)
  },
)

it.each([undefined, 'left', null])('rejects a Diff 200 with invalid or missing side %s', async (side) => {
  server.use(
    http.post(realEndpoint, () =>
      HttpResponse.json({ findings: [{ ...realDiffFindings[0], side }], rejected_count: 0 }),
    ),
  )
  const user = await prepareRealCode()
  await user.click(screen.getByRole('button', { name: 'Diff' }))
  fireEvent.change(screen.getByLabelText('Unified diff'), { target: { value: unifiedDiff } })
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
  expect(screen.getByLabelText('Unified diff')).toHaveValue(unifiedDiff)
  expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
})

it.each([
  ['header only', { findings: [] }, 'true'],
  ['body only', { mock: true, findings: [] }, undefined],
  ['false body', { mock: false, findings: [] }, 'true'],
  ['false header', { mock: true, findings: [] }, 'false'],
  ['real with true header', realResult, 'true'],
  ['real with false header', realResult, 'false'],
  ['real with empty header', realResult, ''],
  ['real with mock true', { ...realResult, mock: true }, undefined],
  ['real with mock false', { ...realResult, mock: false }, undefined],
] as const)('rejects mismatched provenance: %s', async (_name, body, marker) => {
  server.use(
    http.post(realEndpoint, () =>
      HttpResponse.json(body, {
        headers: marker === undefined ? {} : { 'X-Rule-Playground-Mock': marker },
      }),
    ),
  )
  const user = await prepareRealCode()
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
  expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
})

it('rejects invalid JSON and non-200 successful status codes', async () => {
  const user = await prepareRealCode()
  for (const response of [
    new HttpResponse('{', { headers: { 'Content-Type': 'application/json' } }),
    HttpResponse.json(realResult, { status: 201 }),
    new HttpResponse(null, { status: 204 }),
  ]) {
    server.use(http.post(realEndpoint, () => response))
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
    expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
  }
})

it('accepts real results in production but rejects even fully marked mock successes', async () => {
  vi.stubEnv('DEV', false)
  try {
    server.use(http.post(realEndpoint, () => HttpResponse.json(realResult)))
    const user = await prepareRealCode()
    expect(screen.queryByLabelText('Сценарий development')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Принято замечаний: 1.')
    server.use(
      http.post(realEndpoint, () =>
        HttpResponse.json(
          { mock: true, findings: [{ title: 'Mock leak' }] },
          {
            headers: { 'X-Rule-Playground-Mock': 'true' },
          },
        ),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить симуляцию.')
    expect(screen.queryByText('Mock leak')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
  } finally {
    vi.unstubAllEnvs()
  }
})

it.each(['503', 'malformed'])(
  'clears a real Inspector on the next pending request and %s error without fallback, retaining drafts',
  async (outcome) => {
    let requests = 0
    let finish: (response: Response) => void = () => {}
    const next = new Promise<Response>((resolve) => {
      finish = resolve
    })
    server.use(
      http.post(realEndpoint, () => {
        requests += 1
        return requests === 1 ? HttpResponse.json(realResult) : next
      }),
    )
    const user = await prepareRealCode()
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    await user.click(await screen.findByRole('button', { name: 'Подробнее' }))
    expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Симуляция выполняется…')
    expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
    finish(
      outcome === '503'
        ? HttpResponse.json(
            {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Service is unavailable.',
              request_id: 'request-1',
              retryable: false,
              retry_after: null,
            },
            { status: 503 },
          )
        : HttpResponse.json({ findings: [realCodeFinding], rejected_count: 'invalid' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      outcome === '503' ? '503 SERVICE_UNAVAILABLE' : 'Не удалось выполнить симуляцию.',
    )
    expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Замечания' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Исходный код')).toHaveValue(code)
    expect(screen.getByLabelText('.review/rules.md')).toHaveValue(rules)
    expect(requests).toBe(2)
    server.use(http.post(realEndpoint, () => HttpResponse.json(realResult)))
    await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
    expect(await screen.findByRole('button', { name: 'Подробнее' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
  },
)
