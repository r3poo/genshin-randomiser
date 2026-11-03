# Data & asset sources

Research date: **2026-11-04**. Every URL below was probed live on that date.

## Decisions

- **Data strategy:** vendored snapshot. `scripts/fetch-characters.mjs` pulls the data once,
  writes `data/characters.json`, and that file is committed. The site never fetches at runtime.
- **No data dependency.** The `genshin-data` npm package is **not used** — it is ~406 MB because
  it bundles 12 locales. The script reads the English JSON files straight from GitHub instead,
  using only the `fetch` built into Node 18+.
- **English only.** No i18n layer.
- **`Elementless` is a first-class element value.** Manekin and Manekina have no element, so
  upstream sends `element: {"id":"","name":""}` — an empty string, not null. They are
  normalised to `Elementless` in `scripts/fetch-characters.mjs` via an explicit id allowlist
  (`ELEMENTLESS_IDS`), so it is a real category in filters rather than a hole. Only those two
  ids are allowlisted; any other blank element is a validation error, not silently absorbed.
- **Region excluded.** Not an app feature (user decision). Upstream `region` is unreliable anyway —
  17 of 131 values are internal codes, 12 have none at all. Dropped at the fetch step.
- **Roster scope:** all 131 entries returned by upstream, as-is.
- **Refresh:** `node scripts/fetch-characters.mjs` (≈2 s), then commit the diff. Add
  `--sha <commit>` to re-pin to a known revision.

## Character data — `dvaJi/genshin-data`

Primary source. Covers every field the app needs.

| | |
|---|---|
| repo | https://github.com/dvaJi/genshin-data |
| path | `src/data/english/characters/*.json` (131 files, 8.1 MB) |
| license | MIT |
| head | `fc16685` (2026-11-03) |
| characters | 131 |
| projected output | `data/characters.json`, 29.5 KB |

Per-character JSON shape (verified against Hu Tao):

```json
{
  "id": "hu_tao",
  "_id": 10000046,
  "name": "Hu Tao",
  "element":     { "id": "pyro",    "name": "Pyro" },
  "weapon_type": { "id": "polearm", "name": "Polearm" },
  "rarity": 5,
  "gender": { "id": "female", "name": "Female" },
  "region": { "id": "liyue",  "name": "Liyue" },
  "title": "Fragrance in Thaw",
  "description": "...",
  "affiliation": "Wangsheng Funeral Parlor",
  "birthday": [15, 7],
  "constellation": "Papilio Charontis",
  "release": 1614700800,
  "outfits": [], "cv": {}, "skills": [], "passives": [], "constellations": []
}
```

- `rarity` is a real number, always `4` or `5`.
- **No images.**

Enumeration is one GitHub Contents API call; the 131 file bodies are `raw.githubusercontent.com`
requests (8 concurrent, no auth needed). Both are pinned to the resolved commit SHA, so a run is
reproducible. Full run: **1.9 s, 0 failures**.

Keepers: `id` (slug), `gameId`, `name`, `title`, `element`, `weapon`, `rarity`, `gender`.
Everything else — region, affiliation, talents, constellations, voices, skills, ascension costs —
is dropped.

## Assets — Yatta (`gi.yatta.moe`)

Undocumented fan API (successor to ambr). No license statement; treat as a scrape target and
vendor the output. It is the de-facto community standard and is current, including Nod-Krai.

Roster: `GET https://gi.yatta.moe/api/v2/EN/avatar` → 136 entries with
`rank`, `element`, `weaponType`, `region`, `bodyType`, `icon`, `birthday`, `release`.

Assets (all verified `200`):

| Kind | URL | Size |
|---|---|---|
| Character portrait | `https://gi.yatta.moe/assets/UI/UI_AvatarIcon_{icon}.png` | 28–40 KB |
| Element (7) | `https://gi.yatta.moe/assets/UI/UI_Gcg_Tag_Element_{Fire,Water,Wind,Electric,Ice,Rock,Grass}.png` | ~1.5 KB |
| Weapon type (5) | `https://gi.yatta.moe/assets/UI/UI_Gcg_Tag_Weapon_{Sword,Claymore,Polearm,Bow,Catalyst}.png` | ~1 KB |
| Card art (optional) | `https://gi.yatta.moe/assets/UI/UI_Gacha_AvatarImg_{icon}.png` | ~1.8 MB — too heavy |

