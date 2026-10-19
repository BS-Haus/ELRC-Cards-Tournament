// The ladder: nets ranked top to bottom (Net 1 is the top). Each round is one game per net. Win and
// you go up a net, lose and you go down; the top net's winners stay on top and the bottom net's
// losers stay at the bottom. On each net the four players are split into the two fairest teams
// that don't repeat a partnership from earlier in the day, so you play with someone new every game.
// The first round is seeded by rating, so the games are close from the start. If there are more
// players than places, people take turns to sit out, and come back in on the net they left.
//
// Pure: who's here, their ratings and the rounds so far in, the next round out.

export type LadderGame = { net: number; a: [string, string]; b: [string, string] };
export type Round = { games: LadderGame[]; sitting: string[] };
/** A round as played: each net's game with its score (null while it's still being played). */
export type PlayedGame = LadderGame & { scoreA: number | null; scoreB: number | null };
export type PlayedRound = { games: PlayedGame[]; sitting: string[] };

const pairKey = (x: string, y: string) => (x < y ? `${x}+${y}` : `${y}+${x}`);

/** How many nets the round uses: every net that can take four, up to the number set up. */
export const netsFor = (players: number, nets: number) => Math.max(0, Math.min(nets, Math.floor(players / 4)));

/** Everyone who's partnered someone today, as pair keys. */
export function partnersSoFar(rounds: PlayedRound[]): Set<string> {
  const out = new Set<string>();
  for (const r of rounds) for (const g of r.games) { out.add(pairKey(g.a[0], g.a[1])); out.add(pairKey(g.b[0], g.b[1])); }
  return out;
}

/**
 * Four players on a net, split into two teams: never a partnership from earlier today if there's
 * a split that avoids one, and then the closest match by rating (team strength is the sum of the
 * two partners', as in the ratings themselves).
 */
export function pickTeams(four: string[], rating: (id: string) => number, partnered: Set<string>): { a: [string, string]; b: [string, string] } {
  const [p, q, r, s] = four;
  const splits: [[string, string], [string, string]][] = [[[p, q], [r, s]], [[p, r], [q, s]], [[p, s], [q, r]]];
  let best = splits[0], cost = Infinity;
  for (const [a, b] of splits) {
    const repeats = Number(partnered.has(pairKey(a[0], a[1]))) + Number(partnered.has(pairKey(b[0], b[1])));
    const c = repeats * 1e6 + Math.abs(rating(a[0]) + rating(a[1]) - rating(b[0]) - rating(b[1]));
    if (c < cost) { cost = c; best = [a, b]; }
  }
  return { a: best[0], b: best[1] };
}

/** A stable shuffle key, so who sits out varies by round without randomness in the tests. */
function spread(id: string, round: number): number {
  let h = round * 2654435761;
  for (const c of id) h = (Math.imul(h ^ c.charCodeAt(0), 16777619) | 0);
  return h >>> 0;
}

/**
 * Who sits out: the people who've sat the fewest times, never anyone who sat last round (unless
 * there's no other way), spread so it isn't always the same end of the ladder.
 */
function chooseSitters(ids: string[], count: number, sits: Map<string, number>, satLast: Set<string>, round: number): Set<string> {
  if (count <= 0) return new Set();
  const order = [...ids].sort((x, y) =>
    Number(satLast.has(x)) - Number(satLast.has(y)) ||
    (sits.get(x) ?? 0) - (sits.get(y) ?? 0) ||
    spread(x, round) - spread(y, round));
  return new Set(order.slice(0, count));
}

/** The first round: everyone here ordered by rating, the best four on Net 1 and so on down. */
export function firstRound(present: string[], rating: (id: string) => number, nets: number): Round {
  const n = netsFor(present.length, nets);
  const byRating = [...present].sort((x, y) => rating(y) - rating(x) || x.localeCompare(y));
  // Extra people sit out the first round: from the bottom of the ratings, so the top nets start
  // full of the people they're meant for. They come back in next round.
  const playing = byRating.slice(0, n * 4), sitting = byRating.slice(n * 4);
  const games = Array.from({ length: n }, (_, i) => ({ net: i + 1, ...pickTeams(playing.slice(i * 4, i * 4 + 4), rating, new Set()) }));
  return { games, sitting };
}

