import type { QueryClient } from '@tanstack/react-query'
import { meQueryKey, type Me } from '@/entities/session'
import { ReviewHttpError } from '@/entities/pull-request/api/api-data-source'

/** Recheck the browser session when an authenticated review read refuses it. */
export async function recheckReviewSession(
  client: QueryClient,
  error: unknown,
  actorId: string | undefined,
  signal: AbortSignal,
): Promise<void> {
  if (
    error instanceof ReviewHttpError &&
    error.status === 401 &&
    !signal.aborted &&
    actorId !== undefined &&
    client.getQueryData<Me>(meQueryKey)?.user.id === actorId
  ) {
    await client.resetQueries({ queryKey: meQueryKey })
  }
}