Portrait coverage is 136/136, including `UI_AvatarIcon_SkirkNew`, `UI_AvatarIcon_Columbina`,
`UI_AvatarIcon_Nefer`, `UI_AvatarIcon_Lauma`, `UI_AvatarIcon_Zibai`.

### What this repo vendors (`pnpm assets`)

`scripts/fetch-assets.mjs` downloads once and commits the result, so the site makes no third-party
request at runtime:

| Local path | Contents |
|---|---|
| `public/characters/{id}.png` | 129 portraits, keyed by our slug (not the upstream icon name) |
| `public/icons/element-{element}.png` | 7 element glyphs, keyed by our element name |
| `public/icons/weapon-{weaponType}.png` | 5 weapon glyphs |

The script writes the resolved path back into `data/characters.json` as `icon`, and sets it to
`null` when no portrait exists. Two roster entries have no art — `mitya` and `valeriy` — because
they are dvaJi-only entries that Yatta does not carry; the UI draws their initials instead. This is
expected, not a download failure.

There is **no `Elementless` glyph** in the Yatta asset set, so that chip falls back to a plain
label. The seven element glyphs are Fire/Water/Wind/Electric/Ice/Rock/Grass — note the naming does
not match our `Pyro`/`Hydro`/`Anemo`/`Electro`/`Cryo`/`Geo`/`Dendro`, so the mapping is explicit in
the script.

Re-running the script is idempotent: files already on disk are skipped unless `--force` is passed.

### The join key

The numeric game ID is shared (`gameId` in our output, the object key in Yatta) — join on that.

**`gameId` is not unique**, so `id` (the slug) is the primary key. All 7 Traveler variants share
`10000007`, and upstream has no male Traveler at all (Yatta carries both, `10000005`/`10000007`).

Do **not** derive icon names from character names — Skirk's icon is `UI_AvatarIcon_SkirkNew`,
and the Traveler is `10000005-pyro` / `10000007-hydro`. Yatta splits the Traveler into
7 elements × 2 body types (14 entries) plus 2 base entries, while dvaJi has 7 `traveler_*` slugs.

## Known gaps

1. **`element` is never empty** — `manekin` and `manekina` are normalised to the real value
   `Elementless` at fetch time (see Decisions). Every one of the 131 characters therefore has an
   element, so a filter never has to handle a null. If upstream ever blanks a *different*
   character's element, validation fails the run instead of absorbing it as `Elementless`.
2. **`gender` has three values**, not two: `Male`, `Female`, and `Male/Female` (the 7 Travelers).
3. **dvaJi includes entries Yatta's roster lacks:** `mitya`, `valeriy` — likely unreleased or
   datamined. Per the decision above these are kept in the pool; revisit if either looks wrong
   in the UI.
4. dvaJi data for future characters can lag a game update by a few days.

## Verified roster snapshot (2026-11-03 upstream state)

- 131 characters: **79 five-star**, **52 four-star**
- gender: Female 81, Male 43, Male/Female 7
- element: Hydro 18, Anemo 20, Electro 22, Cryo 22, Pyro 19, Geo 15, Dendro 13, Elementless 2
- weapon: Sword 36, Polearm 24, Bow 21, Claymore 20, Catalyst 30

Region is **not** in this snapshot: it was researched and then dropped as a product feature
(user decision). The analysis is not preserved here on purpose — if region ever comes back, the
raw field is still one `region` key away in every upstream file, and the two traps are:
17 of 131 entries are internal codes rather than nation names (`MAINACTOR`, `SNEZHNAYA_STAR`, …),
and `NODKRAI_ZIBAI` is Liyue, not Nod-Krai.

## Sources that are dead — do not use

| Source | Status on 2026-11-04 |
|---|---|
| `genshin.dev`, `api.genshin.dev` | Serves landing-page HTML only; API → 502 |
| `genshin.jmp.blue` | 521, Cloudflare origin down |
| `Dimbreath/GenshinData` | 404, repo removed |
| `ambr.top`, `api.ambr.top` | DNS does not resolve |
| `genshindev/api` | Alive but stale: last push 2026-03-31, 97 characters, missing Skirk → Nod-Krai |
| `theBowja/genshin-db` | Fine (MIT, Sep 2026) but 179 MB, no images, no gender |

No official HoYoverse API exists. All character art is HoYoverse IP; this project relies on the
same tolerated non-commercial fan use as every other Genshin tool. Ship a disclaimer footer.
