import { type RouteObject } from 'react-router'
import { AuthenticatedShell } from '@/app/guards/AuthenticatedShell'
import { RootRedirect } from '@/app/guards/RootRedirect'
import { ConnectRepoPage } from '@/pages/connect-repo'
import { LoginPage } from '@/pages/login'
import { OnboardingPage } from '@/pages/onboarding'
import { RouteError, RouteNotFound } from '@/pages/not-found'
import { RepositoryPullRequestsPage } from '@/pages/repo-pull-requests'
import { OAuthCallbackPage } from '@/pages/oauth-callback'
import { PullRequestPage } from '@/pages/pull-request'
import { ReposPage } from '@/pages/repos'
import { AnalyticsPage } from '@/pages/analytics'
import { AuditPage } from '@/pages/audit'
import { ReviewsPage } from '@/pages/reviews'
import { RepositorySettingsPage } from '@/pages/repository-settings'

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
    // Падение любой страницы внутри шелла (или самого шелла) — стилизованный 500, не дефолтный стек роутера.
    errorElement: <RouteError />,
    children: [
      { path: '/repos', element: <ReposPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/audit', element: <AuditPage /> },
      { path: '/repos/connect', element: <ConnectRepoPage /> },
      { path: '/repos/:repositoryId/pull-requests', element: <RepositoryPullRequestsPage /> },
      { path: '/repos/:repositoryId/settings', element: <RepositorySettingsPage /> },
      { path: '/reviews', element: <ReviewsPage /> },
      { path: '/reviews/:reviewId', element: <PullRequestPage />, errorElement: <RouteError /> },
    ],
  },
  { path: '*', element: <RouteNotFound />, errorElement: <RouteError /> },
]
