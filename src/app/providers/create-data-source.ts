import {
  ApiPullRequestDataSource,
  MockPullRequestDataSource,
  type PullRequestDataSource,
} from '@/entities/pull-request'

/** Источник данных выбирается флагом `VITE_DATA_SOURCE=mock|api` (по умолчанию mock). */
export function createDataSource(): PullRequestDataSource {
  return import.meta.env.VITE_DATA_SOURCE === 'api' ? new ApiPullRequestDataSource() : new MockPullRequestDataSource()
}
