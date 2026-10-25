import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { appRoutes } from '@/app/routes'
import { DataSourceProvider, type PullRequestDataSource } from '@/entities/pull-request'
import { meQueryKey, type Me } from '@/entities/session'
import { createFakeDataSource } from '@/test/fake-data-source'
import { TEST_REVIEW_PATH } from '@/test/fixtures'

export const fakeMe: Me = {
  user: { id: 'user-1', provider: 'github', externalId: '1', login: 'ada' },
  session: { expiresAt: '2999-01-01T00:00:00Z' },
  csrfToken: 'csrf',
}

export interface RenderWithRouterOptions {
  dataSource?: PullRequestDataSource
  routes?: RouteObject[]
  /** Сессия, уже лежащая в кэше `/me`; `null` — не засевать (запрос уйдёт в fetch). */
  session?: Me | null
}

/**
 * Рендерит реальные маршруты приложения в MemoryRouter-е (data router)
 * с заданным начальным URL, тестовым источником данных и засеянной сессией (RequireAuth пропускает).
 */
export function renderWithRouter(
  initialEntry = TEST_REVIEW_PATH,
  { dataSource = createFakeDataSource(), routes = appRoutes, session = fakeMe }: RenderWithRouterOptions = {},
) {
  const user = userEvent.setup()
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: session ? Infinity : 0 } },
  })
  if (session) queryClient.setQueryData(meQueryKey, session)

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider dataSource={dataSource}>
        <RouterProvider router={router} />
      </DataSourceProvider>
    </QueryClientProvider>,
  )

  return { ...utils, user, router, queryClient, dataSource }
}
