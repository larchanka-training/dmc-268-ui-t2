/** Non-2xx response from the same-origin `/api/v1` backend. */
export class ApiHttpError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `API request failed (${status})`)
    this.name = 'ApiHttpError'
    this.status = status
  }
}

/** GET with the session cookie; throws `ApiHttpError` on non-2xx. */
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' })
  if (!response.ok) {
    throw new ApiHttpError(response.status)
  }
  return (await response.json()) as T
}

/** Reads every page of an OpenAPI cursor list (`items` + `next_cursor`). */
export async function getEveryPage<TWire>(path: string, limit: number): Promise<TWire[]> {
  const items: TWire[] = []
  let cursor: string | null = null
  do {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor !== null) {
      params.set('cursor', cursor)
    }
    const page: { items: TWire[]; next_cursor: string | null } = await getJson(`${path}?${params.toString()}`)
    items.push(...page.items)
    cursor = page.next_cursor
  } while (cursor !== null)
  return items
}
