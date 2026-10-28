# Proposal: wire PR page to live review API (after UI #26)

**Status:** PROPOSED  
**Date:** 2026-10-28  
**Repo:** `dmc-268-ui-t2` (primary). API checks against `dmc-268-api-t2` `main`.  
**Trigger:** [UI PR #26](https://github.com/larchanka-training/dmc-268-ui-t2/pull/26) (`diff-viewer`) merged into `main`.  
**Pattern to copy:** [UI PR #17](https://github.com/larchanka-training/dmc-268-ui-t2/pull/17) session + repository HTTP clients.

Decision record: [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) HTTP surface (review detail / findings / diff / PR list), polling, 401, and diff retention. Sprint handoff: API `docs/sprint2-contract-handoff.md` → UI #16. Local real-API how-to: `docs/local-ui-api.md` (same as main/repos page; may be uncommitted).

This proposal does **not** reopen wire shapes. It fills the empty HTTP client the way Eng 1 did for `/me` and repos.

## Pattern from PR #17 (do the same)

Main page / repos did **not** invent a second product env story. They:

1. Ship a small HTTP module (`session-client.ts`, `repository-client.ts`) that always `fetch`es relative `/api/v1/...` with `credentials: 'include'`.
2. Parse snake_case wire → UI types; walk `next_cursor` until null (repos).
3. Throw a tiny `*HttpError` with `status` (no MSW awareness in the client).
4. In DEV, `main.tsx` starts MSW; the same client hits handlers. Tests stub `fetch`.
5. Pointing at a real local API is a **local** switch (skip MSW + Vite `/api` proxy), documented in `local-ui-api.md` — not a committed product feature in that PR.

PR page should follow that, inside the existing `PullRequestDataSource` seam from #26.

## Current

- Pull Request page, diff viewer, file list, finding cards, and parsers shipped in PR #26.
- Default data source is in-memory `MockPullRequestDataSource` (`VITE_DATA_SOURCE` unset → mock). That flag is from #26; repos/session from #17 have no equivalent — they always HTTP + MSW.
- `ApiPullRequestDataSource` is the intended HTTP adapter but every method rejects with `NotImplementedError` — no `fetch`.
- Path helpers and parsers already exist (`paths.ts`, `parseReview`, `parsePullRequest`, `parseDiff`, `parseFinding`).
- MSW `reviewHandlers` already mirror fixtures for when the HTTP client exists; the stub never reaches them.
- API `main` already serves the four cookie-auth GETs.

## Missing (human)

The page can render a review, but it never asks the network. Repos already do. Until `ApiPullRequestDataSource` behaves like `repository-client`, PR #26 is mock-only.

## Desired

1. `ApiPullRequestDataSource` loads review, findings, structured diff, and open-PR header meta via `fetch` + cookies + existing parsers (same style as PR #17).
2. Keep existing UI soft/hard states: review 404 → not found; diff 404/`null` → pending; empty files → empty diff; missing PR meta → soft header fallback.
3. No new response shapes.
4. Local real backend = same uncommitted `local-ui-api.md` path already used for the main page (not a new committed flag design).

## Why

- UI #16 DoD is consume the OpenAPI GETs; mock never proved that.
- Copying #17 avoids a second, inconsistent “how do we talk to the API” story.

## What we need from the API

**No new API features** for this slice.

| Need | API today |
|---|---|
| `GET /api/v1/reviews/{id}` | Implemented |
| `GET /api/v1/reviews/{id}/findings` | Implemented (cursor page) |
| `GET /api/v1/reviews/{id}/diff` | Implemented (structured hunks) |
| `GET /api/v1/repositories/{id}/pull-requests` | Implemented (open PRs) |
| Session cookie `dmc_session` | Existing auth (same as repos) |

Out of this slice (documented elsewhere, not blockers):

- List-reviews / publication-retries handlers still OpenAPI-only.
- `publication_reference` always null.
- SSE as alternative to polling.

## Proposed change (UI)

| Change | Why |
|---|---|
| Implement `ApiPullRequestDataSource` like `repository-client` / `session-client`: relative paths, `credentials: 'include'`, wire parsers, `HttpError`-style status mapping, findings + open-PR list cursor walks until `next_cursor` is null | Same pattern as PR #17; closes NotImplemented. |
| Map HTTP status: review 404 → `ReviewNotFoundError`; diff 404 → `null` (`DiffPending`); diff 410 → also `null` this slice so findings/header still load (not a page error). **Known gap:** SYSTEM_DESIGN wants “diff unavailable/expired” copy; today’s `DiffPending` says «ещё не сохранён» — distinct UI is a follow-up. Other errors → page error. | Soft vs hard failures; honest about retention copy. |
| Keep `VITE_DATA_SOURCE` as #26 already shipped it: unset/mock → in-memory mock; `api` → this HTTP client (DEV → MSW `reviewHandlers`, same as repos hitting MSW). Do **not** add a second committed live-switch or Vite proxy in this PR. | Matches #17’s “client is MSW-unaware; local real API is optional local edits.” |
| Tests: stub `fetch` (or MSW) for happy path + 404/410 + multi-page cursor — same style as `repository-client.test.ts` | Locks adapter without staging. |

### Explicitly out of this first slice

| Item | Why later |
|---|---|
| Polling every 3–15s / pause when hidden / stop on terminal | Design-required for live progress; separate thin PR once reads work. |
| 401 → OAuth return URL to same review | Session client already has return-URL helpers; wire on this page later. |
| Distinct diff-unavailable / 410 copy (vs DiffPending) | SYSTEM_DESIGN retention UX; needs page state beyond adapter `null`. |
| Commit Vite HTTPS proxy / `VITE_USE_API` into the repo | Same as main page: stays local via `local-ui-api.md`, not part of the HTTP-client PR. |
| Start-review button, repo PR list product screen, SSE | Adjacent product. |

## Touchpoints (files)

- `src/entities/pull-request/api/api-data-source.ts` — implement (mirror `repository-client.ts` habits)
- `src/entities/pull-request/api/api-data-source.test.ts` — extend (mirror `repository-client.test.ts`)
- Reuse `paths.ts` + parsers; no parallel types
- Do not change committed `vite.config.ts` / `main.tsx` for proxy in this PR

## Acceptance (falsifiable)

1. `VITE_DATA_SOURCE=api` + MSW (or stubbed `fetch`) loads a completed review through `ApiPullRequestDataSource` without `NotImplementedError`.
2. Diff 404 → `null` → pending; diff 410 → `null` (findings still load); review 404 → not-found; findings and open-PR list walk `next_cursor` until null.
3. Mock default unchanged when env unset.
4. Client shape matches PR #17: `credentials: 'include'`, relative `/api/v1` paths, no MSW imports in the client.
5. No API OpenAPI/handler change required; no committed Vite proxy required.
6. `pnpm` lint / types / tests green for touched packages.

## Decisions (closed)

| Topic | Choice |
|---|---|
| How to talk to the API | Same as PR #17 HTTP clients — not a new flag/proxy product design. |
| This PR scope | Reads-only adapter. Polling / 401 page wiring / distinct 410 copy stay out. |
| 410 in this slice | Interim `null` + documented unavailable-copy gap. |
| Local real backend | Uncommitted `local-ui-api.md` path (same as main page). |
| `VITE_DATA_SOURCE` | Keep as #26’s mock vs HTTP selector; HTTP mode is the #17-equivalent client. |
