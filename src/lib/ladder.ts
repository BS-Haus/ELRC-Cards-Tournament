// The ladders (Tournament tab and Players), in the style of the club's ranked app: each player's
// headline number, a sparkline of how it got there, their last few results as dots and their W–L.
// Pure: games in, rows out.
import { isDone, tally, rank, type Game, type Line } from "@/lib/cards";
import { xpWeekends, winXp, lossXp, XP, levelFor, type PlayerXp } from "@/lib/levels";

export type TimedGame = Game & { updatedAt: number };
export type LadderEvent = { id: string; startsAt: number; games: TimedGame[] };
export type Form = ("W" | "L")[];

export type LadderRow = {
  id: string;
  rank: number;
  /** All-time XP and the level it puts them on. */
  xp: number;
  level: number;
  /** XP made (or lost) at the event in view, or at their latest weekend in the overall ladder. */
  change: number;
  w: number;
  l: number;
  /** Points difference per game. */
  pdg: number;
  form: Form;
  /** XP after each of their recent games, oldest first: the sparkline. */
  spark: number[];
};

const counted = (g: Game) => isDone(g) && !g.decider;
const playedBy = (g: Game, id: string) => [...g.a, ...g.b].includes(id) && !g.subs.includes(id);
const won = (g: Game, id: string) => (g.a.includes(id) ? g.scoreA! > g.scoreB! : g.scoreB! > g.scoreA!);

/**
 * XP after each counted game a player played, oldest first. Each weekend starts from its XP before
 * and ends exactly on its XP after (levels.ts), so finals bonuses and the 0 floor land at the
 * weekend's last game; in between it moves game by game (+10 for turning up on the first).
 */
export function xpTrail(events: LadderEvent[], me: string, xp: Map<string, PlayerXp>): { eventId: string; xp: number; won: boolean }[] {
  const mine = xp.get(me);
  if (!mine) return [];
  const out: { eventId: string; xp: number; won: boolean }[] = [];
  for (const ev of [...events].sort((a, b) => a.startsAt - b.startsAt)) {
    const wk = mine.weekends.get(ev.id);
    if (!wk) continue;
    const gs = ev.games.filter((g) => counted(g) && playedBy(g, me)).sort((a, b) => a.updatedAt - b.updatedAt);
    let run = wk.before;
    gs.forEach((g, i) => {
      const m = Math.abs(g.scoreA! - g.scoreB!), w = won(g, me);
      run += (i === 0 ? XP.showedUp : 0) + (w ? winXp(m) : lossXp(m));
      out.push({ eventId: ev.id, xp: i === gs.length - 1 ? wk.after : Math.max(0, run), won: w });
    });
  }
  return out;
}

/** One event's ladder: everyone in it, ranked by the XP they've made today (then win %, then points
 *  per game), so the order and the big number agree. The sparkline and dots are today's games. */
export function eventLadder(events: LadderEvent[], eventId: string, ids: string[]): LadderRow[] {
  const xp = xpWeekends(events);
  const ev = events.find((e) => e.id === eventId);
  if (!ev) return [];
  const today = ev.games.filter((g) => counted(g) && g.kind !== "final");
  const lines = rank(tally(today, ids).values());
  const all = tally(ev.games.filter(counted), ids);
  const change = (id: string) => { const wk = xp.get(id)?.weekends.get(eventId); return wk ? wk.after - wk.before : 0; };
  const order = lines.map((ln, i) => ({ ln, i })).sort((x, y) => (y.ln.gp ? 1 : 0) - (x.ln.gp ? 1 : 0) || change(y.ln.id) - change(x.ln.id) || x.i - y.i);
  return order.map(({ ln }, i) => {
    const day = all.get(ln.id)!;
    const trail = xpTrail(events, ln.id, xp).filter((t) => t.eventId === eventId);
    const wk = xp.get(ln.id)?.weekends.get(eventId);
    const total = xp.get(ln.id)?.xp ?? 0;
    return row(ln.id, i + 1, total, change(ln.id), day, [...(wk ? [wk.before] : []), ...trail.map((t) => t.xp)], trail.map((t) => (t.won ? "W" : "L")));
  });
}

/** The overall ladder: everyone who's played, ranked by XP. The change is their latest weekend. */
export function overallLadder(events: LadderEvent[], ids: string[]): LadderRow[] {
  const xp = xpWeekends(events);
  const all = tally(events.flatMap((e) => e.games.filter(counted)), ids);
  const latest = (id: string) => {
    const wks = [...(xp.get(id)?.weekends.entries() ?? [])];
    const byStart = new Map(events.map((e) => [e.id, e.startsAt]));
    const last = wks.sort((a, b) => (byStart.get(b[0]) ?? 0) - (byStart.get(a[0]) ?? 0))[0];
    return last ? last[1].after - last[1].before : 0;
  };
  return ids
    .map((id) => ({ id, xp: xp.get(id)?.xp ?? 0, gp: all.get(id)?.gp ?? 0 }))
    .filter((p) => p.gp > 0)
    .sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id))
    .map((p, i) => {
      const trail = xpTrail(events, p.id, xp);
      return row(p.id, i + 1, p.xp, latest(p.id), all.get(p.id)!, [0, ...trail.map((t) => t.xp)].slice(-11), trail.map((t) => (t.won ? "W" : "L")));
    });
}

function row(id: string, rankNo: number, xp: number, change: number, line: Line, spark: number[], form: Form): LadderRow {
  return {
    id, rank: rankNo, xp, level: levelFor(xp).level.level, change,
    w: line.w, l: line.l, pdg: line.gp ? (line.pf - line.pa) / line.gp : 0,
    form: form.slice(-5), spark,
  };
}
