import { builtinEnvironments, type Environment } from 'vitest/environments'

// jsdom подменяет AbortController/AbortSignal своими, а нативный Request (undici, Node 24+)
// принимает только нативный signal: react-router падает на `new Request(url, { signal })`.
// Модуль выполняется до подмены, поэтому здесь ещё нативные классы.
const NodeAbortController = globalThis.AbortController
const NodeAbortSignal = globalThis.AbortSignal

const environment: Environment = {
  ...builtinEnvironments.jsdom,
  name: 'jsdom-node-abort',
  async setup(global, options) {
    const jsdom = await builtinEnvironments.jsdom.setup(global, options)
    const target = global as unknown as Record<string, unknown>
    target.AbortController = NodeAbortController
    target.AbortSignal = NodeAbortSignal
    return jsdom
  },
}

export default environment
