/** Same-origin API paths under `/api/v1` (reviews contract SoT: API `openapi.yaml`). */
const API_V1 = '/api/v1'

export const reviewPath = (reviewId: string) => `${API_V1}/reviews/${encodeURIComponent(reviewId)}`
export const reviewFindingsPath = (reviewId: string) => `${reviewPath(reviewId)}/findings`
export const reviewDiffPath = (reviewId: string) => `${reviewPath(reviewId)}/diff`
export const repositoryPullRequestsPath = (repositoryId: string) =>
  `${API_V1}/repositories/${encodeURIComponent(repositoryId)}/pull-requests`

/** Шаблоны маршрутов для MSW. */
export const REVIEW_ROUTE = `${API_V1}/reviews/:id`
export const REVIEW_FINDINGS_ROUTE = `${REVIEW_ROUTE}/findings`
export const REVIEW_DIFF_ROUTE = `${REVIEW_ROUTE}/diff`
export const REPOSITORY_PULL_REQUESTS_ROUTE = `${API_V1}/repositories/:id/pull-requests`
