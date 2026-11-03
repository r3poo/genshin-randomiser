import type { AppState } from "./types.ts";
import { parseAppState, type Issue } from "./validate.ts";

/**
 * localStorage persistence.
 *
 * Every access is wrapped: browsers throw on `window.localStorage` itself when storage is
 * blocked (Safari private mode, third-party cookie blocking, hardened settings), and on
 * `setItem` when the quota is exceeded. The app stays usable either way — the UI surfaces a
 * banner rather than failing silently.
 */
const STORAGE_KEY = "genshin-randomiser:state:v1";
const CORRUPT_KEY = "genshin-randomiser:state:corrupt";

export type StorageStatus = "available" | "denied" | "unavailable";

export interface StorageProbe {
  status: StorageStatus;
  /** Browser-supplied reason, shown to the user so the banner is actionable. */
  detail: string | null;
}

export interface LoadResult extends StorageProbe {
  /** null when nothing was stored yet. */
  state: AppState | null;
  issues: Issue[];
}

export interface SaveResult {
  ok: boolean;
  detail: string | null;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

export function probeStorage(): StorageProbe {
  if (typeof window === "undefined") return { status: "unavailable", detail: null };
  try {
    const probeKey = `${STORAGE_KEY}:probe`;
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return { status: "available", detail: null };
  } catch (error) {
    return { status: "denied", detail: describe(error) };
  }
}

export function loadState(): LoadResult {
  const probe = probeStorage();
  if (probe.status !== "available") return { ...probe, state: null, issues: [] };

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return { status: "denied", detail: describe(error), state: null, issues: [] };
  }
  if (raw === null) return { ...probe, state: null, issues: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Keep the unreadable payload instead of destroying it, then start clean.
    try {
      window.localStorage.setItem(CORRUPT_KEY, raw);
    } catch {
      // Backup is best-effort; a full quota must not block recovery.
    }
    return {
      ...probe,
      state: null,
      issues: [
        {
          level: "error",
          message: `Saved data could not be read and was reset. A copy was kept under "${CORRUPT_KEY}".`,
        },
      ],
    };
  }

  const { state, issues } = parseAppState(parsed);
  return { ...probe, state, issues };
}

export function saveState(state: AppState): SaveResult {
  if (typeof window === "undefined") return { ok: false, detail: "No browser storage available." };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, detail: null };
  } catch (error) {
    return { ok: false, detail: describe(error) };
  }
}

export function clearStoredState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the caller is already handling a storage failure.
  }
}
