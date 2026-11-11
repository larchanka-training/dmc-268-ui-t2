import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '@/shared/ui/theme-toggle'

const html = document.documentElement
const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  // В тестовом окружении нет window.localStorage — подменяем, как принято в проектных тестах.
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  })
  delete html.dataset.theme
})

afterEach(() => vi.unstubAllGlobals())

describe('ThemeToggle', () => {
  it('по умолчанию следует системной теме и не задаёт data-theme', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Тема: системная' })).toBeInTheDocument()
    expect(html.dataset.theme).toBeUndefined()
  })

  it('циклит light → dark → system, обновляя data-theme и localStorage', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: 'Тема: системная' }))
    expect(screen.getByRole('button', { name: 'Тема: светлая' })).toBeInTheDocument()
    expect(html.dataset.theme).toBe('light')
    expect(storage.get('theme')).toBe('light')

    await user.click(screen.getByRole('button', { name: 'Тема: светлая' }))
    expect(screen.getByRole('button', { name: 'Тема: тёмная' })).toBeInTheDocument()
    expect(html.dataset.theme).toBe('dark')
    expect(storage.get('theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Тема: тёмная' }))
    expect(screen.getByRole('button', { name: 'Тема: системная' })).toBeInTheDocument()
    expect(html.dataset.theme).toBeUndefined()
    expect(storage.get('theme')).toBe('system')
  })

  it('при монтировании применяет сохранённый выбор', () => {
    storage.set('theme', 'dark')
    render(<ThemeToggle />)
    expect(html.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Тема: тёмная' })).toBeInTheDocument()
  })
})
