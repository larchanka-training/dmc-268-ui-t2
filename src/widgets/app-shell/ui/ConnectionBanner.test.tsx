import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionBanner } from '@/widgets/app-shell/ui/ConnectionBanner'

function dispatchOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  window.dispatchEvent(new Event('online'))
})

describe('ConnectionBanner', () => {
  it('скрыт, когда соединение есть', () => {
    render(<ConnectionBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('появляется при потере соединения и исчезает при восстановлении', async () => {
    const user = userEvent.setup()
    render(<ConnectionBanner />)

    dispatchOnline(false)
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с интернетом')

    dispatchOnline(true)
    await user.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('восстановление соединения само скрывает баннер', () => {
    render(<ConnectionBanner />)
    dispatchOnline(false)
    dispatchOnline(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
