# Proposal: MSW stubs for bot-connect and Start review

**Status:** DECIDED mock design, implemented (uncommitted) on feat/bot-connect-check-access  
**Date:** 2026-11-02  
**Repo:** `dmc-268-ui-t2` — `docs/proposals/` + `src/app/msw/`.

Product behaviour for Check access and Start review is decided in [github-bot-connect-proposal.md](./github-bot-connect-proposal.md) and is present (uncommitted) on branch `feat/bot-connect-check-access`. This proposal does **not** reopen product rules. It closes the **dev mock** gap so `pnpm dev` (MSW on) can exercise those UI paths without a live API.

Evaluated against the worktree (2 Nov 2026): baseline corrected; simulate-headers replaced with **clickable** seed/PR triggers.

## What already happens

MSW starts in [src/app/msw/browser.ts](../../src/app/msw/browser.ts) and registers auth, repos, review, and insights handlers.

**Connect (repos store):** [repos-store.ts](../../src/app/msw/repos-store.ts) seeds three available repos (`external_id` 1001–1003). Connected ids are `connected-{external_id}`. `POST /api/v1/repositories/connect` succeeds (201/200) when the seed exists. Unknown seed → bodyless **422**. It never returns `BOT_ACCESS_REQUIRED`, `SERVICE_UNAVAILABLE`, or invite body fields.

**PR list:** `GET /api/v1/repositories/:id/pull-requests` returns `MOCK_PULL_REQUESTS` only when `:id === MOCK_REPOSITORY_ID` (`connected-1001`). After connecting 1001 via the store, ids match; 1002/1003 get 404 on the list.

**Start review:** No `POST …/pull-requests/:number/reviews` handler. The Start review button fails in mock mode.

**Review read path:** `GET /api/v1/reviews/:id` (+ findings/diff) serves `MOCK_REVIEWS`. That stays. Every review fixture has `repository_id: connected-1001`; the detail page re-lists PRs for that id.

**Unit tests:** Vitest stubs `fetch` for Connect / Start UI. MSW is for **browser demo** plus thin handler/store tests. Do not require MSW for those unit tests.

**Contract note:** `BOT_ACCESS_REQUIRED`, `INTEGRATION_UNHEALTHY`, `bot_login`, and `access_url` are **not** yet in API `openapi.yaml` on product main (`Error.additionalProperties: false`). MSW follows the bot-connect proposal / feature branch shapes. Do not claim OpenAPI parity for those codes until the API lands them.

**Out of scope:** real GitHub, live API, `auto_start`, expanding `MockPullRequestDataSource` (Start uses HTTP), teaching MSW to proxy upstream.

## What to change, and why

| Change | Why |
|---|---|
| Seed **1002** (`web-dashboard`): Connect attempt counter. Attempt 1 → `409` with `code: BOT_ACCESS_REQUIRED`, `bot_login: "dmc-bot-msw"`, `access_url: "https://github.com/acme/web-dashboard/settings/access"`, safe `message`, plus `request_id` / `retryable` / `retry_after`. Attempt 2+ → 201 connect. `resetRepositoryStore()` clears the counter. | Clickable invite → Check again. Demo fiction (not GitHub invite timing). |
| Seed **1003** (`worker-jobs`): every Connect → `503 SERVICE_UNAVAILABLE` (no invite fields). Never connect. | Clickable misconfigured-bot copy. |
| Seed **1001**: unchanged happy Connect. | Default demo path. |
| `GET …/pull-requests`: return `MOCK_PULL_REQUESTS` when `:id === MOCK_REPOSITORY_ID` **or** `:id` is a connected id in the store; else 404 `RESOURCE_NOT_FOUND`. | List works after connect; review detail still resolves PRs via `connected-1001`. |
| Add `POST …/pull-requests/:number/reviews` + route constant `REPOSITORY_PULL_REQUEST_REVIEWS_ROUTE` in `paths.ts`. | Start review works in MSW. |
| Success body: `202` + `Location` + `{ review_id, status: "QUEUED", resource_url }` (OpenAPI startReview shape). Map PR number → fixture review id (below). | Navigation to `/reviews/{id}` loads fixtures. |
| Reserved PR **#999** (add one OPEN wire to `MOCK_PULL_REQUESTS` or MSW-only list overlay): Start → `409 INTEGRATION_UNHEALTHY`. Do not steal #42/#43/#44 happy/skipped/fetching demos. | Clickable unhealthy Start copy. |
| Auth: no session → 401; bad CSRF → 403; missing `Idempotency-Key` → 422 `VALIDATION_FAILED`. | Match connect mutation posture. |
| Idempotency map (same key + same body → 200 replay; same key + different `requested_head_sha` → 409 `IDEMPOTENCY_CONFLICT`): **handler tests only** — UI sends a new key every click. | Spec completeness without fake browser AC. |
| Extend MSW `apiError` helper to allow extra fields (`bot_login`, `access_url`) and set `retryable` when needed. | Invite body reaches the UI. |

### Review id map (export from fixtures if private today)

| PR # | `review_id` | Notes |
|---|---|---|
| 42 | `MOCK_DEFAULT_REVIEW_ID` (`9b2f4c1e-3a7d-4e8b-b6c5-1d0f2a9e8c42`) | COMPLETED; primary demo |
| 43 | `5e8a1d3c-7b2f-4c9e-a1d4-6f3b8e2c0a43` | SKIPPED fixture |
| 44 | `c4d7e2a9-1f6b-4a3e-9d8c-2b5e7f1a0c44` | FETCHING_DIFF; no SSE → stays loading |
| 999 | — | No success; always `INTEGRATION_UNHEALTHY` |

**Known mock limit:** fixtures keep `repository_id: connected-1001` even if Start was clicked from `connected-1002`. Acceptable for MSW.

## What not to do

- Do not use `X-MSW-Simulate` (or any header the UI does not send) in Acceptance / primary demo path.
- Do not call GitHub or the real API from MSW.
- Do not delete Vitest fetch stubs.
- Do not block product PRs solely on MSW; this may land on the same feature branch for convenience.

## Order

0. Export fixture review ids as needed; add `REPOSITORY_PULL_REQUEST_REVIEWS_ROUTE`.
1. repos-store counters + connect handler for 1002 / 1003; extend `apiError`.
2. Broaden PR list handler; add PR #999 for unhealthy Start.
3. startReview POST handler (auth/CSRF/idempotency + review id map).
4. Thin store/handler tests; manual smoke (click-only AC below).

## Acceptance (click-only unless noted)

1. Connect **1001** → `/repos` → Pull requests → Start on **#42** → `/reviews/9b2f…` loads completed review.
2. Connect **1002** once → invite UX (bot login + https link + Check again); Check again → connected and listed.
3. Connect **1003** → 503 server-config copy; no invite link; not connected.
4. After any connected repo’s PR list, Start on **#999** → unhealthy alert; stay on list.
5. Handler tests: missing CSRF → 403; missing Idempotency-Key → 422; connecting only 1002 then Start #42 still loads review (proves `MOCK_REPOSITORY_ID` fallback on PR GET for detail).
6. `pnpm validate` still green; auth/`/me` handlers unchanged.
