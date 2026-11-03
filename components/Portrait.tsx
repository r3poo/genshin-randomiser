"use client";

import { useState } from "react";
import { characterIcon } from "@/lib/assets";
import { ELEMENT_BG, ELEMENT_TEXT } from "@/lib/ui";
import type { Character, Rarity } from "@/lib/types";

const SIZES = {
  sm: "size-8 text-[10px]",
  md: "size-12 text-xs",
  lg: "size-16 text-sm",
  /** Fills its container and stays square — used by the pool picker cards. */
  fill: "w-full aspect-square text-xl",
} as const;

/**
 * Rarity wash behind the art, the way the in-game character cards tint their frames: gold for
 * 5★, violet for 4★. Applied to the fallback initials too, so a missing portrait still reads as
 * the right rarity.
 */
const RARITY_FRAME: Record<Rarity, string> = {
  5: "border-rarity-5/60 bg-linear-to-b from-rarity-5/40 via-rarity-5/15 to-transparent",
  4: "border-rarity-4/60 bg-linear-to-b from-rarity-4/40 via-rarity-4/15 to-transparent",
};

function initials(name: string): string {
  const cleaned = name.replace(/\(.*?\)/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2);
  return `${words[0]![0]}${words[1]![0]}`;
}

/**
 * Circular character portrait with an element marker.
 *
 * Two characters upstream have no published art (`mitya`, `valeriy`), and an image can fail for
 * reasons we cannot predict offline, so a failed load degrades to initials rather than a broken
 * image. `key` on the img keeps React from reusing a previous character's failed state.
 */
export function Portrait({
  character,
  size = "md",
  showElement = true,
}: {
  character: Character;
  size?: keyof typeof SIZES;
  showElement?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = characterIcon(character.icon);
  const frame = RARITY_FRAME[character.rarity];

  return (
    <span className="relative inline-flex shrink-0">
      {src && !failed ? (
        <img
          key={src}
          src={src}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`${SIZES[size]} rounded-full border object-cover ${frame}`}
        />
      ) : (
        <span
          aria-hidden
          className={`${SIZES[size]} inline-flex items-center justify-center rounded-full border font-semibold uppercase ${frame} ${ELEMENT_TEXT[character.element]}`}
        >
          {initials(character.name)}
        </span>
      )}
      {showElement ? (
        <span
          aria-hidden
          title={character.element}
          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-panel ${ELEMENT_BG[character.element]}`}
        />
      ) : null}
    </span>
  );
}
