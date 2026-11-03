"use client";

import { CHARACTER_BY_ID } from "@/lib/characters";
import { useStore } from "@/lib/store";
import { BUTTON_GHOST, PANEL, formatTimestamp, plural } from "@/lib/ui";
import { Portrait } from "./Portrait";

export function HistoryPanel() {
  const { state, dispatch } = useStore();
  const { history } = state;

  function clearAll() {
    if (window.confirm(`Delete all ${history.length} history entries? This cannot be undone.`)) {
      dispatch({ type: "clearHistory" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {history.length === 0
            ? "Nothing recorded yet."
            : `${plural(history.length, "generation")} recorded, newest first.`}
        </p>
        {history.length > 0 ? (
          <button type="button" className={BUTTON_GHOST} onClick={clearAll}>
            Clear history
          </button>
        ) : null}
      </div>

      {history.length === 0 ? (
        <div className={`${PANEL} px-6 py-12 text-center`}>
          <p className="text-sm text-body">No generations yet</p>
          <p className="mt-1 text-xs text-muted">
            Randomise a team on the Teams tab and the result will be listed here.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className={`${PANEL} p-4`}>
              <header className="flex flex-wrap items-center gap-2">
                <time
                  dateTime={entry.createdAt}
                  className="text-sm font-medium text-body"
                >
                  {formatTimestamp(entry.createdAt)}
                </time>
                {entry.uniqueAcrossTeams ? (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-accent">
                    unique
                  </span>
                ) : null}
                <span className="text-xs text-muted">{plural(entry.teams.length, "team")}</span>
                <button
                  type="button"
                  className={`${BUTTON_GHOST} ml-auto`}
                  onClick={() => dispatch({ type: "deleteHistoryEntry", entryId: entry.id })}
                  aria-label="Delete this generation"
                >
                  Delete
                </button>
              </header>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {entry.teams.map((team, teamIndex) => {
                  const characters = team.memberIds
                    .map((id) => CHARACTER_BY_ID.get(id))
                    .filter((character) => character !== undefined);
                  return (
                    <div key={`${entry.id}-${teamIndex}`} className="rounded-lg bg-ink/60 p-3">
                      <p className="mb-2 truncate text-xs font-medium text-soft">
                        {team.teamName}
                      </p>
                      {characters.length === 0 ? (
                        <p className="text-xs text-muted">No characters remain from this draw.</p>
                      ) : (
                        // Same four-column layout as the live team cards, so a recorded draw reads
                        // at the same scale as the one on the Teams tab.
                        <div className="grid grid-cols-4 gap-1.5">
                          {characters.map((character) => (
                            <div
                              key={character.id}
                              className="flex min-w-0 flex-col items-center gap-1"
                            >
                              <Portrait character={character} size="fill" />
                              <span className="w-full truncate text-center text-[10px] text-muted">
                                {character.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
