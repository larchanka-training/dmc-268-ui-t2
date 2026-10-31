import { insightsHandlers } from './insights-handlers'
import { setupWorker } from 'msw/browser'
import { authHandlers, reposHandlers, reviewHandlers } from '@/app/msw/handlers'

export const worker = setupWorker(...authHandlers, ...reposHandlers, ...reviewHandlers, ...insightsHandlers)

export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
