/** Development fixture only; these are NOT backend success/audit DTOs. */
export interface MockFinding {
  rule?: string
  title?: string
  severity?: string
  category?: string
  file?: string
  line?: number
  end_line?: number
  message?: string
  explanation?: string
  evidence?: string
  recommendation?: string
  model_context?: string
  rule_ref?: string
  rule_description?: string
}

export interface MockSimulation {
  mock: true
  findings: MockFinding[]
}

export class SimulationHttpError extends Error {
  constructor(
    readonly status: number,
    readonly rulesDiagnostics?: string,
  ) {
    super(`Simulation request failed (${status})`)
  }
}

export interface SimulationRequest {
  input: { kind: 'code'; path: string; source: string } | { kind: 'diff'; unified_diff: string }
  rules: { format: 'rules-md/1'; markdown: string }
}

export async function simulateRules(
  repositoryId: string,
  body: SimulationRequest,
  csrfToken: string,
  mockScenario = '',
): Promise<MockSimulation> {
  const response = await fetch(`/api/v1/repositories/${encodeURIComponent(repositoryId)}/rule-simulations`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': crypto.randomUUID(),
      ...(import.meta.env.DEV && mockScenario ? { 'X-Rule-Playground-Scenario': mockScenario } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    let rulesDiagnostics: string | undefined
    if (response.status === 422) {
      const error: unknown = await response.json().catch(() => null)
      if (typeof error === 'object' && error !== null && 'diagnostics' in error && Array.isArray(error.diagnostics)) {
        rulesDiagnostics =
          error.diagnostics
            .slice(0, 20)
            .flatMap((item: unknown) => {
              if (typeof item !== 'object' || item === null || !('message' in item) || typeof item.message !== 'string')
                return []
              const line = 'line' in item && typeof item.line === 'number' ? `Строка ${item.line}: ` : ''
              return [`${line}${item.message}`]
            })
            .join('\n') || undefined
        if (rulesDiagnostics && 'diagnostics_truncated' in error && error.diagnostics_truncated === true)
          rulesDiagnostics += '\nПоказаны не все ошибки правил.'
      }
    }
    throw new SimulationHttpError(response.status, rulesDiagnostics)
  }
  if (import.meta.env.DEV && response.headers.get('X-Rule-Playground-Mock') === 'true') {
    const value: unknown = await response.json()
    if (
      typeof value === 'object' &&
      value !== null &&
      'mock' in value &&
      value.mock === true &&
      'findings' in value &&
      Array.isArray(value.findings) &&
      value.findings.every((finding: unknown) => {
        if (typeof finding !== 'object' || finding === null) return false
        const item = finding as Record<string, unknown>
        return (
          [
            'rule',
            'title',
            'severity',
            'category',
            'file',
            'message',
            'explanation',
            'rule_ref',
            'rule_description',
            'evidence',
            'recommendation',
            'model_context',
          ].every((key) => item[key] === undefined || typeof item[key] === 'string') &&
          (item.line === undefined ||
            (typeof item.line === 'number' && Number.isInteger(item.line) && item.line > 0)) &&
          (item.end_line === undefined ||
            (typeof item.end_line === 'number' &&
              Number.isInteger(item.end_line) &&
              typeof item.line === 'number' &&
              item.end_line >= item.line))
        )
      })
    )
      return value as MockSimulation
  }
  throw new Error('Simulation success contract is not available yet')
}
