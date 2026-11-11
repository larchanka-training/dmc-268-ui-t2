# Incremental review, limits, quotas, and security

**Status:** Draft for team / lecturer acceptance — Tech Lead Sprint 4 DoD (English source of truth)  
**Date:** 2026-11-03  
**Role:** Tech Lead (Sprint 4) — Stas H.  
**Repo:** `dmc-268-ui-t2` — product design home is this `docs/` tree. Runtime detail cited from `dmc-268-api-t2`.  
**Russian:** deferred until this English file is accepted (`INCREMENTAL_REVIEW_AND_LIMITS_SPEC_RU.md`).

Parent overview: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).  
Pipeline / HTTP / persistence remain authoritative in the API repo (`PIPELINE_SPEC.md`, `openapi.yaml`, `BACKEND_ERD.md`). Do not fork those schemas here.

Board DoD target: this file must define the incremental analysis state machine, the duplicate-suppression algorithm, and rate-limiting / cost-quota / security policy. It is not “approved” until §8 team acceptance is checked.

---

## 1. Locked decisions (grill)

| ID | Decision |
|---|---|
| D1 | Deliverable is **this specification only** (no Tech Lead implementation stub). |
| D2 | General **repository auto-start on every `opened`/`synchronize`** remains a separate product setting (default off; not implemented). This card does **not** turn that flag on for all pushes. |
| D3 | Mid-flight newer head: **do not abort** the in-flight job. Finish it (it may publish on its frozen head). While it runs, reject other starts on the same PR. |
| D4 | **Narrow system follow-up (grill reopen → Q15 B):** when a job reaches terminal and the live PR head is already newer, the system **admits one** follow-up start for that latest head (delta when §3.3 allows). This does **not** require the general auto-start setting. Manual starts still use the same classification rules. |
| D5 | Coalesce to the **latest** live PR head at admission time (manual client must match live head; system follow-up revalidates head at finish). Only run delta when that head differs from the prior job’s `requested_head_sha`. |
| D6 | Delta base when elected prior `P` (§3.1) is `COMPLETED` or `PARTIAL`: analyze `P.requested_head_sha → current_head`. If no eligible `P`, full `merge_base → head`. The just-finished job is used only when it *is* that elected `P`. |
| D7 | “Already checked” = **path-level** omit for files with no diff in the delta range. Eng 3 optional exact/semantic cache is non-blocking. |
| D8 | Normative linkage **concepts**: `delta_base_sha`, prior review id (`rerun_of` or equivalent), coalesced target head. Exact column names are implementer-owned except where API already defines `rerun_of`. |
| D9 | A follow-up / newer-head start consumes **starts** and **active_jobs** like any new start (idempotent replay of the *same* job still does not double-charge). |
| D10 | Cross-cycle duplicates: **suppress at publish** by fingerprint vs prior bot markers (API #53 option 2). |
| D11 | Do **not** edit, resolve, or minimize prior-cycle GitHub bot comments in this sprint. |
| D12 | Existing hard guards stay law (see §5). Redis HTTP entry rate limiting is design intent, not a code DoD of this card. |
| D13 | Money: audit may show `tokens × configured unit_price`; **no** enforced spend/$ cap in Sprint 4. Playground spend is out of scope (one policy line in §5.4). |
| D14 | Security chapter is short + pointer to QA report; incremental-specific rule: do not feed prior PR review comments into the LLM for dedupe. |
| D15 | Checks API, chaos suite, Eng 3 engine internals: **pointers only**. |

Validated against API `main` @ `59a1e7c` and UI `main` @ `d07ded4` (3 Nov 2026, Asia/Jerusalem).

---

## 2. Current baseline (as-is on main)

These facts are descriptive. §3–§6 are normative for the incremental product.

| Topic | Current behaviour |
|---|---|
| Webhook `opened` / `synchronize` | Durable Level-1 intake only. **Does not** create `ReviewJob`. |
| Automatic start setting | Described in SYSTEM_DESIGN (default off). **No** API settings field / behaviour yet. |
| Start path | Authorized `startReview` (manual). Creates a new `ReviewJob` with frozen `requested_head_sha`. |
| Diff range today | Full `merge_base_sha…head_sha` every cycle. **No** delta analysis path. |
| In-flight vs push | Webhook does **not** refresh `ChangeRequest.head_sha` and does **not** abort analysis. Head refresh happens on start admission. |
| Same-PR concurrency | **Main today:** only an *equivalent* active job (same head + config) is blocked. **Normative (§3.2):** at most one active analysis per PR — API change required. |
| Quotas | `max_starts_per_hour` (default 10) per user+repository hour; `max_active_jobs` (default 4) per repository. `429 QUOTA_EXCEEDED`. |
| Diff guards | 50 files, 2000 changed lines, 10 MiB raw diff; skip binary / lock / generated / minified JS. Excess → coverage skip / empty artifact — not an unbounded LLM burn. |
| Per-run LLM budget | Request/token/chunk caps + durable ledger. No daily token or money enforcement. |
| Provider limits | `VCS_RATE_LIMITED`, LLM `RateLimitedError` / 429 cooldown and bounded worker retry. |
| Redis | Queue/transport. **No** Redis HTTP entry rate limiter in API code. |
| Fingerprints | Deduped **inside one review cycle**. Cross-cycle repeats can publish (pinned by QA regression; ticket #53). |
| Lineage | `rerun_of` already exists on start / `ReviewJob`. `delta_base_sha` / `prior_review_id` as delta metadata are **absent**. |
| Publication | Posts against the job’s frozen head. No outdated-comment cleanup. |
| Insights / cost UI | Analytics/audit on UI main; daily tokens + monetary cost marked unavailable (UI #28). |

Authoritative QA write-up: API [`docs/SECURITY_AND_REGRESSION_REPORT.md`](https://github.com/larchanka-training/dmc-268-api-t2/blob/main/docs/SECURITY_AND_REGRESSION_REPORT.md).  
Quota/audit product slice: [REPOSITORY_INSIGHTS.md](./REPOSITORY_INSIGHTS.md).

---

## 3. Incremental review — state machine

### 3.1 Actors and triggers

- **Start** means an admitted analysis job creation through the **same** admission/quota path, whether the caller is:
  - a human/UI `startReview`,
  - a future general auto-start on webhook (separate setting; out of this card’s ownership beyond “same path”), or
  - the **narrow system follow-up** in §3.2.1 (D4).
- This card still does **not** make every `synchronize` create a job when no review is in flight and general auto-start is off.
- **Current head `H`** = GitHub PR head SHA revalidated at admission time. For manual starts, the client `requested_head_sha` must match that live head (today: mismatch → `PR_HEAD_MISMATCH`). The server does not rewrite a stale *client* SHA under the hood; the system follow-up may target the freshly revalidated head because it is the admission actor (D5).
- **Prior job `P` (election rule):** among `ReviewJob` rows for the same change request with terminal `status ∈ {COMPLETED, PARTIAL}` and non-null `finished_at`, choose the one with the latest `finished_at` (tie-break: latest `created_at`, then id). In-flight jobs (`finished_at` is null) are **never** `P`. `FAILED`/`SKIPPED` jobs are never `P`. If the client sends `rerun_of`, it must equal that elected `P.id` (or an older terminal ancestor on the same PR explicitly allowed by API validation); otherwise admission fails with a safe conflict — do not invent a different parent silently. System follow-ups set `rerun_of` to **elected `P`** (which equals the just-finished job only when that job is itself eligible as `P`).

### 3.2 Machine

```text
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              [no active job]                                 │
                    │                                         │
         start admitted for head H                            │
                    │                                         │
                    ▼                                         │
         classify start (§3.3)                                │
           │                │                                 │
           ▼                ▼                                 │
      FULL_CYCLE      DELTA_CYCLE                             │
           │                │                                 │
           └────────┬───────┘                                 │
                    ▼                                         │
         job runs to terminal                                 │
         (may publish on frozen head)                         │
                    │                                         │
                    ▼                                         │
              [terminal]                                      │
                    │                                         │
         live head newer? (§3.2.1)                            │
           │ yes              │ no                            │
           ▼                  ▼                               │
    system admit one     idle until                           │
    follow-up start      manual/future                        │
           │             auto-start                           │
           └──────────────────┴───────────────────────────────┘
```

**In-flight rule (D3) — normative same-PR policy:** If any analysis job for this **change request** has `finished_at` null, a new human/UI `startReview` for the same PR (any head, including a newer one) is **rejected**. It must not cancel, abort, or replace the in-flight job. Map to an existing safe conflict such as `REVIEW_ALREADY_ACTIVE` (or a dedicated same-PR-busy code if API splits “equivalent active” from “any active on PR”). Quotas still apply when no in-flight job exists.

Rationale: today’s API only blocks an **equivalent** active tuple (same head + config); allowing a parallel newer-head job would skip intermediate heads and break delta lineage. This spec tightens that to **one active analysis per PR**.

Webhook `synchronize` during the run still does **not** create a parallel job; it may refresh intake artifacts only. The newer head is handled after finish via §3.2.1.

### 3.2.1 After finish — narrow system follow-up (D4)

This creates a **new** `ReviewJob` (new start). It does **not** reopen a terminal analysis row (compatible with `PIPELINE_SPEC`: terminal analysis is not reopened).

When job `J` becomes terminal (`COMPLETED` | `PARTIAL` | `FAILED` | `SKIPPED`):

1. Revalidate that the PR is still open and readable with current bot/access rules; read live head `H'`. If the PR is closed/stale, initiator lost access, or VCS denies revalidation → **stop**; emit a safe audit/reason (no retry storm).
2. If `H' == J.requested_head_sha` → **stop** (nothing newer).
3. If `H' ≠ J.requested_head_sha` → attempt **one** system-admitted start for `H'`:
   - **Classification always uses §3.3** with elected prior `P` (latest usable `COMPLETED`/`PARTIAL` on the PR — D6). Do **not** force FULL merely because `J` itself failed. Example: `J1` COMPLETED @ A, `J2` FAILED @ B, live head C → follow-up is **DELTA** from A→C when `J1` is elected `P`.
   - `rerun_of` = elected `P.id` when `P` exists; if `J` itself is that `P`, `rerun_of = J.id`. If no eligible `P`, omit `rerun_of` → **FULL_CYCLE**.
   - Initiator = `J`’s initiator (same user quota scope).
   - Charge `starts` / `active_jobs` per D9. If quota, access, or same-PR-busy check fails → do **not** start; emit a safe audit/reason (no crash loop).
4. Intermediate heads between `J.requested_head_sha` and `H'` are **skipped** (coalesce to latest).
5. This follow-up runs even when the repository’s general automatic-start setting is off or missing (narrow policy, not the global auto-start product).
6. **Durable “one attempt per finished job”:** record on `J` (or an outbox/idempotency row keyed by `follow_up_of=J.id`) that a follow-up was attempted or skipped with reason. At-least-once terminal delivery must not schedule a second follow-up for the same `J`. If that follow-up job later finishes and the head moved again, §3.2.1 applies to the **new** job (recursive hop), always coalescing to the then-latest head.

#### Implementation contract (for Eng 3 — normative concepts)

| Concern | Rule |
|---|---|
| Trigger | After durable terminalization of analysis for `J` (same place that sets terminal status / publish handoff), enqueue or run follow-up admission once under the durable key above. |
| Path | **Internal** admission reusing the same domain command/UoW as `startReview` (not a forged user JWT). HTTP `Idempotency-Key` is not required for the internal path; use durable key `system-follow-up:{J.id}` (or equivalent) so retries replay the same outcome. |
| Busy check | Before insert, enforce §3.2 (no other active job on this PR). |
| Manual race | If a human `startReview` for the same PR/`H'` wins first, system follow-up must no-op (busy, equivalent active, or idempotent “already started for head”); never two actives. |
| `rerun_of` validation | Normative: must reference elected `P` (or allowed ancestor). **API main today** only checks parent exists on the change request — tightening is an API gap. |

Manual starts after terminal remain allowed when no job is in flight; they use the same §3.3 classification.

### 3.3 Start classification

Let `P` be elected per §3.1 (or absent). Admission already ensured no in-flight job on this PR (§3.2).

| Condition | Cycle type | Analysis range | LLM input rule |
|---|---|---|---|
| No `P` | **FULL_CYCLE** | `merge_base → H` | Current full-cycle behaviour |
| `P` present and `H == P.requested_head_sha` | **SAME_HEAD** | — | Prefer HTTP **idempotency replay** of the same start key (no new job, no extra `starts` charge). A distinct new start key on the same head after terminal success: **reject** with a safe conflict (e.g. already reviewed for this head/config) unless the client sets explicit `force_full_rerun: true` (name flexible; OpenAPI later). Do not silently burn a second full cycle. System follow-up never targets SAME_HEAD (it only runs when `H' ≠ J.requested_head_sha`). |
| `P` present and `H ≠ P.requested_head_sha` | **DELTA_CYCLE** | `delta_base_sha = P.requested_head_sha` → `H` | Path-level omit (§3.4) |

`PARTIAL` is usable as `P`: limitations and skipped coverage from `P` remain historical; the delta job only claims new paths in its range.

### 3.4 Path-level “already checked”

For **DELTA_CYCLE**:

1. Build the commit-range diff `delta_base_sha…H` (not a silent substitute of full `merge_base…H` under the same name).
2. Apply the same file guards as full cycle (§5.1) to that range.
3. Any path with **no** diff hunks in that range is **omitted** from LLM chunks (treated as already checked for this follow-up).
4. Paths that change in the range are reviewed for the hunks in that range.
5. Optional Eng 3 exact/semantic cache may further skip identical fragments; absence of cache must not block delta correctness.

Hunk/line-level patching of prior findings onto surviving lines inside a also-edited file is **out of scope** (follow-up).

### 3.5 Required linkage concepts

Every delta (and explicit lineage rerun) start must record, in API-owned storage/DTO as Eng 3 lands:

| Concept | Meaning | Notes |
|---|---|---|
| `rerun_of` / prior review id | UUID of prior job `P` | `rerun_of` already exists on API start |
| `delta_base_sha` | `P.requested_head_sha` when cycle is DELTA | New; absent today |
| Target head | Admitted `requested_head_sha` = `H` | Already exists |
| Cycle kind | `FULL` \| `DELTA` (name flexible) | For audit/QA; may be derived |

### 3.6 Quotas on follow-up starts

A new job for a newer head is a **new start**: it reserves `starts` and `active_jobs` under current rules (D9). Idempotent HTTP replay of the **same** start key does not increment `starts` again.

---

## 4. Duplicate suppression algorithm (cross-cycle)

### 4.1 Intra-cycle (unchanged)

Within one `ReviewJob`, fingerprint dedupe of findings before publish remains as today (at most one comment per fingerprint). The existing publication selection cap (~20 inline fingerprints per review; see API `github-review-publication.md`) stays unchanged.

### 4.2 Cross-cycle suppress at publish (normative — API #53 option 2)

When preparing GitHub publication for job `J` (same path as today’s `prepare_github_review`):

1. Collect fingerprints selected for inline comments from `J`.
2. Load prior bot-published inline comments on the same PR that carry the durable marker form already used in API code: `<!-- dmc268-finding:{fingerprint} -->` (plus the review/head markers used for publish idempotency).
3. If fingerprint `F` matches a prior-cycle marker on this PR, **do not** open a new inline comment for `F` in `J` — even if the line moved or the surrounding text changed (fingerprint identity is enough; do not re-prompt the LLM to decide).
4. Optionally note suppressed fingerprints in the overview / limitations corpus as “already noted” (copy is implementer-owned; must not claim the issue is fixed).
5. Do **not** pass prior human or bot comment **bodies** into the LLM prompt to achieve dedupe (D14).

### 4.3 Outdated prior comments (explicit non-goal)

Board text mentions outdated/resolved comments. **This sprint’s policy (D11):**

- Do not resolve, minimize, or edit prior-cycle bot comments when lines move or disappear.
- GitHub timeline may retain comments on older commits; new cycle avoids **duplicate spam** via §4.2.
- Mapping/outdating remote threads is a later publication enhancement (Eng 5 / follow-up).

---

## 5. Limits, rate limiting, and cost quotas

### 5.1 Normative hard guards (keep current constants)

| Guard | Value (current main) | On exceed |
|---|---|---|
| Max files admitted | 50 | Extra paths skipped (`file_limit`) |
| Max changed lines | 2000 | Extra skipped (`line_limit`) |
| Raw diff size | 10 MiB | Intake/fetch failure / untrustworthy diff path |
| Skip classes | binary, lockfiles, generated markers, minified JS, ignore globs | Listed in coverage skipped |
| Hourly starts | `RepositorySettings.max_starts_per_hour` (default 10) | `429 QUOTA_EXCEEDED` |
| Active jobs | `RepositorySettings.max_active_jobs` (default 4) | `429 QUOTA_EXCEEDED` |
| Per-run LLM budget | Configured request/input/output/chunk caps | Terminal / partial with budget reasons |

Whole-PR “skip review” as a separate admin switch is **optional future**; not required to change numbers in this sprint.

### 5.2 Rate limiting — what this phrase means here

| Layer | Status | Spec stance |
|---|---|---|
| Admission quotas (`starts`, `active_jobs`) | Implemented | **Normative** |
| VCS / LLM provider 429 handling | Implemented | **Normative** — keep bounded retry; do not hammer |
| Redis HTTP entry rate limit | Not implemented | **Design intent** only (SYSTEM_DESIGN); not a Tech Lead code deliverable |

### 5.3 Cost quotas vs money display

| Concern | Sprint 4 policy |
|---|---|
| Technical cost control | §5.1 quotas + per-run token budget + delta/path omit + publish suppress |
| Enforced daily token or $ cap | **Out** — remains UI/API #28 territory |
| Audit money display | Eng 1 may show `cost = measured_tokens × configured_unit_price` (price from settings/config; this spec does **not** freeze a market $/M rate) |
| Incomplete usage | Must not present known partial token totals as a complete bill (already in REPOSITORY_INSIGHTS) |

### 5.4 Playground

Rules Playground LLM spend is **out of scope** for this document. When Eng 2 lands a real LLM simulate path, default recommendation is: if it calls the production gateway, it should eventually share technical budgets — decision deferred.

---

## 6. Security policy (TL slice)

### 6.1 Defer to QA

Security regression, chaos, prompt-injection, and secret-log findings live in API `SECURITY_AND_REGRESSION_REPORT.md`. This spec does not rewrite that report.

### 6.2 Incremental-specific rules

1. **Dedupe without prompt injection:** cross-cycle suppress uses stored fingerprints / bot markers at **publish** time, not prior comment text in the model prompt.
2. **Server-owned guards:** file skips, quotas, and budgets are enforced in API admission/analysis — not trusted from the client or PR author.
3. **Rules source:** repository instructions remain server-frozen settings / approved loader policy (ADR-0002 / existing rules isolation). Authors must not gain a path to widen quotas by editing PR text.
4. **Webhook authenticity:** HMAC + delivery idempotency remain mandatory before any future auto-start reuses intake artifacts.

---

## 7. Handoffs (non-normative for other cards)

| Role | Uses this spec to |
|---|---|
| Engineer 3 | Implement DELTA_CYCLE range, `delta_base_sha`, path omit, optional cache, and post-finish narrow follow-up admission (§3.2.1) |
| Engineer 5 / publication | Implement §4.2 suppress; Checks API stays their card |
| Engineer 1 | Wire cost display formula; keep #28 for enforced daily/$ caps |
| QA | Extend incremental regression beyond current “duplicates allowed” pin once §3–§4 land |
| DevOps | Unchanged by this doc except existing alert hooks on quota/LLM failure |

---

## 8. Acceptance checklist (spec DoD)

- [x] Single English SoT named for board DoD in UI `docs/`.
- [x] Incremental state machine (§3) — prior election, one active analysis per PR, finish then narrow system follow-up when head moved (delta when §3.3 says DELTA; D3–D6).
- [x] Duplicate suppression algorithm (§4) — intra-cycle unchanged; cross-cycle publish suppress by `dmc268-finding` fingerprint.
- [x] Rate limiting / quotas / cost policy (§5) — technical normative; money display only; Redis HTTP intent called out.
- [x] Security policy (§6) — short + QA pointer + incremental rules.
- [ ] Team / lecturer acceptance (required before treating this as approved SoT).
- [ ] Russian translation after acceptance.
- [ ] Implementers close API gaps in §2 / §3.2.1 (one active job per PR; internal follow-up path; `rerun_of` must match elected `P`) — not part of Tech Lead code DoD.

---

## 9. Document history

| Date | Change |
|---|---|
| 2026-11-03 | Initial proposal from Sprint 4 grill; aligned to API `59a1e7c` / UI `d07ded4`. |
| 2026-11-03 | Reopened D4 → Q15 **B**: narrow system follow-up after finish when live head is newer. |
| 2026-11-03 | Audit fixes: D6 vs FAILED finish, follow-up admission contract, SYSTEM_DESIGN carve-out, API concurrency gap. |
