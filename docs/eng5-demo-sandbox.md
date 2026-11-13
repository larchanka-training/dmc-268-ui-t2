# Sprint 5 Eng 5 — demo sandbox evidence

Public proof that the Team 2 bot reviews real pull requests end to end.
Board wording said “GitHub App page”; Team 2 ships **OAuth App + bot user**
(`dmc268-t2-bot`). Packaging below is that bot’s public profile and the OAuth
App listing, not a Marketplace install rewrite.

## Identities

| What | Where |
|---|---|
| Bot account / profile | [github.com/dmc268-t2-bot](https://github.com/dmc268-t2-bot) (display name **ReviewBot**) |
| OAuth App (human cabinet login) | GitHub → Settings → Developer settings → OAuth Apps → Team 2 app (name, homepage `https://dmc268-t2.ddns.net`, short description, callback unchanged) |
| Demo repository (bot-owned, public) | [dmc268-t2-bot/dmc-268-demo-sandbox](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox) |
| Connected in cabinet | staging UI → Repositories → this repo (Rules & settings uses `.review/rules.md` on `main`, parser `rules-md/1`) |

## Demo pull requests (bot reviews already posted)

Open each PR → **Conversation** / **Files** for the `dmc268-t2-bot` review.

| Story | PR | Expected | Observed |
|---|---|---|---|
| Clean / no findings | [#1](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox/pull/1) `demo/01-clean` | LGTM-style summary, no inline risks | Review summary: замечаний нет (`COMMENTED`, not Checks Approve) |
| Critical security | [#3](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox/pull/3) `demo/02-sql-injection` | Critical SQL injection comment | Inline **critical** on concatenated query |
| Rules violation | [#2](https://github.com/dmc268-t2-bot/dmc-268-demo-sandbox/pull/2) `demo/03-rules-docstring` | Cite `.review/rules.md` | Inline **medium**, cites **STY-1** |

Branches live on the demo repo (`main` + the three `demo/…` heads). Case map:
`CASES.md` in that repo.

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

## DoD checklist

- [x] Public demo repo with ≥3 PRs reviewed by the bot (clean / critical / rules)
- [x] Bot public packaging (profile + OAuth listing)
- [x] Log secret audit via automated suite (+ local log scan; staging deferred)
