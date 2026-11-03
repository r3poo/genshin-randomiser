/**
 * Domain types and the canonical value lists they are built from.
 *
 * The string literal arrays are the single source of truth: types are derived from them so the
 * filter UI and the validator can never drift from the data model.
 */

export const ELEMENTS = [
  "Anemo",
  "Geo",
  "Electro",
  "Dendro",
  "Hydro",
  "Pyro",
  "Cryo",
  "Elementless",
] as const;
export type Element = (typeof ELEMENTS)[number];

export const WEAPONS = ["Sword", "Claymore", "Polearm", "Bow", "Catalyst"] as const;
export type WeaponType = (typeof WEAPONS)[number];

/** Descending, which is how the filter chips are displayed. */
export const RARITIES = [5, 4] as const;
export type Rarity = (typeof RARITIES)[number];

/**
 * `Male/Female` is the seven combined Traveler entries. Selecting Male *or* Female includes
 * them — see matchesFilters in lib/filters.ts.
 */
export const GENDERS = ["Male", "Female", "Male/Female"] as const;
export type Gender = (typeof GENDERS)[number];

export interface Character {
  id: string;
  /** In-game avatar id. NOT unique: all seven Traveler variants share one. */
  gameId: number | null;
  name: string;
  title: string | null;
  element: Element;
  weapon: WeaponType;
  rarity: Rarity;
  gender: Gender;
  /** Absolute path from the site root, or null when no icon was published. */
  icon: string | null;
}

export interface Pool {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Team {
  id: string;
  name: string;
  /** Requested members for this team, 1-4. */
  size: number;
  /** Union of these pools is the draw space. At least one is required to generate. */
  poolIds: string[];
}

export interface Settings {
  /** When true a character can appear in at most one team per generation. */
  uniqueAcrossTeams: boolean;
}

export interface HistoryTeam {
  teamId: string;
  teamName: string;
  memberIds: string[];
}

export interface HistoryEntry {
  id: string;
  /** ISO 8601 instant. */
  createdAt: string;
  uniqueAcrossTeams: boolean;
  teams: HistoryTeam[];
}

export interface AppState {
  pools: Pool[];
  teams: Team[];
  settings: Settings;
  history: HistoryEntry[];
}

export const TEAM_SIZE_MIN = 1;
export const TEAM_SIZE_MAX = 4;
