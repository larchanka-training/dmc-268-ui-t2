# Follow-up: Add Vitest and enable hard TDD gate

**Status:** done (Vitest + hard TDD gate in `AGENTS.md`)  
**Repo:** `dmc-268-ui-t2`

## Landed

1. Vitest is the UI runner: `pnpm test` / `pnpm test:watch` (`package.json`); config in `vite.config.ts` + `src/test/setup.ts`.
2. UI `AGENTS.md` **When behaviour changes** requires failing-test-first (no soft “until a runner exists” exception).
3. Close quality path uses **pnpm** (`pnpm validate` / `pnpm test` / `pnpm build`).

**Out of this follow-up:** CI job expansion, full coverage quotas, E2E framework choice.
