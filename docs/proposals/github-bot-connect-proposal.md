# Proposal: connect a repository through the bot user

**Status:** DECIDED product, not implemented  
**Date:** 2026-10-25  
**Repo:** `dmc-268-ui-t2` — design home is this `docs/` tree. API paths below are in `dmc-268-api-t2`.

The product choices below are closed. This file is the change list. It does not reopen them.

Decision record: [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) §5 and the MVP boundary. The same pipeline is in [SYSTEM_DESIGN_RU.md](../SYSTEM_DESIGN_RU.md). API detail is in `docs/github-webhook-intake.md`, `docs/github-review-publication.md`, `docs/BACKEND_ERD.md`, and `docs/staging-deployment.md`.

A GitHub App is out of this change.

## What already happens

Validated against API `main` @ `59a1e7c` and UI `main` @ `43b1697` (2 Nov 2026). Product decisions below are unchanged; only this baseline was corrected.

Login is the OAuth App. API `src/app/api/github_auth.py` builds the authorize URL with client id, redirect, and state. It sends no `scope`, so the available-repository list is incomplete for organization public repositories the user can access.

`POST /api/v1/repositories/connect` in API `src/app/api/repositories.py` uses the **logged-in user's** encrypted OAuth token (via `get_repository_reader`) to confirm the user can see the repository, then writes `Repository`, `RepositoryAccess`, and default settings. It never calls GitHub as the bot and never asks whether the bot can read or comment.

The UI Connect button calls that route and returns to `/repos`. It does not open GitHub. Connect error handling only special-cases HTTP 503; other failures share one generic message, and the client drops the error body (so `code` / `bot_login` / `access_url` cannot reach the UI yet).

`GITHUB__TOKEN` is attached in API `src/app/core/github_runtime.py` and used as the **bot read** credential by the webhook worker, the analysis worker, and the parts of `startReview` that revalidate the PR and fetch the diff. **Authorization** of `startReview` (can this user start?) uses the user's OAuth token, not `GITHUB__TOKEN`. `GITHUB__WRITE_TOKEN` and `GITHUB__BOT_USER_ID` are attached in `src/app/core/publication_runtime.py`. `GithubClient` already sends those Bearer tokens. That client stays.

`POST /api/v1/webhooks/github` verifies `WEBHOOK__SECRET` and stores a diff for a repository row that already exists. It does not create a `ReviewJob`.

API already exposes `GET /api/v1/repositories/{id}/pull-requests` and `POST /api/v1/repositories/{id}/pull-requests/{number}/reviews` (`startReview`, with `Idempotency-Key` / CSRF). The PR list reads GitHub with the **user's** OAuth token; `startReview` authorization also uses the user token, while its PR revalidation and diff fetch use the **bot** read token. The site has **no** pull-request list page and **no** Start review control that calls `startReview`. Nav `/review` still redirects to a fixed fixture id; `/reviews/:id` is a live read path (detail, findings, diff, SSE) against the API when a real review id exists.

## What to change, and why

