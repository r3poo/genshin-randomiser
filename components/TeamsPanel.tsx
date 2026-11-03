"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHARACTER_BY_ID } from "@/lib/characters";
import { newId } from "@/lib/ids";
import { generateTeams, teamCandidates, type GeneratedTeam } from "@/lib/randomise";
import { useStore } from "@/lib/store";
import {
  BUTTON,
  BUTTON_GHOST,
  BUTTON_PRIMARY,
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  INPUT,
  PANEL,
  plural,
} from "@/lib/ui";
import { DEFAULT_TEAM_NAME, TEAM_SIZE_MAX, TEAM_SIZE_MIN } from "@/lib/types";
import type { Team } from "@/lib/types";
import { Portrait } from "./Portrait";

/**
 * Fingerprint of everything a draw depends on — deliberately excluding pool and team *names*.
 * Renaming is cosmetic, so it must not discard the result the user is looking at.
 */
function configSignature(
  pools: { id: string; memberIds: string[] }[],
  teams: { id: string; size: number; poolIds: string[] }[],
  settings: { uniqueAcrossTeams: boolean },
): string {
  return JSON.stringify({
    pools: pools.map((pool) => [pool.id, pool.memberIds]),
    teams: teams.map((team) => [team.id, team.size, team.poolIds]),
    unique: settings.uniqueAcrossTeams,
  });
}

