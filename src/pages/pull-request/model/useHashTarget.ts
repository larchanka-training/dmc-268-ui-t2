import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useCommentCardStore } from '@/features/review-comment-card'
import { useCollapsedFilesStore } from '@/widgets/diff-viewer'

const COMMENT_PREFIX = '#comment-'
const FILE_PREFIX = '#file-'

export interface JumpState {
  jump?: number
}

export interface UseHashTargetOptions {
  /** данные загружены и DOM с карточками отрисован */
  ready: boolean
  /** id замечания → путь файла, в котором оно показано */
  fileOfComment: ReadonlyMap<string, string>
}

function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash)
  } catch {
    return hash
  }
}

/**
 * `#comment-<id>` раскрывает карточку (и файл, если он свёрнут) и скроллит к ней,
 * `#file-<path>` — раскрывает и скроллит к файлу. Реагирует на смену hash и на явный
 * «прыжок» (`state.jump`), например по клику на счётчик severity.
 */
export function useHashTarget({ ready, fileOfComment }: UseHashTargetOptions) {
  const location = useLocation()
  const expandComment = useCommentCardStore((state) => state.expand)
  const expandFile = useCollapsedFilesStore((state) => state.expand)
  const pendingScroll = useRef<string | null>(null)

  const hash = decodeHash(location.hash)
  const jump = (location.state as JumpState | null)?.jump

  // Раскрытие файла обновляет стор, на который подписан только DiffFileSection. Подписка здесь
  // перерисовывает и хук после того, как карточка попала в DOM, — иначе скролл не повторился бы.
  const targetFile = hash.startsWith(COMMENT_PREFIX)
    ? fileOfComment.get(hash.slice(COMMENT_PREFIX.length))
    : hash.startsWith(FILE_PREFIX)
      ? hash.slice(FILE_PREFIX.length)
      : undefined
  useCollapsedFilesStore((state) => (targetFile ? Boolean(state.collapsed[targetFile]) : false))

  useEffect(() => {
    pendingScroll.current = null
    if (!ready || !hash) return

    if (hash.startsWith(COMMENT_PREFIX)) {
      const commentId = hash.slice(COMMENT_PREFIX.length)
      expandComment(commentId)
      const filePath = fileOfComment.get(commentId)
      if (filePath) expandFile(filePath)
    } else if (hash.startsWith(FILE_PREFIX)) {
      expandFile(hash.slice(FILE_PREFIX.length))
    } else {
      return
    }
    pendingScroll.current = hash.slice(1)
  }, [ready, hash, jump, fileOfComment, expandComment, expandFile])

  // Скролл — после коммита: цель может появиться только когда свёрнутый файл раскроется.
  // Пока элемента нет в DOM, цель остаётся в ref и ждёт следующего коммита.
  useEffect(() => {
    const id = pendingScroll.current
    const element = id ? document.getElementById(id) : null
    if (element) {
      pendingScroll.current = null
      element.scrollIntoView({ block: 'start' })
    }
  })
}
