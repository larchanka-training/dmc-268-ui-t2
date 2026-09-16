# Follow-up: Add Vitest and enable hard TDD gate

**Status:** open (tracked; out of `agents_setup` MR scope)  
**Repo:** `dmc-268-ui-t2`  
**Minimum scope:**

1. Add Vitest (or equivalent) so UI behaviour tests can run locally with one npm script.
2. Flip UI `AGENTS.md` **When behaviour changes** back to a hard failing-test-first gate (remove the soft “until a runner exists” exception).
3. Keep Close quality gate aligned (`npm run build` may remain; tests become required for behaviour changes).

**Out of minimum scope:** CI job expansion, full coverage quotas, E2E framework choice.

Until this lands, UI agents use soft TDD: prefer red→green when a runner exists for the seam; otherwise use `npm run build` as the interim quality gate.
