import { setupWorker } from 'msw/browser'
import { authHandlers } from '@/app/msw/handlers'

export const worker = setupWorker(...authHandlers)

export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
