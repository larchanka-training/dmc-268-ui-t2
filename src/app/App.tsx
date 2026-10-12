import { BrowserRouter } from 'react-router-dom'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { SessionLifecycle } from '@/app/providers/SessionLifecycle'
import { AppRouter } from '@/app/router'

export function App() {
  return (
    <QueryProvider>
      <SessionLifecycle>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </SessionLifecycle>
    </QueryProvider>
  )
}

export default App
