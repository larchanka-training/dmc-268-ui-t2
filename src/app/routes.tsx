import { Navigate, type RouteObject } from 'react-router'
import { AuthenticatedShell } from '@/app/guards/AuthenticatedShell'
import { RootRedirect } from '@/app/guards/RootRedirect'
import { MOCK_DEFAULT_PR_ID } from '@/entities/pull-request'
import { ConnectRepoPage } from '@/pages/connect-repo'
import { LoginPage } from '@/pages/login'
import { RouteError, RouteNotFound } from '@/pages/not-found'
import { OAuthCallbackPage } from '@/pages/oauth-callback'
import { PullRequestPage } from '@/pages/pull-request'
import { ReposPage } from '@/pages/repos'

/**
 * Декларация маршрутов (data router). Данные страница PR грузит сама через TanStack Query,
 * поэтому `loader`-ов нет: кэш, дедупликация и состояния loading/error уже есть в Query.
 */
export const appRoutes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <OAuthCallbackPage /> },
  {
    element: <AuthenticatedShell />,
    children: [
      { path: '/repos', element: <ReposPage /> },
      { path: '/repos/connect', element: <ConnectRepoPage /> },
      { path: '/review', element: <Navigate to={`/pulls/${MOCK_DEFAULT_PR_ID}`} replace /> },
      { path: '/pulls/:prId', element: <PullRequestPage />, errorElement: <RouteError /> },
    ],
  },
  { path: '*', element: <RouteNotFound />, errorElement: <RouteError /> },
]