| Change | Why |
|---|---|
| Add `scope=repo` to the GitHub authorize URL in API `src/app/api/github_auth.py`. | Without it, organization public repositories the user can access do not show up reliably in the available list. MVP product goal is **public** repositories (org and others the user can see); private repositories are not promised. `repo` is the scope that makes that public list work with this OAuth App. People who already logged in must sign in again so GitHub grants the new scope; refresh alone is not enough. |
| Keep the existing user-visibility check on connect, then add Check access: before inserting, use `GITHUB__TOKEN` (bot read client from `github_runtime`) to read the bot's permission on the repository (`GET /repos/{owner}/{repo}/collaborators/{bot}/permission`). Persist the repository and the caller's access row only when that permission is `admin`, `maintain`, or `write`. Do **not** accept invites from Connect. Empty/misconfigured `GITHUB__TOKEN` must use a distinct server-config error, not `BOT_ACCESS_REQUIRED`. | A database row is not access. User token answers “can this person see the repo?”; bot token answers “can our server operate on it?”. Accepting a pending invite is a separate GitHub step done once while signed in as the bot (outside our UI). Connect only verifies Write+ for the bot. |
| When the bot is missing or weaker than Write, return a named API outcome the UI can act on (see Check access contract below). Do not insert. | GitHub does not notify us that the admin finished the invite page. The page is not the connection. Invite-missing and server-credential failures must not share one vague “conflict.” |
| When the bot already has Write, Maintain, or Admin, insert only this caller's access row if the repository row exists. Keep existing settings. Do not duplicate the repository row. | A second person does not invite the bot again. |
| On a later bot-token denial for that repository, **do not** delete `RepositoryAccess` rows. Mark the integration unhealthy (token/config/GitHub error vs confirmed bot removal when distinguishable). While unhealthy: block new Connect, new Start review, and new publish attempts for that repository; keep stored findings and access links. Already accepted jobs may finish (fetch/analyze/publish as they can). Remove access only on explicit disconnect or when it is confirmed the bot is no longer a collaborator. | A generic 401/403/404 on the bot token is often a bad/expired token, wrong scope, or rate limit — not “everyone lost the repo.” Deleting access rows is the wrong reaction and does not stop jobs already accepted. |

`GithubClient.fetch` and publication posting stay. They already use a Bearer token.

The staging secrets table now names the Actions secret `STAGING_GITHUB_READ_TOKEN`. The workflow already reads that name and writes the container variable `GITHUB__TOKEN`.

### Check access contract (Connect)

| Situation | HTTP + code (examples) | UI |
|---|---|---|
| Bot has Write, Maintain, or Admin | `200` / `201` | Connected; keep settings; no duplicate repository row |
| Bot missing, invite pending, or role below Write; caller is repository admin | `409` `BOT_ACCESS_REQUIRED` | Show `bot_login`, open `access_url`, explain that after Invite the bot account must **Accept** the invitation, then “Check again” |
| Same bot-not-ready case; caller is not an admin | `403` | Explain that a repository admin must invite the bot; do not open the invite page as if this user can finish it |
| Server bot credentials misconfigured, or temporary GitHub/upstream failure | Other distinct codes (not `BOT_ACCESS_REQUIRED`) | Show server-config / retry guidance — not the invite page |

For `409` `BOT_ACCESS_REQUIRED`, the response body includes at least: `bot_login` (GitHub login of the bot), `access_url` (`https://github.com/{owner}/{repo}/settings/access`), and a short safe `message` for the UI. API OpenAPI must use these same names.

## What to add, and why

| Add | Why |
|---|---|
| A small GitHub helper next to API `src/app/vcs/github.py`: `GET /repos/{owner}/{repo}/collaborators/{bot}/permission` for Check access. No list-invitations / accept-invitation on Connect. | Connect verifies permission only. Invite accept stays a manual ops step under the bot account. |
| On Connect in `src/features/connect-repo/ui/ConnectRepoPanel.tsx`: handle `BOT_ACCESS_REQUIRED` (open access URL, show bot login, Check again). Other failures get their own copy. | The admin types the bot login on GitHub. Our page is where they come back after invite **and** after the bot accepted. |
| UI: a pull-request list for a connected repository, and a Start review button that calls the existing `POST /api/v1/repositories/{id}/pull-requests/{number}/reviews`. Reuse existing `GET …/pull-requests` (already on API main; user token). After start, navigate to `/reviews/{id}` (live read/SSE already works). Replace or retire the `/review` fixture redirect as the product entry. | The API already starts a review when a logged-in user calls `startReview` (user-token authorize; bot token for PR revalidation/diff). The site never calls it today. Unhealthy-integration blocking for start/publish is still missing and belongs with the Check access / denial work. |
| Later, not in the first slice: `auto_start` on repository settings, default false, editable only by an admin. When it is true, webhook intake for `opened` and `synchronize` creates the same review a person would start. The bot token downloads the diff and posts the comment. `max_starts_per_hour` and `max_active_jobs` still apply. Offer or enable `auto_start` only where webhook delivery is actually configured for that owner (see webhook row below). | Automatic start is optional. The webhook today only stores the diff. Passing Check access alone does not mean webhook events arrive. |

