import { isKnownCharacterId } from "./characters.ts";
import {
  DEFAULT_POOL_NAME,
  DEFAULT_TEAM_NAME,
  TEAM_SIZE_MAX,
  TEAM_SIZE_MIN,
} from "./types.ts";
import type { AppState, HistoryEntry, Pool, Team } from "./types.ts";

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  message: string;
}

export interface ParseResult {
  state: AppState;
  issues: Issue[];
}

export interface ExportPayload {
  app: "genshin-team-randomiser";
  version: 1;
  exportedAt: string;
  state: AppState;
}

export const HISTORY_LIMIT = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyState(): AppState {
  return {
    pools: [],
    teams: [],
    settings: { uniqueAcrossTeams: false },
    history: [],
  };
}

/**
 * Extra top-level keys are only reported for import, where the user chose the file. A stored
 * payload carrying stale keys is not something the user can act on, so callers pass
 * `reportUnknownKeys: false` when loading from localStorage.
 */
interface ParseOptions {
  reportUnknownKeys?: boolean;
  historyLimit?: number;
}

const POOL_KEYS = new Set(["id", "name", "memberIds"]);
const TEAM_KEYS = new Set(["id", "name", "size", "poolIds"]);
const HISTORY_KEYS = new Set(["id", "createdAt", "uniqueAcrossTeams", "teams"]);
const HISTORY_TEAM_KEYS = new Set(["teamId", "teamName", "memberIds"]);
const STATE_KEYS = new Set(["pools", "teams", "settings", "history"]);

/** Reports any key not in `allowed`, once per key, without echoing values. */
function unknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: Issue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({ level: "warning", message: `${path}: dropped unknown field "${key}"` });
    }
  }
}

function parsePools(raw: unknown, issues: Issue[]): Pool[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.push({ level: "error", message: "pools: expected a list, using none" });
    return [];
  }

  const pools: Pool[] = [];
  const usedIds = new Set<string>();

  raw.forEach((entry, index) => {
    const path = `pools[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ level: "error", message: `${path}: not an object, dropped` });
      return;
    }
    unknownKeys(entry, POOL_KEYS, path, issues);

    let id = typeof entry.id === "string" && entry.id ? entry.id : "";
    if (!id) {
      id = makeId("pool");
      issues.push({ level: "warning", message: `${path}: missing id, generated "${id}"` });
    }
    if (usedIds.has(id)) {
      const replacement = makeId("pool");
      issues.push({
        level: "error",
        message: `${path}: duplicate pool id "${id}", renamed to "${replacement}"`,
      });
      id = replacement;
    }
    usedIds.add(id);

    const name =
      typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : DEFAULT_POOL_NAME;
    if (name !== entry.name) {
      issues.push({ level: "warning", message: `${path}: missing name, used "${name}"` });
    }

    const memberIds: string[] = [];
    if (entry.memberIds !== undefined) {
      if (!Array.isArray(entry.memberIds)) {
        issues.push({ level: "error", message: `${path}: memberIds is not a list, dropped` });
      } else {
        const unknown: string[] = [];
        for (const memberId of entry.memberIds) {
          if (!isKnownCharacterId(memberId)) {
            unknown.push(typeof memberId === "string" ? memberId : JSON.stringify(memberId));
            continue;
          }
          if (!memberIds.includes(memberId)) memberIds.push(memberId);
        }
        if (unknown.length) {
          issues.push({
            level: "error",
            message: `${path}: dropped ${unknown.length} unknown character(s): ${unknown.join(", ")}`,
          });
        }
      }
    }

    pools.push({ id, name, memberIds });
  });

  return pools;
}

function parseTeams(raw: unknown, poolIds: ReadonlySet<string>, issues: Issue[]): Team[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.push({ level: "error", message: "teams: expected a list, using none" });
    return [];
  }

  const teams: Team[] = [];
  const usedIds = new Set<string>();

  raw.forEach((entry, index) => {
    const path = `teams[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ level: "error", message: `${path}: not an object, dropped` });
      return;
    }
    unknownKeys(entry, TEAM_KEYS, path, issues);

    let id = typeof entry.id === "string" && entry.id ? entry.id : "";
    if (!id) {
      id = makeId("team");
      issues.push({ level: "warning", message: `${path}: missing id, generated "${id}"` });
    }
    if (usedIds.has(id)) {
      const replacement = makeId("team");
      issues.push({
        level: "error",
        message: `${path}: duplicate team id "${id}", renamed to "${replacement}"`,
      });
      id = replacement;
    }
    usedIds.add(id);

    const name =
      typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : DEFAULT_TEAM_NAME;
    if (name !== entry.name) {
      issues.push({ level: "warning", message: `${path}: missing name, used "${name}"` });
    }

    let size = Number(entry.size);
    if (!Number.isFinite(size)) {
      issues.push({ level: "warning", message: `${path}: invalid size, used 4` });
      size = TEAM_SIZE_MAX;
    }
    const rounded = Math.min(TEAM_SIZE_MAX, Math.max(TEAM_SIZE_MIN, Math.round(size)));
    if (rounded !== size) {
      issues.push({
        level: "warning",
        message: `${path}: size ${size} out of range, clamped to ${rounded}`,
      });
    }

    const teamPoolIds: string[] = [];
    if (entry.poolIds !== undefined) {
      if (!Array.isArray(entry.poolIds)) {
        issues.push({ level: "error", message: `${path}: poolIds is not a list, dropped` });
      } else {
        const missing: string[] = [];
        for (const poolId of entry.poolIds) {
          if (typeof poolId !== "string" || !poolIds.has(poolId)) {
            missing.push(typeof poolId === "string" ? poolId : JSON.stringify(poolId));
            continue;
          }
          if (!teamPoolIds.includes(poolId)) teamPoolIds.push(poolId);
        }
        if (missing.length) {
          issues.push({
            level: "error",
            message: `${path}: dropped ${missing.length} reference(s) to unknown pool(s): ${missing.join(", ")}`,
          });
        }
      }
    }

    teams.push({ id, name, size: rounded, poolIds: teamPoolIds });
  });

  return teams;
}

