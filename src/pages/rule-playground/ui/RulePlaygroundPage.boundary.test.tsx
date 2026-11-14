import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'

vi.mock('@/features/simulate-rules', () => ({
  RulePlayground: () => {
    throw new Error('Playground render failed')
  },
}))

it('keeps the page title and repository navigation usable when the playground crashes', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { user, router } = renderWithRouter('/repos/repo-1/rule-playground')
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить этот блок')
  expect(screen.getByRole('heading', { name: 'Rule Playground' })).toBeVisible()
  await user.click(screen.getByRole('link', { name: 'Repos' }))
  expect(router.state.location.pathname).toBe('/repos')
})
