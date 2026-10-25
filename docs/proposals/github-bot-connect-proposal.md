# Proposal: connect a repository through the bot user

**Status:** DECIDED product, not implemented  
**Date:** 2026-10-25  
**Repo:** `dmc-268-ui-t2` — design home is this `docs/` tree. API paths below are in `dmc-268-api-t2`.

The product choices below are closed. This file is the change list. It does not reopen them.

Decision record: [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) §5 and the MVP boundary. The same pipeline is in [SYSTEM_DESIGN_RU.md](../SYSTEM_DESIGN_RU.md). API detail is in `docs/github-webhook-intake.md`, `docs/github-review-publication.md`, `docs/BACKEND_ERD.md`, and `docs/staging-deployment.md`.

A GitHub App is out of this change.

## What already happens

Login is the OAuth App. API `src/app/api/github_auth.py` builds the authorize URL with client id, redirect, and state. It sends no `scope`, so GitHub returns only that user's own public repositories.

`POST /api/v1/repositories/connect` in API `src/app/api/repositories.py` checks that the logged-in user can see the repository, then writes `Repository`, `RepositoryAccess`, and default settings. It never asks whether the bot can read or comment.

The UI Connect button calls that route and returns to `/repos`. It does not open GitHub.

`GITHUB__TOKEN` is attached once in API `src/app/core/github_runtime.py` and used by the webhook worker, `startReview`, and the analysis worker. `GITHUB__WRITE_TOKEN` and `GITHUB__BOT_USER_ID` are attached in `src/app/core/publication_runtime.py`. `GithubClient` already sends those Bearer tokens. That client stays.

`POST /api/v1/webhooks/github` verifies `WEBHOOK__SECRET` and stores a diff for a repository row that already exists. It does not create a `ReviewJob`. The site has no pull-request list and no control that calls `startReview`. `/review` is a mock with a fixed id.

## What to change, and why

| Change | Why |
|---|---|
| Add `scope=repo` to the GitHub authorize URL in API `src/app/api/github_auth.py`. | Organization repositories stay hidden without it. People who already logged in must sign in again so GitHub grants the new scope. |
| Make `POST /api/v1/repositories/connect` the Check access call. Before inserting, use `GITHUB__TOKEN` to accept a pending repository invite for this bot, then read the bot's permission. Persist the repository and the caller's access row only when that permission is `admin`, `maintain`, or `write`. | A database row is not access. The bot is the account that downloads diffs and posts comments. |
| When the bot is missing or weaker than Write and the caller is an admin, do not insert. Return a conflict the UI can act on: the bot's login and `https://github.com/{owner}/{repo}/settings/access`. | GitHub does not notify us that the admin finished the page. The page is not the connection. |
| When the bot is missing or weaker than Write and the caller is not an admin, refuse. Do not open the invite page. | Only an admin can invite the bot. |
| When the bot already has Write, Maintain, or Admin, insert only this caller's access row if the repository row exists. | A second person does not invite the bot again. |
| On a later bot-token denial for that repository, delete its `RepositoryAccess` rows. Keep stored findings. | Loss of bot access disconnects the repository. GitHub does not send an event for a removed collaborator, so the next denied call is the signal. |

`GithubClient.fetch` and publication posting stay. They already use a Bearer token.

The staging secrets table now names the Actions secret `STAGING_GITHUB_READ_TOKEN`. The workflow already reads that name and writes the container variable `GITHUB__TOKEN`.

## What to add, and why

| Add | Why |
|---|---|
| A small GitHub helper next to API `src/app/vcs/github.py`: list the bot's repository invitations, accept the one for this repository, then `GET /repos/{owner}/{repo}/collaborators/{bot}/permission`. | Check access needs the permission, and an invite does nothing until the bot accepts it. The bot token can accept its own invite. |
| On Connect in `src/features/connect-repo/ui/ConnectRepoPanel.tsx`: if the API returns the invite conflict, open the access URL in a new tab, show the bot login, and keep a Check access button that calls connect again. | The admin has to type the bot's login on GitHub's page. Our page is where they come back. |
| A pull-request list for a connected repository, and a Start review button that calls the existing `POST /api/v1/repositories/{id}/pull-requests/{number}/reviews`. | The API starts a review only when a logged-in user calls it. The site never calls it. `/review` still shows a mock. |
| Later, not in the first slice: `auto_start` on repository settings, default false, editable only by an admin. When it is true, webhook intake for `opened` and `synchronize` creates the same review a person would start. The bot token downloads the diff and posts the comment. `max_starts_per_hour` and `max_active_jobs` still apply. | Automatic start is optional. The webhook today only stores the diff. |

The first slice is scope, Check access, and the Connect page. The Start review button is the next slice. `auto_start` is the slice after that.

## What to configure, and where

Do this on GitHub and in the API repository settings. No new secret names.

| Where | What | Why |
|---|---|---|
| One extra GitHub user, created once | The bot account | Server identity. Not a new user per repository. |
| That user → Settings → Developer settings → Personal access tokens | Read token that can read the repository, pull requests, and diffs. Write token that can write pull-request reviews. | Two passwords, two jobs. The read token must not be reused for comments. |
| Bot profile, `https://api.github.com/user` as that user | Numeric `id` | Publication already compares comment authors to `GITHUB__BOT_USER_ID`. |
| API repo `larchanka-training/dmc-268-api-t2` → Settings → Secrets and variables → Actions | Secret `STAGING_GITHUB_READ_TOKEN` = read token. Secret `GITHUB__WRITE_TOKEN` = write token. Secret `GITHUB__BOT_USER_ID` = numeric id. Secret `WEBHOOK__SECRET` = the webhook password chosen below. | `.github/workflows/deploy-staging.yml` copies these into the staging env file. The container names are `GITHUB__TOKEN`, `GITHUB__WRITE_TOKEN`, `GITHUB__BOT_USER_ID`, and `WEBHOOK__SECRET`. |
| Same page, Actions variables already used for login | `AUTH__GITHUB_CLIENT_ID`, `AUTH__GITHUB_REDIRECT_URI`, `AUTH__FRONTEND_ORIGINS`. Secret `AUTH__GITHUB_CLIENT_SECRET`. | Login. Unchanged, except the authorize URL gains `scope=repo`. |
| Local API `.env` | The same four bot and webhook variable names the container uses. | Compose reads the env file directly. It does not read the `STAGING_` secret name. |
| GitHub organization `larchanka-training` → Settings → Webhooks → Add webhook | Payload URL `https://dmc268-t2.ddns.net/api/v1/webhooks/github`. Content type `application/json`. Secret equal to `WEBHOOK__SECRET`. Event: Pull requests. SSL verification on. | One webhook covers every repository in the organization. The API stores a diff only after the repository is connected. The bot does not create this webhook. |
| Each demo repository, only if the bot is not already a writer | An admin invites the bot's login with role Write or higher. The Connect page opens `https://github.com/{owner}/{repo}/settings/access` for that step. | Write is what allows a pull-request review. Read is not enough. |

## Order

1. Create the bot, store the three bot values and `WEBHOOK__SECRET`, add the organization webhook.
2. Send `scope=repo` and require a fresh login.
3. Check access inside connect, and the Connect page that opens GitHub and retries.
4. Disconnect the repository when the bot token is denied.
5. Pull-request list and Start review.
6. Optional `auto_start`, default off.
