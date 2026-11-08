import { Component, type ErrorInfo, type ReactNode } from 'react'

interface BlockErrorBoundaryProps {
  children: ReactNode
}

interface BlockErrorBoundaryState {
  failed: boolean
}

/**
 * Локализует падение отдельного блока интерфейса: вместо белого экрана
 * показывает заглушку и не роняет соседние блоки. Общая реализация для
 * инженеров 1 и 2 (спринт 5, issue #40) — оборачивайте любой блок:
 *
 * <BlockErrorBoundary><Playground /></BlockErrorBoundary>
 */
export class BlockErrorBoundary extends Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  state: BlockErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): BlockErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('BlockErrorBoundary caught an error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center"
        >
          <p className="text-sm text-muted-foreground">Не удалось загрузить этот блок, обновите страницу</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent/60 focus-visible:outline focus-visible:outline-2"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
