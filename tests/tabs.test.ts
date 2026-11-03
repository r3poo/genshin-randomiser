import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_TAB,
  TABS,
  currentTab,
  hashForTab,
  isTabId,
  navigateToTab,
  subscribeToTab,
  tabFromHash,
} from "../lib/tabs.ts";

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

/**
 * navigateToTab/subscribeToTab touch `window`. Node's EventTarget supplies the listener plumbing,
 * so a stub with just `location`, `history` and `dispatchEvent` is enough to pin the contract:
 * a pushState that notifies subscribers, and no-ops when the hash already matches.
 */
function withWindow(run: (win: FakeWindow) => void) {
  class FakeWindow extends EventTarget {
    location = { hash: "" };
    pushed: string[] = [];
    history = {
      pushState: (_state: unknown, _title: string, url: string) => {
        this.pushed.push(url);
        this.location.hash = url;
      },
    };
  }
  const win = new FakeWindow();
  const globals = globalThis as { window?: unknown };
  const previous = globals.window;
  globals.window = win;
  try {
    run(win);
  } finally {
    globals.window = previous;
  }
}

type FakeWindow = EventTarget & {
  location: { hash: string };
  pushed: string[];
  history: { pushState: (state: unknown, title: string, url: string) => void };
};

test("navigateToTab pushes the hash and notifies subscribers", () => {
  withWindow((win) => {
    let notified = 0;
    const unsubscribe = subscribeToTab(() => notified++);

    navigateToTab("pools");

    assert.deepEqual(win.pushed, ["#pools"]);
    assert.equal(win.location.hash, "#pools");
    assert.equal(notified, 1);
    unsubscribe();
  });
});

test("navigateToTab does nothing when the hash already matches", () => {
  withWindow((win) => {
    win.location.hash = "#history";
    let notified = 0;
    const unsubscribe = subscribeToTab(() => notified++);

    navigateToTab("history");

    assert.deepEqual(win.pushed, []);
    assert.equal(notified, 0);
    unsubscribe();
  });
});

test("subscribers hear about hashchange and stop hearing after unsubscribing", () => {
  withWindow((win) => {
    let notified = 0;
    const unsubscribe = subscribeToTab(() => notified++);

    win.location.hash = "#pools";
    win.dispatchEvent(new Event("hashchange"));
    assert.equal(notified, 1);

    unsubscribe();
    win.dispatchEvent(new Event("hashchange"));
    assert.equal(notified, 1);
  });
});

test("currentTab reads the live hash", () => {
  withWindow((win) => {
    assert.equal(currentTab(), "teams");
    win.location.hash = "#pools";
    assert.equal(currentTab(), "pools");
  });
});
