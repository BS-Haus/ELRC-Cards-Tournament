// Points and ranks: cosmetic, for fun. Every weekend you play earns points for turning up, for
// your wins and for where you finish; points add up over time into Rocket League-style ranks:
// Bronze, Silver, Gold, Diamond and Champion, three divisions each (Gold I, Gold II, Gold III).
// Nothing here affects who plays whom. Pure: games in, points out.
import { tally, isDone, finalWinTitle, type Game } from "@/lib/cards";
import { finishOf } from "@/lib/recap";

export const POINTS = {
  showedUp: 10, // played at least one counted game
  perWin: 3,
  perGame: 1,
  // Finish in the finals, by final (A, B, C, D) and place.
  champion: [30, 15, 10, 8],
  runnerUp: [15, 8, 5, 4],
  finalist: [6, 3, 2, 2],
};

/** The five ranks and the points each starts at. Champion's divisions are 100 points apart. */
export const RANKS = [
  { tier: "Bronze", icon: "🥉", min: 0, color: "#D08A57" },
  { tier: "Silver", icon: "🥈", min: 60, color: "#C4CDD6" },
  { tier: "Gold", icon: "🥇", min: 150, color: "#FFCF5C" },
  { tier: "Diamond", icon: "💎", min: 300, color: "#7DD3FC" },
  { tier: "Champion", icon: "🏆", min: 500, color: "#C084FC" },
] as const;
const CHAMP_STEP = 100;
const DIVISIONS = ["I", "II", "III"];

export type Level = { name: string; tier: string; icon: string; division: number; min: number; color: string };

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
    parts.push({ label: f.won ? finalWinTitle(f.tier) : f.position === 2 ? `${f.tier} final runner-up` : `${f.tier} final`, points: pts });
  }
  return { total: parts.reduce((n, p) => n + p.points, 0), parts: parts.filter((p) => p.points > 0) };
}

/** Every division in order, lowest first: Bronze I … Champion III. */
export const LEVELS: Level[] = RANKS.flatMap((r, i) => {
  const step = i + 1 < RANKS.length ? (RANKS[i + 1].min - r.min) / 3 : CHAMP_STEP;
  return DIVISIONS.map((d, j) => ({ name: `${r.tier} ${d}`, tier: r.tier, icon: r.icon, division: j + 1, min: Math.round(r.min + j * step), color: r.color }));
});

/** The rank for a points total, and how far to the next division. */
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
