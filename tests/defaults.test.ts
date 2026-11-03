import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARACTERS } from "../lib/characters.ts";
import { STARTER_POOL_ID, initialState } from "../lib/defaults.ts";
import { emptyState, parseAppState } from "../lib/validate.ts";

test("first run seeds one pool with the whole roster", () => {
  const state = initialState();
  assert.equal(state.pools.length, 1);
  assert.equal(state.pools[0]?.id, STARTER_POOL_ID);
  assert.equal(state.pools[0]?.memberIds.length, CHARACTERS.length);
  assert.equal(new Set(state.pools[0]?.memberIds).size, CHARACTERS.length);
});

test("first run seeds teams that point at the starter pool", () => {
  const state = initialState();
  assert.equal(state.teams.length, 2);
  for (const team of state.teams) {
    assert.deepEqual(team.poolIds, [STARTER_POOL_ID]);
    assert.equal(team.size, 4);
  }
});

test("the seeded state passes its own importer unchanged", () => {
  const seeded = initialState();
  const { state, issues } = parseAppState(JSON.parse(JSON.stringify(seeded)));
  assert.deepEqual(issues, []);
  assert.deepEqual(state, seeded);
});

test("the structural blank stays blank", () => {
  const blank = emptyState();
  assert.deepEqual(blank.pools, []);
  assert.deepEqual(blank.teams, []);
  assert.deepEqual(blank.history, []);
});
