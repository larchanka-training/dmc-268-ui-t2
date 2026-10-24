import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetUiStores } from '@/test/reset-ui-stores'

beforeEach(() => {
  // jsdom не реализует scrollIntoView
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  resetUiStores()
})
