import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { appRoutes } from '@/app/routes'
import { DataSourceProvider, type PullRequestDataSource } from '@/entities/pull-request'
import { createFakeDataSource } from '@/test/fake-data-source'

export interface RenderWithRouterOptions {
  dataSource?: PullRequestDataSource
  routes?: RouteObject[]
}

/**
 * Рендерит реальные маршруты приложения в MemoryRouter-е (data router)
 * с заданным начальным URL и тестовым источником данных.
 */
export function renderWithRouter(
  initialEntry = '/pulls/42',
  { dataSource = createFakeDataSource(), routes = appRoutes }: RenderWithRouterOptions = {},
) {
  const user = userEvent.setup()
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider dataSource={dataSource}>
        <RouterProvider router={router} />
      </DataSourceProvider>
    </QueryClientProvider>,
  )

  return { ...utils, user, router, queryClient, dataSource }
}
