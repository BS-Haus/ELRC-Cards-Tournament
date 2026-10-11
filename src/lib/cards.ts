// The cards format, as pure functions: no database, no React. Everything the event page shows
// (who's on which net, group tables, finals winners) is derived from the list of games.

export type StageKind = "random" | "seeded" | "final";
export type GameStatus = "todo" | "done" | "void";

export type Game = {
  id: string;
  stageNo: number;
  kind: StageKind;
  groupNo: number;
  groupName: string;
  seq: number;
  ord: number;
  net: number;
  a: [string, string];
  b: [string, string];
  subs: string[];
  scoreA: number | null;
  scoreB: number | null;
  status: GameStatus;
  /** One of the two tie-break games (decideTie): settles who tops the group, counts for nothing else. */
  decider?: boolean;
};

export type Planned = { a: [string, string]; b: [string, string] };
export type PlannedGroup = { groupNo: number; name: string; net: number; ids: string[]; games: (Planned & { seq: number; ord: number })[] };

// Finals are lettered, best first. They were Gold / Silver / Bronze / Copper until the ranks
// (levels.ts) took those names, so older events still have them stored: read them as letters.
export const TIERS = ["A", "B", "C", "D"];
const LEGACY_TIERS: Record<string, string> = { Gold: "A", Silver: "B", Bronze: "C", Copper: "D" };
export const finalName = (name: string) => LEGACY_TIERS[name] ?? name;
/** What winning a final is called: the A final's winner is the day's champion. */
export const finalWinTitle = (name: string) => (name === TIERS[0] ? "Champion" : `${name} final winner`);

/** Split n players into groups of 4–5 (6–7 only when the numbers force it, e.g. 6 or 7 people). */
export function splitSizes(n: number): number[] {
  if (n < 4) return [];
  const g = Math.max(1, Math.floor(n / 4));
  const base = Math.floor(n / g), extra = n % g;
  return Array.from({ length: g }, (_, i) => base + (i < extra ? 1 : 0));
}

export const gamesForSize = (k: number) => (k === 4 ? 3 : k);
export const gamesEachForSize = (k: number) => (k === 4 ? 3 : Math.round((gamesForSize(k) * 4) / k));

/**
 * Every partner pairing once. 4 players: 3 games, all play every game. 5 players: 5 games, one
 * sits out each game in turn, everyone plays 4 and partners each other person once. Bigger
 * groups fall back to a searched schedule with no repeat partners.
 */
export function groupGames(ids: string[], rnd: () => number = Math.random): Planned[] {
  const k = ids.length;
  if (k === 4) {
    return ([[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]] as const).map(([p, q, r, t]) => ({ a: [ids[p], ids[q]], b: [ids[r], ids[t]] }));
  }
  if (k === 5) {
    return [0, 1, 2, 3, 4].map((i) => ({ a: [ids[(i + 1) % 5], ids[(i + 4) % 5]], b: [ids[(i + 2) % 5], ids[(i + 3) % 5]] }));
  }
  return searchSchedule(ids, k, rnd);
}

