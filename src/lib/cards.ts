// The cards format, as pure functions: no database, no React. Everything the event page shows
// (who's on which net, group tables, finals winners) is derived from the list of games.

/** "ladder" is one round of a ladder event (src/lib/netLadder.ts): one game per net. */
export type StageKind = "random" | "seeded" | "final" | "ladder";
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
  /** The tie-break game (decideTie): settles who tops the group, counts for nothing else. */
  decider?: boolean;
};

export type Planned = { a: [string, string]; b: [string, string] };
export type PlannedGroup = { groupNo: number; name: string; net: number; ids: string[]; games: (Planned & { seq: number; ord: number })[] };

// Finals are lettered, best first. They were Gold / Silver / Bronze / Copper until the ranks
// (levels.ts) took those names, so older events still have them stored: read them as letters.
export const TIERS = ["A", "B", "C", "D"];
const LEGACY_TIERS: Record<string, string> = { Gold: "A", Silver: "B", Bronze: "C", Copper: "D" };
export const finalName = (name: string) => LEGACY_TIERS[name] ?? name;
// Stored as letters (A best); shown as metals. Gold's winner is the day's champion.
const FINAL_LABEL: Record<string, string> = { A: "Gold", B: "Silver", C: "Bronze", D: "Copper" };
/** What a final is called on screen: Gold, Silver, Bronze, Copper (stored as A–D). */
export const finalLabel = (name: string) => FINAL_LABEL[finalName(name)] ?? finalName(name);
/** What winning a final is called: the Gold final's winner is the day's champion. */
export const finalWinTitle = (name: string) => (finalName(name) === TIERS[0] ? "Champion" : `${finalLabel(name)} final winner`);

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
export function searchSchedule(ids: string[], rounds: number, rnd: () => number = Math.random, history: Planned[] = []): Planned[] {
  const N = ids.length;
  const at = new Map(ids.map((id, i) => [id, i]));
  const k = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
  // Games already played in this group: their partnerships count against repeats, and whoever
  // has played least is first in line for the games still to come.
  const P0 = new Map<string, number>(), O0 = new Map<string, number>(), played0 = new Array(N).fill(0);
  for (const g of history) {
    const ix = [...g.a, ...g.b].map((id) => at.get(id));
    ix.forEach((x) => { if (x != null) played0[x]++; });
    const [p, q, r, t] = ix;
    if (p != null && q != null) P0.set(k(p, q), (P0.get(k(p, q)) ?? 0) + 1);
    if (r != null && t != null) P0.set(k(r, t), (P0.get(k(r, t)) ?? 0) + 1);
    for (const x of [p, q]) for (const y of [r, t]) if (x != null && y != null) O0.set(k(x, y), (O0.get(k(x, y)) ?? 0) + 1);
  }
  const cost = (R: number[][]) => {
    const P = new Map(P0), O = new Map(O0);
    for (const g of R) {
      for (const [x, y] of [[g[0], g[1]], [g[2], g[3]]]) P.set(k(x, y), (P.get(k(x, y)) ?? 0) + 1);
      for (const x of [g[0], g[1]]) for (const y of [g[2], g[3]]) O.set(k(x, y), (O.get(k(x, y)) ?? 0) + 1);
    }
    let c = 0;
    for (const v of P.values()) c += 10 * Math.max(0, v - 1);
    for (const v of O.values()) c += Math.max(0, v - 2);
    return c;
  };
  if (N < 4 || rounds < 1) return [];
  let best: number[][] = [], bestC = Infinity;
  for (let restart = 0; restart < 40 && bestC > 0; restart++) {
    // Rest rotates to whoever has played least so far; ties broken at random each restart.
    const played = played0.slice();
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
/**
 * A mixed draw: every group gets a spread of levels. Everyone is ranked by rating and taken in
 * bands as wide as the number of groups (the top band, the next, …); each group gets one player
 * from each band, which group shuffled within the band. So the strong players are spread out to
 * play with (and bring on) the newer ones, and no two draws are the same. Returns the players in
 * group order, the order planStage slices them in.
 */
export function mixedOrder(ids: string[], rating: (id: string) => number, rnd: () => number = Math.random, games: Game[] = []): string[] {
  const sizes = splitSizes(ids.length);
  if (!sizes.length) return shuffle(ids, rnd);
  const sorted = [...ids].sort((a, b) => rating(b) - rating(a) || a.localeCompare(b));
  // A later mixed round (`games`: the day so far) also keeps people away from anyone they've
  // already shared a group with: each band goes to the groups in whichever order meets the fewest
  // old faces (ties stay random), then same-band swaps tidy up what's left. Levels never move.
  const met = groupmates(games);
  const seen = (id: string, group: string[]) => group.filter((x) => met.get(id)?.has(x)).length;
  const groups: string[][] = sizes.map(() => []);
  let at = 0;
  for (let k = 0; k < Math.max(...sizes); k++) {
    const open = sizes.map((n, g) => (n > k ? g : -1)).filter((g) => g >= 0);
    const band = shuffle(sorted.slice(at, at + open.length), rnd);
    at += open.length;
    let best = band, bestCost = Infinity;
    for (const perm of open.length <= 6 ? permutations(band) : [band]) {
      const c = perm.reduce((n, id, i) => n + seen(id, groups[open[i]]), 0);
      if (c < bestCost) { best = perm; bestCost = c; }
    }
    open.forEach((g, i) => groups[g].push(best[i]));
  }
  const total = () => groups.reduce((n, g) => n + g.reduce((m, x, i) => m + g.slice(i + 1).filter((y) => met.get(x)?.has(y)).length, 0), 0);
  for (let improved = met.size > 0, guard = 0; improved && guard < 50; guard++) {
    improved = false;
    for (let k = 0; k < Math.max(...sizes) && !improved; k++) {
      for (let g = 0; g < groups.length && !improved; g++) for (let h = g + 1; h < groups.length && !improved; h++) {
        if (groups[g].length <= k || groups[h].length <= k) continue;
        const before = total();
        [groups[g][k], groups[h][k]] = [groups[h][k], groups[g][k]];
        if (total() < before) improved = true;
        else [groups[g][k], groups[h][k]] = [groups[h][k], groups[g][k]];
      }
    }
  }
  return groups.flat();
}

/** Who has already shared a group with whom (finals aside): in a group of 4 that means partnered. */
function groupmates(games: Game[]): Map<string, Set<string>> {
  const met = new Map<string, Set<string>>();
  const keys = new Set(games.filter((g) => g.kind !== "final").map((g) => `${g.stageNo}:${g.groupNo}`));
  for (const key of keys) {
    const ms = groupMembers(games.filter((g) => `${g.stageNo}:${g.groupNo}` === key));
    for (const x of ms) for (const y of ms) if (x !== y) (met.get(x) ?? met.set(x, new Set()).get(x)!).add(y);
  }
  return met;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

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
/** Who came out on top in the games two players played on opposite sides: 1 if x, -1 if y, 0 if
 *  level or they never faced each other. Deciders and a sub's games don't count. */
export function headToHead(games: Game[], x: string, y: string): number {
  let n = 0;
  for (const g of games) {
    if (!isDone(g) || g.decider || g.subs.includes(x) || g.subs.includes(y)) continue;
    const xa = g.a.includes(x), xb = g.b.includes(x), ya = g.a.includes(y), yb = g.b.includes(y);
    if (!((xa && yb) || (xb && ya))) continue;
    n += xa === g.scoreA! > g.scoreB! ? 1 : -1;
  }
  return Math.sign(n);
}

/** Inside one group: wins, then points difference, then points scored, then (given the games)
 *  who won when the two faced each other. Ties that survive all four go to a decider. */
export function groupRank(lines: Iterable<Line>, games?: Game[]): Line[] {
  return [...lines].sort((x, y) => y.w - x.w || (y.pf - y.pa) - (x.pf - x.pa) || y.pf - x.pf || (games ? -headToHead(games, x.id, y.id) : 0));
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
 * Who's in which group of a stage right now. Someone's group is where their games still to play
 * are; once they have none left, it's the group of the last game they played. So a player moved
 * mid-stage counts once, in the group they ended up in, before and after the stage finishes.
 * (Edits put rearranged games after everything else in the stage, so "last" is the latest.)
 */
export function stageMembers(stageGames: Game[]): Map<number, string[]> {
  const where = new Map<string, { todo: boolean; ord: number; group: number }>();
  for (const g of stageGames) {
    if (g.status === "void" || g.decider) continue;
    const todo = g.status === "todo";
    for (const id of players(g)) {
      if (g.subs.includes(id)) continue;
      const cur = where.get(id);
      const better = !cur || (todo && !cur.todo) || (todo === cur.todo && g.ord > cur.ord);
      if (better) where.set(id, { todo, ord: g.ord, group: g.groupNo });
    }
  }
  const out = new Map<number, string[]>();
  for (const no of [...new Set(stageGames.map((g) => g.groupNo))].sort((x, y) => x - y)) out.set(no, []);
  for (const [id, w] of where) out.get(w.group)?.push(id);
  return out;
}

/** Who's in one group now (see stageMembers), given all the games of its stage. */
export const currentMembers = (stageGames: Game[], groupNo: number): string[] => stageMembers(stageGames).get(groupNo) ?? [];

/**
 * The rest of a group's games after its line-up changed (someone moved in or out). Games already
 * played stay as they were; this plans enough new ones that everyone gets about as many games as a
 * normal group of this size, the people who've played least go first, and partnerships already
 * played aren't repeated where it can be helped.
 */
export function remainingGames(members: string[], played: Game[], rnd: () => number = Math.random): Planned[] {
  const n = members.length;
  if (n < 4) return [];
  const done = played.filter((g) => isDone(g) && !g.decider);
  const t = tally(done, members);
  const target = gamesEachForSize(n);
  const need = members.reduce((sum, id) => sum + Math.max(0, target - (t.get(id)?.gp ?? 0)), 0);
  const count = Math.min(gamesForSize(n) + 2, Math.ceil(need / 4));
  if (!count) return [];
  return searchSchedule(shuffle(members, rnd), count, rnd, done.map((g) => ({ a: g.a, b: g.b })));
}

/**
 * The draw order after a random stage, by where you finished in your own group: every group
 * winner, then every runner-up, and so on. Within the same place it's win %, then points
 * difference per game. Comparing people only with the group they actually played means a group
 * of 5 (4 games each) can't crowd out a group of 4 (3 games), and a tough group doesn't sink you.
 */
/**
 * Who makes the A final from random groups, as a line to draw under each group's table. The
 * finals are seeded by finishing place (placementOrder): every group winner, then every runner-up,
 * and so on, so the top `sure` of every group are in, and `extra` more come from the best of the
 * next place across all groups. The A final is the first group splitSizes makes of everyone left.
 */
export function finalsCut(pool: number, groups: number): { sure: number; extra: number; aSize: number } | null {
  const sizes = splitSizes(pool);
  if (sizes.length < 2 || groups < 1) return null; // one final for everyone: nobody misses out
  const aSize = sizes[0];
  const sure = Math.floor(aSize / groups);
  return { sure, extra: aSize - sure * groups, aSize };
}

export function placementOrder(stageGames: Game[]): string[] {
  const nos = [...new Set(stageGames.map((g) => g.groupNo))].sort((a, b) => a - b);
  // Each person's whole record in this stage, so someone moved between groups mid-stage is judged
  // on all their games, and placed once: in the group they ended up in.
  const lines = tally(stageGames.filter((g) => g.status !== "void"));
  const membersOf = stageMembers(stageGames);
  const rows: { line: Line; place: number }[] = [];
  for (const no of nos) {
    const gs = stageGames.filter((g) => g.groupNo === no);
    const members = (membersOf.get(no) ?? []).filter((id) => lines.has(id));
    // Win %, then points per game: the same order as wins then difference when everyone in the
    // group played the same number of games, and still fair when an edit left them uneven.
    const table = rank(members.map((id) => lines.get(id)!));
    const { winner } = groupWinner(gs);
    const wi = winner ? table.findIndex((r) => r.id === winner) : -1;
    if (wi > 0) table.unshift(...table.splice(wi, 1));
    table.forEach((line, place) => rows.push({ line, place }));
  }
  const across = new Map(rank(rows.map((r) => r.line)).map((l, i) => [l.id, i]));
  return rows.sort((x, y) => x.place - y.place || across.get(x.line.id)! - across.get(y.line.id)!).map((r) => r.line.id);
}

/**
 * The order a seeded stage or the finals draws from: best first, so group A / the A final gets the top.
 * After a seeded stage it's by group finish (everyone in group A above everyone in group B), so a
 * 4–0 in the weaker group can't jump into the A final over someone who went 2–2 among the best. After
 * random groups it's by finishing place in your own group (placementOrder): winners, then runners-up.
 * Someone with no games yet (a late arrival) goes mid-table for a seeded stage, where they'll be sorted out, but to the bottom
 * for the finals: the A final is for people who've shown they belong there.
 */
export function seedOrder(games: Game[], pool: string[], kind: "seeded" | "final", points?: Map<string, number>): string[] {
  const inPool = new Set(pool);
  const groupStages = games.filter((g) => g.kind !== "final");
  const lastNo = Math.max(0, ...groupStages.map((g) => g.stageNo));
  const last = groupStages.filter((g) => g.stageNo === lastNo);
  let played: string[];
  const rounds = new Set(groupStages.map((g) => g.stageNo)).size;
  const lines = tally(groupStages.filter((g) => g.status !== "void"));
  if (kind === "final" && points) {
    // The day's points decide the finals: everyone's rating ± across today's rounds (dayPoints).
    // The ratings already allow for who you played with and against, so a strong pair beating a
    // weak one earns little and a win alongside a weaker partner earns more. Level on points:
    // wins, then points difference.
    played = [...lines.values()].filter((r) => r.gp > 0)
      .sort((x, y) => (points.get(y.id) ?? 0) - (points.get(x.id) ?? 0) || y.w - x.w || (y.pf - y.pa) - (x.pf - x.pa))
      .map((r) => r.id);
  } else if (kind === "final" && rounds > 1 && last[0]?.kind !== "seeded") {
    // Two or more rounds before the finals: they all count together. Best record across every
    // group game of the day (win %, then points difference per game), so a good first round still
    // matters after a tougher second one, and nobody's day hangs on one draw.
    played = rank(lines.values()).filter((r) => r.gp > 0).map((r) => r.id);
  } else if (last.length && last[0].kind === "seeded") {
    // After brackets (bracketOrder: two groups per level): the top two of each group in a bracket
    // go up together and the rest go down together. 16 on 4 nets: the top bracket's top twos are
    // the Gold final, its 3rds and 4ths Silver; the bottom bracket's top twos Bronze, the rest
    // Copper. Everyone's final comes from the same three games at their level, so nobody gains
    // from a bigger group in round 1 or from arriving late. Places: wins, then points difference.
    const nos = [...new Set(last.map((g) => g.groupNo))].sort((a, b) => a - b);
    const table = (no: number) => {
      const gs = last.filter((g) => g.groupNo === no);
      return groupRank(tally(gs.filter((g) => g.status !== "void"), groupMembers(gs)).values(), gs).map((r) => r.id);
    };
    played = [];
    // Below the top twos, each place across the pair in turn (the two 3rds, then the two 4ths, …),
    // the better record first: so when a final has a spare place (groups of five), it goes to the
    // best 3rd, not whoever was 3rd in the first group.
    const recs = tally(last.filter((g) => g.status !== "void"));
    const better = (x: string, y: string) => {
      const a = recs.get(x), b = recs.get(y);
      if (!a?.gp || !b?.gp) return (b?.gp ?? 0) - (a?.gp ?? 0);
      return b.w / b.gp - a.w / a.gp || (b.pf - b.pa) / b.gp - (a.pf - a.pa) / a.gp;
    };
    for (let i = 0; i < nos.length; i += 2) {
      const pair = nos.slice(i, i + 2).map(table);
      if (pair.length === 1) { played.push(...pair[0]); continue; }
      const up = (t: string[]) => t.slice(0, Math.floor(t.length / 2));
      const down = (t: string[]) => t.slice(Math.floor(t.length / 2));
      const [d0, d1] = [down(pair[0]), down(pair[1])];
      const rest: string[] = [];
      for (let k = 0; k < Math.max(d0.length, d1.length); k++) rest.push(...[d0[k], d1[k]].filter(Boolean).sort(better));
      played.push(...up(pair[0]), ...up(pair[1]), ...rest);
    }
    // Anyone who played earlier stages but not the last one (rare): after them, by the table.
    const rest = rank(tally(groupStages).values()).filter((r) => r.gp > 0).map((r) => r.id);
    played = [...new Set([...played, ...rest])];
  } else if (new Set(last.map((g) => g.groupNo)).size > 1) {
    // After random groups: by finishing place in your own group (placementOrder), then anyone
    // from earlier stages who didn't play this one, by the table.
    const rest = rank(tally(groupStages).values()).filter((r) => r.gp > 0).map((r) => r.id);
    played = [...new Set([...placementOrder(last), ...rest])];
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

/**
 * A by-level round ("brackets"): everyone ranked on where they finished so far, then the field taken
 * eight at a time (the top half, the next half, …) and each eight dealt alternately into its two
 * groups: 1st, 3rd, 5th, 7th on one net, 2nd, 4th, 6th, 8th on the next. Every game is even, and
 * because the finals then take the top four together, no final is a round's group again: at most
 * two of any final shared a group here. Earlier group-mates are kept apart by swapping ranking
 * neighbours only. Anyone who hasn't played yet goes mid-table. Pure.
 */
export function bracketOrder(games: Game[], pool: string[]): string[] {
  // Ranked on where people finished (seedOrder: after a mixed round, group winners, then
  // runners-up, …; anyone who hasn't played yet mid-table).
  const ranked = seedOrder(games, pool, "seeded");
  const sizes = splitSizes(ranked.length);
  const groups: string[][] = sizes.map(() => []);
  let at = 0;
  for (let g = 0; g < sizes.length; g += 2) {
    const pair = g + 1 < sizes.length ? [g, g + 1] : [g];
    const chunk = ranked.slice(at, (at += pair.reduce((n, i) => n + sizes[i], 0)));
    chunk.forEach((id, i) => {
      const want = pair[i % pair.length];
      const to = groups[want].length < sizes[want] ? want : pair.find((p) => groups[p].length < sizes[p])!;
      groups[to].push(id);
    });
    // Keep earlier group-mates apart by swapping neighbours in the ranking (1st with 2nd, 3rd with
    // 4th…) between the two groups: each group still has one of every neighbouring pair, so the
    // levels hold and the finals still bring new faces.
    if (pair.length === 2) {
      const met = groupmates(games);
      const clash = (g: string[]) => g.reduce((n, x, i) => n + g.slice(i + 1).filter((y) => met.get(x)?.has(y)).length, 0);
      const [A, B] = [groups[pair[0]], groups[pair[1]]];
      for (let improved = true, guard = 0; improved && guard < 20; guard++) {
        improved = false;
        for (let k = 0; k + 1 < chunk.length; k += 2) {
          const [x, y] = [chunk[k], chunk[k + 1]];
          const ia = A.indexOf(x) >= 0 ? A.indexOf(x) : A.indexOf(y), ib = B.indexOf(y) >= 0 ? B.indexOf(y) : B.indexOf(x);
          if (ia < 0 || ib < 0) continue;
          const before = clash(A) + clash(B);
          [A[ia], B[ib]] = [B[ib], A[ia]];
          if (clash(A) + clash(B) < before) improved = true;
          else [A[ia], B[ib]] = [B[ib], A[ia]];
        }
      }
    }
  }
  return groups.flat();
}

/** The day's points: each player's rating ± summed over the scored games of today's rounds
 *  (finals and skipped games aside), optionally one round only. `delta` is game id → player id → ±,
 *  as the ratings worked it out (EventView.delta). */
export function dayPoints(games: Game[], delta: Record<string, Record<string, number>>, stageNo?: number): Map<string, number> {
  const pts = new Map<string, number>();
  for (const g of games) {
    if (g.kind === "final" || !isDone(g) || (stageNo != null && g.stageNo !== stageNo)) continue;
    for (const [id, d] of Object.entries(delta[g.id] ?? {})) pts.set(id, (pts.get(id) ?? 0) + d);
  }
  return pts;
}

/**
 * Rearranges a seeded or finals draw order so people aren't grouped with the same faces again,
 * moving as little as possible. In a group of 4 everyone partners everyone, so sharing a group
 * again means a repeat partner: a by-level round keeps earlier group-mates apart where it can
 * (between neighbouring groups only, the closest-ranked swap first, so levels hold), and the
 * finals only ever avoid replaying an earlier group exactly (the same three games again). Pure.
 */
export function spreadRepeats(order: string[], games: Game[], kind: "seeded" | "final", inPairs = false): string[] {
  const sizes = splitSizes(order.length);
  if (sizes.length < 2) return order;
  const before = new Map<string, Set<string>>();
  const together = (x: string, y: string) => !!before.get(x)?.has(y);
  const earlier: string[][] = [];
  const stageGroups = new Set(games.filter((g) => g.kind !== "final").map((g) => `${g.stageNo}:${g.groupNo}`));
  for (const key of stageGroups) {
    const ms = groupMembers(games.filter((g) => `${g.stageNo}:${g.groupNo}` === key));
    earlier.push(ms);
    for (const x of ms) for (const y of ms) if (x !== y) (before.get(x) ?? before.set(x, new Set()).get(x)!).add(y);
  }
  const same = (g: string[]) => earlier.some((e) => e.length === g.length && g.every((id) => e.includes(id)));
  const cost = (g: string[]) => (kind === "final" ? (same(g) ? 1 : 0) : g.reduce((n, x, i) => n + g.slice(i + 1).filter((y) => together(x, y)).length, 0));
  const rankOf = new Map(order.map((id, i) => [id, i]));
  let at = 0;
  const groups = sizes.map((k) => order.slice(at, (at += k)));
  for (let guard = 0; guard < 100; guard++) {
    let best: { g: number; i: number; j: number; gain: number; gap: number } | null = null;
    // `inPairs`: brackets swap only between the two groups of the same half, so nobody changes level.
    for (let g = 0; g + 1 < groups.length; g += inPairs ? 2 : 1) {
      const [A, B] = [groups[g], groups[g + 1]];
      const now = cost(A) + cost(B);
      if (!now) continue;
      for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
        const a2 = A.map((x, k) => (k === i ? B[j] : x)), b2 = B.map((x, k) => (k === j ? A[i] : x));
        const gain = now - cost(a2) - cost(b2);
        const gap = rankOf.get(B[j])! - rankOf.get(A[i])!;
        if (gain > 0 && (!best || gain > best.gain || (gain === best.gain && gap < best.gap))) best = { g, i, j, gain, gap };
      }
    }
    if (!best) break;
    const [A, B] = [groups[best.g], groups[best.g + 1]];
    [A[best.i], B[best.j]] = [B[best.j], A[best.i]];
  }
  // Each group best first again, so group A / the A final still reads top down.
  return groups.flatMap((g) => [...g].sort((x, y) => rankOf.get(x)! - rankOf.get(y)!));
}

/** A finished group's winner, or the tied pair when first place is level on wins and difference. */
export function groupWinner(games: Game[]): { winner: string | null; tied: string[]; decider: "none" | "playing" | "decided" | "level" } {
  const live = games.filter((g) => g.status !== "void" && !g.decider);
  if (!live.length || live.some((g) => !isDone(g))) return { winner: null, tied: [], decider: "none" };
  const rows = groupRank(tally(live, groupMembers(live)).values(), live);
  // Everyone level with the top on wins, points difference and points scored...
  const top = rows.filter((r) => r.w === rows[0].w && r.pf - r.pa === rows[0].pf - rows[0].pa && r.pf === rows[0].pf);
  // ...and, for two, head to head too. Three or more level: shown as a tie, no decider (one game
  // can't fairly settle three people), so the organiser calls it.
  if (top.length > 2) return { winner: null, tied: top.map((r) => r.id), decider: "none" };
  const level = top.length === 2 && headToHead(live, top[0].id, top[1].id) === 0;
  if (!level) {
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

/** A tie that survives every tie-break: one game to 11, the tied two on opposite sides, each with
 *  one of the group's other players (a coin decides who gets whom). Whoever's side wins tops the group. */
export function decideTie(table: Line[], tied: [string, string], rnd: () => number = Math.random): Planned[] {
  const [x, y] = tied;
  const [c, d] = table.map((r) => r.id).filter((id) => id !== x && id !== y);
  if (!c || !d) return [];
  return rnd() < 0.5 ? [{ a: [x, c], b: [y, d] }] : [{ a: [x, d], b: [y, c] }];
}

/** "Group A", "Gold final" or "Group A decider": what a game is, for headings. */
export const gameLabel = (g: Pick<Game, "kind" | "groupName" | "decider">) =>
  `${g.kind === "final" ? `${finalLabel(g.groupName)} final` : g.kind === "ladder" ? g.groupName : `Group ${g.groupName}`}${g.decider ? " decider" : ""}`;

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

/** A finished score for a game to `to`, win by two: the winner on exactly `to`, or two clear past
 *  it in a deuce. What typed-in scores are checked against before saving. */
export function isFinalScore(a: number, b: number, to: number): boolean {
  if (!validScore(a, b)) return false;
  return Math.max(a, b) === winnerScore(Math.min(a, b), to);
}

/** Rough minutes for a stage: the busiest net's games, at ~(to/1.6 + 3) min each. */
export function stageMinutes(sizes: number[], nets: number, to: number): number {
  const per = new Array(Math.max(1, nets)).fill(0);
  sizes.forEach((k, i) => (per[i % per.length] += gamesForSize(k)));
  return Math.round(Math.max(0, ...per) * (to / 1.6 + 3));
}
