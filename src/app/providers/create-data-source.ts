import {
  ApiPullRequestDataSource,
  MockPullRequestDataSource,
  type PullRequestDataSource,
} from '@/entities/pull-request'

/**
 * Источник данных выбирается флагом `VITE_DATA_SOURCE=mock|api` (по умолчанию mock).
 * В dev режим `api` обслуживает MSW (`reviewHandlers`) теми же wire-фикстурами.
 */
export function createDataSource(): PullRequestDataSource {
  return import.meta.env.VITE_DATA_SOURCE === 'api' ? new ApiPullRequestDataSource() : new MockPullRequestDataSource()
}
