import { CHARACTERS } from "./characters.ts";
import type { AppState, Pool, Team } from "./types.ts";

export const STARTER_POOL_ID = "pool-all-characters";

/**
 * What a visitor with no saved state starts with: one pool holding the full roster and two teams
 * of four pointing at it, so the randomise button works on the first page load.
 *
 * Distinct from `emptyState()` in lib/validate.ts, which is the structural blank the parser and
 * the reset action use — seeding there would leak starter content into every import and reset.
 */
export function initialState(): AppState {
  const pool: Pool = {
    id: STARTER_POOL_ID,
    name: "All characters",
    memberIds: CHARACTERS.map((c) => c.id),
  };
  const teams: Team[] = [1, 2].map((n) => ({
    id: `team-${n}`,
    name: `Team ${n}`,
    size: 4,
    poolIds: [STARTER_POOL_ID],
  }));

  return {
    pools: [pool],
    teams,
    // Two teams drawing from one pool reads as a bug when the same character shows up twice,
    // so the safer behaviour is the default. It is a one-click toggle away.
    settings: { uniqueAcrossTeams: true },
    history: [],
  };
}
