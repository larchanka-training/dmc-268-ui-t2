import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogoutButton } from '@/features/logout'
import { useMeQuery } from '@/entities/session'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { cn } from '@/shared/lib/cn'

const PRODUCT_NAME = 'Code Review'

function meInitials(login: string | undefined): string {
  if (!login) return '?'
  return login.slice(0, 2).toUpperCase()
}

export function AppShell() {
  const location = useLocation()
  const meQuery = useMeQuery()
  const me = meQuery.data
  const reposActive = location.pathname === '/repos' || location.pathname.startsWith('/repos/')
  const reviewActive = ['/review', '/pulls'].some(
    (base) => location.pathname === base || location.pathname.startsWith(`${base}/`),
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        <p className="text-sm font-semibold tracking-tight text-foreground">{PRODUCT_NAME}</p>
        <div className="flex items-center gap-3">
          {me ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">{meInitials(me.user.login)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-foreground sm:inline">{me.user.login}</span>
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
          {/* Link, не NavLink: NavLink гасит aria-current, когда сам не активен (/pulls/* ≠ /review) */}
          <Link
            to="/review"
            className={cn(
              'rounded-md px-2 py-1.5 text-sm font-medium',
              reviewActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
            aria-current={reviewActive ? 'page' : undefined}
          >
            Reviews/PRs
          </Link>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
