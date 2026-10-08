# AI Code Reviewer — System Design

Team 2 · Larchanka · Tech Lead: Narek Meliksetyan  
Version: 1.3 · October 8, 2026 · Status: Sprint 2 synchronization pending team review

## 1. Purpose and decision status

This document defines the AI code reviewer architecture and the contracts between frontend, backend, background processing, VCS integrations, and the LLM. Detailed module, UI, and test design belongs in the team's specialized documents.

- **Requirement** — explicitly follows from the assignment or recorded team materials.
- **v1 decision** — a proposal selected here to form a coherent MVP; it becomes an implementation contract after team approval.
- **Open question** — requires external confirmation or a team decision and is listed in section 16.

Unless stated otherwise, concrete limits and MVP restrictions are v1 decisions. The Definition of Done also requires this document to be committed and approved by the team.

### Sprint 2 contract precedence

This revision incorporates the contract foundation accepted in [API PR #21](https://github.com/larchanka-training/dmc-268-api-t2/pull/21). This document owns the system overview; detailed implementation contracts have one source in the API repository:

- [openapi.yaml](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/openapi.yaml): HTTP routes, DTOs, authentication, and safe errors.
- [PIPELINE_SPEC.md](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/docs/PIPELINE_SPEC.md): status-only lifecycle, retries/degradation, Redis delivery, leases, and publication recovery.
- [schemas/](https://github.com/larchanka-training/dmc-268-api-t2/tree/main/schemas): versioned context, model output, backend result, settings, and queue envelopes.
- [BACKEND_ERD.md](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/docs/BACKEND_ERD.md): physical persistence and migration invariants.

Those contracts take precedence in their respective areas; do not fork their schemas or infer runtime readiness from their existence. [Sprint 2 handoff](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/docs/sprint2-contract-handoff.md) identifies consumer adaptations and task boundaries.

## 2. Goals, requirements, and scope

The system obtains PR/MR changes from a VCS, builds relevant context, uses an LLM to analyze security, correctness, performance, and maintainability, validates the response, and produces a summary and diff-linked findings. Context has four levels: Diff, Surrounding Context, Whole File, and AST / Imports. Cost/context limits, retries, caching, and clear status are required.

The team board proposes a GitHub bot and reviewer-assignment trigger, access/quota checks, JWT, network segmentation, React/TypeScript, FastAPI/Python, SQLAlchemy/PostgreSQL, and Ollama SDK. The current Sprint 2 scope is GitHub-only with a Redis-backed task queue; the worker framework is not fixed by the contract. GitLab remains a later iteration. The model and paid subscription mechanism are undecided.

### MVP boundary — v1 decision

| Included | Excluded without a separate decision |
|---|---|
| GitHub PRs; adapter contract can support GitLab | Both VCS implementations at once |
| Product UI launch; bot trigger after feasibility validation | Every-push launch, quick actions, arbitrary mentions |
| Access and technical quota checks | Payments, billing, token purchases |
| PR summary/inline findings; runs, diff, results in UI | Full GitLab-like UI and agent chat |
| Python and TypeScript/TSX AST context | Full-repository indexing, external RAG, every language |
| Reading code and publishing comments | Running PR code, changing branches, auto-merge, applying fixes |
| Run continues independently of UI session | User cancellation of an accepted run |

Text recommendations are sufficient; applicable suggestions are optional. Reviews are advisory and do not replace tests, linters, SAST, or human approval.

### Current implementation

This is the **target MVP**, not a claim that all components exist. Baseline is each repository's `main`.

| Area | In `main` | Still required |
|---|---|---|
| Backend | Python 3.14, FastAPI, async SQLAlchemy/asyncpg, Alembic, PostgreSQL 18, Redis 8, domain persistence/ports, contract foundation, structlog, Request ID, Docker | HTTP/auth/VCS handlers, Redis dispatcher/workers, Context Builder, Ollama gateway, Publisher |
| Frontend | Vite + React + TypeScript, mock review page/Diff Viewer | Real auth, repository/PR selection, launch/history, progress/coverage, diff/findings API integration |
| Delivery | API/UI CI and image workflows, UI-triggered API deployment workflow | Verified target deployment/HTTPS, runtime workers/Ollama, backup/restore, metrics |

Baseline checked for this synchronization: API [`bfe4876`](https://github.com/larchanka-training/dmc-268-api-t2/commit/bfe48760bba7a40a627fde774f799a802d89b1d0), UI [`546f7f3`](https://github.com/larchanka-training/dmc-268-ui-t2/commit/546f7f3). Open Gateway [API PR #18](https://github.com/larchanka-training/dmc-268-api-t2/pull/18) and mock-only OAuth/App Shell [UI PR #17](https://github.com/larchanka-training/dmc-268-ui-t2/pull/17) still require contract adaptation; they are not part of these baselines.

## 3. Architecture and responsibilities

```mermaid
flowchart TD
    User["Developer"] --> Browser["React UI in browser"]
    Browser -->|HTTPS: UI and /api| Proxy["Reverse proxy / HTTPS"]
    GH["GitHub API"] -->|Webhook HTTPS| Proxy
    Proxy --> Static["React UI static assets"]
    subgraph Private["Private application network"]
        Proxy --> API["FastAPI API"]
        API --> DB[("PostgreSQL")]
        API --> Cache[("Redis")]
        Dispatch["Dispatcher / recovery"] --> DB
        Dispatch --> Cache
        Cache --> Analyze["Analyze worker"]
        Cache --> Publish["Publish worker"]
        Analyze --> DB
        Analyze --> Cache
        Analyze --> LLM["Ollama"]
        Publish --> DB
    end
    API --> GH
    Analyze --> GH
    Publish --> GH
```

| Component | Responsibility | Excludes |
|---|---|---|
| React UI | Repositories/PRs, launch, history, progress, diff, findings | Secrets, context construction, authorization decisions |
| FastAPI | Auth, webhooks, admission control, user API | Long review work in HTTP |
| Dispatcher/recovery | Outbox delivery, delayed retry, stale-task recovery, TTL cleanup | Code analysis |
| Background workers | Analyze orchestration and separate publication; framework selected by API #13 | Queue as source of state |
| PostgreSQL | Runs, results, settings/access, outbox, leases, quotas, saved context | Permanent source retention |
| Redis | Small acknowledged task envelopes, rate limiting, hot TTL context/blob cache | Authoritative jobs/results/quotas/idempotency/leases; full diff, prompt, result in queue |
| Ollama | Inference | VCS, DB, or secret access |

All backend processes share one project/image and domain model; they are not microservices. PostgreSQL outbox/job/lease state is authoritative. Redis enqueue acknowledgement is not job completion and Redis contains no irreplaceable domain state; queue degradation blocks dispatch, not stored-result reads.

```mermaid
flowchart TD
    Entry["HTTP/background handlers"] --> App["Application use cases"]
    App --> VCS["VCS adapter"]
    App --> Context["Context Builder"]
    Context --> VCS
    Context --> Gateway["LLM gateway"]
    Gateway --> Validate["Validator / deduplication"]
    App --> Publisher["Publisher"]
    Validate --> Publisher
    Publisher --> VCS
    App --> Store["Repositories / PostgreSQL"]
```

The application layer controls sequencing. Repositories only persist. Adapters hide provider APIs. The gateway owns prompts, serialization, limits, and timeouts, but not publication policy. Context construction is deterministic and bounded; v1 has no autonomous tool loop.

## 4. Main flow and lifecycle

```mermaid
sequenceDiagram
    participant Source as UI / webhook
    participant API
    participant DB as PostgreSQL
    participant Worker as Dispatcher / worker
    participant GH as GitHub
    participant LLM as Ollama
    Source->>API: Request review
    API->>API: Authenticity, access, quota, deduplication
    API->>DB: ReviewJob + OutboxEvent transaction
    API-->>Source: 202 + review_id
    Worker->>DB: Deliver outbox and acquire lease
    Worker->>GH: Snapshot and blobs by SHA
    Worker->>LLM: Bounded model calls
    Worker->>DB: Validated results and coverage
    Worker->>DB: Publication outbox
    Worker->>GH: Freshness check and publication
    Worker->>DB: Publication outcome
```

Job/quota creation is atomic and HTTP never waits for the model. Worker revalidates access, fixes the requested SHA snapshot, builds four context levels/chunks, validates model output, and saves completed chunks independently. Analysis and publication are separate: publication failure never repeats inference.

`ReviewJob.status`: `QUEUED → FETCHING_DIFF → PARSING_CONTEXT → LLM_PROCESSING → COMPLETED | PARTIAL | FAILED | SKIPPED`. `COMPLETED` means all eligible scoped changes were processed; `PARTIAL` has useful but incomplete coverage; `FAILED` has no usable result or mandatory trustworthy input; `SKIPPED` is an intentional non-run caused by a lifecycle condition. Policy exclusions appear in coverage but do not cause `PARTIAL`.

There is no current/public `stage`. Validation is internal to `LLM_PROCESSING`. Progress is completed/planned chunks. Retryable failures preserve the current active status and set `retry_at` within the accepted deadline. `ReviewEvent.phase` records a nullable active phase for audit, not a second lifecycle field; public events do not expose phase/attempt/safe_details. Every terminal transition sets status and `finished_at` in the same SQL update or ORM flush; terminal jobs are never silently reopened.

`publication_status`: `NOT_READY`, `PENDING`, `PUBLISHED`, `PARTIAL`, `FAILED`, `UNKNOWN`, `SKIPPED`, independent of analysis.

```mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> FETCHING_DIFF: acquired
    QUEUED --> FAILED: queue deadline exceeded
    FETCHING_DIFF --> PARSING_CONTEXT: trustworthy snapshot
    FETCHING_DIFF --> FETCHING_DIFF: retry_at
    FETCHING_DIFF --> FAILED: no trustworthy input
    FETCHING_DIFF --> SKIPPED: stale/closed PR
    PARSING_CONTEXT --> LLM_PROCESSING: bounded context
    PARSING_CONTEXT --> PARSING_CONTEXT: retry_at
    PARSING_CONTEXT --> FAILED: no usable context
    PARSING_CONTEXT --> SKIPPED: no eligible changes
    LLM_PROCESSING --> LLM_PROCESSING: retry_at
    LLM_PROCESSING --> COMPLETED: full coverage
    LLM_PROCESSING --> PARTIAL: useful partial coverage
    LLM_PROCESSING --> FAILED: no usable result
```

```mermaid
stateDiagram-v2
    [*] --> NOT_READY
    NOT_READY --> PENDING: analysis COMPLETED/PARTIAL
    NOT_READY --> SKIPPED: analysis FAILED/SKIPPED
    PENDING --> PUBLISHED: complete confirmed
    PENDING --> PARTIAL: partial confirmed
    PENDING --> FAILED: absence confirmed
    PENDING --> UNKNOWN: write outcome unknown
    FAILED --> PENDING: authorized manual retry
    UNKNOWN --> PUBLISHED: operator reconciliation
    UNKNOWN --> PARTIAL: operator reconciliation
    UNKNOWN --> FAILED: absence confirmed
```

`UNKNOWN` stops automatic retries until operator reconciliation. Transitions, reasons, and fencing tokens are recorded. Duplicate delivery continues the same run; explicit rerun creates a new run with `rerun_of`. A push alone does not launch proposed v1.

## 5. VCS integration and immutable snapshot

GitHub uses a GitHub App limited to selected repositories, with metadata/contents read and pull-request read/write permissions. `POST /api/v1/webhooks/github` verifies the raw-body signature and deduplicates by delivery ID. Unknown events return 2xx without creating jobs. The `pull_request/review_requested` bot scenario must be tested.

| Adapter operation | Input | Output / guarantee |
|---|---|---|
| Get PR | repository, number | State, title/body, author, source/base repositories/refs/SHA |
| Get diff snapshot | PR, fixed SHA | Files, hunks, line map, completeness |
| Read blob/tree | repository, SHA, path | Exact-version content within limit |
| Get discussions | PR, cursor | IDs, author, body, coordinates, commit |
| Publish/reconcile | Snapshot, validated result, marker | Remote IDs, typed error, or unknown outcome |

`Snapshot` contains repository IDs, `base_sha`, `merge_base_sha`, `head_sha`, `captured_at`, and provider diff version. Review covers `merge_base_sha…head_sha`; all reads use SHA, never branch names.

For fork PRs, metadata/files/patch come through the base repository and head is resolved as `refs/pull/{number}/head`. Direct source access requires installation permission. If a full blob is unavailable, level 1 may remain while levels 2–4 are marked unavailable; without a trustworthy diff the run fails. Private-fork support requires an integration test.

Pagination is mandatory. Missing/truncated patches are reconstructed from fixed blobs within limits or reported incomplete. Current-state APIs are SHA-checked before/after. Publication rechecks open state, head/base SHA, app access, and initiator rights; stale results remain in history but are not published.

| Domain | GitHub v1 | Future GitLab |
|---|---|---|
| Change request | PR number | MR IID |
| Discussion | reviews/comments | discussions/notes |
| Diff version | base/merge-base/head | base/start/head |
| Inline location | commit, path, side/line | position with three SHA, old/new path/line |
| Summary | COMMENT review body | note/discussion with same marker |

Provider-specific coordinates live in snapshot/publication metadata. GitLab implementation is outside v1.

## 6. Context Builder

`ContextPayload` is a versioned one-chunk package with `schema_version`, review/chunk IDs, snapshot, metadata, files, related symbols, coverage, and budget. Ranges are inclusive and 1-based; missing sides are `null`; paths are normalized.

| Level | Structure | Rule |
|---|---|---|
| Diff | `FileDiff` paths/status/blob SHA/language/hunks; hunk line kind/text/old/new line | Required exact line map |
| Surrounding | `SourceWindow` path/side/SHA/range/text/hunk IDs | ±30 default; merged overlaps; prefer bounded function |
| Whole File | path/side/SHA/text/changed ranges | New file ≤300 lines; old for deletion; budgeted |
| AST / Imports | symbol/name/kind/signature/path/SHA/range/relation/excerpt | Python/TS, depth 1, ≤20 symbols and 10 files |

Canonical schemas are checked into the API repository. Required context types include integer schema version, string opaque IDs/SHA/paths, nonempty `files`, diff status enum, line kind enum, `OLD/NEW` side, nullable required `whole_file`, 1-based ranges, and `full/degraded/diff_only` coverage. A zero-length hunk side may start at zero; nonempty sides start at one or later. Structural validation is followed by semantic checks for ordered ranges, hunk counts, and exact contiguous old/new coordinates. Skipped reasons are `policy`, `unsupported_language`, `unavailable_blob`, `provider_truncated`, `token_budget`, `file_limit`, `line_limit`, `context_error`.

Use the schema-validated [context fixture](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/schemas/examples/context.v1.json) instead of copying a shortened envelope into another document. The backend assembles `schema_version`, `review_id`, and `chunk_id` from authoritative columns; persisted `payload_body` excludes those fields. Discussions are objects, file language is nullable, and frozen legacy output language is retained.

Frontend receives API projections, not prompt payloads. Tree-sitter parses Python/TS; a resolver handles local Python and relative TS imports. Unresolved/dynamic/external symbols are marked, never invented.

```mermaid
flowchart LR
    Diff["Snapshot diff"] --> Filter["Filter / ignore"]
    Filter --> Priority["Prioritize"]
    Priority --> Chunks["Group / chunk"]
    Chunks --> L2["L2 windows"]
    Chunks --> L3["L3 whole file"]
    Chunks --> L4["L4 symbols"]
    Cache[("Redis blob cache")] <--> L2
    Cache <--> L3
    Cache <--> L4
    L2 --> Budget["Deduplicate / budget"]
    L3 --> Budget
    L4 --> Budget
    Filter --> Coverage["Coverage / reasons"]
    Budget --> Coverage
    Budget --> Payload["ContextPayload"]
    Coverage --> Payload
    Payload --> PG[("PostgreSQL")]
```

Default policy excludes binaries, known lock files, minified/generated output, `dist/**`, `vendor/**`, snapshots, protobuf-generated files, and recognized generated headers. Migrations remain eligible. Admin-managed policy/overrides are versioned and frozen in each run. Priority is executable code, configuration, documentation. `surrounding_lines=30` is configurable and part of snapshot/cache key.

Small files may share a stable-order chunk. Large blocks split by hunk/range without losing line maps. Reserve instructions, diff, local context, and output before whole-file/symbol context; deduplicate levels 2–4. Budget exhaustion removes low-priority context, moves changes to later chunks, then reports partial coverage. No silent truncation.

Redis caches blobs/derived context by provider, installation/repository, SHA, path, builder/parser/window/rules versions, and relevant metadata hash. PostgreSQL stores final payloads and is authoritative. Authorization is checked on hits; negative VCS results cache ≤1 minute. LLM results are reused only to resume the same run. Cache TTL/eviction is separate from queue delivery/retention policy; queue loss is recovered from PostgreSQL without reviving terminal jobs. Stored-result reads do not require Redis.

## 7. LLM contract and validation

Gateway receives payload, model/version, prompt version, generation settings, and limits; it returns structured `ReviewChunkResult` with summary, findings, limitations, usage, and latency. Raw provider responses never reach frontend.

Gateway supplies the model-only `schemas/llm-output/v1.json` to the provider structured-output API (Ollama `format` for an Ollama adapter), bundling its local Finding reference, uses temperature 0, then performs independent schema/domain validation. The model returns only summary/findings/limitations. Backend maps validated output to `schemas/review-result/v1.json`, adding version, measured latency, and usage only when both token counts are available (otherwise `null`). IDs, fingerprints, lifecycle, and provider provenance are not generated by the model. Use the checked [backend result fixture](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/schemas/examples/review-result.v1.json). Exact model/digest must pass structured-output testing. Schema validity does not prove truth.

Versioned prompts live in backend `.agents/reviewer/` with a manifest and SHA-256 hashes. Trusted repository rules are immutable PostgreSQL versions. Job creation stores exact prompt/rule digests and snapshots; retries never adopt a deployment update. Prompts are not returned or operationally logged.

Finding contract: flat `path`, `side=OLD|NEW`, inclusive `start_line/end_line`; category `security|correctness|performance|maintainability`; severity `critical|high|medium|low`; concise title/explanation, supplied-context evidence, concrete recommendation, and required nullable `proposed_diff_fix`. A suggested diff is never automatically applied. Validator enforces enums, sizes, snapshot paths, and changed-line coordinates. Unpublishable inline locations remain in UI/summary. Unverifiable findings are rejected; exact duplicates merge, semantic guesses do not. `LLM_OUTPUT_INVALID` permits exactly one format-repair attempt within the unchanged analysis deadline. Backend assigns IDs/fingerprints and builds final summary without a mandatory extra LLM call.

## 8. Publication

v1 creates one GitHub `COMMENT` review per run, with summary and ≤20 inline findings. Remaining findings stay in UI. New settings use Russian (`ru`); historical versions retain their actual language, frozen in run configuration. Code/paths/IDs are not translated. Bot never approves or requests changes.

```markdown
<!-- larchanka-ai-review:review_id=rev_01;head_sha=<sha>;schema=1 -->
## AI code review

Snapshot: `<head_sha>` · Coverage: `<reviewed>/<eligible>` · Status: `<COMPLETED|PARTIAL>`

<Summary and severity counts>

Limitations: <none or reasons>
[Open saved result](<review_url>)
```

Marker must be the first fully parsed body line; PR text is never a marker. Publisher leases the PR, checks freshness, searches by marker/app author, and stores remote IDs. Publication retry does not rerun inference.

There is no cross-system exactly-once transaction. After timeout, reconcile remote state. Unknown outcome becomes `UNKNOWN` and stops automatic resend; confirmed partial is `PARTIAL` and is not auto-completed. Retry requires confirmed total absence. Human comments are never changed. Missing findings in later nondeterministic reviews do not mean fixed.

## 9. Queue, idempotency, and recovery

Webhook deduplicates provider+delivery; manual launch requires scoped `Idempotency-Key`, request hash, and 24-hour TTL. Same request returns the prior ID, changed body returns 409. Only one active repository+PR+head+config run exists. Job/quota/outbox creation is transactional. Queue payload contains only schema/event/review IDs, `analyze|publish`, attempt, trace ID. Lease uses owner, expiry, increasing fencing token.

```json
{"schema_version": 1, "event_id": "evt_01", "review_id": "rev_01", "task_kind": "analyze", "attempt": 1, "trace_id": "req_01"}
```

The Redis queue adapter receives only this canonical JSON envelope, validated against `schemas/queue/task-envelope.v1.json`; it never serializes Python objects or raw domain payloads. v1 consumers ignore unknown optional fields, while producers emit only canonical fields. Breaking changes require a new major version/consumer. Unsupported versions, unknown task kinds, and invalid envelopes are rejected before domain work and enter safe quarantine.

| Parameter | v1 |
|---|---|
| Task channels | Separate analyze, publish, and dead-letter channels; concrete Redis transport/framework owned by API #13 |
| Delivery | Acknowledged enqueue before outbox publication mark; at-least-once consumption; ack only after durable processing decision; recovery of unacknowledged/claimed work |
| Size/TTL | JSON ≤16 KiB; large data by review ID; message expiry 20 minutes |
| Consumers | analyze concurrency 1; publish concurrency 4 |
| Quarantine | Seven-day retention; independently versioned safe diagnostic envelope; operator replay only |

Dispatcher locks outbox rows and marks `broker_published_at` only after Redis confirms enqueue. Duplicates are expected and guarded by lifecycle/lease. Recovery recreates eligible delivery when no live lease/progress exists, including message loss after enqueue; PostgreSQL remains authoritative. Application/dispatcher exclusively owns retry; no independent framework autoretry. Recovery runs every 30 seconds, never retries before `retry_at`, but terminally closes expired jobs. Retry requires expired/no lease, reached retry time, remaining deadline/budget. Heartbeat 15 seconds, lease 90 seconds. Every persistence write verifies the current lease/fencing token. External calls happen outside open PostgreSQL transactions. Lost-lease workers cannot save or start external writes.

At most three generic transient attempts per active phase use backoff/jitter/Retry-After. Only `VCS_RATE_LIMITED`, `VCS_UNAVAILABLE`, `LLM_TIMEOUT`, and `LLM_UNAVAILABLE` use generic retry; format repair is separate. Provider retry/failover and worker retry share the analysis deadline and request budget, without multiplying attempts. The whole deployment has one inference through one analyze worker. Horizontal scaling first requires a PostgreSQL lease/semaphore. PostgreSQL reserves durable quotas/active work; Redis carries tasks and protects entry rates.

Dead-letter metadata follows `schemas/queue/dead/v1.json` and never copies raw messages, unknown fields, exceptions, source, prompts, or provider responses. A record without a valid `source_event_id` is diagnostic-only. Operator replay resolves the authoritative PostgreSQL `OutboxEvent`, checks schema/lifecycle/deadlines/lease and equivalent pending work, then creates a new event with a new ID and incremented attempt. Raw dead messages are never replayed; unsupported dead-schema versions are not recursively quarantined. Full error-code/replay rules remain in `PIPELINE_SPEC.md`.

## 10. Data and retention

Core entities: User/RepositoryAccess; versioned Repository settings; mutable ChangeRequest; immutable ReviewJob snapshot/status/config; ContextPayload/ChunkResult; ReviewEvent; Finding; Publication; OutboxEvent/TaskLease; WebhookReceipt/IdempotencyRecord; QuotaUsage. Typed columns hold IDs, states, relationships, and constraints; versioned context/coverage/provider metadata may use JSONB.

Quota units are hourly `starts` scoped by user+repository and repository `active_jobs`; retries do not charge again. Reservation/release are idempotent. Alembic owns migrations. Job settings never change mid-run.

Retention: Redis cache ≤24h and 1 GiB/instance; queue task expiry 20 minutes and dead-letter retention 7 days; source/context in PostgreSQL 7 days; results/evidence/events 30 days; result backups ≤7 days. Cache eviction must not substitute for queue delivery guarantees. After context deletion UI retains findings/metadata and reports unavailable diff. Redis/source are not long-term backups. Repository owners approve values.

## 11. Frontend ↔ backend API

JSON API prefix is `/api/v1`; OpenAPI is authoritative. Access is checked on every resource.

| Route | Purpose |
|---|---|
| GET auth start/callback; POST logout/refresh; GET me | OAuth/JWT session; refresh only a valid active session; nested user/session and CSRF token |
| GET repositories/available; POST repositories/connect; GET repositories and repository PRs | Available/connected pages; explicit connection; provider-derived role |
| GET/PUT repository settings | Versioned rules/ignores/quotas/language; admin; `If-Match`, 409 conflict |
| POST PR reviews | Requested head, optional rerun, idempotency; 202 + resource URL |
| GET review list/detail/findings/diff/events | History, snapshot/progress/coverage/results; diff 410 after retention |
| POST publication retries | Only eligible confirmed-absent `FAILED`; 409 otherwise |
| POST webhooks/github | Signed, deduplicated integration entry; no user JWT |

Routes are relative to `/api/v1`; deployment probes `/healthcheck` and `/readiness` are intentionally outside it. Lists use cursor pagination (20 default, 100 max), UTC ISO 8601, opaque IDs. Errors include safe code/message/request ID/retryability. UI polls 3 seconds with backoff to 15, pauses when hidden, and stops at terminal states. On 401 it stops, repeats OAuth with a safe return URL, and returns to the same review; background work continues.

New starts return 202; same-key/same-body replays return 200 with the existing current status. Settings replacement creates a new immutable version with `If-Match`; it never rewrites accepted jobs or historical digests. Exact legacy empty rules/ignores are projected without mutating storage. Unsupported legacy settings return safe `409 LEGACY_SETTINGS_UNSUPPORTED` with an opaque ETag; admin submits a full canonical replacement. Handlers and real UI adapters must implement these contracts separately from mock flows.

## 12. Security

- GitHub OAuth through backend, then 30-minute Secure/HttpOnly/SameSite=Lax JWT cookie with `sid` backed by active PostgreSQL `AuthSession`; no localStorage tokens. Validate single-use OAuth state and allowlisted Origin/CSRF on browser mutations. Refresh requires a valid JWT and active unexpired/non-revoked DB session, renews the same sid for 30 minutes, and preserves CSRF; expired/revoked sessions require OAuth again. No separate browser-readable refresh token.
- Local repository role plus current GitHub read-access check cached ≤60 seconds. Reviewer launches; admin changes settings. Fail closed. Encrypt user token backend-side.
- Installation token is never sent to UI or treated as user authorization. Revoked installation blocks work/publication.
- Deployment supplies minimal GitHub/JWT/webhook secrets; never commit or log them; rotate keys.
- PR code/descriptions/comments are untrusted data and cannot change system instructions. Model gets no shell, arbitrary network, or VCS tools; code/dependencies never execute/install.
- Validate/escape output and paths; mask discovered secrets. External LLM requires repository-owner approval.

## 13. Failures and observability

PostgreSQL failure makes authoritative state/session operations unavailable and the service not ready. Redis queue degradation blocks dispatch while retaining authoritative DB/outbox work; stored reads remain independent of Redis. VCS degradation blocks access revalidation, repository connection/listing, PR listing, and starts. Model/publisher failures disable affected processing, not saved-result reads. VCS rate limits/5xx use bounded Retry-After; access/missing-resource errors are classified and never replaced with empty context. AST errors degrade coverage; LLM errors preserve completed chunks; worker death expires lease; changed PR blocks publication; unknown external writes enter `UNKNOWN`. Deadline expiry yields PARTIAL only when useful validated output exists; otherwise FAILED.

Structured logs include time, component, request/trace/review IDs, status/audit phase, attempt, duration, safe error code, transitions, cache metrics, counts, retries, and publication outcome—never raw prompt/code/reasoning. Historical unknown reason codes remain in DB audit but project publicly as null. Measure API latency, queue age, phase durations, failure/partial rates, VCS/LLM errors, usage, cache, unknown publications. `/healthcheck` is dependency-free liveness. `/readiness` reports capability booleans, not raw dependency errors or credentials; its contract is in OpenAPI.

## 14. Non-functional limits

| Parameter | Initial v1 value |
|---|---|
| Webhook / API | webhook p95 ≤1s; DB reads p95 ≤500ms |
| Analysis target | p95 ≤60s for ≤300 changed lines, acquisition to saved validated result; excludes queue/publication |
| Deadlines | queue ≤15m; analysis ≤10m including retry; publication cycle ≤5m |
| Admission | ≤20 nonterminal/repository; ≤10 starts/hour/user/repository |
| Change/source | ≤50 files, 2,000 changed lines; ≤1 MiB/blob, 10 MiB/run, whole file ≤300 lines |
| Model | window ≥16,384; call input ≤10k/output ≤2k; ≤5 chunks, ≤8 calls, ≤80k/16k total tokens |
| Timeouts/publication | VCS 15s; Ollama 120s; ≤20 inline findings |
| Concurrency | one inference deployment-wide; publication serialized per PR |

These are independent configurable ceilings, not guaranteed full coverage or an obligation to use every call. Remaining deadline wins. Benchmarks record model/quantization/digest, hardware/VRAM/RAM, warm/cold state, input/output, and load; 60s is a target until measured.

Golden-dataset gates: published Precision ≥85%, Critical Recall ≥75%, Hallucination Rate <3%, validated/published schema compliance 100%. QA covers Python/TS, all categories, clean PRs, false-positive traps, incomplete context, adequate critical cases, and reruns per model/prompt/rules version. No HA is promised. MVP uses one deployment, daily PostgreSQL backup, RPO ≤24h, manual restore, infrastructure-dependent RTO.

## 15. Deployment and ownership

Target v1 uses Docker Compose locally and on Hetzner staging. Reverse proxy terminates HTTPS and is the only public port. PostgreSQL has a durable volume; Redis serves queue/cache roles and lost tasks are recovered from the PostgreSQL outbox/job/lease state. Ollama has a model volume when deployed locally. Terraform records or documents network/DNS/firewall. Port 8000 exposure is bootstrap only. This is the target topology, not a claim of verified HTTPS or completed runtime workers.

```mermaid
flowchart TB
    Internet["Internet: user + GitHub"] -->|443| Proxy["Reverse proxy / TLS"]
    subgraph Host["Staging / Docker Compose"]
        Proxy --> UI["UI static"]
        Proxy --> API["FastAPI"]
        subgraph Private["Private network"]
            API --> PG[("PostgreSQL volume")]
            API --> Redis[("Redis queue / cache")]
            Dispatcher["Dispatcher / recovery"] --> PG
            Dispatcher --> Redis
            Redis --> Analyze["Analyze x1"]
            Redis --> Publish["Publish"]
            Analyze --> PG
            Analyze --> Redis
            Analyze --> Ollama["Ollama model volume"]
            Publish --> PG
        end
    end
    API --> GitHub["GitHub API"]
    Analyze --> GitHub
    Publish --> GitHub
```

Alembic migrations run once before the new version. Contract migration `0004` follows ownership `0003` without rewriting frozen settings/digests. Lifecycle rollout quiesces incompatible old writes and sets a bounded migration lock timeout; lease recovery is not a substitute for old/new writer compatibility. Image/model digests are fixed; environment secrets are separate.

The following table records Sprint 1 responsibility assignments. Current Sprint 2 tasks and handoffs are tracked in [dmc-268-t2](https://github.com/orgs/larchanka-training/projects/8) and the API handoff document, not inferred from these historical roles.

| Owner | Artifact |
|---|---|
| Narek, Tech Lead | `docs/SYSTEM_DESIGN.md`, cross-component contracts |
| Kirill | BACKEND_ARCHITECTURE.md, modules, ERD/migrations, use cases |
| Sasha | Python/uv baseline, quality, Docker/healthcheck |
| Lyosha / Dima | FRONTEND_ARCHITECTURE.md, UI/API types/state, React baseline |
| Stas H. | Versioned prompts/rules and `.agents` assets |
| Stas P. | TEST_PLAN.md, integration/recovery/e2e/LLM evaluation |
| Slava | Hetzner, Terraform, network, secrets, release, restore |

Canonical system overview is `docs/SYSTEM_DESIGN.md`; `docs/SYSTEM_DESIGN_RU.md` is the historical Sprint 1 Russian version, not the current contract. The API repository links here for the overview and owns the detailed contracts listed in section 1.

## 16. Open questions

| Question | Default / blocked work | Approver |
|---|---|---|
| Later GitLab adapter? | GitHub-only Sprint 2 scope is confirmed; GitLab requires a separate later decision | Team / assignment owner |
| Can bot be requested as reviewer? | Test App/account/event; UI launch is reliable default | Tech Lead + backend |
| Meaning of subscription/token limit? | Enabled access and technical quotas only | Assignment owner + Tech Lead |
| OAuth/access policy? | Approve login/token check/local roles/installation owner | Tech Lead + backend + DevOps |
| Ollama model/hardware? | Need digest, ≥16K, structured output, latency measurement | Agentic + DevOps + QA |
| Retention/single host acceptable? | Approve retention, operator access, recovery goals | Repository owners + DevOps |

Open questions allow approval with documented defaults and block only their corresponding implementation. Update this file and TEAM_PROJECT.md after decisions.

## 17. Approval

Reviewers approve GitHub-first scope/UI, component boundaries and stores/queues, immutable snapshot and four context levels, finding/publication contract, limits/quality/retention/deployment, ownership, and open questions. Required reviewers: Tech Lead, backend architecture, frontend architecture, Agentic Engineer, QA, DevOps. Public API, state, queue/context, security, and NFR changes resolve before approval. After approvals, Tech Lead marks Approved with date and SHA.

## 18. Sources and precedence

1. Original team assignment and Tech Lead role.
2. TEAM_PROJECT.md updated October 7, 2026; earlier repository snapshots there are historical.
3. [Team 2 sprint board](https://www.tldraw.com/f/qdH9mHB7ezqaShpUBGvQC?d=v-5902.-1570.13006.7243.A2-cyhhZUcbI7713I8z93); newer explicit decisions win.
4. SYSTEM_DESIGN-Team-3.md for selected snapshot/adapter/recovery/publication ideas only.
5. gtilabduo-example.html as one observed example, not a GitLab Duo specification.

For Sprint 2 lifecycle, queue, HTTP, and schema details, merged API PR #21 and the authoritative artifacts linked in section 1 supersede the earlier proposals in this document.

Unverified claims about GitLab internals, universal ignore files, exact context windows, or zero-data-retention are not implementation facts. Verify external APIs against official documentation.
