import { ELEMENTS, GENDERS, RARITIES, WEAPONS } from "./types.ts";
import type { Character, Element, Gender, Rarity, WeaponType } from "./types.ts";

/**
 * Additive filters for the character picker.
 *
 * Each category is an independent multi-select and the categories are combined with AND, values
 * within a category with OR. Defaults are "everything selected"; the UI treats an empty category
 * as "matches nothing", which falls out of the OR logic naturally rather than needing a special
 * case.
 */
export interface Filters {
  elements: Element[];
  weapons: WeaponType[];
  rarities: Rarity[];
  genders: Gender[];
}

export function allFilters(): Filters {
  return {
    elements: [...ELEMENTS],
    weapons: [...WEAPONS],
    rarities: [...RARITIES],
    genders: [...GENDERS],
  };
}

/**
 * The seven combined Traveler entries are labelled `Male/Female`. They must show up when the
 * user filters for Male *or* Female, otherwise picking a single gender silently hides them.
 */
function genderMatches(gender: Gender, selected: readonly Gender[]): boolean {
  if (gender === "Male/Female") {
    return selected.includes("Male/Female") || selected.includes("Male") || selected.includes("Female");
  }
  return selected.includes(gender);
}

export function matchesFilters(character: Character, filters: Filters): boolean {
  return (
    filters.elements.includes(character.element) &&
    filters.weapons.includes(character.weapon) &&
    filters.rarities.includes(character.rarity) &&
    genderMatches(character.gender, filters.genders)
  );
}

export function filterCharacters(
  characters: readonly Character[],
  filters: Filters,
): Character[] {
  return characters.filter((c) => matchesFilters(c, filters));
}

/** Immutable add/remove, used by the filter chip handlers. */
export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Preserves canonical ordering after a toggle so the UI never reshuffles chips. */
export function toggleInOrder<T>(order: readonly T[], list: readonly T[], value: T): T[] {
  const next = toggleValue(list, value);
  return order.filter((v) => next.includes(v));
}
