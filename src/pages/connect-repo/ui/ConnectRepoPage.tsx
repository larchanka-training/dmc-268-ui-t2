import { Link } from 'react-router-dom'
import { ConnectRepoPanel } from '@/features/connect-repo'
import { Button } from '@/shared/ui/button'

export function ConnectRepoPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">Connect repository</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/repos">Back to list</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Choose a repository that is not yet connected to the product.</p>
      <ConnectRepoPanel />
    </div>
  )
}
