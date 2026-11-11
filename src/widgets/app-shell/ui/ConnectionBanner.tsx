import { useEffect, useState } from 'react'

/**
 * Баннер «нет соединения»: слушает системные события online/offline.
 * Сообщение можно скрыть вручную; восстановление связи скрывает баннер само.
 */
export function ConnectionBanner() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const goOffline = () => {
      setOffline(true)
      setDismissed(false)
    }
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline || dismissed) return null
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-sm text-warning-foreground"
    >
      <p>Нет соединения с интернетом. Данные не обновляются.</p>
      <button
        type="button"
        className="shrink-0 rounded px-2 py-0.5 font-medium hover:bg-accent/60 focus-visible:outline focus-visible:outline-2"
        onClick={() => setDismissed(true)}
      >
        Закрыть
      </button>
    </div>
  )
}
