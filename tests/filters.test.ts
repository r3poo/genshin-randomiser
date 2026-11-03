import assert from "node:assert/strict";
import { test } from "node:test";
import { allFilters, filterCharacters, matchesFilters, toggleInOrder } from "../lib/filters.ts";
import { ELEMENTS, GENDERS, type Character } from "../lib/types.ts";

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: "test",
    gameId: 1,
    name: "Test",
    title: null,
    element: "Pyro",
    weapon: "Sword",
    rarity: 5,
    gender: "Female",
    icon: null,
    ...overrides,
  };
}

const traveler = character({ id: "traveler_anemo", name: "Traveler (Anemo)", gender: "Male/Female" });
const male = character({ id: "male", name: "Male", gender: "Male" });
const fourStar = character({ id: "four", name: "Four", rarity: 4, element: "Hydro" });

test("defaults match every character", () => {
  const all = [traveler, male, fourStar];
  assert.equal(filterCharacters(all, allFilters()).length, 3);
});

test("an empty category matches nothing", () => {
  const all = [traveler, male, fourStar];
  const filters = { ...allFilters(), elements: [] };
  assert.equal(filterCharacters(all, filters).length, 0);
});

test("categories combine with AND", () => {
  const all = [traveler, male, fourStar];
  const filters = { ...allFilters(), rarities: [4] as const };
  assert.deepEqual(
    filterCharacters(all, { ...filters, rarities: [...filters.rarities] }).map((c) => c.id),
    ["four"],
  );
});

test("Male/Female travelers match a Male-only filter", () => {
  const filters = { ...allFilters(), genders: ["Male" as const] };
  assert.equal(matchesFilters(traveler, filters), true);
  assert.equal(matchesFilters(male, filters), true);
  assert.equal(matchesFilters(fourStar, filters), false);
});

test("Male/Female travelers match a Female-only filter", () => {
  const filters = { ...allFilters(), genders: ["Female" as const] };
  assert.equal(matchesFilters(traveler, filters), true);
  assert.equal(matchesFilters(fourStar, filters), true);
  assert.equal(matchesFilters(male, filters), false);
});

test("travelers appear exactly once when both binary genders are selected", () => {
  const filters = { ...allFilters(), genders: ["Male" as const, "Female" as const] };
  assert.deepEqual(filterCharacters([traveler], filters).map((c) => c.id), ["traveler_anemo"]);
});

test("selecting only Male/Female excludes binary-gendered characters", () => {
  const filters = { ...allFilters(), genders: ["Male/Female" as const] };
  assert.deepEqual(filterCharacters([traveler, male, fourStar], filters).map((c) => c.id), [
    "traveler_anemo",
  ]);
});

test("toggleInOrder keeps canonical ordering", () => {
  const selected = toggleInOrder(ELEMENTS, ELEMENTS.filter((e) => e !== "Geo"), "Geo");
  assert.deepEqual(selected, [...ELEMENTS]);
});

test("every canonical gender is filterable", () => {
  for (const gender of GENDERS) {
    const filters = { ...allFilters(), genders: [gender] };
    assert.equal(matchesFilters(character({ gender }), filters), true, gender);
  }
});
