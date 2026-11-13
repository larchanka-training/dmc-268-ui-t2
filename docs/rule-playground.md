# Rule Playground — Stages 1–2

Route: `/repos/:repositoryId/rule-playground`, inside the existing authenticated shell. Open it with **Rule Playground** in the repository row.

The wide layout has two panels: editable Code/Diff and `.review/rules.md` on the left, simulation and findings on the right. Below the `xl` breakpoint the panels stack vertically. Editors remain ordinary accessible textareas with a live highlighted preview using the existing Prism renderer. Preview is limited to 4000 characters / 100 lines; the full editable text is retained.

Code and Diff drafts survive switching modes. Validation errors appear beside their fields. Submission disables edits and duplicate requests. Errors preserve drafts; editing clears an obsolete result. Findings display available rule, severity, file, line and message. Output is escaped text.

## One-click examples

Choose **SQL-инъекция** (Code, `src/users.py`, SEC-1), **Архитектура** (Diff, `src/domain/order.ts`, ARCH-1) or **Кодстайл** (Code, `src/totals.py`, STY-1). A click fills in the input, mode and `rules-md/1` rules. You can edit the draft or immediately choose **Симулировать ревью**. Choosing another example clears the previous result or error. The SQL example constructs a query string for static inspection and never executes it.

For a demonstration, choose **Mock: фиксированные замечания** in development and submit an unchanged example. Open **Подробнее** to inspect the matching rule, file, line and evidence. This fixture has no model behind it. If you edit the example, reload it to reproduce the fixed result or switch the development scenario to exercise error or empty states. Production sends the editable draft through the normal authenticated API.

## API contract

