import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { CHARACTERS } from "../lib/characters.ts";
import { ELEMENTS, GENDERS, RARITIES, WEAPONS } from "../lib/types.ts";

/**
 * Guards the committed roster snapshot. A refresh that changes upstream field names, drops art or
 * introduces a new enum value should fail here rather than surface as a blank card in the UI.
 */
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

test("the roster is non-empty and has unique ids and names", () => {
  assert.ok(CHARACTERS.length > 100, `only ${CHARACTERS.length} characters loaded`);
  const ids = new Set(CHARACTERS.map((c) => c.id));
  const names = new Set(CHARACTERS.map((c) => c.name));
  assert.equal(ids.size, CHARACTERS.length, "duplicate character id");
  assert.equal(names.size, CHARACTERS.length, "duplicate character name");
});

test("every character uses a canonical element, weapon, rarity and gender", () => {
  for (const character of CHARACTERS) {
    assert.ok(ELEMENTS.includes(character.element), `${character.id}: element ${character.element}`);
    assert.ok(WEAPONS.includes(character.weapon), `${character.id}: weapon ${character.weapon}`);
    assert.ok(RARITIES.includes(character.rarity), `${character.id}: rarity ${character.rarity}`);
    assert.ok(GENDERS.includes(character.gender), `${character.id}: gender ${character.gender}`);
  }
});

test("no character is left with an empty required field", () => {
  for (const character of CHARACTERS) {
    assert.ok(character.id.trim(), "empty id");
    assert.ok(character.name.trim(), `${character.id}: empty name`);
    assert.ok(character.gameId !== null && character.gameId > 0, `${character.id}: missing gameId`);
  }
});

test("the roster is sorted by name so the picker needs no sort at runtime", () => {
  const sorted = [...CHARACTERS].sort((a, b) => a.name.localeCompare(b.name, "en"));
  assert.deepEqual(CHARACTERS.map((c) => c.id), sorted.map((c) => c.id));
});

test("every icon path points at a vendored file that exists", () => {
  const missing: string[] = [];
  for (const character of CHARACTERS) {
    if (character.icon === null) continue;
    assert.equal(character.icon, `/characters/${character.id}.png`, `${character.id}: unexpected path`);
    const file = `${PUBLIC_DIR}${character.icon}`;
    if (!existsSync(file) || statSync(file).size === 0) missing.push(character.icon);
  }
  assert.deepEqual(missing, [], "icon listed in the roster but not committed");
});

test("characters without art are the known exceptions only", () => {
  const withoutArt = CHARACTERS.filter((c) => c.icon === null).map((c) => c.id);
  assert.deepEqual(withoutArt, ["mitya", "valeriy"]);
});

test("every element and weapon has a glyph except Elementless", () => {
  const elements = ELEMENTS.filter((e) => e !== "Elementless");
  for (const element of elements) {
    assert.ok(existsSync(`${PUBLIC_DIR}icons/element/${element.toLowerCase()}.png`), element);
  }
  for (const weapon of WEAPONS) {
    assert.ok(existsSync(`${PUBLIC_DIR}icons/weapon/${weapon.toLowerCase()}.png`), weapon);
  }
});

test("the rarity split matches the snapshot the UI was built against", () => {
  const five = CHARACTERS.filter((c) => c.rarity === 5).length;
  const four = CHARACTERS.filter((c) => c.rarity === 4).length;
  assert.equal(five + four, CHARACTERS.length);
  assert.ok(five > 0 && four > 0);
});
