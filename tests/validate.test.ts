import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildExportPayload,
  parseAppState,
  parseExportPayload,
  type Issue,
} from "../lib/validate.ts";

const A = "albedo";
const B = "amber";

function messages(issues: Issue[]): string {
  return issues.map((i) => `${i.level}: ${i.message}`).join("\n");
}

function hasError(issues: Issue[], pattern: RegExp): boolean {
  return issues.some((i) => i.level === "error" && pattern.test(i.message));
}

test("accepts a well-formed document without issues", () => {
  const { state, issues } = parseAppState({
    pools: [{ id: "p1", name: "Main", memberIds: [A, B] }],
    teams: [{ id: "t1", name: "Team 1", size: 2, poolIds: ["p1"] }],
    settings: { uniqueAcrossTeams: true },
    history: [
      {
        id: "h1",
        createdAt: "2026-01-01T00:00:00.000Z",
        uniqueAcrossTeams: true,
        teams: [{ teamId: "t1", teamName: "Team 1", memberIds: [A] }],
      },
    ],
  });
  assert.deepEqual(issues, []);
  assert.equal(state.pools.length, 1);
  assert.equal(state.teams[0]?.size, 2);
  assert.equal(state.settings.uniqueAcrossTeams, true);
  assert.equal(state.history.length, 1);
});

test("drops unknown characters from pools and reports them", () => {
  const { state, issues } = parseAppState({
    pools: [{ id: "p1", name: "Main", memberIds: [A, "ghost"] }],
  });
  assert.deepEqual(state.pools[0]?.memberIds, [A]);
  assert.ok(hasError(issues, /unknown character\(s\): ghost/), messages(issues));
});

test("drops unknown fields with a warning", () => {
  const { state, issues } = parseAppState(
    { pools: [{ id: "p1", name: "Main", memberIds: [], colour: "red" }] },
    { reportUnknownKeys: true },
  );
  assert.equal(state.pools.length, 1);
  assert.ok(issues.some((i) => /dropped unknown field "colour"/.test(i.message)), messages(issues));
});

test("renames duplicate pool ids instead of losing a pool", () => {
  const { state, issues } = parseAppState({
    pools: [
      { id: "dup", name: "One", memberIds: [] },
      { id: "dup", name: "Two", memberIds: [] },
    ],
  });
  assert.equal(state.pools.length, 2);
  assert.notEqual(state.pools[0]?.id, state.pools[1]?.id);
  assert.ok(hasError(issues, /duplicate pool id/), messages(issues));
});

test("drops team references to pools that do not exist", () => {
  const { state, issues } = parseAppState({
    pools: [{ id: "p1", name: "Main", memberIds: [] }],
    teams: [{ id: "t1", name: "Team", size: 4, poolIds: ["p1", "missing"] }],
  });
  assert.deepEqual(state.teams[0]?.poolIds, ["p1"]);
  assert.ok(hasError(issues, /unknown pool\(s\): missing/), messages(issues));
});

test("clamps team size into range", () => {
  const { state, issues } = parseAppState({
    teams: [{ id: "t1", name: "Team", size: 9, poolIds: [] }],
  });
  assert.equal(state.teams[0]?.size, 4);
  assert.ok(issues.some((i) => /clamped to 4/.test(i.message)), messages(issues));
});

test("drops history entries with unusable timestamps", () => {
  const { state, issues } = parseAppState({
    history: [
      { id: "h1", createdAt: "not a date", uniqueAcrossTeams: false, teams: [] },
      {
        id: "h2",
        createdAt: "2026-01-02T00:00:00.000Z",
        uniqueAcrossTeams: false,
        teams: [{ teamId: "t", teamName: "T", memberIds: [A] }],
      },
    ],
  });
  assert.deepEqual(state.history.map((h) => h.id), ["h2"]);
  assert.ok(hasError(issues, /invalid timestamp/), messages(issues));
});

test("drops history teams whose members are all unknown", () => {
  const { state, issues } = parseAppState({
    history: [
      {
        id: "h1",
        createdAt: "2026-01-01T00:00:00.000Z",
        uniqueAcrossTeams: false,
        teams: [{ teamId: "t", teamName: "T", memberIds: ["ghost"] }],
      },
    ],
  });
  assert.equal(state.history.length, 0);
  assert.ok(hasError(issues, /unknown character\(s\): ghost/), messages(issues));
});

