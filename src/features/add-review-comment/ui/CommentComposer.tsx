import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import type { CommentDraft } from '@/features/add-review-comment/model/store'

export interface CommentComposerProps {
  draft: CommentDraft
  onChangeText: (text: string) => void
  onCancel: () => void
  onSubmit: (text: string) => void
}

export function CommentComposer({ draft, onChangeText, onCancel, onSubmit }: CommentComposerProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!draft.text.trim()) return
    setSubmitting(true)
    try {
      onSubmit(draft.text.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-2">
      <Textarea
        autoFocus
        placeholder="Оставить комментарий..."
        value={draft.text}
        onChange={(event) => onChangeText(event.target.value)}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Отмена
        </Button>
        <Button size="sm" disabled={submitting || !draft.text.trim()} onClick={handleSubmit}>
          Отправить
        </Button>
      </div>
    </div>
  )
}
