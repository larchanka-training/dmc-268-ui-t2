import { Fragment, type ReactNode } from 'react'

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

type Block = { kind: 'p'; text: string } | { kind: 'code'; text: string }

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  const paragraph: string[] = []
  let code: string[] | null = null

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'p', text: paragraph.join('\n') })
    paragraph.length = 0
  }

  for (const line of source.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      if (code) {
        blocks.push({ kind: 'code', text: code.join('\n') })
        code = null
      } else {
        flush()
        code = []
      }
    } else if (code) {
      code.push(line)
    } else if (line.trim() === '') {
      flush()
    } else {
      paragraph.push(line)
    }
  }
  if (code) blocks.push({ kind: 'code', text: code.join('\n') })
  flush()
  return blocks
}

export interface MiniMarkdownProps {
  source: string
}

/**
 * Минимальный и безопасный markdown: абзацы, `inline code`, **bold**, блоки ```code```.
 * Всё остальное (в том числе HTML) выводится как обычный текст.
 */
export function MiniMarkdown({ source }: MiniMarkdownProps) {
  return (
    <div className="space-y-2 text-sm">
      {parseBlocks(source).map((block, i) =>
        block.kind === 'code' ? (
          <pre key={i} className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
            {block.text}
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {renderInline(block.text)}
          </p>
        ),
      )}
    </div>
  )
}
