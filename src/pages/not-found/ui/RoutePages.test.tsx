import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RouteError, RouteNotFound } from '@/pages/not-found'

describe('RouteNotFound', () => {
  it('показывает 404 и ссылку на главную', () => {
    render(
      <MemoryRouter>
        <RouteNotFound />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('route-not-found')).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Страница не найдена')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Вернуться на главную' })).toHaveAttribute('href', '/')
  })
})

describe('RouteError', () => {
  it('показывает понятную ошибку с кнопкой обновления', () => {
    render(<RouteError />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Что-то пошло не так')
    expect(alert).toHaveTextContent('500')
    expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeInTheDocument()
  })
})
