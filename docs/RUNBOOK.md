# Runbook

Operational notes for the Genshin Team Randomiser. Keep this file current: any change to the
commands, the data pipeline, the stored payload or the deployment target belongs here in the same
commit as the code change.

## What this is

A single-page, statically exported Next.js app. Users build character pools, point teams at pools,
draw random teams, and keep a local history. There is no server, no database and no runtime API
call: the roster ships as a committed JSON snapshot and every user configuration lives in the
browser's `localStorage`.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node | 24.x | `node --test` runs the TypeScript tests directly (type stripping). Node 22+ works if it is new enough to strip types. |
| pnpm | 12.x | Pinned in `package.json` (`packageManager`, `devEngines`); corepack will fetch it. |

```bash
pnpm install
```

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server on <http://localhost:3000>. |
| `pnpm typecheck` | `tsc --noEmit`. No emit, no incremental cache problems. |
| `pnpm test` | Node's built-in test runner over `tests/*.test.ts`. |
| `pnpm build` | Static export into `out/`. Fails on type errors. |
| `pnpm data` | Re-fetch the character roster (network). |
| `pnpm assets` | Re-fetch portraits and glyphs (network). |
| `pnpm start` | Not available — there is no server build. Serve `out/` instead. |

Preview the exported site exactly as it will be served:

```bash
pnpm build
npx --yes serve out      # or any static file server
```

## Repository map

| Path | Contents |
|---|---|
| `app/` | Route, layout, global styles. The page is a client component because all state is local. |
| `components/` | Teams, pools and history panels, portraits, banners, import/export. |
| `lib/types.ts` | Domain types plus the canonical element/weapon/rarity/gender lists. |
| `lib/characters.ts` | Loads `data/characters.json`, validates it, exposes `CHARACTERS` (name-sorted) and `CHARACTER_BY_ID`. |
| `lib/validate.ts` | Parser for stored/imported payloads. Every repair is reported as an `Issue`. |
| `lib/storage.ts` | `localStorage` probe, load and save. All access is wrapped; blocked storage is a supported state. |
| `lib/store.tsx` | Reducer, persistence effect, `useStore`. |
| `lib/defaults.ts` | The seeded first-run state (one full-roster pool, two teams of four). |
| `lib/randomise.ts` | Candidate unions and the unique-across-teams assignment. |
| `data/characters.json` | Committed roster snapshot, 131 entries. Generated — do not hand-edit. |
| `public/characters/` | 129 portraits, `{id}.png`. Generated. |
| `public/icons/` | Element and weapon glyphs. Generated. |
| `scripts/` | The two fetch scripts behind `pnpm data` and `pnpm assets`. |
| `tests/` | Pure-logic tests: filters, randomiser, parser, defaults. |

## Refreshing game data

Run in this order — `fetch-assets.mjs` rewrites `data/characters.json` to null out icons it could
not download, so running it before `fetch-characters.mjs` would waste the work.

```bash
pnpm data      # roster from dvaJi/genshin-data -> data/characters.json
pnpm assets    # portraits + glyphs -> public/ ; sets icon:null where no portrait exists
pnpm test
pnpm build
git add data public && git commit -m "chore(data): refresh roster"
```

Expected output of `pnpm assets` on a healthy run: `downloaded: 141` (129 portraits + 7 element
glyphs + 5 weapon glyphs) and two characters without art (`mitya`, `valeriy` — datamined entries
Yatta has no portrait for). Both are non-fatal; their `icon` becomes `null` and the UI draws
initials.

To pin the roster to a specific upstream revision: `node scripts/fetch-characters.mjs --sha <commit>`.
Source provenance and the research behind these URLs live in `docs/data-sources.md`.

## User data

- **Storage key:** `genshin-randomiser:state:v1`. Payload shape: `{ pools, teams, settings, history }`.
- **Corrupt payloads** are copied to `genshin-randomiser:state:v1:corrupt` before the loader falls
  back, so a user can recover a bad save by hand.
- **History** is capped at 200 entries (`HISTORY_LIMIT`), trimmed both on load and on write.
- **Blocked storage** (private mode, blocked cookies) is not fatal: a banner explains it, the app
  keeps working in memory, and import/export remain the way to keep a copy.
- **Resetting a browser:** devtools → Application → Local Storage → delete the key, or run
  `localStorage.removeItem("genshin-randomiser:state:v1")`.

### Import/export format

```json
{
  "app": "genshin-team-randomiser",
  "version": 1,
  "exportedAt": "2026-11-04T09:12:00.000Z",
  "state": { "pools": [], "teams": [], "settings": {}, "history": [] }
}
```

Import replaces the current configuration after a confirmation prompt. Unknown fields, unknown
character ids, references to missing pools and unusable history entries are dropped and listed in
the report, each naming the path it came from (for example `pools[0]: dropped 1 unknown
character(s): ghost-character`). A file whose `app` field does not match is rejected outright.

## Deployment

The build is a plain static export in `out/`. Two rules apply everywhere:

1. Build with `pnpm build`; publish `out/`, never `.next/`.
2. If the site is not served from the domain root, set `NEXT_PUBLIC_BASE_PATH` at build time
   (for example `/genshin-randomiser`). It is applied to `next.config.ts` `basePath` and to asset
   URLs in `lib/paths.ts`.

### Cloudflare Pages (primary target)

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `out` |
| Environment variables | `NODE_VERSION=24`, `NEXT_PUBLIC_BASE_PATH` unset |

### GitHub Pages

Project sites live under `/<repo>/`, so the base path is mandatory:

```bash
NEXT_PUBLIC_BASE_PATH=/genshin-randomiser pnpm build
touch out/.nojekyll          # keep the _next directory served
```

Publish `out/` to the `gh-pages` branch (or point Pages at an Actions artifact). Pushing requires
the repository owner's credentials — the agent cannot push.

### Any other static host

Upload `out/`. No rewrites are needed: there is a single route plus Next's `404.html`, and
`trailingSlash: true` means directory indexes resolve without server rules.

## Verifying a change

```bash
pnpm typecheck && pnpm test && pnpm build
```

Then check the exported site, not just the dev server — the static export is what ships:

1. First load shows one pool ("All characters", 131 members) and two teams of four.
2. `Randomise` fills both teams; with *Unique members across teams* on, no character repeats.
3. Reload: teams, pools and history survive.
4. Pools tab: the grid is name-sorted; turning off every element filter shows the "no characters
   match" message rather than an empty grid with no explanation.
5. Export, edit the file to include a bogus character id, import it: the character is dropped and
   the report says so.
6. History shows the draw with a timestamp; deleting an entry persists across reload.

## Known behaviour worth remembering

- **Hydration order.** State is seeded synchronously (`initialState()`) and replaced from storage
  in an effect. Panels render only after `hydrated`, so the server-rendered HTML never claims to
  know a user's saved data.
- **Results are tied to their inputs.** A draw is hidden as soon as pools, team sizes or the
  uniqueness setting change; the history entry stays.
- **Unique mode is a matching problem, not a greedy loop.** Teams that share pools are solved with
  augmenting paths, and an impossible configuration reports which teams cannot be filled instead of
  silently returning short teams.
- **Two characters have no portrait.** `mitya` and `valeriy` have `icon: null`; the UI draws
  initials. Do not treat a null icon as a data bug.
- **Elementless is a real element.** `manekin` and `manekina` have no element upstream; they are
  normalised to `Elementless` at fetch time and filter like any other element.
- **The Traveler is seven entries** sharing one `gameId`, labelled `Male/Female`. A gender filter
  for Male *or* Female includes them, and selecting both shows them once.
