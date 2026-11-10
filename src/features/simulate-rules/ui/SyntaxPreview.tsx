import { useMemo } from 'react'
import { HighlightedCode, tokenizeLines } from '@/entities/diff'

/** Textarea remains the accessible editor; this live preview uses the existing Prism renderer. */
export function SyntaxPreview({ value, language, label }: { value: string; language: string | null; label: string }) {
  const preview = value.slice(0, 4000).split('\n').slice(0, 100).join('\n')
  const lines = useMemo(
    () =>
      language === 'diff'
        ? preview.split('\n').map((content) => [
            {
              content,
              types: [
                content.startsWith('+++') || content.startsWith('---') || content.startsWith('@@')
                  ? 'coord'
                  : content.startsWith('+')
                    ? 'inserted'
                    : content.startsWith('-')
                      ? 'deleted'
                      : 'plain',
              ],
            },
          ])
        : tokenizeLines(preview, language),
    [preview, language],
  )
  return (
    <section aria-label={label} className="max-h-56 overflow-auto rounded-md bg-muted p-3">
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      {preview !== value && (
        <p className="mb-2 text-xs text-muted-foreground">
          Подсветка ограничена первыми 4000 символами и 100 строками. Полный текст сохранён.
        </p>
      )}
      <pre className="text-xs leading-5">
        <code>
          {lines.map((tokens, index) => (
            <div
              key={index}
              className={
                language === 'diff'
                  ? tokens[0].types[0] === 'inserted'
                    ? 'bg-diff-add-bg'
                    : tokens[0].types[0] === 'deleted'
                      ? 'bg-diff-del-bg'
                      : ''
                  : undefined
              }
            >
              <HighlightedCode tokens={tokens} />
              {'\n'}
            </div>
          ))}
        </code>
      </pre>
    </section>
  )
}
