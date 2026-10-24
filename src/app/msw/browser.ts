import { setupWorker } from 'msw/browser'
import { authHandlers, reposHandlers, reviewsHandlers } from '@/app/msw/handlers'

export const worker = setupWorker(...authHandlers, ...reposHandlers, ...reviewsHandlers)

export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
