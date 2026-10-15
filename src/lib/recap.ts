// A player's day, as a story: the numbers, the finish, the moments, and how it compares with
// last time. Pure: games in, recap out. Everything the recap reel and its saveable image show is
// worked out here, so the two can't disagree.
import { tally, groupRank, groupMembers, groupWinner, isDone, rank, TIERS, type Game, type Line } from "@/lib/cards";

export type DayGame = Game & { eventId: string };
export type DayEvent = { id: string; title: string; startsAt: number; status: string; games: DayGame[] };

export type Moment = { score: [number, number]; winners: [string, string]; losers: [string, string]; label: string };

export type Finish = { tier: string; tierIndex: number; position: number; of: number; won: boolean };

export type Recap = {
  event: { id: string; title: string; startsAt: number; done: boolean };
  /** Who won each final (or each group of the last stage, before any finals). */
  winners: { name: string; winner: string | null; tied: string[] }[];
  /** The day's headline games, for everyone. */
  moments: { biggestWin: Moment | null; longestGame: Moment | null; unbeaten: string[] };
  me: MyDay | null;
  /** Rating either side of this weekend, and their games before it and in it (src/lib/standings.ts;
   *  added by the loader). Below PROV_N games they're still placing. */
  progress?: { before: number; after: number; gamesBefore: number; games: number } | null;
};

export type MyDay = {
  id: string;
  line: Line;
  /** Where the group stages put you, of everyone who played them. */
  dayRank: { position: number; of: number } | null;
  finish: Finish | null;
  bestPartner: { id: string; w: number; gp: number; diff: number } | null;
  toughest: { id: string; l: number; gp: number } | null;
  biggestWin: Moment | null;
  closest: Moment | null;
  streak: number;
  /** Your previous weekend, and what changed. */
  vsLast: { title: string; startsAt: number; winPct: number; diffPerGame: number; finish: Finish | null; winPctDelta: number; diffDelta: number; finishMove: "up" | "down" | "same" | null } | null;
  /** Win % per weekend, oldest first, ending with this one (up to 8). */
  trend: { title: string; startsAt: number; winPct: number }[];
  /** Every counted game in the order played. */
  timeline: { label: string; mine: number; theirs: number; won: boolean; partner: string }[];
  /** Everyone you partnered, best +/− first. */
  partners: { id: string; w: number; gp: number; diff: number }[];
  /** You against everyone who played today: win rate and +/− per game, with the day's range. */
  field: { players: number; win: Spread; diffPerGame: Spread; aheadOf: number } | null;
};

/** Where one value sits in the day's spread. */
export type Spread = { you: number; min: number; max: number; avg: number };

const counted = (g: Game, id: string) => isDone(g) && !g.decider && [...g.a, ...g.b].includes(id) && !g.subs.includes(id);
const onA = (g: Game, id: string) => g.a.includes(id);
const mine = (g: Game, id: string) => (onA(g, id) ? g.scoreA! : g.scoreB!);
const theirs = (g: Game, id: string) => (onA(g, id) ? g.scoreB! : g.scoreA!);
const won = (g: Game, id: string) => mine(g, id) > theirs(g, id);
const order = (x: Game, y: Game) => x.stageNo - y.stageNo || x.ord - y.ord || x.seq - y.seq;
const label = (g: Game) => (g.kind === "final" ? `${g.groupName} final` : `Group ${g.groupName}`);

function moment(g: Game): Moment {
  const aWon = g.scoreA! > g.scoreB!;
  return { score: [Math.max(g.scoreA!, g.scoreB!), Math.min(g.scoreA!, g.scoreB!)], winners: aWon ? g.a : g.b, losers: aWon ? g.b : g.a, label: label(g) };
}

const margin = (g: Game) => Math.abs(g.scoreA! - g.scoreB!);
const total = (g: Game) => g.scoreA! + g.scoreB!;
const pct = (l: Line) => (l.gp ? l.w / l.gp : 0);
const dpg = (l: Line) => (l.gp ? (l.pf - l.pa) / l.gp : 0);

