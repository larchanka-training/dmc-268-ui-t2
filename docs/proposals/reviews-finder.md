# Proposal: Reviews/PRs finder

**Status:** Implemented on this branch
**Date:** 2026-11-05
**Repo:** `dmc-268-ui-t2` — design home is this `docs/` tree. The list call already exists on `dmc-268-api-t2`.

The product choices below are closed. This file is the change list. It does not reopen them.

## Job

Reviews/PRs is a way back to a review run. One row is one run. The row opens our review page.

Starting a review stays on Repos → open pull requests → Start review. The audit log stays the operations table (tokens, cost, trigger, filters).

## What already happens

Checked on UI `main` @ `99de849`.

The nav item **Reviews/PRs** is a second link to `/repos` (`src/widgets/app-shell/ui/AppShell.tsx`). It is highlighted on `/reviews` and `/reviews/*`, but the click still goes to the repository list. `PullRequestPage.routing.test.tsx` locks that: the item’s `href` is `/repos`.

`/reviews/:reviewId` is the review page (diff, findings, live status). Start review navigates there (`src/features/start-review/ui/StartReviewButton.tsx`). The audit log links there too (`src/pages/audit/ui/AuditPage.tsx`). Nothing on the review page links back to a list. No review row links out to a GitHub pull request. Connect already opens a repository access URL in a new tab when the bot still needs access.

`/review` (no id) redirects to `/repos`. The same routing test locks that. The missing-page screen is `RouteNotFound` (“Страница не найдена”), outside the app shell, on `*`.

Repos lists connected repositories. Each one links to its open pull requests. That list can start a review. It does not list past runs.

The history call is per repository: `GET /api/v1/repositories/{id}/reviews` (`listRepositoryReviews`). It is ordered by `created_at` descending, then `id` descending. `days` is `7`, `30`, or `90`; the default is the last 30 UTC calendar days, including today. The page has `items` and `next_cursor`. A list item has id, pull-request number, requested head sha, analysis status, publication status, timestamps, trigger, actor, usage, cost, and limit reasons. It has no pull-request title and no GitHub URL.

Connected repositories already have `owner` and `name` (`src/entities/repository`). The review page already has the Russian status and publication words (`src/widgets/pr-header/ui/PullRequestHeader.tsx`). The audit log prints the raw codes and a UTC timestamp.

There is no cross-repository review list.

## What to change, and why

| Change | Why |
|---|---|
| Add an authenticated page at `/reviews`. Point the **Reviews/PRs** nav item at it. Keep Repos on `/repos`. | The nav label is the finder. Today it opens the start path. |
| Remove the `/review` → `/repos` redirect. `/review` falls through to `RouteNotFound`. | Nothing links to `/review`. The finder is `/reviews`. A silent redirect to Repos looks like a way in. |
| On the review page, add a link to `/reviews` at the top. It always goes there, including when the run was opened from the audit log, from Start review, or from a pasted address. Do not use browser history. | One exit to the finder. Browser Back still returns to the previous page. |
| Build the list by calling `GET /api/v1/repositories/{id}/reviews?days=30` for every connected repository, and follow `next_cursor` until it is null. Merge by `created_at` descending, then `id` descending. Do not add an API. | That call is already the 30-day history. The first page alone can hide a run. |
| Show one loading line until every repository has loaded or failed. Then show the merged list once, unless the states table says to show one error instead. | A time-sorted list that inserts rows as responses arrive will jump. An all-fail result is an error, not an empty list. |
| Each row shows `owner/name`, pull-request number, the first 7 characters of `requested_head_sha`, `STATUS_LABEL`, `PUBLICATION_LABEL`, local date and time, and `actor.login`. A null actor or a null login reads **Unknown actor**. The row is a link to `/reviews/{id}`. | These fields exist on the list item plus the connected repository. The title does not, and a closed pull request has no title on the open-pull-request call. The short commit separates two runs of the same pull request. `STATUS_LABEL` and `PUBLICATION_LABEL` live in `src/widgets/pr-header/model/labels.ts` and are the header badge words (for example “Ревью завершено”, “Публикуется”). Do not use `statusLabel` in `src/widgets/review-progress/ui/ReviewProgress.tsx`. That map uses different phrases for the same status (“Анализ завершён”, “Ошибка ревью”). |
| A separate control on the row opens `https://github.com/{owner}/{name}/pull/{number}` in a new tab (`rel="noopener"`). It is not nested inside the row link. That click does not open our review page. | The job is to reopen our review. The pull-request link is the way out to GitHub. Nesting an `<a>` inside an `<a>` is invalid. |
| No repository filter, status filter, or period control. No polling. | The audit log already filters. This list is a snapshot of one window. Progress stays on the review page. |

## What a row does not show

Pull-request title, tokens, cost, trigger, limit reasons, and a link to the GitHub repository. Those stay off this page. Tokens, cost, trigger, and limit reasons stay on the audit log.

## States

| Situation | Page |
|---|---|
| Connected-repository request still in flight, or at least one review history still in flight | One loading line. No partial list. |
| Connected-repository request fails | One error. Not the empty sentence. |
| No connected repositories | Say none are connected, and link to `/repos/connect`. |
| Every history request fails | One error. Not the empty sentence. |
| Some history requests fail | Show the runs that loaded. Name each failed repository as `owner/name`. |
| Every history request succeeds and the window is empty | Say there are no reviews in the last 30 days, and link to `/repos`. |

“Last 30 days” means the API window: `days=30`, `created_at` in the last 30 UTC calendar days, including today. The clock on the row is the browser’s local date and time. A run near midnight can show a local time from another calendar day and still belong in the list.

## Tests to retarget

`src/pages/pull-request/ui/PullRequestPage.routing.test.tsx` currently expects `/review` to land on `/repos`, and **Reviews/PRs** to point at `/repos`. After this change, `/review` shows `route-not-found`, and **Reviews/PRs** points at `/reviews`. The existing check that **Reviews/PRs** is current on a review page stays.

Add coverage for the list states in the table above, for the GitHub control not navigating in-app, and for the review-page link to `/reviews`.

## Out of scope

- A new cross-repository reviews endpoint.
- Changing Start review, the open-pull-request list, or the audit log.
- Filters, live updates, pull-request titles, tokens, cost, or trigger on this page.
- A link to the GitHub repository (the row already shows `owner/name`).
- Rewording the Russian status and publication labels.

## Order

1. Route, nav target, and removal of the `/review` redirect, with the routing test updated.
2. The `/reviews` list, including merge, states, and the GitHub control.
3. The link from the review page back to `/reviews`.
