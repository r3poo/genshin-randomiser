import assert from "node:assert/strict";
import { test } from "node:test";
import { generateTeams, teamCandidates, type RandomSource } from "../lib/randomise.ts";
import type { AppState, Pool, Team } from "../lib/types.ts";

// Real roster ids: candidates are filtered against the character data, so invented ids would be
// dropped and the tests would pass for the wrong reason.
const A = "albedo";
const B = "amber";
const C = "aino";
const D = "aloy";

function pool(id: string, memberIds: string[]): Pool {
  return { id, name: id, memberIds };
}

function team(id: string, size: number, poolIds: string[]): Team {
  return { id, name: id, size, poolIds };
}

function state(pools: Pool[], teams: Team[], uniqueAcrossTeams = false): AppState {
  return { pools, teams, settings: { uniqueAcrossTeams }, history: [] };
}

const zero: RandomSource = () => 0;
const almostOne: RandomSource = () => 0.999999;

test("teamCandidates unions pools and de-duplicates", () => {
  const pools = new Map([
    ["p1", pool("p1", [A, B])],
    ["p2", pool("p2", [B, C])],
  ]);
  assert.deepEqual(teamCandidates(team("t", 2, ["p1", "p2"]), pools).sort(), [A, B, C].sort());
});

test("teamCandidates ignores unknown character ids", () => {
  const pools = new Map([["p1", pool("p1", [A, "not-a-character"])]]);
  assert.deepEqual(teamCandidates(team("t", 1, ["p1"]), pools), [A]);
});

test("draws the requested size from the pool union", () => {
  const result = generateTeams(state([pool("p", [A, B, C, D])], [team("t", 3, ["p"])]), zero);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.teams[0]?.memberIds.length, 3);
  assert.equal(new Set(result.teams[0]?.memberIds).size, 3);
});

test("rejects a team with no pools selected", () => {
  const result = generateTeams(state([pool("p", [A])], [team("t", 1, [])]), zero);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(" "), /select at least one pool/);
});

test("rejects a team larger than its pool union", () => {
  const result = generateTeams(state([pool("p", [A, B])], [team("t", 3, ["p"])]), zero);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(" "), /only contain 2/);
});

test("rejects a generation with no teams", () => {
  const result = generateTeams(state([], []), zero);
  assert.equal(result.ok, false);
});

test("unique mode never repeats a character across teams", () => {
  const pools = [pool("shared", [A, B, C, D])];
  const teams = [team("t1", 2, ["shared"]), team("t2", 2, ["shared"])];
  for (const random of [zero, almostOne]) {
    const result = generateTeams(state(pools, teams, true), random);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const all = result.teams.flatMap((t) => t.memberIds);
    assert.equal(all.length, 4);
    assert.equal(new Set(all).size, 4, "duplicate character across teams");
  }
});

test("non-unique mode may repeat a character across teams", () => {
  const pools = [pool("p", [A])];
  const teams = [team("t1", 1, ["p"]), team("t2", 1, ["p"])];
  const result = generateTeams(state(pools, teams, false), zero);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.teams.map((t) => t.memberIds[0]), [A, A]);
});

test("unique mode finds an assignment that greedy ordering would miss", () => {
  // t1 can take either A or B, t2 can only take A. A greedy pass that hands A to t1 first fails;
  // the augmenting-path matcher has to move t1 onto B.
  const pools = [pool("either", [A, B]), pool("onlyA", [A])];
  const teams = [team("t1", 1, ["either"]), team("t2", 1, ["onlyA"])];
  for (const random of [zero, almostOne]) {
    const result = generateTeams(state(pools, teams, true), random);
    assert.equal(result.ok, true, "matcher failed on a feasible configuration");
    if (!result.ok) return;
    const byTeam = Object.fromEntries(result.teams.map((t) => [t.teamId, t.memberIds[0]]));
    assert.equal(byTeam.t2, A);
    assert.equal(byTeam.t1, B);
  }
});

test("unique mode reports infeasible configurations instead of returning short teams", () => {
  // t1 needs both A and B; t2 needs one member and can only draw A. Impossible.
  const pools = [pool("ab", [A, B]), pool("onlyA", [A])];
  const teams = [team("t1", 2, ["ab"]), team("t2", 1, ["onlyA"])];
  const result = generateTeams(state(pools, teams, true), zero);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.join(" "), /No unique assignment/);
});

test("unique mode satisfies multi-team tight pools exactly", () => {
  const pools = [pool("p", [A, B, C])];
  const teams = [team("t1", 1, ["p"]), team("t2", 1, ["p"]), team("t3", 1, ["p"])];
  const result = generateTeams(state(pools, teams, true), zero);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.teams.flatMap((t) => t.memberIds).sort(), [A, B, C].sort());
});

test("out-of-range team sizes are clamped rather than overfilling", () => {
  const result = generateTeams(state([pool("p", [A, B, C, D])], [team("t", 99, ["p"])]), zero);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.teams[0]?.memberIds.length, 4);
});

test("a team that lists the same pool twice draws from it once", () => {
  const pools = new Map([["p1", pool("p1", [A, B])]]);
  assert.deepEqual(teamCandidates(team("t", 2, ["p1", "p1"]), pools), [A, B]);
});

test("three teams sharing a pool of three fill exactly, without repeats", () => {
  const pools = new Map([["p1", pool("p1", [A, B, C])]]);
  const teams = [team("t1", 1, ["p1"]), team("t2", 1, ["p1"]), team("t3", 1, ["p1"])];
  const result = generateTeams(state([...pools.values()], teams, true), zero);
  assert.equal(result.ok, true, result.ok ? "" : result.errors.join("; "));
  if (!result.ok) return;
  assert.deepEqual(result.teams.flatMap((t) => t.memberIds).sort(), [A, B, C].sort());
});

test("unique mode reports every team that cannot be filled", () => {
  const pools = new Map([["p1", pool("p1", [A])]]);
  const teams = [team("t1", 1, ["p1"]), team("t2", 1, ["p1"])];
  const result = generateTeams(state([...pools.values()], teams, true), zero);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors.length, 2);
});

test("repeated draws do not return the same four characters", () => {
  const pools = new Map([["p1", pool("p1", [A, B, C, D])]]);
  const teams = [team("t1", 2, ["p1"])];
  const seen = new Set<string>();
  for (let i = 0; i < 60; i += 1) {
    const result = generateTeams(state([...pools.values()], teams), Math.random);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    seen.add([...(result.teams[0]?.memberIds ?? [])].sort().join("+"));
  }
  assert.ok(seen.size > 1, "60 draws from a pool of four produced one combination");
});
