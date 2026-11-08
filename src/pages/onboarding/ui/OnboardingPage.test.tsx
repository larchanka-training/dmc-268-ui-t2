import { screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { OnboardingPage } from '@/pages/onboarding'
import { renderWithRouter } from '@/test/render-with-router'

afterEach(() => vi.unstubAllGlobals())

const connectedWire = {
  id: 'repo-1',
  provider: 'github',
  external_id: '1001',
  owner: 'larchanka-training',
  name: 'hello',
  role: 'admin',
  capabilities: { can_start_review: true, can_manage_settings: true },
}

function stubConnectedRepos(items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ items, next_cursor: null })),
  )
}

test('онбординг показывает три шага: подключение репозитория, webhook, .review/rules.md', async () => {
  stubConnectedRepos([])
  const { user, router } = renderWithRouter('/onboarding', {
    routes: [{ path: '/onboarding', element: <OnboardingPage /> }],
  })

  // Шаг 1 — подключение репозитория со ссылкой на connect.
  const step1 = screen.getByRole('listitem', { current: 'step' })
  expect(within(step1).getByText('Подключите репозиторий')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Открыть подключение репозитория' })).toHaveAttribute(
    'href',
    '/repos/connect',
  )

  // Шаг 2 — webhook (настройка оператора на уровне организации).
  await user.click(screen.getByRole('button', { name: 'Далее' }))
  const step2 = screen.getByRole('listitem', { current: 'step' })
  expect(within(step2).getByText('Проверьте webhook')).toBeInTheDocument()
  expect(screen.getByText('/api/v1/webhooks/github')).toBeInTheDocument()
  expect(screen.getByText(/Pull requests/)).toBeInTheDocument()

  // Шаг 3 — правила ревью.
  await user.click(screen.getByRole('button', { name: 'Далее' }))
  const step3 = screen.getByRole('listitem', { current: 'step' })
  expect(within(step3).getByText('Создайте .review/rules.md')).toBeInTheDocument()
  expect(screen.getByText('.review/rules.md')).toBeInTheDocument()

  // Навигация назад работает.
  await user.click(screen.getByRole('button', { name: 'Назад' }))
  expect(within(screen.getByRole('listitem', { current: 'step' })).getByText('Проверьте webhook')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Далее' }))

  // Финал — возвращение к списку репозиториев.
  await user.click(screen.getByRole('button', { name: 'Готово' }))
  expect(router.state.location.pathname).toBe('/repos')
})

test('после подключения репозитория мастер предлагает сразу перейти к правилам', async () => {
  stubConnectedRepos([connectedWire])
  const { user } = renderWithRouter('/onboarding', {
    routes: [{ path: '/onboarding', element: <OnboardingPage /> }],
  })

  // Шаг 1 активен, но мастер видит подключённый репозиторий.
  expect(await screen.findByRole('status')).toHaveTextContent('уже подключён')

  // Переход сразу к третьему шагу — без второго webhook и серверного секрета.
  await user.click(screen.getByRole('button', { name: 'Перейти к правилам' }))
  expect(
    within(screen.getByRole('listitem', { current: 'step' })).getByText('Создайте .review/rules.md'),
  ).toBeInTheDocument()
})

test('шаг подключения разделяет роли: администратор приглашает, оператор принимает приглашение', async () => {
  stubConnectedRepos([])
  renderWithRouter('/onboarding', {
    routes: [{ path: '/onboarding', element: <OnboardingPage /> }],
  })

  const step1 = screen.getByRole('region', { name: 'Шаг 1 из 3' })
  // Администратор приглашает бота, но приглашение принимает оператор под аккаунтом бота.
  expect(step1).toHaveTextContent(/принимает не администратор, а оператор бота/i)
  expect(step1).toHaveTextContent(/Check access/)
  // Старая инструкция войти под аккаунтом бота самому исчезла.
  expect(step1.textContent).not.toMatch(/примите приглашение/i)
})

test('шаг webhook описывает настройку оператора, а не предлагает создать webhook с секретом', async () => {
  stubConnectedRepos([])
  const { user } = renderWithRouter('/onboarding', {
    routes: [{ path: '/onboarding', element: <OnboardingPage /> }],
  })
  await user.click(screen.getByRole('button', { name: 'Далее' }))

  const step2 = screen.getByRole('region', { name: 'Шаг 2 из 3' })
  expect(within(step2).getByText('Проверьте webhook')).toBeInTheDocument()
  // Один webhook на организацию настраивает оператор; секрет развёртывания пользователю не нужен.
  expect(step2).toHaveTextContent(/настраивается один раз на уровне организации/i)
  expect(step2).toHaveTextContent(/larchanka-training/i)
  expect(step2).toHaveTextContent(/попросите оператора/i)
  // Инструкция создать webhook с серверным секретом исчезла.
  expect(step2.textContent).not.toMatch(/Add webhook/i)
  expect(step2.textContent).not.toMatch(/WEBHOOK__SECRET/i)
})
