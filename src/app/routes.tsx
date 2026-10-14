import { Navigate, type RouteObject } from 'react-router'
import { MOCK_DEFAULT_PR_ID } from '@/entities/pull-request'
import { RouteError, RouteNotFound } from '@/pages/not-found'
import { PullRequestPage } from '@/pages/pull-request'

/**
 * Декларация маршрутов (data router). Данные страница грузит сама через TanStack Query,
 * поэтому `loader`-ов нет: кэш, дедупликация и состояния loading/error уже есть в Query.
 */
export const appRoutes: RouteObject[] = [
  { path: '/', element: <Navigate to={`/pulls/${MOCK_DEFAULT_PR_ID}`} replace /> },
  { path: '/pulls/:prId', element: <PullRequestPage />, errorElement: <RouteError /> },
  { path: '*', element: <RouteNotFound />, errorElement: <RouteError /> },
]
