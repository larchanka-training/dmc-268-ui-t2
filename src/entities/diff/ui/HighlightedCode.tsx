import type { HighlightToken } from '@/entities/diff/lib/tokenize'

const TOKEN_COLOR: Record<string, string> = {
  keyword: 'text-purple-600 dark:text-purple-300',
  'class-name': 'text-sky-700 dark:text-sky-300',
  function: 'text-sky-700 dark:text-sky-300',
  string: 'text-emerald-700 dark:text-emerald-300',
  'template-string': 'text-emerald-700 dark:text-emerald-300',
  number: 'text-amber-700 dark:text-amber-300',
  boolean: 'text-amber-700 dark:text-amber-300',
  comment: 'italic text-muted-foreground',
  property: 'text-sky-800 dark:text-sky-200',
  tag: 'text-rose-700 dark:text-rose-300',
  selector: 'text-rose-700 dark:text-rose-300',
  'attr-name': 'text-amber-700 dark:text-amber-300',
}

function colorOf(types: string[]): string | undefined {
  for (const type of types) {
    if (TOKEN_COLOR[type]) return TOKEN_COLOR[type]
  }
  return undefined
}

export interface HighlightedCodeProps {
  tokens: HighlightToken[]
}

export function HighlightedCode({ tokens }: HighlightedCodeProps) {
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={['token', ...token.types, colorOf(token.types)].filter(Boolean).join(' ')}>
          {token.content}
        </span>
      ))}
    </>
  )
}
