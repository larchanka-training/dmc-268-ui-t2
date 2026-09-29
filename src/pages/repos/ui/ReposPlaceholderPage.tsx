import { LogoutButton } from '@/features/logout'
import { useMeQuery } from '@/entities/session'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'

export function ReposPlaceholderPage() {
  const meQuery = useMeQuery()
  const me = meQuery.data

  const initials =
    me?.displayName
      ?.split(/\s+/)
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ?? '?'

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">Repositories</h1>
        <LogoutButton />
      </header>

      {me ? (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {me.avatarUrl ? <AvatarImage src={me.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{me.displayName}</p>
            <p className="text-xs text-muted-foreground capitalize">{me.provider}</p>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">Connected repositories will appear here in a later slice.</p>
    </main>
  )
}