test("orders history newest first", () => {
  const entry = (id: string, createdAt: string) => ({
    id,
    createdAt,
    uniqueAcrossTeams: false,
    teams: [{ teamId: "t", teamName: "T", memberIds: [A] }],
  });
  const { state } = parseAppState({
    history: [
      entry("old", "2025-01-01T00:00:00.000Z"),
      entry("new", "2026-06-01T00:00:00.000Z"),
      entry("mid", "2025-09-01T00:00:00.000Z"),
    ],
  });
  assert.deepEqual(state.history.map((h) => h.id), ["new", "mid", "old"]);
});

test("rejects non-objects without throwing", () => {
  for (const bad of [null, 42, "text", []]) {
    const { state, issues } = parseAppState(bad);
    assert.equal(state.pools.length, 0);
    assert.ok(issues.some((i) => i.level === "error"));
  }
});

test("export payload round-trips", () => {
  const original = {
    pools: [{ id: "p1", name: "Main", memberIds: [A] }],
    teams: [{ id: "t1", name: "Team 1", size: 3, poolIds: ["p1"] }],
    settings: { uniqueAcrossTeams: true },
    history: [],
  };
  const payload = buildExportPayload(original);
  const { state, issues } = parseExportPayload(JSON.parse(JSON.stringify(payload)));
  assert.deepEqual(issues, []);
  assert.deepEqual(state, original);
});

test("rejects a file from a different app", () => {
  const { issues } = parseExportPayload({ app: "something-else", state: {} });
  assert.ok(hasError(issues, /Not a genshin-team-randomiser export/), messages(issues));
});

test("rejects a bare state object with no wrapper", () => {
  const { issues } = parseExportPayload({ pools: [], teams: [] });
  assert.ok(hasError(issues, /Not a genshin-team-randomiser export/), messages(issues));
});

test("history beyond the limit keeps the newest entries and says so", () => {
  const entry = (id: string, createdAt: string) => ({
    id,
    createdAt,
    uniqueAcrossTeams: false,
    teams: [{ teamId: "t", teamName: "T", memberIds: [A] }],
  });
  const { state, issues } = parseAppState(
    {
      history: [
        entry("old", "2025-01-01T00:00:00.000Z"),
        entry("new", "2026-06-01T00:00:00.000Z"),
        entry("mid", "2025-09-01T00:00:00.000Z"),
      ],
    },
    { historyLimit: 2 },
  );
  assert.deepEqual(state.history.map((h) => h.id), ["new", "mid"]);
  assert.ok(
    issues.some((i) => i.level === "warning" && /kept the 2 most recent/.test(i.message)),
    messages(issues),
  );
});

test("a character repeated inside one history team is counted once", () => {
  const { state } = parseAppState({
    history: [
      {
        id: "h1",
        createdAt: "2026-01-01T00:00:00.000Z",
        uniqueAcrossTeams: true,
        teams: [{ teamId: "t", teamName: "T", memberIds: [A, A, B] }],
      },
    ],
  });
  assert.deepEqual(state.history[0]?.teams[0]?.memberIds, [A, B]);
});

test("settings accept only a real boolean true", () => {
  for (const value of ["true", 1, null, {}]) {
    const { state } = parseAppState({ settings: { uniqueAcrossTeams: value } });
    assert.equal(state.settings.uniqueAcrossTeams, false, `accepted ${JSON.stringify(value)}`);
  }
  const { state } = parseAppState({ settings: { uniqueAcrossTeams: true } });
  assert.equal(state.settings.uniqueAcrossTeams, true);
});

test("a pool without a name gets a label instead of an empty heading", () => {
  const { state, issues } = parseAppState({ pools: [{ id: "p1", memberIds: [A] }] });
  assert.equal(state.pools[0]?.name, "Untitled pool");
  assert.ok(issues.some((i) => i.level === "warning"), messages(issues));
});

test("a pool listed twice by a team contributes each character once", () => {
  const { state } = parseAppState({
    pools: [{ id: "p1", name: "P", memberIds: [A, B] }],
    teams: [{ id: "t1", name: "T", size: 2, poolIds: ["p1", "p1"] }],
  });
  assert.deepEqual(state.teams[0]?.poolIds, ["p1"]);
});
