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

/** Verified service DTO, separate from development fixtures. */
export interface CodeFinding {
  rule_ref: string
  path: string
  start_line: number
  end_line: number
  title: string
  explanation: string
  evidence: string
}

export interface CodeSimulationResult {
  findings: CodeFinding[]
  rejected_count: number
}

export interface DiffFinding extends CodeFinding {
  side: 'old' | 'new'
}

export interface DiffSimulationResult {
  findings: DiffFinding[]
  rejected_count: number
}

/** Existing Inspector view fields; the HTTP adapter maps real coordinates explicitly. */
export interface SimulationFinding extends MockFinding {
  side?: 'old' | 'new'
}

export type SimulationResult =
  | { source: 'real'; findings: SimulationFinding[]; rejected_count: number }
  | { source: 'mock'; findings: SimulationFinding[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && [...value].length >= 1 && [...value].length <= max
}

function isServiceFinding(value: unknown, kind: 'code' | 'diff'): value is CodeFinding | DiffFinding {
  if (!isRecord(value)) return false
  return (
    Object.keys(value).length === (kind === 'diff' ? 8 : 7) &&
    Object.keys(value).every((key) =>
      [
        'rule_ref',
        'path',
        'start_line',
        'end_line',
        'title',
        'explanation',
        'evidence',
        ...(kind === 'diff' ? ['side'] : []),
      ].includes(key),
    ) &&
    (kind === 'code' || value.side === 'old' || value.side === 'new') &&
    typeof value.path === 'string' &&
    !value.path.startsWith('/') &&
    !value.path.includes('\\') &&
    !value.path.includes('\0') &&
    value.path.split('/').every((part) => !['', '.', '..'].includes(part)) &&
    typeof value.start_line === 'number' &&
    Number.isSafeInteger(value.start_line) &&
    value.start_line >= 1 &&
    typeof value.end_line === 'number' &&
    Number.isSafeInteger(value.end_line) &&
    value.end_line >= value.start_line &&
    isBoundedText(value.rule_ref, 32) &&
    isBoundedText(value.title, 200) &&
    isBoundedText(value.explanation, 2000) &&
    isBoundedText(value.evidence, 1000)
  )
}

function isRealResult(value: unknown, kind: 'code' | 'diff'): value is CodeSimulationResult | DiffSimulationResult {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    Array.isArray(value.findings) &&
    value.findings.length <= 100 &&
    value.findings.every((finding: unknown) => isServiceFinding(finding, kind)) &&
    typeof value.rejected_count === 'number' &&
    Number.isSafeInteger(value.rejected_count) &&
    value.rejected_count >= 0
  )
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
): Promise<SimulationResult> {
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
  if (response.status !== 200) throw new Error('Invalid simulation response')
  const value: unknown = await response.json()
  if (import.meta.env.DEV && response.headers.get('X-Rule-Playground-Mock') === 'true') {
    if (
      isRecord(value) &&
      Object.keys(value).length === 2 &&
      'mock' in value &&
      value.mock === true &&
      'findings' in value &&
      Array.isArray(value.findings) &&
      value.findings.every((finding: unknown) => {
        if (!isRecord(finding)) return false
        const item = finding as Record<string, unknown>
        return (
          Object.keys(item).every((key) =>
            [
              'rule',
              'title',
              'severity',
              'category',
              'file',
              'line',
              'end_line',
              'message',
              'explanation',
              'rule_ref',
              'rule_description',
              'evidence',
              'recommendation',
              'model_context',
            ].includes(key),
          ) &&
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
      return { source: 'mock', findings: value.findings as MockFinding[] }
  }
  if (!response.headers.has('X-Rule-Playground-Mock') && isRealResult(value, body.input.kind)) {
    return {
      source: 'real',
      rejected_count: value.rejected_count,
      findings: value.findings.map((finding) => ({
        rule_ref: finding.rule_ref,
        file: finding.path,
        line: finding.start_line,
        end_line: finding.end_line,
        title: finding.title,
        message: finding.title,
        explanation: finding.explanation,
        evidence: finding.evidence,
        ...('side' in finding ? { side: finding.side } : {}),
      })),
    }
  }
  throw new Error('Invalid simulation response')
}
