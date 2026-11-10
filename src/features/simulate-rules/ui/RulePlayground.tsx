import { useEffect, useRef, useState } from 'react'
import { languageFromPath } from '@/entities/diff'
import { SyntaxPreview } from './SyntaxPreview'
import { ReviewAuditInspector } from './ReviewAuditInspector'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { meQueryKey, useMeQuery, type Me } from '@/entities/session'
import { simulateRules, SimulationHttpError } from '../api/simulate'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Textarea } from '@/shared/ui/textarea'

// eslint-disable-next-line no-control-regex -- PR #87 rejects ASCII controls in repository-relative paths.
const UNSAFE_PATH_CHARACTERS = /[\\\x00-\x1f\x7f]/
// eslint-disable-next-line no-control-regex -- Match the backend's Python splitlines separators, including ASCII record separators.
const CODE_LINE_BREAK = /\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/

export function RulePlayground({ repositoryId }: { repositoryId: string }) {
  const me = useMeQuery().data
  const client = useQueryClient()
  const live = useRef(false)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null)
  const [mockScenario, setMockScenario] = useState('')
  const [mode, setMode] = useState<'code' | 'diff'>('code')
  const [path, setPath] = useState('')
  const [source, setSource] = useState('')
  const [diff, setDiff] = useState('')
  const [rules, setRules] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({
    retry: false,
    onError: async (error) => {
      if (!live.current || client.getQueryData<Me>(meQueryKey)?.user.id !== me?.user.id) return
      if (error instanceof SimulationHttpError && error.status === 401)
        await client.resetQueries({ queryKey: meQueryKey })
      if (error instanceof SimulationHttpError && error.rulesDiagnostics) setErrors({ rules: error.rulesDiagnostics })
    },
    mutationFn: () =>
      simulateRules(
        repositoryId,
        {
          input: mode === 'code' ? { kind: 'code', path, source } : { kind: 'diff', unified_diff: diff },
          rules: { format: 'rules-md/1', markdown: rules },
        },
        me!.csrfToken,
        mockScenario,
      ),
  })
  function editDraft(update: () => void) {
    update()
    setErrors({})
    mutation.reset()
  }
  return (
    <form
      className="grid min-w-0 gap-6 xl:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const sourceLines = source.split(CODE_LINE_BREAK)
        const lineCount = sourceLines.length - (sourceLines[sourceLines.length - 1] === '' ? 1 : 0)
        const nextErrors = {
          ...(mode === 'code' &&
          (!path.trim() ||
            path.startsWith('/') ||
            /^[a-zA-Z]:/.test(path) ||
            UNSAFE_PATH_CHARACTERS.test(path) ||
            path.split('/').some((part) => ['', '.', '..'].includes(part)) ||
            new TextEncoder().encode(path).length > 512)
            ? {
                path: !path.trim()
                  ? 'Укажите относительный путь файла.'
                  : 'Нужен нормализованный относительный путь без .. и обратных слешей, до 512 байт UTF-8.',
              }
            : {}),
          ...(mode === 'code' && !source.trim() ? { input: 'Введите исходный код.' } : {}),
          ...(mode === 'code' && (new TextEncoder().encode(source).length > 65536 || lineCount > 500)
            ? { input: 'Код: не более 64 КиБ UTF-8 и 500 строк.' }
            : {}),
          ...(mode === 'diff' && !diff.trim() ? { input: 'Введите unified diff.' } : {}),
          ...(mode === 'diff' && new TextEncoder().encode(diff).length > 131072
            ? { input: 'Diff: не более 128 КиБ UTF-8. До 50 файлов и 2000 изменённых строк; формат проверяет сервер.' }
            : {}),
          ...(!rules.trim() ? { rules: 'Введите правила ревью.' } : {}),
          ...(new TextEncoder().encode(rules).length > 65536 ? { rules: 'Правила: не более 64 КиБ UTF-8.' } : {}),
        }
        setErrors(nextErrors)
        if (Object.keys(nextErrors).length === 0 && me && !mutation.isPending) {
          setExpandedFinding(null)
          mutation.mutate()
        }
      }}
    >
      <fieldset
        disabled={mutation.isPending}
        aria-label="Входные данные"
        className="min-w-0 space-y-4 rounded-md border border-border p-4"
      >
        <div className="flex gap-2" role="group" aria-label="Формат входных данных">
          {(['code', 'diff'] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? 'default' : 'outline'}
              aria-pressed={mode === value}
              onClick={() => editDraft(() => setMode(value))}
            >
              {value === 'code' ? 'Code' : 'Diff'}
            </Button>
          ))}
        </div>
        {mode === 'code' && (
          <label className="grid gap-2 text-sm">
            Путь файла
            <input
              aria-invalid={Boolean(errors.path)}
              aria-describedby={errors.path ? 'path-error' : undefined}
              className="rounded-md border border-input bg-background p-2 font-mono"
              value={path}
              onChange={(event) => editDraft(() => setPath(event.target.value))}
              placeholder="src/example.ts"
            />
          </label>
        )}
        {errors.path && mode === 'code' && (
          <p id="path-error" role="alert" className="text-sm text-destructive">
            {errors.path}
          </p>
        )}
        <label className="grid gap-2 text-sm">
          {mode === 'code' ? 'Исходный код' : 'Unified diff'}
          <Textarea
            aria-invalid={Boolean(errors.input)}
            aria-describedby={errors.input ? 'input-error' : undefined}
            className="min-h-56 font-mono"
            spellCheck={false}
            value={mode === 'code' ? source : diff}
            onChange={(event) =>
              editDraft(() => (mode === 'code' ? setSource(event.target.value) : setDiff(event.target.value)))
            }
          />
        </label>
        <SyntaxPreview
          value={mode === 'code' ? source : diff}
          language={mode === 'code' ? languageFromPath(path) : 'diff'}
          label={mode === 'code' ? 'Подсветка исходного кода' : 'Подсветка unified diff'}
        />
        {errors.input && (
          <p id="input-error" role="alert" className="text-sm text-destructive">
            {errors.input}
          </p>
        )}
        <label className="grid gap-2 text-sm">
          .review/rules.md
          <Textarea
            aria-invalid={Boolean(errors.rules)}
            aria-describedby={errors.rules ? 'rules-error' : undefined}
            className="min-h-48 font-mono"
            spellCheck={false}
            placeholder={'# Security\n## SEC-1: Validate input\nCheck the input.\n'}
            value={rules}
            onChange={(event) => editDraft(() => setRules(event.target.value))}
          />
        </label>
        <SyntaxPreview value={rules} language="markdown" label="Подсветка правил" />
        {errors.rules && (
          <p id="rules-error" role="alert" className="whitespace-pre-wrap text-sm text-destructive">
            {errors.rules}
          </p>
        )}
      </fieldset>
      <section aria-label="Результат симуляции" className="min-w-0 space-y-4 rounded-md border border-border p-4">
        {import.meta.env.DEV && (
          <label className="grid gap-2 text-sm">
            Сценарий development
            <select
              aria-label="Сценарий development"
              aria-describedby="mock-help"
              className="rounded-md border border-input bg-background p-2"
              value={mockScenario}
              onChange={(event) => editDraft(() => setMockScenario(event.target.value))}
              disabled={mutation.isPending}
            >
              <option value="">API-контракт: 503 (MSW)</option>
              <option value="findings">Mock: фиксированные замечания</option>
              <option value="empty">Mock: замечаний нет</option>
            </select>
            <span id="mock-help" className="text-xs text-muted-foreground">
              Development использует MSW. Mock-результаты фиксированы и не оценивают введённые правила.
            </span>
          </label>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Симуляция выполняется…' : 'Симулировать ревью'}
        </Button>
        {mutation.isPending && <p role="status">Симуляция выполняется…</p>}
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error instanceof SimulationHttpError && mutation.error.status === 503
              ? '503 SERVICE_UNAVAILABLE: сервис симуляции временно недоступен. Введённый текст сохранён. Попробуйте позже.'
              : 'Не удалось выполнить симуляцию. Введённый текст сохранён. Повторите попытку.'}
          </p>
        )}
        {mutation.isSuccess && (
          <>
            <p role="status" className="text-sm text-muted-foreground">
              Mock: демонстрационный результат, без анализа кода и LLM.
            </p>
            {mutation.data.findings.length === 0 && <p>Замечаний нет.</p>}
            <ul aria-label="Замечания" className="space-y-3">
              {mutation.data.findings.map((finding, index) => (
                <li key={index} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {finding.rule && <span className="font-medium">{finding.rule}</span>}
                    {finding.severity && <Badge variant="outline">{finding.severity}</Badge>}
                  </div>
                  {(finding.file || finding.line) && (
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {finding.file}
                      {finding.line ? `:${finding.line}` : ''}
                    </p>
                  )}
                  {finding.message && <p className="whitespace-pre-wrap break-words text-sm">{finding.message}</p>}
                  <ReviewAuditInspector
                    finding={finding}
                    open={expandedFinding === index}
                    onToggle={() => setExpandedFinding((current) => (current === index ? null : index))}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        {mutation.isIdle && <p>Введите код и правила, затем запустите симуляцию.</p>}
      </section>
    </form>
  )
}
