import { expect, test } from 'vitest'
import type { Finding } from '@/entities/finding'
import { EMPTY_FINDING_FILTERS, filterFindings, hasActiveFindingFilters } from '@/features/filter-findings'

function finding(id: string, overrides: Partial<Finding> = {}): Finding {
  return {
    id,
    path: 'src/api/user.ts',
    side: 'new',
    startLine: 1,
    endLine: 1,
    category: 'correctness',
    severity: 'medium',
    title: `Finding ${id}`,
    explanation: '',
    evidence: '',
    recommendation: '',
    proposedDiffFix: null,
    ...overrides,
  }
}

const ids = (findings: Finding[]) => findings.map((item) => item.id)

test('without filters every finding is shown', () => {
  const findings = [finding('a'), finding('b', { path: 'src/other.ts', severity: 'low' })]

  expect(ids(filterFindings(findings, EMPTY_FINDING_FILTERS))).toEqual(['a', 'b'])
})

test('file filter keeps only findings in the selected file', () => {
  const findings = [finding('a'), finding('b', { path: 'src/other.ts' }), finding('c')]

  expect(ids(filterFindings(findings, { ...EMPTY_FINDING_FILTERS, path: 'src/api/user.ts' }))).toEqual(['a', 'c'])
})

test('severity filter keeps findings of any selected severity', () => {
  const findings = [
    finding('a', { severity: 'critical' }),
    finding('b', { severity: 'low' }),
    finding('c', { severity: 'high' }),
  ]

  expect(ids(filterFindings(findings, { ...EMPTY_FINDING_FILTERS, severities: ['critical', 'high'] }))).toEqual([
    'a',
    'c',
  ])
})

test('text search matches title, explanation, recommendation and evidence case-insensitively', () => {
  const findings = [
    finding('title', { title: 'SQL injection in query builder' }),
    finding('explanation', { explanation: 'Builds SQL from user input' }),
    finding('recommendation', { recommendation: 'Use parameterised sql' }),
    finding('evidence', { evidence: 'db.raw(`SELECT ${id}`) // Sql' }),
    finding('other', { title: 'Unused import' }),
  ]

  expect(ids(filterFindings(findings, { ...EMPTY_FINDING_FILTERS, query: '  sQl ' }))).toEqual([
    'title',
    'explanation',
    'recommendation',
    'evidence',
  ])
})

test('hasActiveFindingFilters is false only when no filter is set', () => {
  expect(hasActiveFindingFilters(EMPTY_FINDING_FILTERS)).toBe(false)
  expect(hasActiveFindingFilters({ ...EMPTY_FINDING_FILTERS, path: 'a.ts' })).toBe(true)
  expect(hasActiveFindingFilters({ ...EMPTY_FINDING_FILTERS, severities: ['low'] })).toBe(true)
  expect(hasActiveFindingFilters({ ...EMPTY_FINDING_FILTERS, query: 'x' })).toBe(true)
})
