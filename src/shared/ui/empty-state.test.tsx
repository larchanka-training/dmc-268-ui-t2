import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '@/shared/ui/empty-state'

describe('EmptyState', () => {
  it('показывает заголовок, описание и действие', () => {
    render(
      <EmptyState title="Пока нет данных" description="Здесь появятся результаты после первого запуска.">
        <button type="button">Создать первый</button>
      </EmptyState>,
    )
    expect(screen.getByText('Пока нет данных')).toBeInTheDocument()
    expect(screen.getByText('Здесь появятся результаты после первого запуска.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Создать первый' })).toBeInTheDocument()
  })

  it('работает без описания и действия', () => {
    render(<EmptyState title="Ничего не найдено" />)
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
  })
})
