import { fireEvent, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'

const route = '/repos/repo-1/rule-playground'
const mockHeaders = { 'X-Rule-Playground-Mock': 'true' }

async function simulate(findings: unknown[]) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ mock: true, findings }, { headers: mockHeaders }))
  const rendered = renderWithRouter(route)
  fireEvent.change(screen.getByLabelText('Путь файла'), { target: { value: 'src/draft.ts' } })
  fireEvent.change(screen.getByLabelText('Исходный код'), { target: { value: 'const privateDraft = 42' } })
  fireEvent.change(screen.getByLabelText('.review/rules.md'), {
    target: { value: '# Security\n## SEC-1: Draft rule\nDraft rule description.' },
  })
  await rendered.user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  await screen.findByRole('list', { name: 'Замечания' })
  return rendered
}

it('opens the selected finding audit with its returned identity, range and explanation', async () => {
  const { user } = await simulate([
    {
      title: 'Непроверенный ввод',
      severity: 'high',
      category: 'Security',
      file: 'src/example.ts',
      line: 3,
      end_line: 5,
      message: 'Проверьте ввод.',
      explanation: 'Значение используется до проверки формата.',
    },
  ])
  const button = screen.getByRole('button', { name: 'Подробнее' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
  await user.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(inspector.id).toBe(button.getAttribute('aria-controls'))
  expect(within(inspector).getByRole('heading', { name: 'Непроверенный ввод' })).toBeInTheDocument()
  expect(inspector).toHaveTextContent('high')
  expect(inspector).toHaveTextContent('Security')
  expect(inspector).toHaveTextContent('src/example.ts:3–5')
  expect(inspector).toHaveTextContent('Значение используется до проверки формата.')
})

it('returns to the list when keyboard users toggle details with Enter and Space', async () => {
  const { user } = await simulate([{ title: 'Замечание с клавиатуры', message: 'Список остаётся доступен.' }])
  await user.tab()
  const button = screen.getByRole('button', { name: 'Подробнее' })
  expect(button).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).toBeInTheDocument()
  await user.keyboard(' ')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(button).toHaveFocus()
  expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Замечания' })).toBeVisible()
})

it('handles sparse findings without inventing a rule reference or model context from the draft', async () => {
  const { user } = await simulate([{ rule: 'SEC-1: Draft rule', message: 'Краткое замечание без audit-полей.' }])
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(inspector).toHaveTextContent('Связанное правило не указано')
  expect(inspector).toHaveTextContent('Краткое замечание без audit-полей.')
  expect(inspector).not.toHaveTextContent('SEC-1')
  expect(inspector).not.toHaveTextContent('Draft rule description.')
  expect(inspector).not.toHaveTextContent('privateDraft')
  expect(within(inspector).queryByText(/Confidence|Verifier|Контекст модели|Доказательство/)).not.toBeInTheDocument()
})

it('shows only the explicit returned rule reference and its returned description', async () => {
  const { user } = await simulate([
    {
      message: 'Замечание по правилу.',
      rule: 'Legacy label',
      rule_ref: 'MOCK-RETURNED-7',
      rule_description: '**Mock:** проверять формат на границе системы.',
    },
  ])
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(within(inspector).getByRole('heading', { name: 'Связанное правило' })).toBeInTheDocument()
  expect(inspector).toHaveTextContent('MOCK-RETURNED-7')
  expect(inspector).toHaveTextContent('**Mock:** проверять формат на границе системы.')
  expect(inspector).not.toHaveTextContent('Legacy label')
  expect(inspector).not.toHaveTextContent('Draft rule description.')
  expect(inspector).not.toHaveTextContent('Связанное правило не указано')
})

it('renders returned evidence and a fix as inert text including hostile HTML and Markdown', async () => {
  const evidence = '<img src=x onerror="alert(1)"><script>alert(2)</script>\n**unsafe input**'
  const recommendation = '[Выполнить](javascript:alert(3))\nПроверьте формат перед использованием.'
  const { user } = await simulate([{ title: 'Mock XSS fixture', evidence, recommendation }])
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(within(inspector).getByRole('heading', { name: 'Доказательство' })).toBeInTheDocument()
  expect(within(inspector).getByText(evidence, { normalizer: (text) => text })).toBeInTheDocument()
  expect(within(inspector).getByRole('heading', { name: 'Рекомендация' })).toBeInTheDocument()
  expect(within(inspector).getByText(recommendation, { normalizer: (text) => text })).toBeInTheDocument()
  expect(inspector.querySelector('img, script, a, iframe')).toBeNull()
})

it('shows model context only when explicitly returned and keeps it separate from editor drafts', async () => {
  const context = '# Mock context\nsrc/example.ts:3\nconst value = request.input'
  const { user } = await simulate([{ title: 'Mock context fixture', model_context: context }])
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(within(inspector).getByRole('heading', { name: 'Контекст модели (из результата)' })).toBeInTheDocument()
  expect(within(inspector).getByText(context, { normalizer: (text) => text })).toBeInTheDocument()
  expect(inspector).not.toHaveTextContent('privateDraft')
  expect(inspector).not.toHaveTextContent('Draft rule description.')
})

it('switches to a different finding without mixing its audit with the previous one', async () => {
  const { user } = await simulate([
    { title: 'Первое замечание', evidence: 'evidence-A', model_context: 'context-A', rule_ref: 'MOCK-A' },
    { title: 'Второе замечание', evidence: 'evidence-B', recommendation: 'fix-B' },
  ])
  const [first, second] = screen.getAllByRole('button', { name: 'Подробнее' })
  await user.click(first)
  expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).toHaveTextContent('evidence-A')
  await user.click(second)
  expect(first).toHaveAttribute('aria-expanded', 'false')
  expect(second).toHaveAttribute('aria-expanded', 'true')
  expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'))
  const inspector = screen.getByRole('region', { name: 'Review Audit Inspector' })
  expect(inspector).toHaveTextContent('Второе замечание')
  expect(inspector).toHaveTextContent('evidence-B')
  expect(inspector).toHaveTextContent('fix-B')
  expect(inspector).toHaveTextContent('Связанное правило не указано')
  expect(inspector).not.toHaveTextContent('evidence-A')
  expect(inspector).not.toHaveTextContent('context-A')
  expect(inspector).not.toHaveTextContent('MOCK-A')
})