/** Local search for groups of 6+: one net, `rounds` games, no repeat partners, even sit-outs. */
export function searchSchedule(ids: string[], rounds: number, rnd: () => number = Math.random): Planned[] {
  const N = ids.length;
  const cost = (R: number[][]) => {
    const P = new Map<string, number>(), O = new Map<string, number>();
    const k = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
    for (const g of R) {
      for (const [x, y] of [[g[0], g[1]], [g[2], g[3]]]) P.set(k(x, y), (P.get(k(x, y)) ?? 0) + 1);
      for (const x of [g[0], g[1]]) for (const y of [g[2], g[3]]) O.set(k(x, y), (O.get(k(x, y)) ?? 0) + 1);
    }
    let c = 0;
    for (const v of P.values()) c += 10 * Math.max(0, v - 1);
    for (const v of O.values()) c += Math.max(0, v - 2);
    return c;
  };
  let best: number[][] = [], bestC = Infinity;
  for (let restart = 0; restart < 40 && bestC > 0; restart++) {
    // Rest rotates to whoever has played least so far; ties broken at random each restart.
    const played = new Array(N).fill(0);
    const R: number[][] = [];
    for (let r = 0; r < rounds; r++) {
      const order = [...Array(N).keys()].map((x) => [x, rnd()] as const).sort((x, y) => played[x[0]] - played[y[0]] || x[1] - y[1]).map((x) => x[0]);
      const four = order.slice(0, 4);
      four.forEach((x) => played[x]++);
      R.push(four);
    }
    let c = cost(R);
    for (let it = 0; it < 3000 && c > 0; it++) {
      const g = R[Math.floor(rnd() * rounds)];
      const i = Math.floor(rnd() * 4), j = Math.floor(rnd() * 4);
      if ((i >> 1) === (j >> 1)) continue;
      [g[i], g[j]] = [g[j], g[i]];
      const c2 = cost(R);
      if (c2 <= c) c = c2;
      else [g[i], g[j]] = [g[j], g[i]];
    }
    if (c < bestC) { bestC = c; best = R.map((x) => x.slice()); }
  }
  return best.map((g) => ({ a: [ids[g[0]], ids[g[1]]], b: [ids[g[2]], ids[g[3]]] }));
}

export function shuffle<T>(xs: T[], rnd: () => number = Math.random): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Lay out a stage. `ordered` is the player order: shuffled for a random stage, best first for
 * seeded and finals, so group A / the A final gets the top of the table. Groups share nets in turn,
 * and `ord` interleaves their games so two groups on one net alternate.
 */
export function planStage(kind: StageKind, ordered: string[], nets: number, rnd: () => number = Math.random): PlannedGroup[] {
  const sizes = splitSizes(ordered.length);
  const G = sizes.length;
  let at = 0;
  return sizes.map((k, groupNo) => {
    const ids = ordered.slice(at, (at += k));
    const name = kind === "final" ? (TIERS[groupNo] ?? `Tier ${groupNo + 1}`) : String.fromCharCode(65 + groupNo);
    const games = groupGames(kind === "random" ? ids : shuffle(ids, rnd), rnd).map((g, i) => ({ ...g, seq: i + 1, ord: i * G + groupNo }));
    return { groupNo, name, net: (groupNo % Math.max(1, nets)) + 1, ids, games };
  });
}

// ---------------------------------------------------------------------------------------------

export type Line = { id: string; gp: number; w: number; l: number; pf: number; pa: number };

const players = (g: Game) => [...g.a, ...g.b];
export const isDone = (g: Game) => g.status === "done" && g.scoreA != null && g.scoreB != null;

/** Win/loss lines from finished games. A sub's appearance never counts for the sub. */
export function tally(games: Game[], ids?: Iterable<string>): Map<string, Line> {
  const t = new Map<string, Line>();
  const line = (id: string) => t.get(id) ?? (t.set(id, { id, gp: 0, w: 0, l: 0, pf: 0, pa: 0 }), t.get(id)!);
  if (ids) for (const id of ids) line(id);
  for (const g of games) {
    if (!isDone(g) || g.decider) continue;
    const aWon = g.scoreA! > g.scoreB!;
    for (const [side, won, f, a] of [[g.a, aWon, g.scoreA!, g.scoreB!], [g.b, !aWon, g.scoreB!, g.scoreA!]] as const) {
      for (const id of side) {
        if (g.subs.includes(id)) continue;
        const r = line(id);
        r.gp++; won ? r.w++ : r.l++; r.pf += f; r.pa += a;
      }
    }
  }
  return t;
}

/** Best first: win %, then point difference per game, then wins. Players yet to play go last. */
export function rank(lines: Iterable<Line>): Line[] {
  const pct = (r: Line) => (r.gp ? r.w / r.gp : 0);
  const pdg = (r: Line) => (r.gp ? (r.pf - r.pa) / r.gp : 0);
  return [...lines].sort((x, y) => Number(!x.gp) - Number(!y.gp) || pct(y) - pct(x) || pdg(y) - pdg(x) || y.w - x.w);
}

