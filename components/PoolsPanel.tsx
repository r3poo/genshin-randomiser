"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHARACTERS } from "@/lib/characters";
import { allFilters, filterCharacters, toggleInOrder, type Filters } from "@/lib/filters";
import { elementIcon, weaponIcon } from "@/lib/assets";
import { newId } from "@/lib/ids";
import { useStore } from "@/lib/store";
import {
  BUTTON,
  BUTTON_GHOST,
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  ELEMENT_TEXT,
  INPUT,
  PANEL,
  RARITY_LABEL,
  RARITY_TEXT,
  plural,
} from "@/lib/ui";
import { DEFAULT_POOL_NAME } from "@/lib/types";
import { ELEMENTS, GENDERS, RARITIES, WEAPONS } from "@/lib/types";
import type { Character } from "@/lib/types";
import { Portrait } from "./Portrait";

/** Every character in the roster, in roster order — the target of "Select all". */
const ALL_CHARACTER_IDS = CHARACTERS.map((character) => character.id);

export function PoolsPanel() {
  const { state, dispatch } = useStore();
  const [activeId, setActiveId] = useState<string | null>(state.pools[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(allFilters);

  // Deleting the open pool must not leave the editor pointing at nothing.
  const active = state.pools.find((pool) => pool.id === activeId) ?? state.pools[0] ?? null;

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return filterCharacters(CHARACTERS, filters)
      .filter(
        (character) =>
          needle === "" ||
          character.name.toLowerCase().includes(needle) ||
          (character.title ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filters, query]);

  const members = useMemo(() => new Set(active?.memberIds ?? []), [active]);
  const shownIds = useMemo(() => shown.map((character) => character.id), [shown]);
  const selectedAmongShown = shownIds.filter((id) => members.has(id)).length;

  // The name field of a freshly created pool takes focus so the default label can be replaced by
  // typing. Cleared once it has been focused, so switching pools later does not steal the caret.
  const [focusNameFor, setFocusNameFor] = useState<string | null>(null);
  const clearFocusName = useCallback(() => setFocusNameFor(null), []);

  function addPool() {
    const poolId = newId("pool");
    dispatch({ type: "addPool", poolId });
    setActiveId(poolId);
    setFocusNameFor(poolId);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Pools</h2>
          <button type="button" className={BUTTON_GHOST} onClick={addPool}>
            + New
          </button>
        </div>
        {state.pools.length === 0 ? (
          <p className={`${PANEL} px-3 py-4 text-xs text-muted`}>
            No pools yet. Create one, then pick the characters it contains.
          </p>
        ) : (
          <ul className={`${PANEL} overflow-hidden`}>
            {state.pools.map((pool) => {
              const isActive = pool.id === active?.id;
              return (
                <li key={pool.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(pool.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "border-accent bg-panel-2 text-strong"
                        : "border-transparent text-soft hover:bg-panel-2/60"
                    }`}
                  >
                    <span className="truncate">{pool.name || DEFAULT_POOL_NAME}</span>
                    <span className="shrink-0 text-xs text-muted">{pool.memberIds.length}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="px-1 text-xs text-muted">
          A team draws from the union of the pools you tick on it.
        </p>
      </aside>

      {active ? (
        <PoolEditor
          key={active.id}
          poolId={active.id}
          name={active.name}
          focusName={active.id === focusNameFor}
          onNameFocused={clearFocusName}
          memberCount={members.size}
          members={members}
          shown={shown}
          shownIds={shownIds}
          selectedAmongShown={selectedAmongShown}
          query={query}
          onQueryChange={setQuery}
          filters={filters}
          onFiltersChange={setFilters}
        />
      ) : (
        <div className={`${PANEL} flex flex-col items-center justify-center gap-3 px-6 py-16 text-center`}>
          <p className="text-sm text-body">No pool selected</p>
          <p className="max-w-sm text-xs text-muted">
            Pools are reusable character sets. Create one to start choosing characters.
          </p>
          <button type="button" className={BUTTON} onClick={addPool}>
            Create the first pool
          </button>
        </div>
      )}
    </div>
  );
}

function PoolEditor({
  poolId,
  name,
  focusName,
  onNameFocused,
  memberCount,
  members,
  shown,
  shownIds,
  selectedAmongShown,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
}: {
  poolId: string;
  name: string;
  focusName: boolean;
  onNameFocused: () => void;
  memberCount: number;
  members: Set<string>;
  shown: Character[];
  shownIds: string[];
  selectedAmongShown: number;
  query: string;
  onQueryChange: (value: string) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}) {
  const { dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusName) return;
    const input = nameRef.current;
    if (input) {
      input.focus();
      input.select();
    }
    onNameFocused();
  }, [focusName, onNameFocused]);

  // Blank names are allowed while typing, but the pool is never stored without a label.
  function commitName() {
    const trimmed = name.trim();
    if (trimmed === name) return;
    dispatch({ type: "renamePool", poolId, name: trimmed || DEFAULT_POOL_NAME });
  }

  function toggle(characterId: string) {
    dispatch({ type: "togglePoolMember", poolId, characterId });
  }

  // Filtered scope: whatever the search box and filters currently let through.
  function selectFiltered() {
    dispatch({ type: "setPoolMembers", poolId, memberIds: [...new Set([...members, ...shownIds])] });
  }

  function deselectFiltered() {
    const hide = new Set(shownIds);
    dispatch({
      type: "setPoolMembers",
      poolId,
      memberIds: [...members].filter((id) => !hide.has(id)),
    });
  }

  // Roster scope: the label says "all", so it must not depend on what is currently hidden.
  function selectAll() {
    dispatch({ type: "setPoolMembers", poolId, memberIds: ALL_CHARACTER_IDS });
  }

  function deselectAll() {
    if (window.confirm(`Remove all ${memberCount} characters from "${name}"?`)) {
      dispatch({ type: "setPoolMembers", poolId, memberIds: [] });
    }
  }

  return (
    <section className={`${PANEL} flex flex-col`}>
      <header className="flex flex-wrap items-end gap-3 border-b border-line/70 p-4">
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Pool name
          </span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => dispatch({ type: "renamePool", poolId, name: event.target.value })}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Pool name"
            placeholder="e.g. On-field DPS, Supports, Friendship"
            maxLength={60}
            className={`${INPUT} font-semibold`}
          />
        </label>
        <span className="pb-2 text-xs text-muted">{plural(memberCount, "character")}</span>
        <button
          type="button"
          className={`${BUTTON_GHOST} mb-1`}
          onClick={() => dispatch({ type: "deletePool", poolId })}
        >
          Delete pool
        </button>
      </header>

      <div className="space-y-3 border-b border-line/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name or title"
            aria-label="Search characters"
            className={`${INPUT} sm:max-w-xs`}
          />
          <span className="text-xs text-muted">
            {plural(shown.length, "character")} match · {selectedAmongShown} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            <button
              type="button"
              className={BUTTON_GHOST}
              onClick={selectFiltered}
              disabled={shownIds.length === 0 || selectedAmongShown === shownIds.length}
              title={`Add the ${shownIds.length} characters matching the current filters`}
            >
              Select filtered
            </button>
            <button
              type="button"
              className={BUTTON_GHOST}
              onClick={deselectFiltered}
              disabled={selectedAmongShown === 0}
              title={`Remove the ${selectedAmongShown} selected characters matching the current filters`}
            >
              Deselect filtered
            </button>
            <span aria-hidden className="mx-0.5 h-4 w-px self-center bg-line" />
            <button
              type="button"
              className={BUTTON_GHOST}
              onClick={selectAll}
              disabled={memberCount === ALL_CHARACTER_IDS.length}
              title={`Add all ${ALL_CHARACTER_IDS.length} characters to this pool`}
            >
              Select all
            </button>
            <button
              type="button"
              className={BUTTON_GHOST}
              onClick={deselectAll}
              disabled={memberCount === 0}
              title="Remove every character from this pool"
            >
              Deselect all
            </button>
          </div>
        </div>

        <FilterRow label="Element">
          {ELEMENTS.map((element) => (
            <FilterChip
              key={element}
              active={filters.elements.includes(element)}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  elements: toggleInOrder(ELEMENTS, filters.elements, element),
                })
              }
              icon={elementIcon(element)}
              label={element}
              tint={ELEMENT_TEXT[element]}
            />
          ))}
        </FilterRow>

        <FilterRow label="Weapon">
          {WEAPONS.map((weapon) => (
            <FilterChip
              key={weapon}
              active={filters.weapons.includes(weapon)}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  weapons: toggleInOrder(WEAPONS, filters.weapons, weapon),
                })
              }
              icon={weaponIcon(weapon)}
              label={weapon}
            />
          ))}
        </FilterRow>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <FilterRow label="Rarity">
            {RARITIES.map((rarity) => (
              <FilterChip
                key={rarity}
                active={filters.rarities.includes(rarity)}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    rarities: toggleInOrder(RARITIES, filters.rarities, rarity),
                  })
                }
                label={RARITY_LABEL[rarity]}
              />
            ))}
          </FilterRow>

          <FilterRow label="Gender">
            {GENDERS.map((gender) => (
              <FilterChip
                key={gender}
                active={filters.genders.includes(gender)}
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    genders: toggleInOrder(GENDERS, filters.genders, gender),
                  })
                }
                label={gender === "Male/Female" ? "Both" : gender}
                title={gender === "Male/Female" ? "Traveler entries (Male/Female)" : undefined}
              />
            ))}
          </FilterRow>
        </div>
      </div>

      <div className="p-3">
        {shown.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-muted">
            No characters match the current filters. Turn a filter back on to see the roster.
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,10.5rem)] justify-center gap-2">
            {shown.map((character) => {
              const selected = members.has(character.id);
              return (
                <li key={character.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(character.id)}
                    title={`${character.name} · ${character.element} ${character.weapon} · ${RARITY_LABEL[character.rarity]}`}
                    className={`group flex w-full flex-col gap-1 rounded-xl border p-1.5 leading-tight transition-colors ${
                      selected
                        ? "border-accent/70 bg-accent/10"
                        : "border-line/60 hover:border-line hover:bg-panel-2"
                    }`}
                  >
                    <Portrait character={character} size="fill" showElement={false} />
                    <span
                      className={`w-full truncate text-center text-xs ${
                        selected ? "text-strong" : "text-soft"
                      }`}
                    >
                      {character.name}
                    </span>
                    <span className="flex w-full items-center justify-center gap-1 truncate text-[10px]">
                      <span className={ELEMENT_TEXT[character.element]}>
                        {character.element === "Elementless" ? "—" : character.element}
                      </span>
                      <span className="text-muted/50">·</span>
                      <span className={RARITY_TEXT[character.rarity]}>
                        {RARITY_LABEL[character.rarity]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-14 shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
  tint,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string | null;
  label: string;
  tint?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
    >
      {icon ? (
        <img src={icon} alt="" width={14} height={14} className="size-3.5 object-contain" />
      ) : null}
      <span className={active && tint ? tint : undefined}>{label}</span>
    </button>
  );
}
