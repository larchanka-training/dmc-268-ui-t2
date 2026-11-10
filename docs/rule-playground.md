# Rule Playground — Stages 1–2

Route: `/repos/:repositoryId/rule-playground`, inside the existing authenticated shell. Open it with **Rule Playground** in the repository row.

The wide layout has two panels: editable Code/Diff and `.review/rules.md` on the left, simulation and findings on the right. Below the `xl` breakpoint the panels stack vertically. Editors remain ordinary accessible textareas with a live highlighted preview using the existing Prism renderer. Preview is limited to 4000 characters / 100 lines; the full editable text is retained.

Code and Diff drafts survive switching modes. Validation errors appear beside their fields. Submission disables edits and duplicate requests. Errors preserve drafts; editing clears an obsolete result. Findings display available rule, severity, file, line and message. Output is escaped text.

## API contract

Based on [Backend PR #87](https://github.com/larchanka-training/dmc-268-api-t2/pull/87), head `e2268a6d0a003d9ed91be20ae881b8f162685a14`:

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

The current backend admission endpoint deliberately returns **503 SERVICE_UNAVAILABLE** for a valid request. It has no success DTO. Production does not accept the development mock DTO as a real success. No automatic POST retry or success fallback is used. A 401 rechecks the existing session; generic failures and 503 preserve entered drafts. Rules diagnostics from 422 appear at the rules editor, with line numbers and truncation notice when provided. Generic 422 does not invent field coordinates.

Client validation covers required values, normalized relative Code paths, 512-byte path limit, 64-KiB/500-line Code limit, 128-KiB Diff limit and 64-KiB rules limit (UTF-8). Full rules grammar, unified-diff parsing (50 files / 2000 changed lines) and the 256-KiB encoded request-body limit remain server-authoritative. Backend access checks include personal GitHub administrator permission; merely opening the page does not grant permission.

## Development demonstration

`pnpm dev` starts the existing MSW worker. Sign in using the existing development auth flow, open a connected repository, and choose **Сценарий development**:

- **API-контракт: 503 (MSW)** — default; mirrors the current admission refusal.
- **Mock: фиксированные замечания** — two fixed findings, after a short loading state: a complete audit and a sparse audit.
- **Mock: замечаний нет** — fixed empty result.

Enter a relative path, some code (or a unified diff), and a valid rules example above, then click **Симулировать ревью**. Mock responses carry `X-Rule-Playground-Mock: true` and `{ "mock": true, "findings": [...] }`; this is an explicitly development-only format. The first demo fixture always refers to `src/example.ts:3–4` and explicit `rule_ref: MOCK-1`; the second refers to `src/example.ts:7` without a rule reference, regardless of input. It does not parse rules, analyze code, call an LLM, reproduce every backend refusal or enforce live GitHub permissions. Mock successes are labeled in the result panel. They are unavailable in production builds.

## Review Audit Inspector — Stage 2

Each finding has a **Подробнее** disclosure button. Click, Enter or Space opens/closes the audit in place; selecting another finding closes the previous audit. Focus stays on the button, with `aria-expanded` and a stable `aria-controls` target. Starting another request closes the selection; edits, pending requests and errors remove the old result. A 503 never displays a previous mock audit as the current result.

The Inspector shows only returned data: title, severity, category, file and single line/range, explanation (or the finding message), evidence, fix recommendation, explicit rule reference/description and explicit model context. Without `rule_ref`, it displays **Связанное правило не указано**. It does not infer a rule from the old `rule` label, the finding text or the rules editor. Model context is never reconstructed from editor drafts. Confidence scores, verifier verdicts and private AI reasoning are not generated or displayed.

The development-only `MockFinding` extends the Stage 1 mock format with optional string fields `title`, `category`, `explanation`, `evidence`, `recommendation`, `rule_ref`, `rule_description`, `model_context`, and optional integer `end_line` (requires `line`, must be at least `line`). Existing `rule`, `severity`, `file`, `line`, `message` remain supported. These are **mock fields, not a real API success/audit contract**. Fields are runtime-validated before rendering. Both the result panel and the Inspector explicitly identify fixed mock data, including the mock context that was never sent to a model.

All returned Markdown/HTML is rendered as escaped plain text with preserved line breaks. HTML elements, event handlers and Markdown links are not activated. Long audit text wraps within the existing split/stack layout; no UI dependency was added.

## Verification

Vitest / Testing Library cover the real route and repository link, switching modes, editing rules, validation, exact Code/Diff requests, cookie/CSRF/header transport, loading, errors, 503, draft retention, safe mock output, empty results, diagnostics, bounded highlighting, stale-result reset and expired sessions. MSW integration tests exercise the fixed scenarios through the page and HTTP boundary. Inspector tests use that same public route/UI seam: opening, closing, Enter/Space, sparse fields, explicit rule/context provenance, inert hostile HTML/Markdown, switching without data mixing, mock labels, and mock → real-status 503 → later mock selection reset.

Run `pnpm validate` for lint, stylelint, formatting, typecheck, all tests and production build. Permanent screenshot/E2E tooling is not configured in this repository. Stage 2 uses temporary Playwright/Chromium outside project dependencies for desktop/mobile visual inspection; results and screenshots are recorded in `.scratch/issue-32-stage2-review.md` and `.scratch/issue-32-stage2-screenshots/`.

A real Inspector still requires a published backend success/audit DTO and an explicit integration change. Production continues to reject undocumented 200 responses, and the real endpoint currently returns 503. Confidence scores and verifier verdicts remain unavailable.
