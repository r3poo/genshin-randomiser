"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { AppState, HistoryEntry, Pool, Team } from "./types.ts";
import { TEAM_SIZE_MAX, TEAM_SIZE_MIN } from "./types.ts";
import { loadState, saveState, type StorageStatus } from "./storage.ts";
import { emptyState, type Issue } from "./validate.ts";

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clampSize(size: number): number {
  return Math.min(TEAM_SIZE_MAX, Math.max(TEAM_SIZE_MIN, Math.round(size)));
}

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "replace"; state: AppState }
  | { type: "reset" }
  | { type: "addPool" }
  | { type: "renamePool"; poolId: string; name: string }
  | { type: "deletePool"; poolId: string }
  | { type: "togglePoolMember"; poolId: string; characterId: string }
  | { type: "setPoolMembers"; poolId: string; memberIds: string[] }
  | { type: "addTeam" }
  | { type: "renameTeam"; teamId: string; name: string }
  | { type: "deleteTeam"; teamId: string }
  | { type: "setTeamSize"; teamId: string; size: number }
  | { type: "toggleTeamPool"; teamId: string; poolId: string }
  | { type: "setUniqueAcrossTeams"; value: boolean }
  | { type: "recordGeneration"; entry: HistoryEntry }
  | { type: "deleteHistoryEntry"; entryId: string }
  | { type: "clearHistory" };

function mapPool(state: AppState, poolId: string, update: (pool: Pool) => Pool): AppState {
  return {
    ...state,
    pools: state.pools.map((pool) => (pool.id === poolId ? update(pool) : pool)),
  };
}

function mapTeam(state: AppState, teamId: string, update: (team: Team) => Team): AppState {
  return {
    ...state,
    teams: state.teams.map((team) => (team.id === teamId ? update(team) : team)),
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
    case "replace":
      return action.state;

    case "reset":
      return emptyState();

    case "addPool": {
      const index = state.pools.length + 1;
      const pool: Pool = { id: newId("pool"), name: `Pool ${index}`, memberIds: [] };
      return { ...state, pools: [...state.pools, pool] };
    }

    case "renamePool":
      return mapPool(state, action.poolId, (pool) => ({ ...pool, name: action.name }));

    case "deletePool":
      return {
        ...state,
        pools: state.pools.filter((pool) => pool.id !== action.poolId),
        // A deleted pool must not linger as a dangling reference on any team.
        teams: state.teams.map((team) => ({
          ...team,
          poolIds: team.poolIds.filter((id) => id !== action.poolId),
        })),
      };

    case "togglePoolMember":
      return mapPool(state, action.poolId, (pool) => ({
        ...pool,
        memberIds: pool.memberIds.includes(action.characterId)
          ? pool.memberIds.filter((id) => id !== action.characterId)
          : [...pool.memberIds, action.characterId],
      }));

    case "setPoolMembers":
      return mapPool(state, action.poolId, (pool) => ({
        ...pool,
        memberIds: [...new Set(action.memberIds)],
      }));

    case "addTeam": {
      const index = state.teams.length + 1;
      const team: Team = { id: newId("team"), name: `Team ${index}`, size: 4, poolIds: [] };
      return { ...state, teams: [...state.teams, team] };
    }

    case "renameTeam":
      return mapTeam(state, action.teamId, (team) => ({ ...team, name: action.name }));

    case "deleteTeam":
      return { ...state, teams: state.teams.filter((team) => team.id !== action.teamId) };

    case "setTeamSize":
      return mapTeam(state, action.teamId, (team) => ({ ...team, size: clampSize(action.size) }));

    case "toggleTeamPool":
      return mapTeam(state, action.teamId, (team) => ({
        ...team,
        poolIds: team.poolIds.includes(action.poolId)
          ? team.poolIds.filter((id) => id !== action.poolId)
          : [...team.poolIds, action.poolId],
      }));

    case "setUniqueAcrossTeams":
      return { ...state, settings: { ...state.settings, uniqueAcrossTeams: action.value } };

    case "recordGeneration":
      return { ...state, history: [action.entry, ...state.history] };

    case "deleteHistoryEntry":
      return { ...state, history: state.history.filter((entry) => entry.id !== action.entryId) };

    case "clearHistory":
      return { ...state, history: [] };

    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** false until the localStorage read has run, so the UI can avoid rendering stale defaults. */
  hydrated: boolean;
  storageStatus: StorageStatus;
  storageDetail: string | null;
  /** Set when a write failed after load succeeded (quota, revoked permission). */
  saveError: string | null;
  /** Problems found while reading the saved payload. */
  loadIssues: Issue[];
  dismissLoadIssues: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("unavailable");
  const [storageDetail, setStorageDetail] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadIssues, setLoadIssues] = useState<Issue[]>([]);

  // Read once on mount. localStorage is not available during the static render, so this cannot
  // be part of the initial state without breaking hydration.
  useEffect(() => {
    const result = loadState();
    setStorageStatus(result.status);
    setStorageDetail(result.detail);
    if (result.issues.length) setLoadIssues(result.issues);
    if (result.state) dispatch({ type: "hydrate", state: result.state });
    setHydrated(true);
  }, []);

  // Write after every change once hydrated. The first write after hydration re-persists the
  // sanitised payload, so anything the loader had to repair is stored in its repaired form.
  useEffect(() => {
    if (!hydrated) return;
    const result = saveState(state);
    setSaveError(result.ok ? null : result.detail);
  }, [state, hydrated]);

  const dismissLoadIssues = useCallback(() => setLoadIssues([]), []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      dispatch,
      hydrated,
      storageStatus,
      storageDetail,
      saveError,
      loadIssues,
      dismissLoadIssues,
    }),
    [state, hydrated, storageStatus, storageDetail, saveError, loadIssues, dismissLoadIssues],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}
