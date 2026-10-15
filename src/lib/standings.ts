// Ratings: the ranked app's system (spike-east, src/lib/rating.ts and computeStandings in
// src/lib/league.ts), applied to every counted tournament game. A whole-history fit to the points
// of every game, so the order games are entered in can't bias it, turned into a per-game ledger:
// each game's change is the fit with it minus the fit without it, plus a top-up so a win always
// pays at least a little (winFloor). Everyone starts on 800 behind the scenes; for their first
// PROV_N games they're placing (🐣 Fresh Meat, no number shown), then their rating is revealed in
// whatever tier it lands. Pure: games in, ratings out.
import { isDone, type Game } from "@/lib/cards";
import { MODEL, disp, fitSkills, snapshotOf, priorOf, foundersFor, expectedShare, gameWinProb, type Snapshot, type Fit, type FitGame } from "@/lib/rating";
export { START, disp } from "@/lib/rating";

/** Games before a player is placed. About one Saturday, so everyone places on their first. */
export const PROV_N = 6;

/** The least a win pays: +2 for a win by two, plus a point for every 3 further points of margin. */
export const WIN_MIN = 2;
export const WIN_PER = 3;
export const winFloor = (gf: number, ga: number) => WIN_MIN + Math.max(0, Math.round((gf - ga - 2) / WIN_PER));

export type RatedEvent = { id: string; startsAt: number; groupTo: number; finalTo: number; games: Game[] };

/** One player's view of one game, and what it did to them. */
export type GameEntry = {
  gameId: string; eventId: string; idx: number;
  won: boolean; gf: number; ga: number; partner: string; opps: string[];
  ratingBefore: number; ratingAfter: number; delta: number;
  /** Their team's win chance going in, from the ratings then (0–1). */
  winProb: number;
  /** Games they'd played before this one: below PROV_N they were still placing. */
  gamesBefore: number;
};

export type PlayerRating = {
  id: string;
  rating: number;
  games: number; wins: number; losses: number; pf: number; pa: number;
  /** Has played, but fewer than PROV_N games: no number or rank shown yet. */
  provisional: boolean;
  /** Position among placed players, 1 = top. Unset while placing or before a first game. */
  rank?: number;
  entries: GameEntry[];
  peak: number;
};

export type Ratings = { players: Map<string, PlayerRating>; ranked: PlayerRating[]; placing: PlayerRating[]; ledger: Ledger };

/** The fit after every prefix of the games, keyed by each game's signature, so a later call
 *  reuses every prefix that still matches and only fits what's new. */
export type Ledger = { sigs: string[]; snaps: Snapshot[] };

const counted = (g: Game) => isDone(g) && new Set([...g.a, ...g.b]).size === 4;

/** Every counted game, in the order played: by event, then stage, then running order. `order` is
 *  a time (the event's start plus a little per game) because the model's drift reads days. */
export function playOrder(events: RatedEvent[]): (Game & { eventId: string; order: number; to: number })[] {
  return [...events].sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id)).flatMap((ev) =>
    ev.games.filter(counted)
      .sort((a, b) => a.stageNo - b.stageNo || a.ord - b.ord || a.id.localeCompare(b.id))
      .map((g, i) => ({ ...g, eventId: ev.id, order: ev.startsAt + (i + 1) * 1000, to: g.decider ? 11 : g.kind === "final" ? ev.finalTo : ev.groupTo })),
  );
}

const sig = (g: Game & { order: number }) => `${g.id}:${g.a.join(",")}:${g.b.join(",")}:${g.scoreA}:${g.scoreB}:${g.order}`;