/** The latest finals stage's groups (or the last stage's, before any finals), each with its result. */
export function stageResults(games: Game[]): { kind: "final" | "group"; groups: { name: string; groupNo: number; games: Game[]; winner: string | null; tied: string[] }[] } | null {
  const live = games;
  if (!live.length) return null;
  const finals = live.filter((g) => g.kind === "final");
  const pool = finals.length ? finals : live;
  const stageNo = Math.max(...pool.map((g) => g.stageNo));
  const inStage = pool.filter((g) => g.stageNo === stageNo);
  const nos = [...new Set(inStage.map((g) => g.groupNo))].sort((a, b) => a - b);
  return {
    kind: finals.length ? "final" : "group",
    groups: nos.map((groupNo) => {
      const gs = inStage.filter((g) => g.groupNo === groupNo);
      const { winner, tied } = groupWinner(gs);
      return { name: gs[0].groupName, groupNo, games: gs, winner, tied };
    }),
  };
}

/** Where a player finished in the day's finals: which tier, and their place in it. */
export function finishOf(games: Game[], id: string): Finish | null {
  const res = stageResults(games);
  if (!res || res.kind !== "final") return null;
  for (const g of res.groups) {
    const members = groupMembers(g.games.filter((x) => !x.decider));
    if (!members.includes(id)) continue;
    const table = groupRank(tally(g.games.filter((x) => x.status !== "void"), members).values(), g.games).map((r) => r.id);
    // A decided tie puts the decider's winner first.
    if (g.winner && table[0] !== g.winner) table.splice(table.indexOf(g.winner), 1), table.unshift(g.winner);
    const tierIndex = TIERS.indexOf(g.name) >= 0 ? TIERS.indexOf(g.name) : g.groupNo;
    return { tier: g.name, tierIndex, position: table.indexOf(id) + 1, of: table.length, won: g.winner === id };
  }
  return null;
}

/** Lower is better: A final 1st beats A final 2nd beats B final 1st. */
const finishScore = (f: Finish) => f.tierIndex * 100 + f.position;

