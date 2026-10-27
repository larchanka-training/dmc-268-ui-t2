import { describe, expect, it } from 'vitest'
import { languageFromPath, tokenizeLines } from '@/entities/diff/lib/tokenize'

describe('languageFromPath', () => {
  it.each([
    ['src/a.ts', 'typescript'],
    ['src/a.tsx', 'tsx'],
    ['src/a.js', 'javascript'],
    ['src/a.jsx', 'jsx'],
    ['src/a.css', 'css'],
    ['package.json', 'json'],
    ['README.md', 'markdown'],
  ])('maps %s to %s', (path, language) => {
    expect(languageFromPath(path)).toBe(language)
  })

  it('returns null for unknown extensions and files without one', () => {
    expect(languageFromPath('data.xyz')).toBeNull()
    expect(languageFromPath('Makefile')).toBeNull()
  })
})

describe('tokenizeLines', () => {
  it('returns one token list per line and keeps the text intact', () => {
    const lines = tokenizeLines('const a = 1\nreturn a', 'typescript')

    expect(lines).toHaveLength(2)
    expect(lines.map((tokens) => tokens.map((t) => t.content).join(''))).toEqual(['const a = 1', 'return a'])
  })

  it('marks keywords', () => {
    const [tokens] = tokenizeLines('const a = 1', 'typescript')

    expect(tokens.find((t) => t.content === 'const')?.types).toContain('keyword')
  })

  it('falls back to plain text for an unknown language', () => {
    const lines = tokenizeLines('hello\nworld', null)

    expect(lines.map((tokens) => tokens.map((t) => t.content).join(''))).toEqual(['hello', 'world'])
    expect(lines.flat().every((t) => t.types.every((type) => type === 'plain'))).toBe(true)
  })
})
