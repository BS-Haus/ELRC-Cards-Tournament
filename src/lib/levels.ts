// Tiers: the ranked app's ten (spike-east, src/lib/league.ts TIERS), same names, icons, colours
// and rating bands, layered over the rating (src/lib/standings.ts). Before that, everyone's
// 🐣 Fresh Meat while they place. `level` numbers them 1 (Fresh Meat) to 11 (Scotty Beeks), which
// is what the profile photo's ring and banner dress up by (RankAvatar).
import { PROV_N } from "@/lib/standings";

export type Level = { level: number; name: string; icon: string; color: string; min: number };

export const FRESH_MEAT: Level = { level: 1, min: -Infinity, name: "Fresh Meat", icon: "🐣", color: "#8A9196" };

/** The rating tiers, ascending; each runs from `min` to the next one's. Everyone's placed rating
 *  starts near 800 (Pocket Sniper, mid-table); 1400+ is a deliberately mythical cap. */
export const TIERS: Level[] = [
  { level: 2, min: 0, name: "Whiff Merchant", icon: "💨", color: "#FF6B6B" },
  { level: 3, min: 350, name: "Tacky Boomer", icon: "📠", color: "#E0935A" },
  { level: 4, min: 500, name: "Soft Touch", icon: "🧈", color: "#E0B15A" },
  { level: 5, min: 600, name: "Lob Goblin", icon: "👺", color: "#A8B05A" },
  { level: 6, min: 700, name: "Roll-Shot Rascal", icon: "🌀", color: "#8A9196" },
  { level: 7, min: 800, name: "Pocket Sniper", icon: "🎯", color: "#C4CDD6" },
  { level: 8, min: 900, name: "Spike Lee", icon: "🎬", color: "#F4F5F6" },
  { level: 9, min: 1000, name: "Tomahawk", icon: "🪓", color: "#5CD37D" },
  { level: 10, min: 1100, name: "Block-ness Monster", icon: "🦕", color: "#FFCF5C" },
  { level: 11, min: 1400, name: "Scotty Beeks", icon: "🐐", color: "#CBFB4F" },
];
export const LEVELS: Level[] = [FRESH_MEAT, ...TIERS];

export type Standing = { rating: number; games: number };

export type TierInfo = {
  level: Level;
  next: Level | null;
  /** 0–1 through the tier, or through placement while placing. */
  progress: number;
  /** Rating points to the next tier, or games left to place. */
  toNext: number;
  placing: boolean;
};

/** A player's tier: Fresh Meat while placing (fewer than PROV_N games), then by rating. */
export function tierFor({ rating, games }: Standing): TierInfo {
  if (games < PROV_N) return { level: FRESH_MEAT, next: null, progress: games / PROV_N, toNext: PROV_N - games, placing: true };
  const i = Math.max(0, TIERS.findLastIndex((t) => rating >= t.min));
  const level = TIERS[i], next = TIERS[i + 1] ?? null;
  return { level, next, progress: next ? Math.min(1, Math.max(0, (rating - level.min) / (next.min - level.min))) : 1, toNext: next ? next.min - rating : 0, placing: false };
}

/** The tier for a bare rating (a placed player). */
export const tierOfRating = (rating: number) => tierFor({ rating, games: PROV_N });
