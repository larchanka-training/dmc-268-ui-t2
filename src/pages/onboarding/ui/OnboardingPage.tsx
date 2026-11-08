import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConnectedRepositoriesQuery } from '@/entities/repository'
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
          Откройте раздел <strong>Repos</strong> → <strong>Connect repository</strong> и выберите репозиторий. Боту
          нужен доступ <strong>Write</strong> и выше: если его ещё нет, страница подключения откроет настройки доступа
          GitHub, где администратор репозитория приглашает бота с ролью <strong>Write</strong> или выше.
        </p>
        <p>
          Приглашение принимает не администратор, а оператор бота: он входит под аккаунтом бота и подтверждает
          приглашение. После этого нажмите <strong>Check access</strong> ещё раз; если проверка не проходит — сообщите
          оператору.
        </p>
        <Button asChild>
          <Link to="/repos/connect">Открыть подключение репозитория</Link>
        </Button>
      </div>
    ),
  },
  {
    title: 'Проверьте webhook',
    body: (
      <div className="space-y-3">
        <p>
          События GitHub приходят в API через webhook. По принятой схеме webhook настраивается один раз на уровне
          организации и делает это оператор при развёртывании: он указывает Payload URL{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">/api/v1/webhooks/github</code> (адрес
          вашего развёртывания API), тип{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">application/json</code>, события{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px]">Pull requests</code> и секрет из
          развёртывания API.
        </p>
        <p>
          Секрет развёртывания — серверная настройка: администратору репозитория он не нужен, и второй webhook создавать
          не нужно. Если репозиторий принадлежит организации, где такой webhook уже настроен оператором, переходите
          сразу к правилам.
        </p>
        <p className="text-sm text-muted-foreground">
          Если репозиторий вне такой организации, попросите оператора добавить webhook для его владельца — иначе ручной
          запуск ревью (Start review) работает, но автоматический приём событий — нет.
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
  const reposQuery = useConnectedRepositoriesQuery()
  const hasConnectedRepos = (reposQuery.data?.length ?? 0) > 0
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
        {isFirst && hasConnectedRepos ? (
          <div role="status" className="space-y-2 rounded-md border border-border bg-accent/40 p-3">
            <p className="text-sm text-foreground">
              Репозиторий уже подключён — первый шаг выполнен. Webhook на уровне организации обычно уже настроен
              оператором, поэтому можно переходить к правилам.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setCurrent(steps.length - 1)}>
              Перейти к правилам
            </Button>
          </div>
        ) : null}
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
