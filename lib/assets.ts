import { assetUrl } from "./paths.ts";
import type { Element, WeaponType } from "./types.ts";

/**
 * Glyph paths, written by `scripts/fetch-assets.mjs`.
 *
 * `Elementless` has no upstream glyph — the game itself shows no element for those characters —
 * so the UI draws a neutral marker instead of an image.
 */
const ELEMENT_ICONS: Record<Element, string | null> = {
  Anemo: "/icons/element/anemo.png",
  Geo: "/icons/element/geo.png",
  Electro: "/icons/element/electro.png",
  Dendro: "/icons/element/dendro.png",
  Hydro: "/icons/element/hydro.png",
  Pyro: "/icons/element/pyro.png",
  Cryo: "/icons/element/cryo.png",
  Elementless: null,
};

const WEAPON_ICONS: Record<WeaponType, string> = {
  Sword: "/icons/weapon/sword.png",
  Claymore: "/icons/weapon/claymore.png",
  Polearm: "/icons/weapon/polearm.png",
  Bow: "/icons/weapon/bow.png",
  Catalyst: "/icons/weapon/catalyst.png",
};

export function elementIcon(element: Element): string | null {
  return assetUrl(ELEMENT_ICONS[element]);
}

export function weaponIcon(weapon: WeaponType): string {
  return assetUrl(WEAPON_ICONS[weapon]) ?? "";
}

export function characterIcon(path: string | null): string | null {
  return assetUrl(path);
}
