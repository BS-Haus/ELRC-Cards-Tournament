// Points and levels: cosmetic, for fun. Every weekend you play earns points for turning up, for
// your wins and for where you finish; points add up over time into levels. Nothing here affects
// who plays whom. Pure: games in, points out.
import { tally, isDone, type Game } from "@/lib/cards";
import { finishOf } from "@/lib/recap";

export const POINTS = {
  showedUp: 10, // played at least one counted game
  perWin: 3,
  perGame: 1,
  // Finish in the finals, by tier (Gold, Silver, Bronze, Copper) and place.
  champion: [30, 15, 10, 8],
  runnerUp: [15, 8, 5, 4],
  finalist: [6, 3, 2, 2],
};

export type Level = { name: string; min: number; color: string; emoji: string };
export const LEVELS: Level[] = [
  { name: "Rookie", min: 0, color: "#9CA3A8", emoji: "🌱" },
  { name: "Regular", min: 40, color: "#5EEAD4", emoji: "🏐" },
  { name: "Contender", min: 100, color: "#93C5FD", emoji: "⚡" },
  { name: "Pro", min: 200, color: "#C4B5FD", emoji: "🔥" },
  { name: "Elite", min: 350, color: "#FFCF5C", emoji: "👑" },
  { name: "Legend", min: 550, color: "#CBFB4F", emoji: "🌟" },
];

export type Earned = { total: number; parts: { label: string; points: number }[] };

/** What one weekend earned a player. Zero if they didn't play a counted game. */
export function eventPoints(games: Game[], id: string): Earned {
  const counted = games.filter((g) => isDone(g) && !g.decider && [...g.a, ...g.b].includes(id) && !g.subs.includes(id));
  if (!counted.length) return { total: 0, parts: [] };
  const line = tally(counted, [id]).get(id)!;
  const parts = [
    { label: "Played", points: POINTS.showedUp },
    { label: `${line.gp} game${line.gp === 1 ? "" : "s"}`, points: line.gp * POINTS.perGame },
    { label: `${line.w} win${line.w === 1 ? "" : "s"}`, points: line.w * POINTS.perWin },
  ];
  const f = finishOf(games, id);
  if (f) {
    const t = Math.min(f.tierIndex, 3);
    const pts = f.won ? POINTS.champion[t] : f.position === 2 ? POINTS.runnerUp[t] : POINTS.finalist[t];
    parts.push({ label: f.won ? `${f.tier} champion` : f.position === 2 ? `${f.tier} runner-up` : `${f.tier} final`, points: pts });
  }
  return { total: parts.reduce((n, p) => n + p.points, 0), parts: parts.filter((p) => p.points > 0) };
}

/** The level for a points total, and how far to the next one. */
export function levelFor(points: number): { level: Level; next: Level | null; progress: number } {
  const i = LEVELS.findLastIndex((l) => points >= l.min);
  const level = LEVELS[Math.max(0, i)];
  const next = LEVELS[i + 1] ?? null;
  return { level, next, progress: next ? (points - level.min) / (next.min - level.min) : 1 };
}

/** A player's points over their weekends (oldest first), up to and including `until`. */
export function careerPoints(events: { id: string; startsAt: number; games: Game[] }[], id: string, until = Infinity): number {
  return events.filter((e) => e.startsAt <= until).reduce((n, e) => n + eventPoints(e.games, id).total, 0);
}
