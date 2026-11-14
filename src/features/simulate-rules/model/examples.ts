import type { SimulationRequest } from '../api/simulate'

export interface PlaygroundExample {
  id: 'sql' | 'architecture' | 'style'
  label: string
  input: SimulationRequest['input']
  markdown: string
}

export const examples: PlaygroundExample[] = [
  {
    id: 'sql',
    label: 'SQL-инъекция',
    input: {
      kind: 'code',
      path: 'src/users.py',
      source: 'def user_query(name):\n    return f"SELECT id FROM users WHERE name = \'{name}\'"\n',
    },
    markdown:
      '# Security\n## SEC-1: Параметры SQL\nПередавайте внешние значения в SQL отдельными параметрами. Отметьте строку, где значение подставляется в текст запроса.\n',
  },
  {
    id: 'architecture',
    label: 'Архитектура',
    input: {
      kind: 'diff',
      unified_diff: [
        'diff --git a/src/domain/order.ts b/src/domain/order.ts',
        '--- a/src/domain/order.ts',
        '+++ b/src/domain/order.ts',
        '@@ -1,3 +1,5 @@',
        "+import { sql } from '../infra/database'",
        '+',
        ' export function orderCount() {',
        '-  return 0',
        "+  return sql.count('orders')",
        ' }',
        '',
      ].join('\n'),
    },
    markdown:
      '# Style\n## ARCH-1: Границы доменного слоя\nФайлы в src/domain не должны импортировать модули из src/infra. Укажите строку импорта и предложите передать зависимость через интерфейс.\n',
  },
  {
    id: 'style',
    label: 'Кодстайл',
    input: {
      kind: 'code',
      path: 'src/totals.py',
      source: 'def orderTotal(prices):\n    return sum(prices)\n',
    },
    markdown:
      '# Style\n## STY-1: Имена функций\nИспользуйте snake_case для имён функций Python. Укажите определение, где нарушено правило, и предложите новое имя.\n',
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function matchesExample(example: PlaygroundExample, request: unknown): boolean {
  if (!isRecord(request) || !isRecord(request.input) || !isRecord(request.rules)) return false
  const { input, rules } = request
  if (rules.format !== 'rules-md/1' || rules.markdown !== example.markdown) return false
  return example.input.kind === 'code'
    ? input.kind === 'code' && input.path === example.input.path && input.source === example.input.source
    : input.kind === 'diff' && input.unified_diff === example.input.unified_diff
}