/** Inside one group, points (= wins) decide, then point difference. */
export function groupRank(lines: Iterable<Line>): Line[] {
  return [...lines].sort((x, y) => y.w - x.w || (y.pf - y.pa) - (x.pf - x.pa));
}

/** Everyone who appears in a group's games (minus anyone who only ever subbed in). */
export function groupMembers(games: Game[]): string[] {
  const subOnly = new Set<string>();
  const all = new Set<string>();
  for (const g of games) for (const id of players(g)) { all.add(id); if (g.subs.includes(id)) subOnly.add(id); }
  for (const g of games) for (const id of players(g)) if (!g.subs.includes(id)) subOnly.delete(id);
  return [...all].filter((id) => !subOnly.has(id));
}

/**
 * Who the next draw takes: everyone checked in ("here"), plus everyone who played in the latest
 * stage and hasn't been marked out. Playing a stage keeps you in the tournament, so nobody has
 * to be checked in again between stages; only "out" takes you out. A sub from the latest stage is
 * carried too if they're on the list (they turned up), but someone who only ever subbed with no
 * entry at all isn't. Checked-in players come first, in check-in order, then the carried ones.
 */
export function drawPool(entries: { playerId: string; state: string }[], games: Game[]): string[] {
  const state = new Map(entries.map((e) => [e.playerId, e.state]));
  const pool = new Set(entries.filter((e) => e.state === "here").map((e) => e.playerId));
  const latest = games.filter((g) => g.stageNo === Math.max(0, ...games.map((x) => x.stageNo)));
  const members = new Set(groupMembers(latest));
  for (const id of new Set(latest.flatMap(players))) {
    const s = state.get(id);
    if (s === "out") continue;
    if (members.has(id) || s) pool.add(id);
  }
  return [...pool];
}

/**
 * The order a seeded stage or the finals draws from: best first, so group A / the A final gets the top.
 * After a seeded stage it's by group finish (everyone in group A above everyone in group B), so a
 * 4–0 in the weaker group can't jump into the A final over someone who went 2–2 among the best. After a
 * random stage it's the group-stage table (win %, then +/− per game). Someone with no games yet (a
 * late arrival) goes mid-table for a seeded stage, where they'll be sorted out, but to the bottom
 * for the finals: the A final is for people who've shown they belong there.
 */
export function seedOrder(games: Game[], pool: string[], kind: "seeded" | "final"): string[] {
  const inPool = new Set(pool);
  const groupStages = games.filter((g) => g.kind !== "final");
  const lastNo = Math.max(0, ...groupStages.map((g) => g.stageNo));
  const last = groupStages.filter((g) => g.stageNo === lastNo);
  let played: string[];
  if (last.length && last[0].kind === "seeded") {
    const nos = [...new Set(last.map((g) => g.groupNo))].sort((a, b) => a - b);
    played = nos.flatMap((no) => {
      const gs = last.filter((g) => g.groupNo === no);
      return groupRank(tally(gs.filter((g) => g.status !== "void"), groupMembers(gs)).values()).map((r) => r.id);
    });
    // Anyone who played earlier stages but not the last one (rare): after them, by the table.
    const rest = rank(tally(groupStages).values()).filter((r) => r.gp > 0).map((r) => r.id);
    played = [...new Set([...played, ...rest])];
  } else {
    played = rank(tally(groupStages).values()).filter((r) => r.gp > 0).map((r) => r.id);
  }
  played = played.filter((id) => inPool.has(id));
  const placed = new Set(played);
  const fresh = pool.filter((id) => !placed.has(id));
  if (kind === "final") return [...played, ...fresh];
  const mid = Math.floor(played.length / 2);
  return [...played.slice(0, mid), ...fresh, ...played.slice(mid)];
}

