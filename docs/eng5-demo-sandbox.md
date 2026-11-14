# Sprint 5 Eng 5 — demo sandbox evidence

Public proof that the Team 2 bot reviews real pull requests end to end.
Board wording said “GitHub App page”; Team 2 ships **OAuth App + bot user**
(`dmc268-t2-bot`). Packaging below is that bot’s public profile and the OAuth
App listing, not a Marketplace install rewrite.

Tracker card: [API #67](https://github.com/larchanka-training/dmc-268-api-t2/issues/67).
This evidence doc records what the live demo **actually** shows today; gaps vs
the full #67 wording are called out in the table (not claimed as done).

## Identities

| What | Where |
|---|---|
| Bot account / profile | [github.com/dmc268-t2-bot](https://github.com/dmc268-t2-bot) (display name **ReviewBot**) |
| OAuth App (human cabinet login) | GitHub → Settings → Developer settings → OAuth Apps → Team 2 app (name, homepage `https://dmc268-t2.ddns.net`, short description, callback unchanged) |
| Demo repository (bot-owned, public) | [dmc268-t2-bot/dmc-268-demo-sandbox](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox) |
| Connected in cabinet | staging UI → Repositories → this repo (Rules & settings uses `.review/rules.md` on `main`, parser `rules-md/1`) |

## Demo pull requests (bot reviews already posted)

Open each PR → **Conversation** / **Files** for the `dmc268-t2-bot` review.
Use **full URLs** below (bare `#1` / `#2` / `#3` in this UI repo point at the wrong
project).

| Story | GitHub PR (demo repo) | Branch / scenario | Expected (board / #67) | Observed (what to show) | Still open |
|---|---|---|---|---|---|
| Clean / no findings | [pull/1](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox/pull/1) | `demo/01-clean` (scenario S1) | LGTM / Approve | Summary: замечаний нет; review state `COMMENTED` (not GitHub Approve) | Formal Approve / Checks green |
| Critical security | [pull/3](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox/pull/3) | `demo/02-sql-injection` (scenario S2) | Blocking Check **and** critical comment | Inline **critical** on concatenated SQL | **No** check runs / commit statuses on head `d5dd442` — comment alone must **not** be shown as merge-block proof |
| Rules violation | [pull/2](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox/pull/2) | `demo/03-rules-docstring` (scenario S3) | Comment linking to a concrete line in `.review/rules.md` | Inline **medium** on `export_summary`; body **textually** mentions `STY-1` | Inline anchor is the **code** line, not a rules-file line; proving rule provenance from **base** `main` (vs rules rewrite on the PR head) remains open |

Numbering note: GitHub PR numbers (#1 / #2 / #3) are creation order, not
scenario order. Scenario S2 (SQL) is **pull/3**; scenario S3 (docstring) is
**pull/2**. Prefer this table over any older “PR 1/2/3” labels in the demo
repo’s `CASES.md`.

Branches: `main` + `demo/01-clean`, `demo/02-sql-injection`,
`demo/03-rules-docstring` on the demo repo.

## Log secret audit

Primary evidence is the API test suite (real logging pipeline; sentinel
webhook / GitHub write / LLM / JWT values must not appear in rendered JSON).

```bash
# from dmc-268-api-t2 checkout with its venv
python -m pytest tests/test_security_secrets_in_logs.py -q
# expect: 4 passed
```

Secondary: optional grep of local `logs/app.log` for credential-shaped strings
(`ghp_`, `github_pat_`, `sk-`, `sk_live_`, `whsec-`, `Bearer ghp|eyJ`). Staging
`docker logs` re-check is deferred until ops can share a slice after one demo
review.

Session notes (not product SoT): meta workspace
`.scratch/eng5_log_secret_audit.md`.

## DoD checklist (honest vs #67)

- [x] Public demo repo with ≥3 PRs reviewed by the bot (clean / critical comment / rules text cite)
- [x] Bot public packaging (profile + OAuth listing; not Marketplace GitHub App install)
- [x] Log secret audit via automated suite (+ local log scan; staging deferred)
- [ ] Blocking Check Run on critical demo PR (depends on Checks / commit-status path)
- [ ] Rules demo: inline (or review body) link to a concrete `.review/rules.md` line from **base**