it('keeps the opened inspector explicitly labeled as a fixed mock audit', async () => {
  const { user } = await simulate([{ title: 'Демонстрационное замечание' }])
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  expect(screen.getByRole('status')).toHaveTextContent('Mock: демонстрационный результат')
  expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).toHaveTextContent(
    'Mock: данные Inspector фиксированы; анализ кода и вызов модели не выполнялись.',
  )
})

it('clears the selected mock audit for a real 503 and starts a later result with details closed', async () => {
  const { user } = await simulate([{ title: 'Предыдущий mock', evidence: 'old-evidence' }])
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).toHaveTextContent('old-evidence')
  vi.mocked(globalThis.fetch)
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ mock: true, findings: [{ title: 'Новый mock' }] }, { headers: mockHeaders }))
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('503 SERVICE_UNAVAILABLE')
  expect(screen.queryByRole('region', { name: 'Review Audit Inspector' })).not.toBeInTheDocument()
  expect(screen.queryByText('old-evidence')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Подробнее' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Симулировать ревью' }))
  expect(await screen.findByRole('button', { name: 'Подробнее' })).toHaveAttribute('aria-expanded', 'false')
  await user.click(screen.getByRole('button', { name: 'Подробнее' }))
  expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).toHaveTextContent('Новый mock')
  expect(screen.getByRole('region', { name: 'Review Audit Inspector' })).not.toHaveTextContent('old-evidence')
})
