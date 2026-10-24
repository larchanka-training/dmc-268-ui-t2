import { Prism, normalizeTokens } from 'prism-react-renderer'

export interface HighlightToken {
  content: string
  types: string[]
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  css: 'css',
  json: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  html: 'markup',
  xml: 'markup',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
}

export function languageFromPath(path: string): string | null {
  const name = path.split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  return LANGUAGE_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null
}

function plain(code: string): HighlightToken[][] {
  return code.split('\n').map((content) => [{ content, types: ['plain'] }])
}

/** Токенизирует код по строкам. Неизвестный язык → plain text. */
export function tokenizeLines(code: string, language: string | null): HighlightToken[][] {
  const grammar = language ? Prism.languages[language] : undefined
  if (!grammar) return plain(code)

  return normalizeTokens(Prism.tokenize(code, grammar)).map((line) => {
    const tokens = line.flatMap((t) => {
      const content = t.empty ? '' : t.content
      return content === '' ? [] : [{ content, types: t.types }]
    })
    return tokens.length > 0 ? tokens : [{ content: '', types: ['plain'] }]
  })
}
