import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithRouter } from '@/test/render-with-router'

it('offers Analytics navigation to an authenticated user', async () => {
  renderWithRouter()
  expect(await screen.findByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/analytics')
})

it('offers Audit Log navigation to an authenticated user', async () => {
  renderWithRouter()
  expect(await screen.findByRole('link', { name: 'Audit Log' })).toHaveAttribute('href', '/audit')
})

it('opens Analytics from the application navigation', async () => {
  const { user } = renderWithRouter()
  await user.click(await screen.findByRole('link', { name: 'Analytics' }))
  expect(await screen.findByRole('heading', { name: 'Repository analytics' })).toBeInTheDocument()
})

it('opens Audit Log from the application navigation', async () => {
  const { user } = renderWithRouter()
  await user.click(await screen.findByRole('link', { name: 'Audit Log' }))
  expect(await screen.findByRole('heading', { name: 'Review audit log' })).toBeInTheDocument()
})
