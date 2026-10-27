import { QueryClient } from '@tanstack/react-query'
import { NonRetryableError } from '@/shared/lib/non-retryable-error'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) => !(error instanceof NonRetryableError) && failureCount < 1,
      refetchOnWindowFocus: false,
    },
  },
})