/** Everyone's rating, game by game. Pass the ledger from an earlier call to skip the refitting. */
export function rate(events: RatedEvent[], opts: { ledger?: Ledger } = {}): Ratings {
  const games = playOrder(events);
  const fitGames: FitGame[] = games.map((g) => ({ teamA: g.a, teamB: g.b, scoreA: g.scoreA!, scoreB: g.scoreB!, order: g.order }));
  // Everyone counts as a founder: everyone starts on the same 800, whenever they first turn up.
  const founders = foundersFor(fitGames, true);

  const sigs: string[] = [], snaps: Snapshot[] = [];
  let fit: Fit | undefined;
  const led = opts.ledger;
  for (let i = 0; i < games.length; i++) {
    const s = sig(games[i]);
    sigs.push(s);
    if (led && led.sigs[i] === s && led.snaps[i] && (i === 0 || snaps[i - 1] === led.snaps[i - 1])) {
      snaps.push(led.snaps[i]);
      fit = undefined;
    } else {
      fit = fitSkills(fitGames.slice(0, i + 1), fit ?? snaps[i - 1], MODEL, true);
      snaps.push(snapshotOf(fit));
    }
  }

  const players = new Map<string, PlayerRating & { held: number }>();
  const me = (id: string) => players.get(id) ?? (players.set(id, { id, rating: disp(MODEL.MU0), games: 0, wins: 0, losses: 0, pf: 0, pa: 0, provisional: false, entries: [], peak: 0, held: 0 }), players.get(id)!);
  const empty: Snapshot = { skill: {}, late: MODEL.MU0 };
  const skillIn = (snap: Snapshot, id: string) => snap.skill[id] ?? priorOf(id, founders, snap.late);
  const shown = (snap: Snapshot, id: string) => disp(skillIn(snap, id)) + me(id).held;

  games.forEach((g, idx) => {
    const pre = idx ? snaps[idx - 1] : empty, post = snaps[idx];
    const aWon = g.scoreA! > g.scoreB!;
    const expA = expectedShare(skillIn(pre, g.a[0]), skillIn(pre, g.a[1]), skillIn(pre, g.b[0]), skillIn(pre, g.b[1]));
    const pA = gameWinProb(expA, g.to);
    const side = (team: string[], opp: string[], won: boolean, gf: number, ga: number, winProb: number) => {
      for (const id of team) {
        const p = me(id);
        const ratingBefore = shown(pre, id);
        const fitDelta = disp(post.skill[id]) - disp(skillIn(pre, id));
        const floor = won ? winFloor(gf, ga) : -Infinity;
        if (fitDelta < floor) p.held += floor - fitDelta;
        const ratingAfter = shown(post, id);
        p.entries.push({
          gameId: g.id, eventId: g.eventId, idx, won, gf, ga, partner: team.find((x) => x !== id)!, opps: [...opp],
          ratingBefore, ratingAfter, delta: ratingAfter - ratingBefore, winProb, gamesBefore: p.games,
        });
        p.games++;
        if (won) p.wins++; else p.losses++;
        p.pf += gf; p.pa += ga;
      }
    };
    side(g.a, g.b, aWon, g.scoreA!, g.scoreB!, pA);
    side(g.b, g.a, !aWon, g.scoreB!, g.scoreA!, 1 - pA);
  });

  const last = snaps.at(-1) ?? empty;
  for (const p of players.values()) {
    p.rating = disp(skillIn(last, p.id)) + p.held;
    p.provisional = p.games < PROV_N;
    // The peak only counts once placed: a placing player's number isn't shown.
    p.peak = p.entries.filter((e) => e.gamesBefore + 1 >= PROV_N).reduce((m, e) => Math.max(m, e.ratingAfter), p.provisional ? 0 : p.rating);
  }
  const all = [...players.values()];
  const byRating = (a: PlayerRating, b: PlayerRating) => b.rating - a.rating || a.id.localeCompare(b.id);
  const ranked = all.filter((p) => !p.provisional).sort(byRating);
  ranked.forEach((p, i) => (p.rank = i + 1));
  const placing = all.filter((p) => p.provisional).sort((a, b) => b.games - a.games || byRating(a, b));
  return { players, ranked, placing, ledger: { sigs, snaps } };
}

/** A game's change for one player, if it counted for them. */
export function entryOf(r: Ratings, playerId: string, gameId: string): GameEntry | undefined {
  return r.players.get(playerId)?.entries.find((e) => e.gameId === gameId);
}

/** A player's rating before and after one event (null if they didn't play in it). */
export function eventChange(r: Ratings, playerId: string, eventId: string): { before: number; after: number; games: number; gamesBefore: number } | null {
  const es = r.players.get(playerId)?.entries.filter((e) => e.eventId === eventId) ?? [];
  if (!es.length) return null;
  return { before: es[0].ratingBefore, after: es.at(-1)!.ratingAfter, games: es.length, gamesBefore: es[0].gamesBefore };
}
