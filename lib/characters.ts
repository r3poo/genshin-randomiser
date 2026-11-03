// Relative path plus an import attribute: the app bundles this through Next, and the Node test
// runner imports the same module directly, where both the `@/` alias and attribute-less JSON
// imports are unsupported.
import rawCharacters from "../data/characters.json" with { type: "json" };
import {
  ELEMENTS,
  GENDERS,
  RARITIES,
  WEAPONS,
  type Character,
  type Element,
  type Gender,
  type Rarity,
  type WeaponType,
} from "./types.ts";

/**
 * Runtime validation of the generated data file.
 *
 * The data is a build artefact produced by scripts/fetch-characters.mjs, so a shape change should
 * fail the build loudly rather than reach the UI as a half-valid character. This runs once at
 * module load; in a static export that means `next build` fails.
 */
function parseCharacters(input: unknown): Character[] {
  if (!Array.isArray(input)) throw new Error("characters.json: expected an array");

  const problems: string[] = [];
  const seen = new Set<string>();
  const characters: Character[] = [];

  input.forEach((entry, index) => {
    const at = `characters.json[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      problems.push(`${at}: not an object`);
      return;
    }
    const c = entry as Record<string, unknown>;

    if (typeof c.id !== "string" || !c.id) problems.push(`${at}: missing string id`);
    else if (seen.has(c.id)) problems.push(`${at}: duplicate id "${c.id}"`);
    else seen.add(c.id);

    if (typeof c.name !== "string" || !c.name) problems.push(`${at}: missing string name`);

    if (!ELEMENTS.includes(c.element as Element)) {
      problems.push(`${at} (${String(c.id)}): bad element ${JSON.stringify(c.element)}`);
    }
    if (!WEAPONS.includes(c.weapon as WeaponType)) {
      problems.push(`${at} (${String(c.id)}): bad weapon ${JSON.stringify(c.weapon)}`);
    }
    if (!RARITIES.includes(c.rarity as Rarity)) {
      problems.push(`${at} (${String(c.id)}): bad rarity ${JSON.stringify(c.rarity)}`);
    }
    if (!GENDERS.includes(c.gender as Gender)) {
      problems.push(`${at} (${String(c.id)}): bad gender ${JSON.stringify(c.gender)}`);
    }

    characters.push({
      id: c.id as string,
      gameId: typeof c.gameId === "number" ? c.gameId : null,
      name: c.name as string,
      title: typeof c.title === "string" ? c.title : null,
      element: c.element as Element,
      weapon: c.weapon as WeaponType,
      rarity: c.rarity as Rarity,
      gender: c.gender as Gender,
      icon: typeof c.icon === "string" && c.icon ? c.icon : null,
    });
  });

  if (problems.length) {
    throw new Error(
      `Character data is invalid (${problems.length} problem(s)):\n  ${problems.join("\n  ")}`,
    );
  }

  return characters;
}

/** Sorted by display name, which is the order every character list must use. */
export const CHARACTERS: readonly Character[] = parseCharacters(rawCharacters).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const CHARACTER_BY_ID: ReadonlyMap<string, Character> = new Map(
  CHARACTERS.map((c) => [c.id, c]),
);

export function isKnownCharacterId(id: unknown): id is string {
  return typeof id === "string" && CHARACTER_BY_ID.has(id);
}
