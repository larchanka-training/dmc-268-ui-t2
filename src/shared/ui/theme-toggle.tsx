import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

type ThemeChoice = 'light' | 'dark' | 'system'

const ORDER: ThemeChoice[] = ['light', 'dark', 'system']

const LABELS: Record<ThemeChoice, string> = {
  light: 'Тема: светлая',
  dark: 'Тема: тёмная',
  system: 'Тема: системная',
}

const ICONS: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

function applyTheme(choice: ThemeChoice): void {
  // Системная тема обслуживается media query в globals.css — атрибут нужно снять.
  if (choice === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = choice
}

function storedChoice(): ThemeChoice {
  // Storage может отсутствовать (приватный режим, окружения без window) — тогда системная тема.
  if (typeof localStorage === 'undefined') return 'system'
  const stored = localStorage.getItem('theme')
  return ORDER.includes(stored as ThemeChoice) ? (stored as ThemeChoice) : 'system'
}

/**
 * Переключатель light / dark / system (спринт 5, TC-FE-THEME-01).
 * Выбор сохраняется в localStorage («theme») и применяется через data-theme на <html>;
 * системная тема остаётся на CSS prefers-color-scheme.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(storedChoice)

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]
    setChoice(next)
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', next)
  }

  const Icon = ICONS[choice]
  return (
    <button
      type="button"
      aria-label={LABELS[choice]}
      title={LABELS[choice]}
      onClick={cycle}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline focus-visible:outline-2"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
