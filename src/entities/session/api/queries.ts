import { useQuery } from '@tanstack/react-query'
import { fetchMe, SessionHttpError } from '@/entities/session/api/session-client'

export const meQueryKey = ['session', 'me'] as const

export function useMeQuery() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    retry: (failureCount: number, error: Error) => {
      if (error instanceof SessionHttpError && error.status === 401) {
        return false
      }
      return failureCount < 1
    },
  })
}
