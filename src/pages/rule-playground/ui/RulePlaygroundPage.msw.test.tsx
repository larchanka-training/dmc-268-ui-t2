import { screen } from '@testing-library/react'
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
