import { QueryProvider } from '@/app/providers/QueryProvider'
import { ReviewPage } from '@/pages/review'

export function App() {
  return (
    <QueryProvider>
      <ReviewPage />
    </QueryProvider>
  )
}

export default App
