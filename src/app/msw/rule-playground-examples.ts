import { examples, matchesExample } from '@/features/simulate-rules/model/examples'
import type { MockFinding } from '@/features/simulate-rules/api/simulate'

const findings = {
  sql: {
    rule_ref: 'SEC-1',
    file: 'src/users.py',
    line: 2,
    evidence: `return f"SELECT id FROM users WHERE name = '{name}'"`,
    message: 'Значение name попадает в текст запроса. Передайте его отдельным параметром.',
  },
  architecture: {
    rule_ref: 'ARCH-1',
    file: 'src/domain/order.ts',
    line: 1,
    evidence: "import { sql } from '../infra/database'",
    message: 'Доменный модуль напрямую импортирует базу данных. Передайте зависимость через интерфейс.',
  },
  style: {
    rule_ref: 'STY-1',
    file: 'src/totals.py',
    line: 1,
    evidence: 'def orderTotal(prices):',
    message: 'Имя orderTotal использует camelCase. Для функции Python выберите order_total.',
  },
} satisfies Record<(typeof examples)[number]['id'], MockFinding>

export function exampleMockFinding(body: unknown): MockFinding | undefined {
  const example = examples.find((preset) => matchesExample(preset, body))
  if (!example) return
  const finding = findings[example.id]
  return { ...finding, rule: finding.rule_ref, title: example.label }
}