The first slice is scope, Check access (API + Connect UI error body parsing), and the Connect page. The Start review **UI** (list + button + post-start navigation) is the next slice — list/start HTTP already exist. `auto_start` is the slice after that.

## What to configure, and where

Do this on GitHub and in the API repository settings. No new secret names.

| Where | What | Why |
|---|---|---|
| One extra GitHub user, created once | The bot account | Server identity. Not a new user per repository. |
| That user → Settings → Developer settings → Personal access tokens | Two tokens on that bot user: a **read** token able to read the repository, pull requests, and diffs; a **write** token able to create pull-request reviews and review comments as we publish them. Both must belong to `GITHUB__BOT_USER_ID`. Exact PAT product (classic vs fine-grained) and checkbox lists are an ops choice as long as these capabilities hold and the write token is never reused as the read token. | The bot must communicate on the PR correctly. We specify required capabilities, not a second mythology of token kinds. |
| Bot profile, `https://api.github.com/user` as that user | Numeric `id` | Publication already compares comment authors to `GITHUB__BOT_USER_ID`. |
| API repo `larchanka-training/dmc-268-api-t2` → Settings → Secrets and variables → Actions | Secret `STAGING_GITHUB_READ_TOKEN` = read token. Secret `GITHUB__WRITE_TOKEN` = write token. Secret `GITHUB__BOT_USER_ID` = numeric id. Secret `WEBHOOK__SECRET` = the webhook password chosen below. | `.github/workflows/deploy-staging.yml` copies these into the staging env file. The container names are `GITHUB__TOKEN`, `GITHUB__WRITE_TOKEN`, `GITHUB__BOT_USER_ID`, and `WEBHOOK__SECRET`. |
| Same page, Actions variables already used for login | `AUTH__GITHUB_CLIENT_ID`, `AUTH__GITHUB_REDIRECT_URI`, `AUTH__FRONTEND_ORIGINS`. Secret `AUTH__GITHUB_CLIENT_SECRET`. | Login. Unchanged, except the authorize URL gains `scope=repo`. |
| Local API `.env` | The same four bot and webhook variable names the container uses. | Compose reads the env file directly. It does not read the `STAGING_` secret name. |
| GitHub organization `larchanka-training` → Settings → Webhooks → Add webhook | Payload URL `https://dmc268-t2.ddns.net/api/v1/webhooks/github`. Content type `application/json`. Secret equal to `WEBHOOK__SECRET`. Event: Pull requests. SSL verification on. | **Default setup:** one org-level webhook covers every repository in `larchanka-training`. The same Payload URL (and preferably the same secret) **may** be added on another repository or organization; then those owners also deliver events to our API. Without that extra webhook, personal / other-org repos never hit our endpoint. Connect may still succeed there; manual Start review can work; webhook intake and later `auto_start` need delivery. The API stores a diff only after the repository is connected. The bot does not create webhooks. |
| Each repository where the bot is not already a writer | An admin invites the bot's login with role Write or higher, then someone signed in as the **bot** accepts the invitation once. The Connect page opens `https://github.com/{owner}/{repo}/settings/access` for the invite step and reminds that Accept is required. | We require Write+ as **our** connect policy so the bot can write review comments and publish the way we design. That is a product rule, not a claim that GitHub forbids every review action below Write. |

## Order

1. Create the bot, store the three bot values and `WEBHOOK__SECRET`, add the organization webhook (and any extra same-URL webhooks you intentionally want).
2. Send `scope=repo` and require a fresh login.
3. Check access inside connect (permission only), Connect UI for `BOT_ACCESS_REQUIRED` / other failures, and the invite → Accept-under-bot → Check again loop.
4. Unhealthy integration on later bot-token denial: keep `RepositoryAccess`; block new Connect/start/publish; already accepted jobs may finish — do not wipe access on generic denial.
5. UI pull-request list and Start review (API routes already on main); wire unhealthy gate on start/publish when slice 1’s marker exists.
6. Optional `auto_start`, default off, only where webhook delivery exists for that owner.
