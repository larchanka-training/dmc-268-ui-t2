import { reviewFindingsPath } from '@/entities/finding/model/paths'
import type { Finding, FindingWire } from '@/entities/finding/model/types'
import { parseFinding } from '@/entities/finding/model/types'
import { getEveryPage } from '@/shared/api/http'

/** OpenAPI `Limit` maximum: findings are capped per run, so this is usually one request. */
const FINDINGS_PAGE_LIMIT = 100

export async function fetchReviewFindings(reviewId: string): Promise<Finding[]> {
  const items = await getEveryPage<FindingWire>(reviewFindingsPath(reviewId), FINDINGS_PAGE_LIMIT)
  return items.map(parseFinding)
}