function parseHistory(raw: unknown, issues: Issue[], limit: number): HistoryEntry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.push({ level: "error", message: "history: expected a list, using none" });
    return [];
  }

  const entries: HistoryEntry[] = [];

  raw.forEach((entry, index) => {
    const path = `history[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ level: "error", message: `${path}: not an object, dropped` });
      return;
    }
    unknownKeys(entry, HISTORY_KEYS, path, issues);

    const createdAt = typeof entry.createdAt === "string" ? entry.createdAt : "";
    if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
      issues.push({ level: "error", message: `${path}: invalid timestamp, dropped` });
      return;
    }

    if (!Array.isArray(entry.teams)) {
      issues.push({ level: "error", message: `${path}: teams is not a list, dropped` });
      return;
    }

    const teams = [];
    for (const [teamIndex, rawTeam] of entry.teams.entries()) {
      const teamPath = `${path}.teams[${teamIndex}]`;
      if (!isRecord(rawTeam)) {
        issues.push({ level: "error", message: `${teamPath}: not an object, dropped` });
        continue;
      }
      unknownKeys(rawTeam, HISTORY_TEAM_KEYS, teamPath, issues);

      const memberIds: string[] = [];
      const unknown: string[] = [];
      if (Array.isArray(rawTeam.memberIds)) {
        for (const memberId of rawTeam.memberIds) {
          if (!isKnownCharacterId(memberId)) {
            unknown.push(typeof memberId === "string" ? memberId : JSON.stringify(memberId));
            continue;
          }
          if (!memberIds.includes(memberId)) memberIds.push(memberId);
        }
      } else {
        issues.push({ level: "error", message: `${teamPath}: memberIds is not a list, dropped` });
        continue;
      }
      if (unknown.length) {
        issues.push({
          level: "error",
          message: `${teamPath}: dropped ${unknown.length} unknown character(s): ${unknown.join(", ")}`,
        });
      }
      if (!memberIds.length) {
        issues.push({ level: "error", message: `${teamPath}: no valid members left, dropped` });
        continue;
      }

      teams.push({
        teamId: typeof rawTeam.teamId === "string" ? rawTeam.teamId : "",
        teamName: typeof rawTeam.teamName === "string" && rawTeam.teamName ? rawTeam.teamName : "Team",
        memberIds,
      });
    }

    if (!teams.length) {
      issues.push({ level: "error", message: `${path}: no valid teams left, dropped` });
      return;
    }

    entries.push({
      id: typeof entry.id === "string" && entry.id ? entry.id : makeId("history"),
      createdAt,
      uniqueAcrossTeams: entry.uniqueAcrossTeams === true,
      teams,
    });
  });

  // Newest first, and bounded so a long-lived browser store cannot grow without limit.
  entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (entries.length > limit) {
    issues.push({
      level: "warning",
      message: `history: kept the ${limit} most recent entries, dropped ${entries.length - limit}`,
    });
  }

  return entries.slice(0, limit);
}

/**
 * Validates anything that claims to be an AppState: the localStorage payload and imported files
 * both go through here, so a corrupt store and a hand-edited file are handled identically.
 * Unknown characters and fields are dropped and reported instead of failing the whole document.
 */
export function parseAppState(raw: unknown, options: ParseOptions = {}): ParseResult {
  const issues: Issue[] = [];
  const { reportUnknownKeys = false, historyLimit = HISTORY_LIMIT } = options;

  if (!isRecord(raw)) {
    issues.push({ level: "error", message: "Not a valid document: expected an object." });
    return { state: emptyState(), issues };
  }

  if (reportUnknownKeys) unknownKeys(raw, STATE_KEYS, "root", issues);

  const pools = parsePools(raw.pools, issues);
  const teams = parseTeams(raw.teams, new Set(pools.map((p) => p.id)), issues);
  const history = parseHistory(raw.history, issues, historyLimit);

  let uniqueAcrossTeams = false;
  if (isRecord(raw.settings)) {
    if (reportUnknownKeys) {
      unknownKeys(raw.settings, new Set(["uniqueAcrossTeams"]), "settings", issues);
    }
    uniqueAcrossTeams = raw.settings.uniqueAcrossTeams === true;
  } else if (raw.settings !== undefined) {
    issues.push({ level: "warning", message: "settings: not an object, using defaults" });
  }

  return { state: { pools, teams, settings: { uniqueAcrossTeams }, history }, issues };
}

export const EXPORT_APP_ID = "genshin-team-randomiser";

export function buildExportPayload(state: AppState): ExportPayload {
  return {
    app: EXPORT_APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
}

/** Accepts only this app's export wrapper; a bare AppState object is rejected with a hint. */
export function parseExportPayload(raw: unknown): ParseResult {
  if (!isRecord(raw)) {
    return {
      state: emptyState(),
      issues: [{ level: "error", message: "Not a valid file: expected a JSON object." }],
    };
  }
  if (raw.app !== EXPORT_APP_ID) {
    return {
      state: emptyState(),
      issues: [
        {
          level: "error",
          message: `Not a genshin-team-randomiser export (found app=${JSON.stringify(raw.app)}).`,
        },
      ],
    };
  }

  const issues: Issue[] = [];
  unknownKeys(raw, new Set(["app", "version", "exportedAt", "state"]), "root", issues);

  if (raw.version !== 1) {
    issues.push({
      level: "warning",
      message: `Version ${JSON.stringify(raw.version)} is not 1; importing on a best-effort basis.`,
    });
  }
  if (typeof raw.exportedAt !== "string" || Number.isNaN(Date.parse(raw.exportedAt))) {
    issues.push({ level: "warning", message: "Missing or invalid exportedAt." });
  }

  const parsed = parseAppState(raw.state, { reportUnknownKeys: true });
  return { state: parsed.state, issues: [...issues, ...parsed.issues] };
}
