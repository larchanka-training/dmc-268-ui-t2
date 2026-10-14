import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import {
  UnifiedColGroup,
  UnifiedLineRow,
  highlightHunk,
  languageFromPath,
  parseUnifiedDiff,
  resultingCode,
} from '@/entities/diff'
import { copyText } from '@/shared/lib/clipboard'
import { Button } from '@/shared/ui/button'

export interface SuggestedFixProps {
  /** unified diff исправления */
  diff: string
  /** путь файла замечания — по нему выбирается язык подсветки */
  filePath: string
}

export function SuggestedFix({ diff, filePath }: SuggestedFixProps) {
  const files = useMemo(() => parseUnifiedDiff(diff), [diff])
  const language = languageFromPath(filePath)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await copyText(resultingCode(files))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section aria-label="Suggested fix" className="overflow-hidden rounded border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted px-2 py-1">
        <span className="text-xs font-medium">Suggested fix</span>
        <Button type="button" variant="ghost" size="sm" onClick={copy} className="gap-1">
          {copied ? <Check aria-hidden="true" className="h-3 w-3" /> : <Copy aria-hidden="true" className="h-3 w-3" />}
          Copy fix
        </Button>
      </div>
      <table className="w-full table-fixed border-collapse font-mono text-[13px]">
        <UnifiedColGroup />
        <tbody>
          {files.flatMap((file) =>
            file.hunks.map((hunk, hunkIndex) => {
              const tokens = highlightHunk(hunk, language)
              return hunk.lines.map((line, lineIndex) => (
                <UnifiedLineRow
                  key={`${file.path}:${hunkIndex}:${lineIndex}`}
                  line={line}
                  tokens={tokens.get(line)}
                  testId="fix-row"
                />
              ))
            }),
          )}
        </tbody>
      </table>
    </section>
  )
}
