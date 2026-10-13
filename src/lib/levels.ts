// XP and levels. Everyone starts at the bottom, Level 1 (Fresh Meat), and climbs by playing:
// showing up and winning earn XP, losing costs some, and how you finish in the finals adds more.
// Lose enough and you drop a level, so there's something at stake every game; turn up and win
// half your games and you climb. Pure: weekends in, XP out.
//
// The ranks above Fresh Meat are the ranked app's ten (spike-east, src/lib/league.ts TIERS), in
// the same order with the same icons, but here they're levels you unlock with XP, not bands of a
// rating. Tournament games never touch the ladder.
import { isDone, groupWinner, groupMembers, groupRank, tally, type Game } from "@/lib/cards";

export const XP = {
  showedUp: 10, // each weekend you play at least one counted game
  win: 10, // each win...
  marginEvery: 3, // ...plus 1 for every 3 points of margin past 2...
  winMax: 15, // ...up to this
  loss: -6, // each loss
  closeLoss: -3, // a loss by 3 or fewer
  // The A final's podium, and every other final's winner.
  champion: 20,
  second: 10,
  third: 5,
  otherFinal: 10,
};

export type Level = { level: number; name: string; icon: string; color: string; min: number };

/** Level 1 is where everyone starts; then the ranked app's ten, in order. `min` is the XP to unlock.
 *  Tuned by simulating seasons of 12 players of mixed strength (scratch script, not in the repo):
 *  everyone unlocks Level 2 on their first Saturday and an average player Level 3 by their second;
 *  an average player reaches about Level 7 over a 30-Saturday season, and the top levels take a
 *  season of winning, so they still mean something. The steps widen as you go up. */
export const LEVELS: Level[] = [
  { level: 1, min: 0, name: "Fresh Meat", icon: "🐣", color: "#8A9196" },
  { level: 2, min: 20, name: "Whiff Merchant", icon: "💨", color: "#FF6B6B" },
  { level: 3, min: 60, name: "Tacky Boomer", icon: "📠", color: "#E0935A" },
  { level: 4, min: 110, name: "Soft Touch", icon: "🧈", color: "#E0B15A" },
  { level: 5, min: 180, name: "Lob Goblin", icon: "👺", color: "#A8B05A" },
  { level: 6, min: 270, name: "Roll-Shot Rascal", icon: "🌀", color: "#B7C0C8" },
  { level: 7, min: 380, name: "Pocket Sniper", icon: "🎯", color: "#C4CDD6" },
  { level: 8, min: 520, name: "Spike Lee", icon: "🎬", color: "#F4F5F6" },
  { level: 9, min: 700, name: "Tomahawk", icon: "🪓", color: "#5CD37D" },
  { level: 10, min: 920, name: "Block-ness Monster", icon: "🦕", color: "#FFCF5C" },
  { level: 11, min: 1200, name: "Scotty Beeks", icon: "🐐", color: "#CBFB4F" },
];

