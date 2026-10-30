# Repository analytics and review audit (#31)

The authenticated `/analytics` and `/audit` pages use the repository insights API. The URL retains `repository=<opaque ID>` and `days=7|30|90`; audit additionally retains the analysis `status`. Changing any filter starts a separate query. Audit loads cursor pages on demand. Query caches are isolated by authenticated user, repository and filters. HTTP 401 rechecks the session; access errors hide previously loaded results.

## Data meaning

- Analytics aggregates are calculated by the API. The browser does not fetch every review or infer metrics from one page of results.
- Categories remain Security, Bug (the API's `correctness`), Performance and Maintainability. Maintainability is not silently renamed Style; the present API has no Style category.
- Dates and chart buckets are UTC. Categories can be toggled in the chart; the table always exposes all source counts, including zero values.
- Average duration uses `finished_at - started_at` for completed and partial reviews, excludes queue time, and shows the contributing sample count. A missing measurement displays “Not available”. Findings are counted per review run, including repeated runs; this is not a deduplicated count of unique bugs.
- Audit identifies the recorded trigger actor, not the PR author. Missing actors remain unknown. Analysis and publication statuses are separate.
- Input/output tokens are measured usage. `incomplete` means that some attempts have unknown actual usage; known totals must not be treated as the complete bill. Reservations are shown separately. Missing measurements are not zero.
- Persisted `file_limit`, `line_limit` and `token_budget` coverage reasons display a partial-analysis warning. These do not claim that the entire PR was rejected.
- Current quotas show the user's hourly starts in that repository and repository-wide active jobs. A zero configured limit disables starts; otherwise exhaustion identifies the reset time or the need to wait for running reviews.

**Accepted scope decision:** only existing start constraints are implemented. Daily token policy and monetary cost remain dependencies of [issue #28](https://github.com/larchanka-training/dmc-268-ui-t2/issues/28). Their unavailable states are explicit. This slice does not introduce prices, billing, a daily counter or limit editing.

## API

The canonical schemas and authorization checks are in API `openapi.yaml`:

- `GET /api/v1/repositories/{id}/analytics?days=30`
- `GET /api/v1/repositories/{id}/reviews?days=30&limit=20&status=PARTIAL&cursor=...`
- `GET /api/v1/repositories/{id}/quotas`

All requests use same-origin cookies. These pages do not trigger reviews, spend tokens or mutate limits. Review links use the existing `/reviews/:reviewId` route. This branch is stacked on UI PR #37 to reuse its HTTP review client; it does not duplicate that client or include the separate SSE work in PR #27. Review, PR metadata, diff and findings caches are also scoped to the authenticated user.

## Local demo and verification

Development starts MSW automatically. Log in, connect repositories, then open Analytics/Audit:

- `acme/payments-api`: populated chart and audit with a second cursor page; includes coverage warnings and unknown token/actor examples.
- `acme/web-dashboard`: empty period.
- `acme/worker-jobs`: hourly and active-job limits exhausted.

Repository connections are the existing in-memory MSW store; a full reload resets that store. Demo data is synthetic and is not evidence of live API acceptance. Production builds do not start MSW.

Run `pnpm validate` for lint, stylelint, formatting, TypeScript, Vitest and build. Component tests exercise filters, chart toggles, missing values, pagination, session changes, access revocation, coverage warnings and quota states through rendered pages and mocked HTTP. On resource-constrained machines the equivalent test command is `pnpm test --maxWorkers=1`.

For live acceptance, use a same-origin API deployment with MSW disabled and a repository accessible to the session. Compare metrics and audit rows to saved runs; check unknown usage and a limited-coverage run; verify the user cannot read another repository; test desktop/mobile layout, keyboard chart toggles and the audit-to-review link. Do not run new paid analysis merely to test these read-only pages.
