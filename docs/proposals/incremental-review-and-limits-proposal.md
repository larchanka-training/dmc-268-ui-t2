# Proposal: Incremental review, limits, quotas, and security (Sprint 4 Tech Lead)

**Status:** DECIDED grill → English spec draft pending team / lecturer acceptance; not implemented in API runtime  
**Date:** 2026-11-03  
**Repo:** `dmc-268-ui-t2` — design home is this `docs/` tree. API paths below are in `dmc-268-api-t2`.

The product choices below are closed by grill. This file is the change list. It does not reopen them. The normative draft is not “approved SoT” until the spec §8 acceptance box is checked.

Normative contract: [INCREMENTAL_REVIEW_AND_LIMITS_SPEC.md](../INCREMENTAL_REVIEW_AND_LIMITS_SPEC.md).  
Overview pointers: [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) §1 (contract list) and §4 (narrow post-finish follow-up carve-out).

## What already happens

Validated against API `main` @ `59a1e7c` and UI `main` @ `d07ded4` (3 Nov 2026).

- Webhook `opened` / `synchronize` stores Level-1 intake and does **not** create `ReviewJob`.
- Manual `startReview` creates a full-cycle job on `merge_base…head` with technical quotas and diff guards.
- Fingerprint dedupe is intra-cycle; cross-cycle duplicate publish is the current pinned behaviour (#53).
- `rerun_of` exists; `delta_base_sha` and delta analysis do not.
- Analytics/audit UI exists; daily token / money enforcement remain UI #28 / unavailable.

## What to change, and why

| Change | Why |
|---|---|
| Add English SoT `docs/INCREMENTAL_REVIEW_AND_LIMITS_SPEC.md` | Board DoD for Sprint 4 Tech Lead: state machine, duplicate suppress, limits/quotas/security policy. |
| Point `SYSTEM_DESIGN.md` §1 at that spec | Keep overview discoverable without forking API pipeline contracts. |
| Defer Russian copy | English is SoT until accepted. |
| **Not** implement delta engine / publish suppress / runtime follow-up in this Tech Lead **code** slice | DoD is specification only (D1). **Product norm** for follow-up remains in the spec §3.2.1 for Eng 3 to implement. |
| Spec **narrow system follow-up** after finish when head moved (D4 / Q15 B) | Waiting for a manual re-click after a superseded run is poor UX; still not the same as global auto-start on every push. |

## Locked decisions (summary)

See spec §1 (D1–D15). Short form: finish in-flight jobs (reject parallel starts on the PR); when finished and live head is newer, **system admits one** follow-up (usually delta); path-level omit; publish-time fingerprint suppress; no remote outdated-comment edits; existing guards normative; money display only; no Redis HTTP rate-limit code DoD; security = QA pointer + no prior comments in LLM for dedupe.

## Out of this proposal

General repository auto-start on every `opened`/`synchronize`, Checks API, semantic cache implementation, chaos suite, playground billing, enforced daily/$ caps.
