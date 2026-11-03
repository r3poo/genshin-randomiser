# Genshin Team Randomiser

A single-page static site for drawing Genshin Impact teams. Build character pools, assign pools to
up to six teams of 1–4 members, and roll squads for co-op or Stygian Onslaught. Optionally keeps
members unique across teams. Everything is stored in your browser; there is no backend.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

```bash
pnpm typecheck && pnpm test && pnpm build   # what CI should run
```

`pnpm build` emits a static site to `out/` — that directory is the deployable artifact.

## Documentation

- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — commands, data refresh, storage format, deployment,
  and the verification checklist. Keep it current with any change to those.
- [`docs/data-sources.md`](docs/data-sources.md) — where the roster and artwork come from, how the
  two sources are joined, and the known data gaps.

## How it works

- The roster is a committed snapshot (`data/characters.json`, 131 characters) with portraits
  vendored into `public/characters/`. No runtime API calls.
- `lib/randomise.ts` treats unique-across-teams mode as a matching problem rather than a greedy
  loop, so a feasible configuration is never reported as impossible.
- Pools, teams, settings and history live in `localStorage` under
  `genshin-randomiser:state:v1`, and the same shape is what import/export moves between browsers.

## Refreshing game data

```bash
pnpm data && pnpm assets && pnpm test
```

Order matters — see the runbook.

---

Unofficial fan project. Character data and artwork belong to HoYoverse.