/**
 * The next round, from the rounds so far (every game in the last one scored). `present` is who's
 * here now: anyone who's left is dropped, and anyone new comes in on the net their rating puts
 * them on. Returns null if there aren't four people to play.
 */
export function nextRound(rounds: PlayedRound[], present: string[], rating: (id: string) => number, nets: number): Round | null {
  const last = rounds.at(-1);
  if (!last) return present.length >= 4 ? firstRound(present, rating, nets) : null;
  const here = new Set(present);
  const n = netsFor(present.length, nets);
  if (!n) return null;

  // Where each person is headed: winners up a net, losers down, within the nets in use now.
  const target = new Map<string, number>();
  const clamp = (x: number) => Math.min(n, Math.max(1, x));
  for (const g of last.games) {
    if (g.scoreA == null || g.scoreB == null) continue;
    const aWon = g.scoreA > g.scoreB;
    for (const id of g.a) target.set(id, clamp(aWon ? g.net - 1 : g.net + 1));
    for (const id of g.b) target.set(id, clamp(aWon ? g.net + 1 : g.net - 1));
  }
  // The last net each person played on, for anyone coming back from sitting out.
  const lastNet = new Map<string, number>();
  for (const r of rounds) for (const g of r.games) for (const id of [...g.a, ...g.b]) lastNet.set(id, g.net);
  // Anyone new: the net their rating would put them on among everyone here.
  const byRating = [...present].sort((x, y) => rating(y) - rating(x) || x.localeCompare(y));
  for (const id of present) {
    if (target.has(id)) continue;
    target.set(id, clamp(lastNet.get(id) ?? Math.floor(byRating.indexOf(id) / 4) + 1));
  }

  // Who sits out this round, if there are more people than places.
  const sits = new Map<string, number>();
  for (const r of rounds) for (const id of r.sitting) sits.set(id, (sits.get(id) ?? 0) + 1);
  const ids = present.filter((id) => here.has(id));
  const sitting = chooseSitters(ids, ids.length - n * 4, sits, new Set(last.sitting), rounds.length + 1);

  // Fill the nets top to bottom: by where each person is headed, then by rating, so a net with
  // too many people sends its lowest-rated down and one with too few takes the next best up.
  const playing = ids.filter((id) => !sitting.has(id))
    .sort((x, y) => target.get(x)! - target.get(y)! || rating(y) - rating(x) || x.localeCompare(y));
  const partnered = partnersSoFar(rounds);
  const games = Array.from({ length: n }, (_, i) => ({ net: i + 1, ...pickTeams(playing.slice(i * 4, i * 4 + 4), rating, partnered) }));
  return { games, sitting: ids.filter((id) => sitting.has(id)) };
}

/** Whether every net in a round has a score, so the next one can be drawn. */
export const roundDone = (r: PlayedRound) => r.games.length > 0 && r.games.every((g) => g.scoreA != null && g.scoreB != null);

/** One player's day on the ladder, for the end-of-day story and the table. */
export type LadderLine = { id: string; w: number; l: number; pf: number; pa: number; bestNet: number | null; topRounds: number; topWins: number };

export function ladderLines(rounds: PlayedRound[]): Map<string, LadderLine> {
  const out = new Map<string, LadderLine>();
  const me = (id: string) => out.get(id) ?? (out.set(id, { id, w: 0, l: 0, pf: 0, pa: 0, bestNet: null, topRounds: 0, topWins: 0 }), out.get(id)!);
  for (const r of rounds) {
    for (const g of r.games) {
      if (g.scoreA == null || g.scoreB == null) continue;
      for (const [side, mine, theirs] of [[g.a, g.scoreA, g.scoreB], [g.b, g.scoreB, g.scoreA]] as const) {
        for (const id of side) {
          const x = me(id);
          const won = mine > theirs;
          if (won) x.w++; else x.l++;
          x.pf += mine; x.pa += theirs;
          x.bestNet = x.bestNet == null ? g.net : Math.min(x.bestNet, g.net);
          if (g.net === 1) { x.topRounds++; if (won) x.topWins++; }
        }
      }
    }
  }
  return out;
}