/** Your level for an XP total, the next one, and how far towards it you are (0–1). */
export function levelFor(xp: number): { level: Level; next: Level | null; progress: number } {
  const i = Math.max(0, LEVELS.findLastIndex((l) => xp >= l.min));
  const next = LEVELS[i + 1] ?? null;
  return { level: LEVELS[i], next, progress: next ? (xp - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1 };
}

/** One line of a weekend's XP, for the review: "4 wins +46". */
export type XpPart = { label: string; xp: number };
/** A weekend: XP before and after it, how it was made up, and the counted games played. */
export type Weekend = { before: number; after: number; games: number; parts: XpPart[] };
export type PlayerXp = { xp: number; games: number; weekends: Map<string, Weekend> };

const counted = (g: Game) => isDone(g) && !g.decider;
const margin = (g: Game) => Math.abs(g.scoreA! - g.scoreB!);
export const winXp = (m: number) => Math.min(XP.winMax, XP.win + Math.floor(Math.max(0, m - 2) / XP.marginEvery));
export const lossXp = (m: number) => (m <= 3 ? XP.closeLoss : XP.loss);

/** Where each player finished in the last finals stage: the A final's top three, and every other
 *  final's winner. Only once that final has no games left to play. */
function finishes(games: Game[]): Map<string, XpPart> {
  const out = new Map<string, XpPart>();
  const fin = games.filter((g) => g.kind === "final" && g.status !== "void");
  if (!fin.length) return out;
  const last = Math.max(...fin.map((g) => g.stageNo));
  const inLast = fin.filter((g) => g.stageNo === last);
  const nos = [...new Set(inLast.map((g) => g.groupNo))].sort((a, b) => a - b);
  for (const no of nos) {
    const gg = inLast.filter((g) => g.groupNo === no);
    if (gg.some((g) => g.status === "todo" && !g.decider)) continue;
    const { winner } = groupWinner(gg);
    if (!winner) continue;
    if (no === nos[0]) {
      const rest = groupRank(tally(gg, groupMembers(gg)).values()).map((r) => r.id).filter((id) => id !== winner);
      out.set(winner, { label: "Champion", xp: XP.champion });
      if (rest[0]) out.set(rest[0], { label: `${gg[0].groupName} final, 2nd`, xp: XP.second });
      if (rest[1]) out.set(rest[1], { label: `${gg[0].groupName} final, 3rd`, xp: XP.third });
    } else out.set(winner, { label: `${gg[0].groupName} final winner`, xp: XP.otherFinal });
  }
  return out;
}

/** Everyone's XP, weekend by weekend, oldest first. Deciders don't count; a sub's game never
 *  counts for the sub. XP never goes below 0. */
export function xpWeekends(events: { id: string; startsAt: number; games: Game[] }[]): Map<string, PlayerXp> {
  const out = new Map<string, PlayerXp>();
  const me = (id: string) => out.get(id) ?? (out.set(id, { xp: 0, games: 0, weekends: new Map() }), out.get(id)!);
  for (const ev of [...events].sort((a, b) => a.startsAt - b.startsAt)) {
    const day = new Map<string, { w: number; l: number; wXp: number; lXp: number }>();
    for (const g of ev.games.filter(counted)) {
      const aWon = g.scoreA! > g.scoreB!;
      for (const [side, won] of [[g.a, aWon], [g.b, !aWon]] as const) {
        for (const id of side) {
          if (g.subs.includes(id)) continue;
          const d = day.get(id) ?? (day.set(id, { w: 0, l: 0, wXp: 0, lXp: 0 }), day.get(id)!);
          if (won) { d.w++; d.wXp += winXp(margin(g)); } else { d.l++; d.lXp += lossXp(margin(g)); }
        }
      }
    }
    const fin = finishes(ev.games);
    for (const [id, d] of day) {
      const p = me(id);
      const parts: XpPart[] = [{ label: "Played", xp: XP.showedUp }];
      if (d.w) parts.push({ label: `${d.w} ${d.w === 1 ? "win" : "wins"}`, xp: d.wXp });
      if (d.l) parts.push({ label: `${d.l} ${d.l === 1 ? "loss" : "losses"}`, xp: d.lXp });
      const f = fin.get(id);
      if (f) parts.push(f);
      const before = p.xp;
      p.xp = Math.max(0, p.xp + parts.reduce((n, x) => n + x.xp, 0));
      p.games += d.w + d.l;
      p.weekends.set(ev.id, { before, after: p.xp, games: d.w + d.l, parts });
    }
  }
  return out;
}

/** The Me tab's chart: XP after each weekend (oldest first), and the level lines it crossed, plus
 *  the next one up, so a drop below a line shows as clearly as a climb above one. */
export function climb(after: number[]): { values: number[]; marks: Level[] } {
  if (!after.length) return { values: [], marks: [] };
  const hi = Math.max(...after);
  const next = levelFor(hi).next;
  const crossed = LEVELS.filter((l) => l.min > 0 && l.min >= Math.min(...after) && l.min <= hi).slice(-3); // a few, not a ladder
  return { values: after, marks: next ? [...crossed, next] : crossed };
}
