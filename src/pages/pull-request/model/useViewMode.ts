import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { parseViewMode, type ViewMode } from '@/widgets/diff-viewer'

/** Режим diff хранится в `?view=unified|split`, чтобы ссылка открывала тот же вид. */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { hash } = useLocation()

  const mode = parseViewMode(searchParams.get('view'))

  const setMode = useCallback(
    (next: ViewMode) => {
      const params = new URLSearchParams(searchParams)
      params.set('view', next)
      // hash сохраняем, историю не засоряем
      navigate({ search: `?${params.toString()}`, hash }, { replace: true })
    },
    [navigate, searchParams, hash],
  )

  return [mode, setMode]
}
