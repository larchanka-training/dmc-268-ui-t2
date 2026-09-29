import { BrowserRouter } from 'react-router-dom'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { AppRouter } from '@/app/router'

export function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryProvider>
  )
}

export default App
