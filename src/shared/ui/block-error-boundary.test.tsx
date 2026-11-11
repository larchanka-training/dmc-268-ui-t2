import { screen } from '@testing-library/react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BlockErrorBoundary } from '@/shared/ui/block-error-boundary'

function Bomb({ message = 'boom' }: { message?: string }): never {
  throw new Error(message)
}

describe('BlockErrorBoundary', () => {
  it('рендерит children, когда блок не падает', () => {
    render(
      <BlockErrorBoundary>
        <p>рабочий блок</p>
      </BlockErrorBoundary>,
    )
    expect(screen.getByText('рабочий блок')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('заменяет упавший блок заглушкой с кнопкой обновления, не роняя соседние блоки', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div>
        <p>соседний блок</p>
        <BlockErrorBoundary>
          <Bomb />
        </BlockErrorBoundary>
      </div>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить этот блок, обновите страницу')
    expect(screen.getByRole('button', { name: 'Обновить страницу' })).toBeInTheDocument()
    expect(screen.getByText('соседний блок')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('кнопка «Обновить страницу» перезагружает страницу', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = (await import('@testing-library/user-event')).default.setup()
    // jsdom делает reload неконфигурируемым свойством самого location — подменяем location целиком.
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
      configurable: true,
    })
    render(
      <BlockErrorBoundary>
        <Bomb />
      </BlockErrorBoundary>,
    )

    await user.click(screen.getByRole('button', { name: 'Обновить страницу' }))
    expect(reload).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })
})
