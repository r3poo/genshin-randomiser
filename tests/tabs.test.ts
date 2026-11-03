import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TAB, TABS, hashForTab, isTabId, tabFromHash } from "../lib/tabs.ts";

test("every tab id round-trips through the hash", () => {
  for (const tab of TABS) {
    assert.equal(tabFromHash(hashForTab(tab.id)), tab.id);
  }
});

test("tabFromHash accepts the hash with or without the leading #", () => {
  assert.equal(tabFromHash("#pools"), "pools");
  assert.equal(tabFromHash("pools"), "pools");
  assert.equal(tabFromHash("#history"), "history");
});

test("tabFromHash is case-insensitive and tolerates stray whitespace", () => {
  assert.equal(tabFromHash("#Pools"), "pools");
  assert.equal(tabFromHash("#  history  "), "history");
});

test("unknown or missing hashes fall back to the default tab", () => {
  for (const hash of ["", "#", "#nope", "#teams/1", "#pools?x=1"]) {
    assert.equal(tabFromHash(hash), DEFAULT_TAB, `hash ${JSON.stringify(hash)}`);
  }
});

test("hashForTab always produces a hash the parser understands", () => {
  assert.equal(hashForTab("teams"), "#teams");
  assert.equal(hashForTab(DEFAULT_TAB), `#${DEFAULT_TAB}`);
});

test("isTabId rejects non-tab values", () => {
  assert.equal(isTabId("pools"), true);
  assert.equal(isTabId("Pools"), false);
  assert.equal(isTabId(""), false);
  assert.equal(isTabId(null), false);
  assert.equal(isTabId(undefined), false);
  assert.equal(isTabId(3), false);
});