/** A finished group's winner, or the tied pair when first place is level on wins and difference. */
export function groupWinner(games: Game[]): { winner: string | null; tied: string[]; decider: "none" | "playing" | "decided" | "level" } {
  const live = games.filter((g) => g.status !== "void" && !g.decider);
  if (!live.length || live.some((g) => !isDone(g))) return { winner: null, tied: [], decider: "none" };
  const rows = groupRank(tally(live, groupMembers(live)).values());
  if (!(rows.length > 1 && rows[0].w === rows[1].w && rows[0].pf - rows[0].pa === rows[1].pf - rows[1].pa)) {
    return { winner: rows[0]?.id ?? null, tied: [], decider: "none" };
  }
  const tied = [rows[0].id, rows[1].id];
  const d = games.filter((g) => g.decider && g.status !== "void");
  if (!d.length) return { winner: null, tied, decider: "none" };
  if (d.some((g) => !isDone(g))) return { winner: null, tied, decider: "playing" };
  const [x, y] = deciderPoints(d, tied);
  if (x === y) return { winner: null, tied, decider: "level" };
  return { winner: x > y ? tied[0] : tied[1], tied, decider: "decided" };
}

/** Points each of the tied pair scored across the decider games, in the pair's order. */
export function deciderPoints(deciders: Game[], tied: string[]): number[] {
  return tied.map((id) => deciders.filter(isDone).reduce((n, g) => n + (g.a.includes(id) ? g.scoreA! : g.b.includes(id) ? g.scoreB! : 0), 0));
}

/**
 * A fair decider between two players level at the top of a group: two games in which they're on
 * opposite sides and swap partners, so each plays once with each of the next two in the table
 * (x+c v y+d, then x+d v y+c). Neither gets the better partner. Most points across both wins.
 */
export function decideTie(table: Line[], tied: [string, string]): Planned[] {
  const [x, y] = tied;
  const [c, d] = table.map((r) => r.id).filter((id) => id !== x && id !== y);
  if (!c || !d) return [];
  return [{ a: [x, c], b: [y, d] }, { a: [x, d], b: [y, c] }];
}

/** "Group A", "A final" or "Group A decider": what a game is, for headings. */
export const gameLabel = (g: Pick<Game, "kind" | "groupName" | "decider">) =>
  `${g.kind === "final" ? `${g.groupName} final` : `Group ${g.groupName}`}${g.decider ? " decider" : ""}`;

/** Deciders are short: to 11, win by two. */
export const DECIDER_TO = 11;

/** Each net's queue of games still to play, in order: [0] is on now, [1] is next. */
export function netQueues(games: Game[], nets: number): Game[][] {
  const todo = games.filter((g) => g.status === "todo").sort((x, y) => x.stageNo - y.stageNo || x.ord - y.ord);
  return Array.from({ length: Math.max(1, nets) }, (_, i) => todo.filter((g) => g.net === i + 1));
}

/** Games still to play that include someone who has left: they need a sub (or skipping). */
export function needsSub(g: Game, out: Set<string>): string[] {
  return g.status === "todo" ? players(g).filter((id) => out.has(id)) : [];
}

/** Swap `from` for `sub` in a game; the sub is recorded so the result doesn't count for them. */
export function withSub(g: Pick<Game, "a" | "b" | "subs">, from: string, sub: string): { a: [string, string]; b: [string, string]; subs: string[] } {
  const swap = (side: [string, string]) => side.map((x) => (x === from ? sub : x)) as [string, string];
  return { a: swap(g.a), b: swap(g.b), subs: [...new Set([...g.subs.filter((s) => s !== from), sub])] };
}

/** A valid finished score: whole numbers 0–99, no draws. */
export function validScore(a: unknown, b: unknown): boolean {
  return Number.isInteger(a) && Number.isInteger(b) && (a as number) >= 0 && (b as number) >= 0 && (a as number) <= 99 && (b as number) <= 99 && a !== b;
}

/** The winner's score for a loser's score in a game to `to`, win by two. */
export const winnerScore = (loser: number, to: number) => Math.max(to, loser + 2);

/** Rough minutes for a stage: the busiest net's games, at ~(to/1.6 + 3) min each. */
export function stageMinutes(sizes: number[], nets: number, to: number): number {
  const per = new Array(Math.max(1, nets)).fill(0);
  sizes.forEach((k, i) => (per[i % per.length] += gamesForSize(k)));
  return Math.round(Math.max(0, ...per) * (to / 1.6 + 3));
}
