// The cards rating and its ranks. Every counted game moves the four players up or down: a team is
// as strong as its two players' ratings together, and what you're scored on is the result and
// the scoreline, against what the ratings expected. So performance decides your rank, and it can
// fall as well as climb. Pure: weekends in, ratings out.
//
// It runs on the same scale and the same ten ranks as the ranked app (spike-east, src/lib/league.ts
// TIERS) so a number means the same thing in both, but it's its own rating: tournament games never
// touch the ladder. If those tiers change there, change them here.
import { isDone, type Game } from "@/lib/cards";

export const START = 800; // everyone's first rating, mid-table (Pocket Sniper), as in the ranked app
export const PLACING_GAMES = 5; // until then you're placing: a rating, moving fast, no rank shown
const K_PLACING = 48; // how far one game moves you while placing...
const K = 24; // ...and after: an even 15–9 game is worth about ±7
const SPREAD = 400; // rating gap at which the stronger pair is expected ~10 to 1
const WIN_FLOOR = 1; // a win always gains something, even a scrappy one as heavy favourites

export type Rank = { name: string; icon: string; color: string; min: number };

/** While placing, regardless of the rating (the ranked app calls it the same). */
export const PLACING: Rank = { name: "Fresh Meat", icon: "🐣", color: "#8A9196", min: 0 };

/** The ranked app's ten ranks, ascending. Each applies from `min` up to the next one's. */
export const RANKS: Rank[] = [
  { min: 0, name: "Whiff Merchant", icon: "💨", color: "#FF6B6B" },
  { min: 350, name: "Tacky Boomer", icon: "📠", color: "#E0935A" },
  { min: 500, name: "Soft Touch", icon: "🧈", color: "#E0B15A" },
  { min: 600, name: "Lob Goblin", icon: "👺", color: "#A8B05A" },
  { min: 700, name: "Roll-Shot Rascal", icon: "🌀", color: "#8A9196" },
  { min: 800, name: "Pocket Sniper", icon: "🎯", color: "#C4CDD6" },
  { min: 900, name: "Spike Lee", icon: "🎬", color: "#F4F5F6" },
  { min: 1000, name: "Tomahawk", icon: "🪓", color: "#5CD37D" },
  { min: 1100, name: "Block-ness Monster", icon: "🦕", color: "#FFCF5C" },
  { min: 1400, name: "Scotty Beeks", icon: "🐐", color: "#CBFB4F" },
];

/** Your rank for a rating, the next one up, and how far between the two you are (0–1). */
export function rankFor(rating: number, placed: boolean): { rank: Rank; next: Rank | null; progress: number } {
  if (!placed) return { rank: PLACING, next: null, progress: 0 };
  const i = Math.max(0, RANKS.findLastIndex((r) => rating >= r.min));
  const next = RANKS[i + 1] ?? null;
  return { rank: RANKS[i], next, progress: next ? Math.max(0, Math.min(1, (rating - RANKS[i].min) / (next.min - RANKS[i].min))) : 1 };
}

/** Where a weekend left you: rating before and after it, and how many counted games you played. */
export type Weekend = { before: number; after: number; games: number; gamesBefore: number };
export type PlayerRating = { rating: number; games: number; placed: boolean; weekends: Map<string, Weekend> };

const counted = (g: Game) => isDone(g) && !g.decider;
const order = (x: Game, y: Game) => x.stageNo - y.stageNo || x.ord - y.ord || x.seq - y.seq;

/** Everyone's rating, replaying every weekend in order (oldest first) and every counted game in
 *  the order it was drawn. Deciders don't count; a sub plays at their rating but their own rating
 *  doesn't move, since the game never counts for the sub. */
export function rateWeekends(events: { id: string; startsAt: number; games: Game[] }[]): Map<string, PlayerRating> {
  const out = new Map<string, PlayerRating>();
  const me = (id: string) => out.get(id) ?? (out.set(id, { rating: START, games: 0, placed: false, weekends: new Map() }), out.get(id)!);
  for (const ev of [...events].sort((a, b) => a.startsAt - b.startsAt)) {
    for (const g of ev.games.filter(counted).sort(order)) {
      const r = (id: string) => out.get(id)?.rating ?? START; // read only: a sub gets no entry
      const ra = (r(g.a[0]) + r(g.a[1])) / 2;
      const rb = (r(g.b[0]) + r(g.b[1])) / 2;
      const expA = 1 / (1 + 10 ** ((rb - ra) / SPREAD));
      const aWon = g.scoreA! > g.scoreB!;
      // Half the result, half the share of the points: a 15–13 win counts for less than 15–3.
      const scoreA = 0.5 * (aWon ? 1 : 0) + 0.5 * (g.scoreA! / (g.scoreA! + g.scoreB!));
      for (const [side, exp, got, won] of [[g.a, expA, scoreA, aWon], [g.b, 1 - expA, 1 - scoreA, !aWon]] as const) {
        for (const id of side) {
          if (g.subs.includes(id)) continue;
          const p = me(id);
          const wk = p.weekends.get(ev.id) ?? (p.weekends.set(ev.id, { before: p.rating, after: p.rating, games: 0, gamesBefore: p.games }), p.weekends.get(ev.id)!);
          let d = (p.games < PLACING_GAMES ? K_PLACING : K) * (got - exp);
          if (won) d = Math.max(WIN_FLOOR, d);
          p.rating += d;
          p.games += 1;
          p.placed = p.games >= PLACING_GAMES;
          wk.after = p.rating;
          wk.games += 1;
        }
      }
    }
  }
  return out;
}

/** The Me tab's chart: your rating after each weekend (oldest first), and the rank lines it
 *  crossed or sits between, so a dip below a line shows as clearly as a climb above one. */
export function climb(after: number[]): { values: number[]; marks: Rank[] } {
  if (!after.length) return { values: [], marks: [] };
  const lo = Math.min(START, ...after), hi = Math.max(START, ...after);
  const marks = RANKS.filter((r) => r.min > 0 && r.min >= lo - 60 && r.min <= hi + 60);
  return { values: after, marks };
}
