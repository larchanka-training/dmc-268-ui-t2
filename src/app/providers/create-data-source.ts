import { ApiPullRequestDataSource, type PullRequestDataSource } from '@/entities/pull-request'

/**
 * Same idea as repos/session: always the HTTP client.
 * Dev MSW answers `/api/v1` fetches; production nginx proxies to the real API.
 * In-memory `MockPullRequestDataSource` stays for tests that inject it.
 */
export function createDataSource(): PullRequestDataSource {
  return new ApiPullRequestDataSource()
}
