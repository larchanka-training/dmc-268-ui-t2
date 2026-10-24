import { reviewPath } from '@/entities/review/model/paths'
import type { ReviewDetail, ReviewDetailWire } from '@/entities/review/model/types'
import { parseReviewDetail } from '@/entities/review/model/types'
import { getJson } from '@/shared/api/http'

export async function fetchReview(reviewId: string): Promise<ReviewDetail> {
  return parseReviewDetail(await getJson<ReviewDetailWire>(reviewPath(reviewId)))
}
