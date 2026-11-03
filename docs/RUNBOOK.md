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
| `pnpm test` | Node's built-in test runner over `tests/*.test.ts`. No browser, no DOM, no network. |
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

## Theming

All colours are tokens in `app/globals.css` under `@theme`; Tailwind v4 turns each one into
utilities (`--color-panel-2` → `bg-panel-2`, `text-panel-2`, …). Components must use those
utilities, never raw palette values — a hardcoded `bg-slate-700` would survive a theme change and
quietly break the dark-violet base.

| Token | Role |
|---|---|
| `ink`, `panel`, `panel-2` | Page, card, hover/elevated surfaces |
| `line` | Borders and dividers |
| `strong`, `body`, `soft`, `muted` | Text ramp, brightest to dimmest |
| `accent`, `accent-hover` | Genshin menu gold: focus rings, selected chips, primary buttons |
| `rarity-5`, `rarity-4` | 5★ gold and 4★ lavender |
| `warning`, `danger` | Banners, error reports, validation issues |
| `anemo`…`elementless` | Game-canonical element colours, not derived from the base palette |

Two rules when editing the palette:

1. Keep every text token at WCAG AA (4.5:1) against `panel`, not against `ink`. Cards are where
   text actually sits.
2. Element and rarity colours must stay distinguishable from each other and from `accent`;
   `text-rarity-4` sits close to the violet base on purpose but stays lighter than `line`.

The palette is a single-hue harmony (violet base ≈265°, warm accent ≈40°) in the Adobe Color
sense: one dominant hue, a neutral surface ramp, one complementary accent. Element colours are
the deliberate exception.

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

Automated gate — must be green before a commit:

```bash
pnpm typecheck && pnpm test && pnpm build
```

What the 63 tests cover, all without a browser:

| File | Covers |
|---|---|
| `tests/filters.test.ts` | Additive filter semantics, empty category shows nothing, Traveler gender behaviour, canonical ordering. |
| `tests/randomise.test.ts` | Pool unions, size clamping, error messages, and unique mode against feasible, tight and infeasible configurations. |
| `tests/validate.test.ts` | Import parsing: unknown fields and characters, duplicate ids, dangling pool references, history ordering, trimming and timestamp rejection. |
| `tests/storage.test.ts` | `localStorage` with a fake `window`: round-trip, absent window, throwing getter, quota error, corrupt-JSON backup. |
| `tests/data-integrity.test.ts` | The committed roster: canonical enums, unique ids and names, name sort order, every `icon` file present on disk, known art gaps. |
| `tests/defaults.test.ts` | First-run seed shape and its round-trip through the importer. |

Manual checks belong to the site owner and need a real browser against `out/` (serve it, do not
rely on `pnpm dev`):

1. First load shows one pool ("All characters", 131 members) and two teams of four.
2. `Randomise` fills both teams; with *Unique members across teams* on, no character repeats.
3. Reload: teams, pools and history survive.
4. Pools tab: the grid is name-sorted; turning off every element filter shows the "no characters
   match" message rather than an empty grid with no explanation.
5. Export, edit the file to include a bogus character id, import it: the character is dropped and
   the report says so.
6. History shows the draw with a timestamp; deleting an entry persists across reload.
7. Blocked storage: load the site with `localStorage` disabled and confirm the banner appears and
   the app still runs.

## Known behaviour worth remembering

- **Hydration order.** State is seeded synchronously (`initialState()`) and replaced from storage
  in an effect. Panels render only after `hydrated`, so the server-rendered HTML never claims to
  know a user's saved data.
- **Pool names are labels, not identity.** `id` is the key everywhere (teams reference pool ids,
  history does not reference pools at all), so renaming a pool cannot break a team or a saved draw.
  The name field is inline in the pool editor, takes focus when a pool is created, and a blank or
  whitespace-only name is normalised to `DEFAULT_POOL_NAME` ("Untitled pool") on blur — never
  stored empty.
- **Results are tied to their inputs.** A draw is hidden as soon as pool membership, team sizes or
  the uniqueness setting change; the history entry stays. Renaming a pool or a team does not hide
  it — `configSignature` in `components/TeamsPanel.tsx` fingerprints ids and membership only.
- **Unique mode is a matching problem, not a greedy loop.** Teams that share pools are solved with
  augmenting paths, and an impossible configuration reports which teams cannot be filled instead of
  silently returning short teams.
- **Two characters have no portrait.** `mitya` and `valeriy` have `icon: null`; the UI draws
  initials. Do not treat a null icon as a data bug.
- **Elementless is a real element.** `manekin` and `manekina` have no element upstream; they are
  normalised to `Elementless` at fetch time and filter like any other element.
- **The Traveler is seven entries** sharing one `gameId`, labelled `Male/Female`. A gender filter
  for Male *or* Female includes them, and selecting both shows them once.
