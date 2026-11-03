/**
 * Tab definitions, and the "which tab was open" state.
 *
 * The active tab lives in the URL hash (`#pools`), not in storage: nothing is written to
 * localStorage or sessionStorage for it. That keeps the page working when storage is blocked,
 * survives a reload, and makes a tab deep-linkable. Unrecognised hashes fall back to the default
 * rather than erroring, so a stale or hand-typed link still lands somewhere usable.
 */

export const TABS = [
  { id: "teams", label: "Teams" },
  { id: "pools", label: "Pools" },
  { id: "history", label: "History" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const DEFAULT_TAB: TabId = "teams";

export function isTabId(value: unknown): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

/** `#pools`, `#Pools` and `pools` all resolve; anything unknown (including `""`) is the default. */
export function tabFromHash(hash: string): TabId {
  const id = hash.replace(/^#/, "").trim().toLowerCase();
  return isTabId(id) ? id : DEFAULT_TAB;
}

export function hashForTab(tab: TabId): string {
  return `#${tab}`;
}
