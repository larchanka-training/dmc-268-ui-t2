# Walk review comments without scrolling clean lines

**Status:** DECIDED product, not implemented  
**Date:** 2026-11-05  
**Repo:** `dmc-268-ui-t2`  
**Baseline:** UI `main` @ `99de849`

Decisions are locked. This file is the change list. It does not reopen them.

No API change. Keyboard shortcuts are out. Finding categories stay a label inside the open card.

## Current

On `PullRequestPage` two controls look alike and do different jobs.

`SeveritySummary` in the header (`data-testid="severity-summary"`) jumps to the first comment of that level. `selectSeverity` navigates to `#comment-<id>` from `firstCommentIdBySeverity`. It does not narrow the page. A second click on the same level does not move to the next comment. `PullRequestPage.routing.test.tsx` covers that jump, including into a collapsed file.

`FindingFiltersPanel` has a second set of level buttons. Several levels can be on at once (`FindingFilters.severities`). The URL repeats `severity`. Search (`q`) matches title, explanation, recommendation, and evidence. The file `<select>` is built from comment paths, sorted, not from diff paths. On the page fixture that is `src/api/user.ts`, `src/legacy/old-helper.ts`, and `src/missing.ts`. `src/features/new-feature.ts` is in the diff, has no comments, and is absent from the select. The panel says «Показано N из M». With a filter on, files that have no matching comment are hidden. Inside a remaining file every hunk is still drawn. Badge counts are counts of the already filtered comments, so `?severity=high` shows critical as 0 (`PullRequestPage.live.test.tsx`).

`anchorComments` places cards on diff lines, then file-level «Замечания вне diff», then a PR-level block for files that are not in the diff. Cards on one line, and those two blocks, are already ordered critical → low (`sortBySeverity`). `#comment-<id>` expands the card and its file and scrolls (`useHashTarget`). A fresh open with no hash selects nothing. `#file-<path>` from `FileList` only scrolls to the file header.

A file with no comments still appears in the sidebar and in the diff. `PullRequestPage.test.tsx` expects every diff file in that list.

## Desired

The reader can move through comments. Lines with no comment are folded. One level is selected at a time.

### One level control

The header row is the only level control. Remove the level buttons from `FindingFiltersPanel`. Keep search, the file `<select>`, and «Сбросить». Remove «Показано N из M».

`FindingFilters.severities` becomes one `severity: Severity | null`. The URL has one `severity` param. If an old link repeats it, the first valid value wins.

The number on a badge counts comments of that level that also match search and the selected file. It does not depend on the selected level. A count of 0 disables a badge only when that level is not selected. The selected badge stays clickable, so it can still be cleared when search or the chosen file leaves it at 0.

Click a level that is off: set it, and open the first matching comment in walk order. Click the level that is on: clear it, and stay on the same comment. Its place in the counter is recalculated.

«Сбросить» clears search, file, and level. It does not leave the current comment when that comment is still in the full set.

### What stays on screen

A file with no visible comment is absent from `FileList` and from the diff. The file `<select>` lists every diff path, in diff order, including paths with no comments, then comment paths that are not in the diff (the fixture’s `src/missing.ts`), in the order those orphan cards are rendered.

Choosing a diff path that has no comments shows that file in the diff only. It does not appear in `FileList`. The selection clears and the page does not scroll. Every level count is 0. A level that was already selected stays selected and clickable. The others are disabled. A binary file with no comments follows the same rule: `binary-placeholder` appears after that path is chosen, not on the default page.

A file with a visible comment stays. A hunk that contains one stays fully open, header and all lines. Hunks with no visible comment fold. Consecutive folded hunks, including the start of the file and the tail after the last open hunk, are one button: «N строк без замечаний». N is the number of diff rows (`hunk.lines`) in that gap, not the number of hunks. The click opens that gap. The file header has one toggle, «весь файл» / «только замечания». A file shown only because it was chosen and has no comments does not show that toggle.

Opened gaps and «весь файл» last until the level, the search, or the file filter changes. A gap is remembered as the file path plus the hunk headers inside it, and is dropped when any of those headers is gone. «Весь файл» is remembered as the file path, and is dropped when that file is gone. Switching unified / split does not clear them and does not scroll.

The file chevron still collapses the whole file. Split / unified stays as it is. The out-of-diff blocks stay where they are.

### The walk

Walk order is the on-screen order of comment cards in the active view:

1. Files in diff order.
2. Inside a file, cards in the order the active view renders them. On one row that is critical → low, which `sortBySeverity` already does. In split mode a deleted/added pair is one stack (`commentsForRow`); the walk follows that stack.
3. Then that file’s «Замечания вне diff», in the order already rendered.
4. After the last file, the PR-level block, in the order already rendered.

«Дальше» and «Назад» sit in the header row. «Дальше» on an empty selection opens the first comment. On the last comment it is disabled. «Назад» is disabled when there is no selection and when the selection is the first. Neither wraps.

The same navigation sets the current comment: «Дальше», «Назад», a level click, a sidebar file click, a click that opens a card, and a load or refresh whose hash is `#comment-<id>` and whose comment is in the set. The file `<select>` sets the current comment only when the chosen path has a visible comment.

