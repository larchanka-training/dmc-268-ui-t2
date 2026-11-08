import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { OnboardingPage } from '@/pages/onboarding'
import { renderWithRouter } from '@/test/render-with-router'

test('онбординг показывает три шага: подключение репозитория, webhook, .review/rules.md', async () => {
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

  // Шаг 2 — webhook.
  await user.click(screen.getByRole('button', { name: 'Далее' }))
  const step2 = screen.getByRole('listitem', { current: 'step' })
  expect(within(step2).getByText('Настройте webhook')).toBeInTheDocument()
  expect(screen.getByText('/api/v1/webhooks/github')).toBeInTheDocument()
  expect(screen.getByText(/Pull requests/)).toBeInTheDocument()

  // Шаг 3 — правила ревью.
  await user.click(screen.getByRole('button', { name: 'Далее' }))
  const step3 = screen.getByRole('listitem', { current: 'step' })
  expect(within(step3).getByText('Создайте .review/rules.md')).toBeInTheDocument()
  expect(screen.getByText('.review/rules.md')).toBeInTheDocument()

  // Навигация назад работает.
  await user.click(screen.getByRole('button', { name: 'Назад' }))
  expect(within(screen.getByRole('listitem', { current: 'step' })).getByText('Настройте webhook')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Далее' }))

  // Финал — возвращение к списку репозиториев.
  await user.click(screen.getByRole('button', { name: 'Готово' }))
  expect(router.state.location.pathname).toBe('/repos')
})
