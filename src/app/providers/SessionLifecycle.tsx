import type { PropsWithChildren } from 'react'
import { useSessionAutoRefresh } from '@/entities/session/api/use-session-auto-refresh'

/** Owns session side-effects that need QueryClient (auto-refresh). */
export function SessionLifecycle({ children }: PropsWithChildren) {
  useSessionAutoRefresh()
  return children
}