Based on [Backend PR #87](https://github.com/larchanka-training/dmc-268-api-t2/pull/87), verified at `ac503ee`:

```http
POST /api/v1/repositories/{id}/rule-simulations
Content-Type: application/json
X-CSRF-Token: <current /me token>
Idempotency-Key: <fresh UUID>
```

Existing cookie authentication and session hooks are reused. The UUID satisfies the required transport header; this frontend adds no idempotency storage or replay mechanism.

Code body:

```json
{
  "input": { "kind": "code", "path": "src/example.ts", "source": "const answer = 42\n" },
  "rules": { "format": "rules-md/1", "markdown": "# Security\n## SEC-1: Validate input\nCheck the input.\n" }
}
```

Diff replaces only `input` with `{ "kind": "diff", "unified_diff": "..." }`.

In the default API configuration, a valid request returns **503 SERVICE_UNAVAILABLE**. The API contract also defines a Code/Diff HTTP 200 response when an executor is configured; the UI does not enable that executor. Production rejects the development mock DTO. No automatic POST retry or success fallback is used. A 401 rechecks the existing session; generic failures and 503 preserve entered drafts. Rules diagnostics from 422 appear at the rules editor, with line numbers and truncation notice when provided. Generic 422 does not invent field coordinates.

Client validation covers required values, normalized relative Code paths, 512-byte path limit, 64-KiB/500-line Code limit, 128-KiB Diff limit and 64-KiB rules limit (UTF-8). Full rules grammar, unified-diff parsing (50 files / 2000 changed lines) and the 256-KiB encoded request-body limit remain server-authoritative. Backend access checks include personal GitHub administrator permission; merely opening the page does not grant permission.

## Development demonstration

`pnpm dev` starts the existing MSW worker. Sign in using the existing development auth flow, open a connected repository, and choose **Сценарий development**:

- **API-контракт: 503 (MSW)** — default; mirrors the current admission refusal.
- **Mock: фиксированные замечания** — one matching audit for each unchanged one-click example, or two fixed demonstration findings for manual input.
- **Mock: замечаний нет** — fixed empty result.

Enter a relative path, some code (or a unified diff), and a valid rules example above, then click **Симулировать ревью**. Mock responses carry `X-Rule-Playground-Mock: true` and `{ "mock": true, "findings": [...] }`; this is an explicitly development-only format. For manual input, the first demo fixture refers to `src/example.ts:3–4` and explicit `rule_ref: MOCK-1`; the second refers to `src/example.ts:7` without a rule reference, regardless of input. It does not parse rules, analyze code, call an LLM, reproduce every backend refusal or enforce live GitHub permissions. Mock successes are labeled in the result panel. They are unavailable in production builds.

## Review Audit Inspector — Stage 2

Each finding has a **Подробнее** disclosure button. Click, Enter or Space opens/closes the audit in place; selecting another finding closes the previous audit. Focus stays on the button, with `aria-expanded` and a stable `aria-controls` target. Starting another request closes the selection; edits, pending requests and errors remove the old result. A 503 never displays a previous mock audit as the current result.

The Inspector shows only returned data: title, severity, category, file and single line/range, explanation (or the finding message), evidence, fix recommendation, explicit rule reference/description and explicit model context. Without `rule_ref`, it displays **Связанное правило не указано**. It does not infer a rule from the old `rule` label, the finding text or the rules editor. Model context is never reconstructed from editor drafts. Confidence scores, verifier verdicts and private AI reasoning are not generated or displayed.

The development-only `MockFinding` extends the Stage 1 mock format with optional string fields `title`, `category`, `explanation`, `evidence`, `recommendation`, `rule_ref`, `rule_description`, `model_context`, and optional integer `end_line` (requires `line`, must be at least `line`). Existing `rule`, `severity`, `file`, `line`, `message` remain supported. These are **mock fields, not a real API success/audit contract**. Fields are runtime-validated before rendering. Both the result panel and the Inspector explicitly identify fixed mock data, including the mock context that was never sent to a model.

All returned Markdown/HTML is rendered as escaped plain text with preserved line breaks. HTML elements, event handlers and Markdown links are not activated. Long audit text wraps within the existing split/stack layout; no UI dependency was added.

## Verification

Vitest / Testing Library cover the real route and repository link, switching modes, editing rules, validation, exact Code/Diff requests, cookie/CSRF/header transport, loading, errors, 503, draft retention, safe mock output, empty results, diagnostics, bounded highlighting, stale-result reset and expired sessions. MSW integration tests exercise the fixed scenarios through the page and HTTP boundary. Inspector tests use that same public route/UI seam: opening, closing, Enter/Space, sparse fields, explicit rule/context provenance, inert hostile HTML/Markdown, switching without data mixing, mock labels, and mock → real-status 503 → later mock selection reset.

Run `pnpm validate` for lint, stylelint, formatting, typecheck, all tests and production build. Permanent screenshot/E2E tooling is not configured in this repository. Stage 2 uses temporary Playwright/Chromium outside project dependencies for desktop/mobile visual inspection; results and screenshots are recorded in `.scratch/issue-32-stage2-review.md` and `.scratch/issue-32-stage2-screenshots/`.

## Verified local service results — Stage 10

The same HTTP client and Split View now accept an exact HTTP 200 matching the local `CodeSimulationResult` / `DiffSimulationResult`. The decoder accepts the documented service DTO. In the default configuration, the backend still returns canonical 503. Frontend tests use deterministic MSW responses; no LLM is called.

Real results contain only `findings` (at most 100) and a nonnegative safe-integer `rejected_count`. Each Code finding requires `rule_ref`, `path`, positive safe-integer `start_line` / `end_line` (inclusive, ordered), `title`, `explanation` and `evidence`; Diff additionally requires `side: 'old' | 'new'`. The decoder follows the service's relative-path and string-length constraints. Missing fields, unknown fields, invalid JSON/types/ranges, mixed DTOs and other successful HTTP statuses reject the entire response with the existing safe error. It never displays a valid subset of a malformed response.

The explicit adapter maps `path` to the existing `file` view field, `start_line` to `line`, and `title` to the list message; other available text/range fields remain literal. The Inspector shows exact paths/ranges and Diff side, and the summary shows accepted/rejected counts without inventing rejected findings. Empty accepted findings show **Замечаний нет.** No severity, category, recommendation, confidence, verifier verdict or model context is created for real findings. `rule_ref` is required by the real DTO; the existing neutral missing-rule message remains available for sparse development mocks.

`source: 'real' | 'mock'` is frontend state, never a request/backend field. Real requires a fully valid service DTO and no mock marker in either header or body. Mock requires development mode, the exact `X-Rule-Playground-Mock: true` header and `body.mock === true`, plus the existing mock shape. Both panel and Inspector show Mock labels only for mock results. Production accepts valid real DTOs and rejects mock successes. Every returned string uses escaped React text, including HTML/Markdown.

The route/MSW tests also cover malformed success and provenance combinations, production mock refusal, stale result/Inspector removal during a new request and after errors, retained drafts, and canonical 503 without retry or mock fallback. Confidence scores and verifier verdicts remain unavailable.
