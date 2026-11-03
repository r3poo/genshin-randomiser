#!/usr/bin/env node
/**
 * Fetch English Genshin character data straight from the dvaJi/genshin-data repo.
 *
 *   node scripts/fetch-characters.mjs
 *   node scripts/fetch-characters.mjs --sha <commit>      # pin to a known revision
 *
 * No dependencies — uses the global fetch built into Node 18+.
 *
 * Pulls the 131 per-character JSON files, keeps only the fields the app needs,
 * and writes data/characters.json (~42 KB). The output is committed to the repo,
 * so the site never touches the network at build or run time.
 *
 * Upstream data is MIT licensed: https://github.com/dvaJi/genshin-data
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER = "dvaJi";
const REPO = "genshin-data";
const DIR = "src/data/english/characters";
const OUT = "data/characters.json";
const CONCURRENCY = 8;

// Upstream leaves `element` empty for these two. They get an explicit category rather than a
// null, so no filter or icon lookup ever has to special-case a missing value.
// Anything ELSE missing an element is a data change and warns below rather than being absorbed.
const ELEMENTLESS_IDS = new Set(["manekin", "manekina"]);
const ELEMENTLESS = "Elementless";

// NOTE: upstream `region` is deliberately NOT included. 17 of 131 characters carry an
// internal code (MAINACTOR, SNEZHNAYA_STAR, HVISION, ...) instead of a nation name, and 12
// have no nation at all. Region is not an app feature, so it is dropped rather than modelled.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const headers = { "User-Agent": "genshin-randomiser-data-script" };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

/** Resolve the commit to read from: --sha flag or current master head. */
async function resolveSha() {
  const flag = process.argv.indexOf("--sha");
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/commits/${encodeURIComponent("master")}`,
    { headers },
  );
  if (!res.ok) throw new Error(`commit lookup failed: ${res.status} ${res.statusText}`);
  const { sha } = await res.json();
  return sha;
}

async function main() {
  const sha = await resolveSha();
  console.log(`source: ${OWNER}/${REPO} @ ${sha.slice(0, 7)}`);

  const listRes = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}?ref=${sha}`,
    { headers },
  );
  if (!listRes.ok) {
    throw new Error(`directory listing failed: ${listRes.status} ${listRes.statusText}`);
  }
  const listing = await listRes.json();
  if (!Array.isArray(listing)) throw new Error("unexpected listing shape from GitHub API");

  const files = listing.filter((f) => f.type === "file" && f.name.endsWith(".json"));
  console.log(`found ${files.length} character files`);

  const characters = [];
  const failures = [];
  let next = 0;

  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      try {
        const res = await fetch(
          `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}/${file.path}`,
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const d = await res.json();

        if (!d.id || !d.name) throw new Error("missing id or name");

        characters.push({
          // Stable primary key. Note: gameId is NOT unique — all 7 Traveler
          // variants share 10000007.
          id: d.id,
          gameId: d._id ?? null,
          name: d.name,
          title: d.title ?? null,
          // `||`, not `??`: upstream sends `element: {"id":"","name":""}` for these two, so
          // the value is an empty string and a nullish-only fallback would pass it straight through.
          element: d.element?.name || (ELEMENTLESS_IDS.has(d.id) ? ELEMENTLESS : null),
          weapon: d.weapon_type?.name ?? null,
          rarity: d.rarity,
          gender: d.gender?.name ?? null,
          // Derived, not fetched: `scripts/fetch-assets.mjs` writes exactly this path, so the
          // field is always present and the UI never has to guess a filename.
          icon: `/characters/${d.id}.png`,
        });
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failures.length) {
    console.error(`\n${failures.length} file(s) failed:`);
    for (const f of failures) console.error("  " + f);
    process.exitCode = 1;
    return;
  }

  characters.sort((a, b) => a.name.localeCompare(b.name));

  // Hard validation. Anything here means the upstream shape changed.
  const problems = [];
  const seenIds = new Set();
  for (const c of characters) {
    if (seenIds.has(c.id)) problems.push(`duplicate id: ${c.id}`);
    seenIds.add(c.id);
    if (![4, 5].includes(c.rarity)) problems.push(`${c.id}: rarity ${c.rarity}`);
    if (!c.element) problems.push(`${c.id}: missing element (and not a known elementless)`);
    if (!c.weapon) problems.push(`${c.id}: missing weapon`);
    if (!c.gender) problems.push(`${c.id}: missing gender`);
  }

  const outPath = resolve(ROOT, OUT);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(characters, null, 2) + "\n");

  // Soft warnings — worth a look, not worth failing the run.
  const missingElement = characters.filter((c) => !c.element).map((c) => c.id);

  console.log(`\nwrote ${OUT} — ${characters.length} characters`);
  console.log(`by rarity: 5★=${characters.filter((c) => c.rarity === 5).length}  ` +
    `4★=${characters.filter((c) => c.rarity === 4).length}`);
  console.log(`by element: ${countBy(characters, "element")}`);
  console.log(`by gender: ${countBy(characters, "gender")}`);

  if (problems.length) {
    console.error(`\n${problems.length} validation problem(s):`);
    for (const p of problems) console.error("  " + p);
    process.exitCode = 1;
  }
}

function countBy(items, key) {
  const tally = {};
  for (const item of items) tally[item[key]] = (tally[item[key]] ?? 0) + 1;
  return Object.entries(tally)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

await main();
