import { useSearchParams } from 'react-router-dom'
import { startGithubOAuth } from '@/entities/session'
import { Button } from '@/shared/ui/button'

export function ContinueWithGithubButton() {
  const [params] = useSearchParams()

  return (
    <Button type="button" onClick={() => startGithubOAuth(params.get('returnUrl'))}>
      Continue with GitHub
    </Button>
  )
}
