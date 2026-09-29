import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogoutButton } from '@/features/logout'
import { useMeQuery } from '@/entities/session'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { cn } from '@/shared/lib/cn'

const PRODUCT_NAME = 'Code Review'

function meInitials(displayName: string | undefined): string {
  if (!displayName) return '?'
  return (
    displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

export function AppShell() {
  const location = useLocation()
  const meQuery = useMeQuery()
  const me = meQuery.data
  const reposActive = location.pathname === '/repos' || location.pathname.startsWith('/repos/')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        <p className="text-sm font-semibold tracking-tight text-foreground">{PRODUCT_NAME}</p>
        <div className="flex items-center gap-3">
          {me ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                {me.avatarUrl ? <AvatarImage src={me.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[10px]">{meInitials(me.displayName)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-foreground sm:inline">{me.displayName}</span>
            </div>
          ) : null}
          <LogoutButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-3">
          <NavLink
            to="/repos"
            className={cn(
              'rounded-md px-2 py-1.5 text-sm font-medium',
              reposActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
            aria-current={reposActive ? 'page' : undefined}
          >
            Repos
          </NavLink>
          <span
            className="cursor-not-allowed rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60"
            aria-disabled="true"
            title="Coming soon"
          >
            Reviews/PRs
            <span className="mt-0.5 block text-xs font-normal">Coming soon</span>
          </span>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
