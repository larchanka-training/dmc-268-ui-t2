import { Link, useNavigate } from 'react-router-dom'
import { PullRequestHttpError, useStartReviewMutation, type PullRequest } from '@/entities/pull-request'
import { Button } from '@/shared/ui/button'

function isIntegrationUnhealthy(error: Error): boolean {
  return error instanceof PullRequestHttpError && error.status === 409 && error.code === 'INTEGRATION_UNHEALTHY'
}

interface StartReviewButtonProps {
  repositoryId: string
  pullRequest: PullRequest
}

export function StartReviewButton({ repositoryId, pullRequest }: StartReviewButtonProps) {
  const navigate = useNavigate()
  const startMutation = useStartReviewMutation()

  async function handleStart() {
    try {
      const reviewId = await startMutation.mutateAsync({
        repositoryId,
        number: pullRequest.number,
        headSha: pullRequest.headSha,
      })
      navigate(`/reviews/${encodeURIComponent(reviewId)}`)
    } catch {
      // Error surfaced via startMutation.isError below
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={startMutation.isPending} onClick={() => void handleStart()}>
        Start review
      </Button>
      {startMutation.isError ? (
        <p className="text-xs text-destructive" role="alert">
          {isIntegrationUnhealthy(startMutation.error) ? (
            <>
              This repository integration is unhealthy, so new reviews are blocked. An admin can use Check access on the{' '}
              <Link to="/repos" className="underline underline-offset-2">
                Repositories
              </Link>{' '}
              page, then try again.
            </>
          ) : (
            'Could not start review. Try again.'
          )}
        </p>
      ) : null}
    </div>
  )
}
