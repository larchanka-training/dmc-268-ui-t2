# Repository rules and settings

Open **Rules & settings** from a connected repository or its pull-request list.
The authenticated route is `/repos/:repositoryId/settings`. **Review history**
opens the existing audit log with that repository selected.

The companion API contract is [API PR #77](https://github.com/larchanka-training/dmc-268-api-t2/pull/77),
verified against `45895842f67aa44223f1d419a0622fd36bcb0d94`.
Its [OpenAPI](https://github.com/larchanka-training/dmc-268-api-t2/blob/45895842f67aa44223f1d419a0622fd36bcb0d94/openapi.yaml)
remains the wire source of truth; the UI does not introduce a separate settings schema.

## Preferences and access

Administrators can change three preferences:

- **Automatic reviews** controls new accepted pull-request open/update events;
  it does not disable manual starts. The server chooses the authorizing actor.
- **Base branches** is a list of exact Git names, one per line. Empty allows
  all bases. These are not patterns. Server validation bounds the list at 128
  entries and each name at 1024 UTF-8 bytes; invalid input remains in the draft
  after 422 so the user can correct it.
- **Publication minimum severity** offers all four wire severities. All findings
  maps to `low`; medium/high/critical include that severity and higher. This
  filters outgoing publication, while saved findings remain in review history.

Values come from the canonical API response. A reader's settings403 hides the
editor without fabricating off/default controls or logging the user out.
Readers can still use file preview and history when they retain read access.
The backend rechecks current personal GitHub admin/read permission; cached
repository capabilities never grant write access.

## Conditional save and drafts

The form retains the full canonical settings baseline and its opaque ETag as
one snapshot. Only the three preferences are edited. Rules, ignores, quotas,
language and surrounding-line settings are copied from that captured baseline
into a complete conditional PUT; response metadata/internal actor fields are
excluded. The original ETag is sent unchanged in `If-Match`, with the current
session's CSRF token and cookie credentials. The browser supplies Origin.

Background refresh cannot replace a dirty draft's hidden fields or ETag.
Temporary refresh errors retain the draft. Save is disabled while pending and
mutations do not retry automatically. A 409 preserves edits and explains the
conflict. **Reload current settings and discard edits** explicitly discards the
draft and reads a fresh baseline; the UI never silently rebases or retries it.
New edits remove the previous saved confirmation and report unsaved changes.

Successful writes cancel older settings GETs and cache the accepted full
snapshot/ETag together. Updates are scoped to the current principal and original
active query instance; an old response cannot repopulate an abandoned or denied
screen. Settings/preview cache entries are scoped to user and repository and
expire when unobserved. A repository/user switch therefore does not carry a
draft into the next scope. Resource read-denial clears sibling private data and
cancels old reads; admin-only denial preserves the independent read preview.
New requests 401 follow the existing `/me` recheck and login return-URL flow.

Unsupported legacy settings 409 provides no complete canonical baseline, so the
UI shows an explicit migration state and refresh action. It does not guess
hidden values or reset them. A historical non-`ru` language is also unavailable
for this editor because canonical PUT currently accepts only `ru`; the UI never
coerces it. An administrator's recovery path is the API's deliberately complete
canonical replacement using its recovery ETag, Origin and CSRF, documented in
[API repository settings](https://github.com/larchanka-training/dmc-268-api-t2/blob/45895842f67aa44223f1d419a0622fd36bcb0d94/docs/repository-settings.md).
This page is not a database-rules/quotas/language editor.

## File preview

Preview uses only parsed criteria from root `.review/rules.md`, never database
instructions. It labels the current default branch, resolved immutable commit
SHA and path, with blob/content digest and parser provenance in details. Existing
reviews retain their saved context; this preview does not change an admitted run.
Refresh requests a newly resolved snapshot. Absent, empty and invalid content
have distinct messages, with safe diagnostic codes for invalid content.
Provider/access errors remain explicit errors rather than absence. Cached old
criteria are hidden after a failed refresh.

Criteria are rendered as plain React text, including hostile Markdown/HTML-like
strings. No raw HTML, Markdown renderer or executable links are introduced.

## Verification boundary

Public client/component tests exercise real fetch clients, routes and Query
state against contract-shaped HTTP responses: full PUT/CAS, dirty refresh,
pending/error states, role/session changes, late GET/PUT responses, safe preview
and navigation. They do not claim live API/provider interoperability.

Release acceptance pairs exact API/UI heads using production assets and actual
HTTP/session/CSRF/database persistence, without frontend MSW or private Query
substitution. It covers desktop/mobile/keyboard rendering, reload persistence,
conflicts, viewer/admin boundaries, source refresh and existing audit navigation.
Synthetic provider transports can supply public fixture data without inference,
real GitHub review publication or deployment.
