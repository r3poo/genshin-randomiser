"use client";

import { useMemo, useState } from "react";
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
  plural,
} from "@/lib/ui";
import { ELEMENTS, GENDERS, RARITIES, WEAPONS } from "@/lib/types";
import type { Character } from "@/lib/types";
import { Portrait } from "./Portrait";

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
  const shownIds = useMemo(() => shown.map((c) => c.id), [shown]);
  const selectedAmongShown = shownIds.filter((id) => members.has(id)).length;

  function addPool() {
    const poolId = newId("pool");
    dispatch({ type: "addPool", poolId });
    setActiveId(poolId);
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
                        ? "border-accent bg-panel-2 text-slate-100"
                        : "border-transparent text-slate-300 hover:bg-panel-2/60"
                    }`}
                  >
                    <span className="truncate">{pool.name || "Untitled pool"}</span>
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
          poolId={active.id}
          name={active.name}
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
          <p className="text-sm text-slate-200">No pool selected</p>
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

  function toggle(characterId: string) {
    dispatch({ type: "togglePoolMember", poolId, characterId });
  }

  function selectShown() {
    dispatch({ type: "setPoolMembers", poolId, memberIds: [...new Set([...members, ...shownIds])] });
  }

  function clearShown() {
    const hide = new Set(shownIds);
    dispatch({
      type: "setPoolMembers",
      poolId,
      memberIds: [...members].filter((id) => !hide.has(id)),
    });
  }

  function clearPool() {
    if (window.confirm(`Remove all ${memberCount} characters from "${name}"?`)) {
      dispatch({ type: "setPoolMembers", poolId, memberIds: [] });
    }
  }

  return (
    <section className={`${PANEL} flex flex-col`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line/70 p-4">
        <input
          value={name}
          onChange={(event) => dispatch({ type: "renamePool", poolId, name: event.target.value })}
          aria-label="Pool name"
          placeholder="Pool name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold text-slate-100 placeholder:text-muted hover:border-line focus:border-accent/70 focus:bg-ink focus:outline-none"
        />
        <span className="text-xs text-muted">{plural(memberCount, "character")}</span>
        <button
          type="button"
          className={BUTTON_GHOST}
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
          <div className="ml-auto flex gap-1">
            <button type="button" className={BUTTON_GHOST} onClick={selectShown}>
              Select shown
            </button>
            <button type="button" className={BUTTON_GHOST} onClick={clearShown}>
              Clear shown
            </button>
            <button type="button" className={BUTTON_GHOST} onClick={clearPool}>
              Clear pool
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
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
            {shown.map((character) => {
              const selected = members.has(character.id);
              return (
                <li key={character.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(character.id)}
                    title={`${character.name} · ${character.element} ${character.weapon} · ${RARITY_LABEL[character.rarity]}`}
                    className={`group flex w-full flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition-colors ${
                      selected
                        ? "border-accent/60 bg-accent/10"
                        : "border-transparent hover:border-line hover:bg-panel-2"
                    }`}
                  >
                    <span className="relative">
                      <Portrait character={character} size="md" showElement={false} />
                      <span
                        aria-hidden
                        className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-panel ${
                          selected ? "bg-accent" : "bg-transparent"
                        }`}
                      />
                    </span>
                    <span
                      className={`w-full truncate text-center text-[11px] ${
                        selected ? "text-slate-100" : "text-slate-300"
                      }`}
                    >
                      {character.name}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted">
                      <span className={ELEMENT_TEXT[character.element]}>
                        {character.element === "Elementless" ? "—" : character.element}
                      </span>
                      <span className="text-muted/50">·</span>
                      <span>{RARITY_LABEL[character.rarity]}</span>
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