function myDay(ev: DayEvent, id: string, history: DayEvent[]): MyDay | null {
  const mineGames = ev.games.filter((g) => counted(g, id)).sort(order);
  if (!mineGames.length) return null;
  const line = tally(mineGames, [id]).get(id)!;

  const groupStage = ev.games.filter((g) => g.kind !== "final");
  const table = rank(tally(groupStage).values()).filter((r) => r.gp > 0);
  const at = table.findIndex((r) => r.id === id);

  const partners = new Map<string, { w: number; gp: number; diff: number }>();
  const foes = new Map<string, { l: number; gp: number }>();
  for (const g of mineGames) {
    const side = onA(g, id) ? g.a : g.b, other = onA(g, id) ? g.b : g.a;
    const mate = side[0] === id ? side[1] : side[0];
    const p = partners.get(mate) ?? { w: 0, gp: 0, diff: 0 };
    p.gp++; if (won(g, id)) p.w++; p.diff += mine(g, id) - theirs(g, id);
    partners.set(mate, p);
    for (const o of other) {
      const f = foes.get(o) ?? { l: 0, gp: 0 };
      f.gp++; if (!won(g, id)) f.l++;
      foes.set(o, f);
    }
  }
  const bp = [...partners].sort((x, y) => y[1].w - x[1].w || y[1].diff - x[1].diff)[0];
  const tf = [...foes].filter(([, f]) => f.l > 0).sort((x, y) => y[1].l - x[1].l || y[1].gp - x[1].gp)[0];

  const wins = mineGames.filter((g) => won(g, id));
  const biggest = [...wins].sort((x, y) => margin(y) - margin(x) || order(x, y))[0];
  const closest = [...mineGames].sort((x, y) => margin(x) - margin(y) || total(y) - total(x) || order(x, y))[0];
  let streak = 0, run = 0;
  for (const g of mineGames) { run = won(g, id) ? run + 1 : 0; streak = Math.max(streak, run); }

  // History: every weekend this player counted a game in, oldest first, up to and including this one.
  const days = history
    .filter((e) => e.startsAt <= ev.startsAt && e.games.some((g) => counted(g, id)))
    .sort((x, y) => x.startsAt - y.startsAt);
  const lineOf = (e: DayEvent) => tally(e.games.filter((g) => counted(g, id)), [id]).get(id)!;
  const prev = days.filter((e) => e.id !== ev.id).at(-1);
  const finish = finishOf(ev.games, id);
  let vsLast: MyDay["vsLast"] = null;
  if (prev) {
    const pl = lineOf(prev);
    const pf = finishOf(prev.games, id);
    vsLast = {
      title: prev.title, startsAt: prev.startsAt, winPct: pct(pl), diffPerGame: dpg(pl), finish: pf,
      winPctDelta: pct(line) - pct(pl), diffDelta: dpg(line) - dpg(pl),
      finishMove: finish && pf ? (finishScore(finish) < finishScore(pf) ? "up" : finishScore(finish) > finishScore(pf) ? "down" : "same") : null,
    };
  }

  // The field: everyone with a counted game today, on the same measures.
  const everyone = [...tally(ev.games.filter((g) => isDone(g) && !g.decider)).values()].filter((r) => r.gp > 0);
  const spread = (f: (l: Line) => number): Spread => {
    const vs = everyone.map(f);
    return { you: f(line), min: Math.min(...vs), max: Math.max(...vs), avg: vs.reduce((a, b) => a + b, 0) / vs.length };
  };
  const field = everyone.length > 1 ? {
    players: everyone.length,
    win: spread(pct),
    diffPerGame: spread(dpg),
    // Share of the others you finished ahead of, on win rate then +/- per game.
    aheadOf: everyone.filter((r) => r.id !== id && (pct(r) < pct(line) || (pct(r) === pct(line) && dpg(r) < dpg(line)))).length / (everyone.length - 1),
  } : null;

  return {
    id, line,
    timeline: mineGames.map((g) => {
      const side = onA(g, id) ? g.a : g.b;
      return { label: label(g), mine: mine(g, id), theirs: theirs(g, id), won: won(g, id), partner: side[0] === id ? side[1] : side[0] };
    }),
    partners: [...partners].map(([pid, p]) => ({ id: pid, ...p })).sort((x, y) => y.diff - x.diff || y.w - x.w),
    field,
    dayRank: at >= 0 ? { position: at + 1, of: table.length } : null,
    finish,
    bestPartner: bp ? { id: bp[0], ...bp[1] } : null,
    toughest: tf ? { id: tf[0], ...tf[1] } : null,
    biggestWin: biggest ? moment(biggest) : null,
    closest: closest ? moment(closest) : null,
    streak,
    vsLast,
    trend: days.slice(-8).map((e) => ({ title: e.title, startsAt: e.startsAt, winPct: pct(lineOf(e)) })),
  };
}

/** The whole recap for one event, from one player's point of view (or nobody's). */
export function buildRecap(ev: DayEvent, playerId: string | null, history: DayEvent[]): Recap {
  const played = ev.games.filter((g) => isDone(g) && !g.decider);
  const res = stageResults(ev.games);
  const biggest = [...played].sort((x, y) => margin(y) - margin(x) || order(x, y))[0];
  // The longest deuce: most points in a game that went to win-by-two.
  const longest = played.filter((g) => margin(g) === 2).sort((x, y) => total(y) - total(x) || order(x, y))[0];
  // Unbeaten across the group stages, with at least three games.
  const groupLines = [...tally(played.filter((g) => g.kind !== "final")).values()];
  return {
    event: { id: ev.id, title: ev.title, startsAt: ev.startsAt, done: ev.status === "done" },
    winners: res?.groups.map((g) => ({ name: res.kind === "final" ? g.name : `Group ${g.name}`, winner: g.winner, tied: g.tied })) ?? [],
    moments: {
      biggestWin: biggest ? moment(biggest) : null,
      longestGame: longest ? moment(longest) : null,
      unbeaten: groupLines.filter((l) => l.gp >= 3 && l.l === 0).map((l) => l.id),
    },
    me: playerId ? myDay(ev, playerId, history) : null,
  };
}
