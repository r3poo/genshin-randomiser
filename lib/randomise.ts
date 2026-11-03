import { CHARACTER_BY_ID } from "./characters.ts";
import { TEAM_SIZE_MAX, TEAM_SIZE_MIN } from "./types.ts";
import type { AppState, Pool, Team } from "./types.ts";

export interface GeneratedTeam {
  teamId: string;
  teamName: string;
  memberIds: string[];
}

export type GenerationResult =
  | { ok: true; uniqueAcrossTeams: boolean; teams: GeneratedTeam[] }
  | { ok: false; errors: string[] };

export type RandomSource = () => number;

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Union of a team's pools, de-duplicated and filtered to characters that still exist. */
export function teamCandidates(team: Team, poolsById: ReadonlyMap<string, Pool>): string[] {
  const ids = new Set<string>();
  for (const poolId of team.poolIds) {
    const pool = poolsById.get(poolId);
    if (!pool) continue;
    for (const memberId of pool.memberIds) {
      if (CHARACTER_BY_ID.has(memberId)) ids.add(memberId);
    }
  }
  return [...ids];
}

/**
 * Assigns every slot a distinct character via Kuhn's augmenting-path matching, where a slot is
 * one member position of one team. This makes the "unique members across teams" option exact:
 * if a valid assignment exists it is always found, instead of a retry loop that can fail by
 * chance on a tight pool.
 *
 * Candidate lists and slot order are shuffled first, so the result varies between runs. The
 * distribution is not uniform over all perfect matchings — good enough for team drawing, and
 * documented in the runbook rather than pretended otherwise.
 */
function assignUnique(
  slots: readonly (readonly string[])[],
  random: RandomSource,
): { ok: true; bySlot: string[] } | { ok: false; unmatchedSlots: number[] } {
  const owner = new Map<string, number>();
  const bySlot: (string | undefined)[] = new Array(slots.length).fill(undefined);

  const order = shuffle(
    slots.map((_, index) => index),
    random,
  );

  function tryAssign(slot: number, seen: Set<string>): boolean {
    const candidates = slots[slot] ?? [];
    for (const characterId of candidates) {
      if (seen.has(characterId)) continue;
      seen.add(characterId);

      const currentOwner = owner.get(characterId);
      if (currentOwner === undefined) {
        owner.set(characterId, slot);
        bySlot[slot] = characterId;
        return true;
      }
      if (tryAssign(currentOwner, seen)) {
        owner.set(characterId, slot);
        bySlot[slot] = characterId;
        return true;
      }
    }
    return false;
  }

  const unmatchedSlots: number[] = [];
  for (const slot of order) {
    if (!tryAssign(slot, new Set())) unmatchedSlots.push(slot);
  }

  if (unmatchedSlots.length) return { ok: false, unmatchedSlots };

  const resolved: string[] = [];
  for (let i = 0; i < slots.length; i += 1) {
    const value = bySlot[i];
    if (value === undefined) return { ok: false, unmatchedSlots: [i] };
    resolved.push(value);
  }
  return { ok: true, bySlot: resolved };
}

function describeTeams(names: readonly string[]): string {
  if (names.length === 1) return `"${names[0]}"`;
  return names.map((n) => `"${n}"`).join(", ");
}

/**
 * Draws every team at once. Teams are generated together because the uniqueness option couples
 * them; a per-team button could not honour it.
 */
export function generateTeams(state: AppState, random: RandomSource = Math.random): GenerationResult {
  const { teams } = state;
  if (!teams.length) return { ok: false, errors: ["Add at least one team before generating."] };

  const poolsById = new Map(state.pools.map((p) => [p.id, p]));
  const errors: string[] = [];
  const candidatesByTeam: string[][] = [];
  // Clamped once and reused everywhere, so an out-of-range size from an imported file can never
  // produce a team with more members than the UI allows.
  const sizes = teams.map((team) =>
    Math.min(TEAM_SIZE_MAX, Math.max(TEAM_SIZE_MIN, Math.round(team.size))),
  );

  for (const [index, team] of teams.entries()) {
    if (!team.poolIds.length) {
      errors.push(`${team.name}: select at least one pool.`);
      candidatesByTeam.push([]);
      continue;
    }

    const size = sizes[index] ?? TEAM_SIZE_MIN;
    const candidates = teamCandidates(team, poolsById);
    candidatesByTeam.push(candidates);

    if (candidates.length < size) {
      errors.push(
        `${team.name}: needs ${size} member${size === 1 ? "" : "s"} but its selected pools only contain ${candidates.length}.`,
      );
    }
  }

  if (errors.length) return { ok: false, errors };

  if (!state.settings.uniqueAcrossTeams) {
    const generated = teams.map((team, index) => ({
      teamId: team.id,
      teamName: team.name,
      memberIds: shuffle(candidatesByTeam[index] ?? [], random).slice(0, sizes[index] ?? TEAM_SIZE_MIN),
    }));
    return { ok: true, uniqueAcrossTeams: false, teams: generated };
  }

  // One slot per member position; every slot in a team shares that team's candidate list.
  const slotTeams: number[] = [];
  const slotCandidates: string[][] = [];
  teams.forEach((team, teamIndex) => {
    for (let i = 0; i < (sizes[teamIndex] ?? TEAM_SIZE_MIN); i += 1) {
      slotTeams.push(teamIndex);
      slotCandidates.push(shuffle(candidatesByTeam[teamIndex] ?? [], random));
    }
  });

  const assignment = assignUnique(slotCandidates, random);
  if (!assignment.ok) {
    const blocked = new Set(assignment.unmatchedSlots.map((slot) => slotTeams[slot]));
    const names = teams.filter((_, index) => blocked.has(index)).map((t) => t.name);
    return {
      ok: false,
      errors: [
        `No unique assignment exists for ${describeTeams(names)}: their pools overlap too much to fill every team without repeating a character.`,
        "Add characters to the pools, reduce a team size, or turn off unique members.",
      ],
    };
  }

  const membersByTeam: string[][] = teams.map(() => []);
  assignment.bySlot.forEach((characterId, slot) => {
    const teamIndex = slotTeams[slot];
    if (teamIndex === undefined) return;
    membersByTeam[teamIndex]?.push(characterId);
  });

  return {
    ok: true,
    uniqueAcrossTeams: true,
    teams: teams.map((team, index) => ({
      teamId: team.id,
      teamName: team.name,
      // Re-shuffle for display so a team is not ordered by how the matching happened to run.
      memberIds: shuffle(membersByTeam[index] ?? [], random),
    })),
  };
}
