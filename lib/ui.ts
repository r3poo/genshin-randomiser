import type { Element, Gender, Rarity, WeaponType } from "./types.ts";

/**
 * Tailwind only emits classes it can see as complete strings, so every variant lives in a map
 * here rather than being built with `bg-${element}`.
 */
export const ELEMENT_TEXT: Record<Element, string> = {
  Anemo: "text-anemo",
  Geo: "text-geo",
  Electro: "text-electro",
  Dendro: "text-dendro",
  Hydro: "text-hydro",
  Pyro: "text-pyro",
  Cryo: "text-cryo",
  Elementless: "text-elementless",
};

export const ELEMENT_BG: Record<Element, string> = {
  Anemo: "bg-anemo",
  Geo: "bg-geo",
  Electro: "bg-electro",
  Dendro: "bg-dendro",
  Hydro: "bg-hydro",
  Pyro: "bg-pyro",
  Cryo: "bg-cryo",
  Elementless: "bg-elementless",
};

export const RARITY_LABEL: Record<Rarity, string> = { 5: "5★", 4: "4★" };
export const RARITY_TEXT: Record<Rarity, string> = { 5: "text-rarity-5", 4: "text-rarity-4" };
export const GENDER_LABEL: Record<Gender, string> = {
  Male: "Male",
  Female: "Female",
  "Male/Female": "Both",
};

export const WEAPON_LABEL: Record<WeaponType, string> = {
  Sword: "Sword",
  Claymore: "Claymore",
  Polearm: "Polearm",
  Bow: "Bow",
  Catalyst: "Catalyst",
};

export const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-body transition-colors hover:border-accent/60 hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40";
export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-accent/70 bg-accent px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40";
export const BUTTON_GHOST =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-body disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted";
export const INPUT =
  "w-full rounded-lg border border-line bg-ink px-3 py-1.5 text-sm text-strong placeholder:text-muted/70 focus:border-accent/70 focus:outline-none";
export const PANEL = "rounded-xl border border-line bg-panel";
export const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors";
export const CHIP_ON = "border-accent/60 bg-accent/15 text-strong";
export const CHIP_OFF = "border-line bg-ink text-muted hover:border-line/80 hover:text-soft";

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
