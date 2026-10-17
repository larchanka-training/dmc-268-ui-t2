import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from '@/app/App'
import '@/app/styles/globals.css'

async function enableMocking() {
  if (!import.meta.env.DEV) return
  const { startMockWorker } = await import('@/app/msw/browser')
  await startMockWorker()
}

void enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
