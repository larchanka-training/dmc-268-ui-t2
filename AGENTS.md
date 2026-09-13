# AGENTS.md — DMC-268 UI (Team 2)

Always-on brief for coding agents. Longer procedures live in `.agents/skills/` (load on demand). Human wiring / skill matrix: `.agents/README.md`.

## How to work here

- Make the smallest change that solves the ask. Match existing patterns; do not invent structure without need.
- Prefer lint / typecheck / build over inventing process. Before calling work done, run the commands below and say what passed.
- Prefer `/grill-me` when scope is unclear, and `/tdd` when changing behaviour test-first. Other skills (`to-spec`, `to-tickets`, `project-code-review`) only when the user asks for them.

## Where to put outputs

Agreed lasting notes → team tracker (issue or PR). Session drafts → `.scratch/` (gitignored).

## When behaviour changes

Write a failing test first, then the minimal code to pass it. Test through public APIs (exported functions / components), not private helpers. One small slice at a time. Full procedure: `/tdd`.

## Stack

- Vite + React + TypeScript, npm
- Layout: `src/` (`App.tsx`, `main.tsx`)

```bash
npm install
npm run dev
npm run build   # tsc && vite build
```

Lint/format is not set up yet; use `npm run build` as the typecheck gate for now.