export function TeamsPanel() {
  const { state, dispatch } = useStore();
  const { pools, teams, settings } = state;

  // Same affordance as the pool editor: a new team's name field takes focus so the default label
  // can be replaced by typing, and only once, so switching focus later is not hijacked.
  const [focusNameFor, setFocusNameFor] = useState<string | null>(null);
  const clearFocusName = useCallback(() => setFocusNameFor(null), []);

  function addTeam() {
    const teamId = newId("team");
    dispatch({ type: "addTeam", teamId });
    setFocusNameFor(teamId);
  }

  const [errors, setErrors] = useState<string[]>([]);
  const [generated, setGenerated] = useState<{ signature: string; teams: GeneratedTeam[] } | null>(
    null,
  );

  const poolsById = useMemo(() => new Map(pools.map((pool) => [pool.id, pool])), [pools]);
  const signature = useMemo(
    () => configSignature(pools, teams, settings),
    [pools, teams, settings],
  );
  // Results are tied to the configuration that produced them: editing a pool, a team size or the
  // uniqueness setting hides them instead of showing a draw that no longer matches the inputs.
  const visible = generated && generated.signature === signature ? generated.teams : null;

  function randomise() {
    const result = generateTeams(state);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setGenerated({ signature, teams: result.teams });
    dispatch({
      type: "recordGeneration",
      entry: {
        id: newId("history"),
        createdAt: new Date().toISOString(),
        uniqueAcrossTeams: result.uniqueAcrossTeams,
        teams: result.teams,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className={`${PANEL} flex flex-wrap items-center justify-between gap-4 px-4 py-3`}>
        <button
          type="button"
          role="switch"
          aria-checked={settings.uniqueAcrossTeams}
          onClick={() =>
            dispatch({ type: "setUniqueAcrossTeams", value: !settings.uniqueAcrossTeams })
          }
          className="flex items-center gap-3 text-left"
        >
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
              settings.uniqueAcrossTeams
                ? "border-accent/70 bg-accent/80"
                : "border-line bg-panel-2"
            }`}
          >
            <span
              className={`absolute top-0.5 size-3.5 rounded-full bg-ink transition-all ${
                settings.uniqueAcrossTeams ? "left-[1.15rem]" : "left-0.5"
              }`}
            />
          </span>
          <span>
            <span className="block text-sm text-body">Unique members across teams</span>
            <span className="block text-xs text-muted">
              {settings.uniqueAcrossTeams
                ? "A character appears in at most one team."
                : "Teams draw independently, so characters can repeat."}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button type="button" className={BUTTON} onClick={addTeam}>
            Add team
          </button>
          <button
            type="button"
            className={BUTTON_PRIMARY}
            onClick={randomise}
            disabled={teams.length === 0}
          >
            Randomise
          </button>
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">Could not randomise</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {errors.map((error) => (
              <li key={error} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {teams.length === 0 ? (
        <div className={`${PANEL} px-6 py-10 text-center`}>
          <p className="text-sm text-body">No teams configured yet.</p>
          <p className="mt-1 text-xs text-muted">
            Add a team, point it at one or more pools, then randomise.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              focusName={team.id === focusNameFor}
              onNameFocused={clearFocusName}
              pools={pools}
              candidateCount={teamCandidates(team, poolsById).length}
              result={visible?.find((entry) => entry.teamId === team.id)?.memberIds ?? null}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted">
        Every successful draw is recorded in{" "}
        <span className="text-soft">History</span> with its timestamp.
      </p>
    </div>
  );
}

function TeamCard({
  team,
  focusName,
  onNameFocused,
  pools,
  candidateCount,
  result,
}: {
  team: Team;
  focusName: boolean;
  onNameFocused: () => void;
  pools: { id: string; name: string; memberIds: string[] }[];
  candidateCount: number;
  result: string[] | null;
}) {
  const { dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const short = candidateCount < team.size;
  const noPools = team.poolIds.length === 0;

  useEffect(() => {
    if (!focusName) return;
    const input = nameRef.current;
    if (input) {
      input.focus();
      input.select();
    }
    onNameFocused();
  }, [focusName, onNameFocused]);

  // Blank names are allowed while typing, but a team is never stored without a label.
  function commitName() {
    const trimmed = team.name.trim();
    if (trimmed === team.name) return;
    dispatch({ type: "renameTeam", teamId: team.id, name: trimmed || DEFAULT_TEAM_NAME });
  }

  return (
    <section className={`${PANEL} flex flex-col gap-3 p-4`}>
      <header className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Team name
          </span>
          <input
            ref={nameRef}
            value={team.name}
            onChange={(event) =>
              dispatch({ type: "renameTeam", teamId: team.id, name: event.target.value })
            }
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Team name"
            placeholder="e.g. Abyss first half"
            maxLength={60}
            className={`${INPUT} font-semibold`}
          />
        </label>
        <div
          className="flex shrink-0 items-center rounded-lg border border-line bg-ink p-0.5"
          role="group"
          aria-label="Members per team"
        >
          {Array.from({ length: TEAM_SIZE_MAX - TEAM_SIZE_MIN + 1 }, (_, i) => i + TEAM_SIZE_MIN).map(
            (size) => (
              <button
                key={size}
                type="button"
                aria-pressed={team.size === size}
                onClick={() => dispatch({ type: "setTeamSize", teamId: team.id, size })}
                className={`size-6 rounded-md text-xs transition-colors ${
                  team.size === size
                    ? "bg-accent text-ink"
                    : "text-muted hover:bg-panel-2 hover:text-body"
                }`}
              >
                {size}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className={`${BUTTON_GHOST} mb-1`}
          onClick={() => dispatch({ type: "deleteTeam", teamId: team.id })}
          aria-label={`Delete ${team.name}`}
          title="Delete team"
        >
          Delete
        </button>
      </header>

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Draw from
        </p>
        {pools.length === 0 ? (
          <p className="text-xs text-warning/90">No pools exist yet — create one first.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {pools.map((pool) => {
              const on = team.poolIds.includes(pool.id);
              return (
                <button
                  key={pool.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    dispatch({ type: "toggleTeamPool", teamId: team.id, poolId: pool.id })
                  }
                  className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${on ? "bg-accent" : "bg-line"}`}
                    aria-hidden
                  />
                  {pool.name}
                  <span className="text-muted">{pool.memberIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className={`mt-2 text-xs ${noPools || short ? "text-warning/90" : "text-muted"}`}>
          {noPools
            ? "Select at least one pool."
            : short
              ? `${plural(candidateCount, "character")} available, ${team.size} needed — this team cannot be filled.`
              : `${plural(candidateCount, "character")} in the pool union.`}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-line/70 pt-3">
        {Array.from({ length: team.size }, (_, index) => {
          const id = result?.[index];
          const character = id ? CHARACTER_BY_ID.get(id) : undefined;
          return (
            <div key={index} className="flex w-16 flex-col items-center gap-1">
              {character ? (
                <>
                  <Portrait character={character} size="md" />
                  <span className="w-full truncate text-center text-[11px] text-soft">
                    {character.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="size-12 rounded-full border border-dashed border-line/80" />
                  <span className="text-[11px] text-muted/60">empty</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
