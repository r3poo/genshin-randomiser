import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { initialState } from "../lib/defaults.ts";
import { clearStoredState, loadState, probeStorage, saveState } from "../lib/storage.ts";

const STORAGE_KEY = "genshin-randomiser:state:v1";
const CORRUPT_KEY = "genshin-randomiser:state:corrupt";

/**
 * The storage module reads `window` at call time (never at import time), so a plain object with a
 * `localStorage` property is enough. No jsdom, no browser.
 */
function installWindow(localStorage: unknown): void {
  (globalThis as { window?: unknown }).window = { localStorage };
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("without a window, storage reports unavailable instead of throwing", () => {
  assert.equal(probeStorage().status, "unavailable");
  const loaded = loadState();
  assert.equal(loaded.state, null);
  assert.deepEqual(loaded.issues, []);
  assert.equal(saveState(initialState()).ok, false);
  clearStoredState(); // must not throw
});

test("save then load round-trips the whole state", () => {
  const storage = memoryStorage();
  installWindow(storage);
  const state = initialState();
  state.settings.uniqueAcrossTeams = true;

  assert.equal(probeStorage().status, "available");
  assert.equal(saveState(state).ok, true);

  const loaded = loadState();
  assert.equal(loaded.status, "available");
  assert.deepEqual(loaded.state, state);
  assert.deepEqual(loaded.issues, []);
});

test("a fresh browser loads nothing rather than an empty document", () => {
  installWindow(memoryStorage());
  const loaded = loadState();
  assert.equal(loaded.state, null, "seed state must come from the caller, not storage");
  assert.deepEqual(loaded.issues, []);
});

test("a getter that throws is reported as denied, not as a crash", () => {
  // Safari private mode throws on `window.localStorage` itself, not on `setItem`.
  (globalThis as { window?: unknown }).window = Object.defineProperty({}, "localStorage", {
    get() {
      throw new Error("The operation is insecure.");
    },
  });
  const probe = probeStorage();
  assert.equal(probe.status, "denied");
  assert.match(probe.detail ?? "", /insecure/);
  assert.equal(loadState().state, null);
  assert.equal(saveState(initialState()).ok, false);
});

test("a quota failure surfaces the browser message", () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  installWindow(storage);
  const saved = saveState(initialState());
  assert.equal(saved.ok, false);
  assert.match(saved.detail ?? "", /QuotaExceededError/);
});

test("unreadable JSON is backed up before the store is reset", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, "{not json");
  installWindow(storage);

  const loaded = loadState();
  assert.equal(loaded.state, null);
  assert.equal(loaded.issues.length, 1);
  assert.match(loaded.issues[0]?.message ?? "", /could not be read and was reset/);
  assert.equal(storage.getItem(CORRUPT_KEY), "{not json", "the original payload must survive");
  assert.equal(storage.getItem(STORAGE_KEY), "{not json", "the key is left for the user to inspect");
});

test("a stored payload with a stale character id still loads and reports it", () => {
  const storage = memoryStorage();
  installWindow(storage);
  const state = initialState();
  state.pools[0]?.memberIds.push("character-that-was-removed");
  storage.setItem(STORAGE_KEY, JSON.stringify(state));

  const loaded = loadState();
  assert.ok(loaded.state);
  assert.equal(loaded.state.pools[0]?.memberIds.includes("character-that-was-removed"), false);
  assert.ok(loaded.issues.some((issue) => /unknown character/.test(issue.message)));
});

test("clear removes only the saved state", () => {
  const storage = memoryStorage();
  installWindow(storage);
  saveState(initialState());
  storage.setItem("unrelated", "keep me");

  clearStoredState();
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem("unrelated"), "keep me");
});