A sidebar click opens the first visible comment of that file. Other files stay. It does not set `file`. The file `<select>` sets `file`. Choosing a file that has a visible comment hides the other files and opens that file’s first comment. Choosing «Все файлы» only clears `file` and keeps the current comment.

A file change means the `<select>` changed the `file` param. A sidebar click and «Сбросить» are not file changes.

«Дальше», «Назад», a click that opens a card, and choosing a path that has a visible comment write `#comment-<id>` and `state.jump`, the same way a level click does. The file choice writes the hash of that file’s first comment. Clearing the selection removes the hash. A comment-less path clears it that way.

Search does not navigate while typing. Changing unified / split does not navigate. A review poll that adds comments does not navigate.

If the current comment is no longer in the set, and this update is not a file change, clear the selection and do not scroll. `useHashTarget` does not expand or scroll an id outside the current set. The next «Дальше» starts at the first remaining comment. That covers search, a poll that drops the comment, and a `#comment-` that does not belong to the current filters. «Сбросить» and «Все файлы» grow or restore the set and keep the comment when it is still there.

A click that opens a card makes it current, expands it, scrolls to it, and marks it. A click that closes a card closes it. Closing does not move the selection. Closing the current card leaves it current and does not force it open again until the next navigation.

The current card is expanded on navigation, scrolled into view, and marked (`aria-current="true"` plus a visible ring). Other open cards stay open. Clearing the hash must not scroll. Repeating a navigation to the same hash still scrolls, using the existing `state.jump` on `useHashTarget`.

With no selection the counter is the set size plus the plural of «замечание»: if `n % 100` is 11–14, «замечаний»; otherwise if `n % 10` is 1, «замечание»; otherwise if `n % 10` is 2–4, «замечания»; otherwise «замечаний». So 1, 21 → замечание; 2, 4, 22 → замечания; 5, 11 → замечаний. With a selection it is «3 из 12», 1-based, in walk order.

## Out of scope

- Keyboard shortcuts.
- Filtering or walking by finding category.
- Any API or comment-schema change.
- Changing card sections, suggested fix, or split / unified behavior.
- Auto-selecting a comment on a fresh open that has no `#comment-` hash.
- Publishing to GitHub.

## Tests

Vitest, through the rendered review page and the filter helpers. Update existing cases that describe the old behavior.

- `filter.test.ts`: one level matches; `severity: null` matches all. Replace «severity filter keeps findings of any selected severity». Point `hasActiveFindingFilters` at `severity: 'low'` and `severity: null`, not `severities: ['low']`.
- `search-params.test.ts`: one `severity` is written. A repeated param keeps the first valid value.
- `PullRequestPage.test.tsx` «lists every file…»: the sidebar omits `src/features/new-feature.ts`. The file `<select>` lists diff paths in diff order (`user.ts`, `old-helper.ts`, `new-feature.ts`), then `src/missing.ts`.
- «renders a section per file»: the default diff omits `new-feature.ts`. Choosing it in the `<select>` shows the section with status `added`.
- «shows a placeholder for binary files»: `img/logo.png` is hidden until chosen in the `<select>`, then `binary-placeholder` is shown.
- `PullRequestPage.live.test.tsx` «shows every file without filters» and «offers to reset filters that match nothing»: two file sections, `src/api/user.ts` and `src/legacy/old-helper.ts`.
- Same file, «keeps only files with matching findings when filtered by severity from the URL»: those two files remain for `?severity=high`, and `severity-count-critical` stays 2 (`c1`, `c6`). `severity-count-high` stays 2.
- `PullRequestPage.routing.test.tsx` «keeps the chosen mode when navigating to another file»: the sidebar link sets `#comment-c4` and keeps `view=split`.
- Severity jump in that file: the click also leaves only that level on screen, folds gaps, and sets one `severity` param plus `#comment-<id>` and `state.jump`. A second click on the active level clears the level and keeps the hash.
- Fresh render with no hash: no `aria-current`, counter is the total, «Назад» is disabled, «Дальше» writes `#comment-<id>` for the first card.
- «Дальше» / «Назад» follow on-screen order, including an out-of-diff card and a PR-level orphan, write the hash, and stop at the ends.
- A gap button reveals those rows and survives «Дальше». «весь файл» reveals the file. A level change folds them again.
- Choosing a file that has comments hides the other files and opens its first comment. Choosing `new-feature.ts` shows that file in the diff only, clears the selection, and does not scroll. A level that was on stays clickable at 0.
- A sidebar link sets `#comment-` for that file’s first comment and does not set `file`.
- Opening a card by click writes its hash and sets it current. Closing it leaves the mark and the card closed, and leaves the hash.
- Typing a search that excludes the current comment removes the hash, clears `aria-current`, and does not scroll. The next «Дальше» opens the first remaining hit.
- Loading `#comment-<id>` selects that card. Loading a hash outside the active filter selects nothing and does not scroll.

## Done when

- One header row selects a level, shows the counter, and walks comments.
- Files and hunks with no visible comment are not a wall of lines.
- The cases in Tests pass, including the updated ones that used to expect every file and a jump that did not filter.
