import { RequireAuth } from '@/app/guards/RequireAuth'
import { AppShell } from '@/widgets/app-shell'

export function AuthenticatedShell() {
  return (
    <RequireAuth>
      <AppShell />
    </RequireAuth>
  )
}
