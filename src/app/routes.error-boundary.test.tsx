import { screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { appRoutes } from '@/app/routes'
import { renderWithRouter } from '@/test/render-with-router'

// Фальшивая страница вместо стаба fetch: поведение под тестом — что показывает
// роутер, когда страница внутри AuthenticatedShell падает при рендере.
vi.mock('@/pages/repos', () => ({
  ReposPage: () => {
    throw new Error('boom')
  },
}))

afterEach(() => vi.restoreAllMocks())

test('падение страницы внутри шелла показывает стилизованный экран 500, а не дефолтный роутер-стек', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  renderWithRouter('/repos', { routes: appRoutes })

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('Что-то пошло не так')
  expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeInTheDocument()
  expect(screen.queryByText('Unexpected Application Error')).not.toBeInTheDocument()
  consoleError.mockRestore()
})
