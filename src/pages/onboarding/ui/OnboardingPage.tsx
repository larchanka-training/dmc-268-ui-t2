import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/cn'

interface WizardStep {
  title: string
  /** Описание шага для панели активного шага. */
  body: React.ReactNode
}

const steps: WizardStep[] = [
  {
    title: 'Подключите репозиторий',
    body: (
      <div className="space-y-3">
        <p>
          Войдите через GitHub, откройте раздел <strong>Repos</strong> → <strong>Connect repository</strong> и выберите
          репозиторий. Боту нужен доступ <strong>Write</strong> и выше: если доступ ещё не выдан, пригласите бота на
          GitHub, примите приглашение под аккаунтом бота и нажмите <strong>Check access</strong> ещё раз.
        </p>
        <Button asChild>
          <Link to="/repos/connect">Открыть подключение репозитория</Link>
        </Button>
      </div>
    ),
  },
  {
    title: 'Настройте webhook',
    body: (
      <div className="space-y-3">
        <p>
          На GitHub (организация или репозиторий) откройте <strong>Settings → Webhooks → Add webhook</strong> и укажите:
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            Payload URL:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">/api/v1/webhooks/github</code> (адрес
            вашего развёртывания API)
          </li>
          <li>
            Content type: <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">application/json</code>
          </li>
          <li>Secret: значение WEBHOOK__SECRET из развёртывания API</li>
          <li>
            События: <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">Pull requests</code>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Без webhook ручной запуск ревью (Start review) работает, но автоматический приём событий — нет.
        </p>
      </div>
    ),
  },
  {
    title: 'Создайте .review/rules.md',
    body: (
      <div className="space-y-3">
        <p>
          Добавьте файл <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">.review/rules.md</code> в
          корень репозитория и опишите в нём критерии, по которым нужно проверять изменения. Превью разобранных правил
          появится на странице настроек подключённого репозитория.
        </p>
        <Button asChild variant="outline">
          <Link to="/repos">Перейти к репозиториям</Link>
        </Button>
      </div>
    ),
  },
]

/** Onboarding Wizard первого входа: подключение репозитория → webhook → .review/rules.md. */
export function OnboardingPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const step = steps[current]
  const isFirst = current === 0
  const isLast = current === steps.length - 1

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Подключение бота к репозиторию</h1>
        <p className="text-sm text-muted-foreground">Три шага, чтобы начать получать ревью от бота.</p>
      </header>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((item, index) => {
          const isCurrent = index === current
          const isDone = index < current
          return (
            <li
              key={item.title}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                isCurrent ? 'border-primary bg-accent text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                )}
              >
                {isDone ? '✓' : index + 1}
              </span>
              <span className="min-w-0 truncate font-medium">{item.title}</span>
            </li>
          )
        })}
      </ol>

      <section
        aria-label={`Шаг ${current + 1} из ${steps.length}`}
        className="space-y-4 rounded-lg border border-border p-5"
      >
        <h2 className="font-semibold text-foreground">{step.title}</h2>
        <div className="text-sm leading-relaxed text-foreground [&_p]:text-sm [&_strong]:font-medium">{step.body}</div>
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="outline" disabled={isFirst} onClick={() => setCurrent((v) => v - 1)}>
            Назад
          </Button>
          {isLast ? (
            <Button type="button" onClick={() => void navigate('/repos')}>
              Готово
            </Button>
          ) : (
            <Button type="button" onClick={() => setCurrent((v) => v + 1)}>
              Далее
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
