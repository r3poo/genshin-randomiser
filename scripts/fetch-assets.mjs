#!/usr/bin/env node
/**
 * Downloads the image assets the UI needs into `public/`.
 *
 *   node scripts/fetch-assets.mjs           # fetch anything missing
 *   node scripts/fetch-assets.mjs --force   # re-download everything
 *
 * Character portraits and the element/weapon glyphs come from gi.yatta.moe, the same fan-hosted
 * source the character data is derived from (see docs/data-sources.md). Output is committed, so
 * the site never touches the network at runtime and builds stay reproducible offline.
 *
 * Portraits are joined to our roster on the numeric game id, which is why the script reads
 * `data/characters.json` rather than re-deriving names: Skirk's icon is `SkirkNew`, and the
 * Traveler is split into per-element entries upstream. Icon names cannot be guessed from names.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data", "characters.json");
const PUBLIC = path.join(ROOT, "public");
const ROSTER_URL = "https://gi.yatta.moe/api/v2/EN/avatar?";
const ASSET_BASE = "https://gi.yatta.moe/assets/UI";
const CONCURRENCY = 8;
const FORCE = process.argv.includes("--force");

// Upstream element ids use in-game names, ours use the display names. `Elementless` has no
// glyph upstream — the UI draws its own marker, so it is deliberately absent here.
const ELEMENT_TAGS = {
  Anemo: "Wind",
  Geo: "Rock",
  Electro: "Electric",
  Dendro: "Grass",
  Hydro: "Water",
  Pyro: "Fire",
  Cryo: "Ice",
};

const WEAPON_TAGS = ["Sword", "Claymore", "Polearm", "Bow", "Catalyst"];

async function exists(file) {
  try {
    const s = await stat(file);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (!FORCE && (await exists(dest))) return "skipped";
  const res = await fetch(url, { headers: { "User-Agent": "genshin-randomiser/asset-fetch" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 256) throw new Error(`suspiciously small file (${bytes.byteLength} B): ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return "downloaded";
}

async function main() {
  const characters = JSON.parse(await readFile(DATA, "utf8"));

  const res = await fetch(ROSTER_URL, { headers: { "User-Agent": "genshin-randomiser/asset-fetch" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${ROSTER_URL}`);
  const roster = (await res.json()).data.items;

  const iconFor = new Map();
  for (const [key, entry] of Object.entries(roster)) {
    if (entry?.icon) iconFor.set(key, entry.icon);
  }

  const tally = { downloaded: 0, skipped: 0 };
  const missing = [];
  const failed = [];
  const withoutIcon = new Set();

  async function fetchOne(character) {
    // The seven Traveler variants share gameId 10000007; upstream disambiguates them with a
    // `-{element}` suffix. Everything else is keyed by the bare id.
    const key = character.id.startsWith("traveler_")
      ? `${character.gameId}-${character.element.toLowerCase()}`
      : String(character.gameId);
    const icon = iconFor.get(key);
    if (!icon) {
      missing.push(`${character.id} (gameId ${character.gameId})`);
      withoutIcon.add(character.id);
      return;
    }
    try {
      const outcome = await download(
        `${ASSET_BASE}/${icon}.png`,
        path.join(PUBLIC, "characters", `${character.id}.png`),
      );
      tally[outcome] += 1;
    } catch (err) {
      failed.push(`${character.id}: ${err.message}`);
      withoutIcon.add(character.id);
    }
  }

  const queue = [...characters];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await fetchOne(queue.shift());
    }),
  );

  // Glyphs: 7 elements + 5 weapon types, ~1.5 KB each.
  for (const [element, tag] of Object.entries(ELEMENT_TAGS)) {
    const outcome = await download(
      `${ASSET_BASE}/UI_Gcg_Tag_Element_${tag}.png`,
      path.join(PUBLIC, "icons", "element", `${element.toLowerCase()}.png`),
    );
    tally[outcome] += 1;
  }
  for (const weapon of WEAPON_TAGS) {
    const outcome = await download(
      `${ASSET_BASE}/UI_Gcg_Tag_Weapon_${weapon}.png`,
      path.join(PUBLIC, "icons", "weapon", `${weapon.toLowerCase()}.png`),
    );
    tally[outcome] += 1;
  }

  // Keep data/characters.json honest: a character with no published portrait points at nothing,
  // so the field becomes null and the UI draws its initials fallback instead of a broken image.
  if (withoutIcon.size) {
    for (const character of characters) {
      if (withoutIcon.has(character.id)) character.icon = null;
    }
    await writeFile(DATA, `${JSON.stringify(characters, null, 2)}\n`);
  }

  console.log(`characters: ${characters.length}`);
  console.log(`icons:      ${Object.keys(ELEMENT_TAGS).length} element, ${WEAPON_TAGS.length} weapon`);
  console.log(`downloaded: ${tally.downloaded}, already present: ${tally.skipped}`);

  if (missing.length) {
    console.log(`\nno portrait exists upstream for ${missing.length} (icon set to null):`);
    for (const m of missing) console.log("  " + m);
  }
  if (failed.length) {
    console.error(`\n${failed.length} download(s) failed:`);
    for (const f of failed) console.error("  " + f);
    process.exitCode = 1;
  }
}

await main();
