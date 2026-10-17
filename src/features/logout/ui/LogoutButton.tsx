import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { logoutSession, meQueryKey, type Me } from '@/entities/session'
import { Button } from '@/shared/ui/button'

export function LogoutButton() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function handleLogout() {
    const me = queryClient.getQueryData<Me>(meQueryKey)
    await logoutSession(me?.csrfToken)
    navigate('/login', { replace: true })
    await queryClient.resetQueries({ queryKey: meQueryKey })
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void handleLogout()}>
      Log out
    </Button>
  )
}