/** The rounds of a ladder event as stored: each "ladder" stage in order, its games by net (a
 *  skipped net is left out), and who sat it out. */
export function roundsFrom(
  stages: { no: number; kind: string; sitting: string[] }[],
  games: { stageNo: number; net: number; a: [string, string]; b: [string, string]; scoreA: number | null; scoreB: number | null; status: string }[],
): PlayedRound[] {
  return stages.filter((s) => s.kind === "ladder").sort((x, y) => x.no - y.no).map((s) => ({
    sitting: s.sitting,
    games: games.filter((g) => g.stageNo === s.no && g.status !== "void").sort((x, y) => x.net - y.net)
      .map((g) => ({ net: g.net, a: g.a, b: g.b, scoreA: g.status === "done" ? g.scoreA : null, scoreB: g.status === "done" ? g.scoreB : null })),
  }));
}

/** The end-of-day story's numbers: the whole day, then the viewer's part. `today` is each
 *  player's rating change on the day (null while they're still placing). `winChance` is each game's
 *  side-A chance going in, by game key (`round:net`). */
export type LadderStoryData = {
  players: number; rounds: number; games: number;
  earners: { id: string; today: number }[];
  king: { id: string; topWins: number } | null;
  upset: { winners: [string, string]; losers: [string, string]; score: [number, number]; chance: number; net: number } | null;
  me: { id: string; w: number; l: number; today: number | null; bestNet: number | null; topRounds: number; partner: { id: string; w: number; gp: number } | null } | null;
};

export function ladderStory(rounds: PlayedRound[], today: Map<string, number | null>, winChance: Map<string, number>, viewer: string | null): LadderStoryData {
  const lines = ladderLines(rounds);
  const played = rounds.flatMap((r, i) => r.games.filter((g) => g.scoreA != null).map((g) => ({ ...g, key: `${i + 1}:${g.net}` })));
  const earners = [...today].filter((x): x is [string, number] => x[1] != null && lines.has(x[0]))
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, d]) => ({ id, today: d }));
  const kingLine = [...lines.values()].filter((l) => l.topWins > 0).sort((a, b) => b.topWins - a.topWins || b.topRounds - a.topRounds)[0];
  let upset: LadderStoryData["upset"] = null;
  for (const g of played) {
    const pA = winChance.get(g.key);
    if (pA == null) continue;
    const aWon = g.scoreA! > g.scoreB!;
    const chance = aWon ? pA : 1 - pA;
    if (chance < 0.4 && (!upset || chance < upset.chance)) {
      upset = { winners: aWon ? g.a : g.b, losers: aWon ? g.b : g.a, score: [Math.max(g.scoreA!, g.scoreB!), Math.min(g.scoreA!, g.scoreB!)], chance, net: g.net };
    }
  }
  let me: LadderStoryData["me"] = null;
  const mine = viewer ? lines.get(viewer) : undefined;
  if (viewer && mine) {
    const partners = new Map<string, { w: number; gp: number }>();
    for (const g of played) {
      const side = g.a.includes(viewer) ? g.a : g.b.includes(viewer) ? g.b : null;
      if (!side) continue;
      const mate = side[0] === viewer ? side[1] : side[0];
      const won = (side === g.a) === (g.scoreA! > g.scoreB!);
      const x = partners.get(mate) ?? { w: 0, gp: 0 };
      x.gp++; if (won) x.w++;
      partners.set(mate, x);
    }
    const best = [...partners].sort((a, b) => b[1].w - a[1].w || a[1].gp - b[1].gp)[0];
    me = { id: viewer, w: mine.w, l: mine.l, today: today.get(viewer) ?? null, bestNet: mine.bestNet, topRounds: mine.topRounds, partner: best && best[1].w > 0 ? { id: best[0], ...best[1] } : null };
  }
  return { players: lines.size, rounds: rounds.filter((r) => r.games.some((g) => g.scoreA != null)).length, games: played.length, earners, king: kingLine ? { id: kingLine.id, topWins: kingLine.topWins } : null, upset, me };
}
