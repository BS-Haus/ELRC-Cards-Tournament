// "Moments": what each newly scored game did to your rating, as story slides that pop up the next
// time you're in the app. Pure: ratings and a "seen up to" time in, slides out.
//
// Ratings are always worked out from the whole history (standings.ts), so a game's change is its
// line in the ledger. While you're placing (your first PROV_N games) the number stays hidden: each
// game shows how far through placement you are, and the game that places you reveals your rating
// and tier.
import { isDone, gameLabel, type Game } from "@/lib/cards";
import { PROV_N, type Ratings, type GameEntry } from "@/lib/standings";
import { tierFor, type Level, type TierInfo } from "@/lib/levels";

export type TimedGame = Game & { eventId: string; updatedAt: number };
export type MomentEvent = { id: string; title: string; startsAt: number; games: TimedGame[] };

type Bar = { from: number; to: number; level: Level; next: Level | null; toNext: number; placing: boolean };

export type GameSlide = {
  kind: "game"; gameId: string; eventTitle: string; label: string; won: boolean; mine: number; theirs: number;
  partner: string; opponents: [string, string];
  /** Rating change, before and after; while placing these are kept off screen. */
  delta: number; before: number; after: number;
  /** Games played after this one, while placing (1–PROV_N); null once placed. */
  placingGame: number | null;
  winProb: number;
  bar: Bar; cheer: string;
  /** The whole game, everyone's line: the slide shows this, with yours picked out. */
  match: Match;
};
/** The whole game for someone who didn't play in it (a scorer at the side): the same view, nobody picked out. */
export type MatchSlide = { kind: "match"; gameId: string; eventTitle: string; label: string; match: Match };
/** A game as everyone saw it: the score, side A's chance going in, and all four lines. */
export type Match = { a: [string, string]; b: [string, string]; scoreA: number; scoreB: number; chanceA: number; lines: ResultLine[] };
export type PlacedSlide = { kind: "placed"; rating: number; level: Level; next: Level | null; toNext: number; cheer: string };
type TierChange = { level: Level; next: Level | null; toNext: number; rating: number; cheer: string };
export type LevelUpSlide = TierChange & { kind: "levelUp" };
export type LevelDownSlide = TierChange & { kind: "levelDown" };
export type SummarySlide = { kind: "summary"; games: number; wins: number; delta: number | null; after: number; tier: TierInfo; cheer: string };
export type MomentSlide = GameSlide | MatchSlide | PlacedSlide | LevelUpSlide | LevelDownSlide | SummarySlide;

/** Pick a line by a stable hash, so the same game always gets the same message. */
function pick(lines: string[], seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return lines[Math.abs(h) % lines.length];
}

export function cheerFor(won: boolean, margin: number, seed: string, upset = false): string {
  if (won) {
    if (upset) return pick(["Upset! Nobody saw that coming 😮", "Giant-killers 🪓", "Against the odds. Brilliant."], seed);
    if (margin >= 8) return pick(["Absolute demolition 💥", "That was a statement.", "Ruthless. Love it."], seed);
    if (margin <= 3) return pick([`Clutch! Won by ${margin}.`, "Nerves of steel 🧊", "Down to the wire, and you got it."], seed);
    return pick(["Get in! 🙌", "That's how it's done.", "Clinical.", "Nets on fire 🔥", "Big win. Keep rolling."], seed);
  }
  if (margin <= 3) return pick([`So close, only ${margin} in it.`, "A coin-flip game. The next one's yours.", "That close? You're right there."], seed);
  return pick(["Shake it off. Next game's a fresh start.", "Every loss is a lesson. You'll get them next time.", "Tough one. The best players lose plenty too.", "Head up. Plenty more games today 💪"], seed);
}

const upLines = (l: Level) => [`Welcome to ${l.name} ${l.icon}`, `${l.name} ${l.icon}. You earned this one.`, `Up you go: ${l.name} ${l.icon}`];
const downLines = ["A dip, not a drop-off. One good win and you're climbing again.", "Everyone slips sometimes. Your next win starts the climb back.", "Ranks move both ways. That's what makes the climb worth it."];
const placedLines = (l: Level) => [`You've placed: ${l.name} ${l.icon}. Now climb.`, `${l.icon} ${l.name}. That's where your games put you. Now it's yours to move.`, `Placed! ${l.name} ${l.icon}. Every game from here moves your number.`];

const tierAt = (rating: number, games: number) => tierFor({ rating, games });

function bar(e: GameEntry): Bar {
  const a = tierAt(e.ratingBefore, e.gamesBefore), b = tierAt(e.ratingAfter, e.gamesBefore + 1);
  const from = a.level.level === b.level.level ? a.progress : b.level.level > a.level.level ? 0 : 1;
  return { from, to: b.progress, level: b.level, next: b.next, toNext: b.toNext, placing: b.placing };
}

function slidesFor(r: Ratings, e: GameEntry, g: Game, title: string, me: string): MomentSlide[] {
  const onA = g.a.includes(me);
  const side = onA ? g.a : g.b, other = onA ? g.b : g.a;
  const placing = e.gamesBefore + 1 <= PROV_N;
  const margin = Math.abs(e.gf - e.ga);
  const out: MomentSlide[] = [{
    kind: "game", gameId: g.id, eventTitle: title, label: gameLabel(g), won: e.won, mine: e.gf, theirs: e.ga,
    partner: side[0] === me ? side[1] : side[0], opponents: [other[0], other[1]],
    delta: e.delta, before: e.ratingBefore, after: e.ratingAfter, placingGame: placing ? e.gamesBefore + 1 : null, winProb: e.winProb,
    bar: bar(e), cheer: cheerFor(e.won, margin, g.id, e.won && e.winProb < 0.4),
    match: matchOf(r, g)!,
  }];
  if (e.gamesBefore + 1 === PROV_N) {
    const t = tierAt(e.ratingAfter, PROV_N);
    out.push({ kind: "placed", rating: e.ratingAfter, level: t.level, next: t.next, toNext: t.toNext, cheer: pick(placedLines(t.level), g.id) });
  } else if (!placing) {
    const a = tierAt(e.ratingBefore, PROV_N), b = tierAt(e.ratingAfter, PROV_N);
    if (b.level.level !== a.level.level) {
      const change = { level: b.level, next: b.next, toNext: b.toNext, rating: e.ratingAfter };
      out.push(b.level.level > a.level.level ? { kind: "levelUp", ...change, cheer: pick(upLines(b.level), g.id) } : { kind: "levelDown", ...change, cheer: pick(downLines, g.id) });
    }
  }
  return out;
}

const mine = (g: Game, me: string) => isDone(g) && [...g.a, ...g.b].includes(me);

/**
 * The slides for everything scored for `me` since `seenAt` (ms), in the order the games were
 * played. `upTo` is the latest of those games' scoring times, to mark as seen afterwards (not
 * "now", so a game scored while the story was open still pops up after).
 */
export function buildMoments(events: MomentEvent[], r: Ratings, me: string, seenAt: number): { slides: MomentSlide[]; upTo: number } {
  const byId = new Map(events.flatMap((e) => e.games.map((g) => [g.id, { g, e }] as const)));
  const fresh = (r.players.get(me)?.entries ?? []).filter((x) => { const f = byId.get(x.gameId); return f && mine(f.g, me) && f.g.updatedAt > seenAt; });
  if (!fresh.length) return { slides: [], upTo: seenAt };
  const slides = fresh.flatMap((x) => { const { g, e } = byId.get(x.gameId)!; return slidesFor(r, x, g, e.title, me); });
  if (fresh.length > 1) {
    const wins = fresh.filter((x) => x.won).length, games = fresh.length;
    const last = fresh.at(-1)!;
    const placed = last.gamesBefore + 1 >= PROV_N;
    const cheer = wins === games ? "Perfect run. Unstoppable 🔥"
      : wins * 2 > games ? "Winning more than you lose. Cracking stuff."
      : wins * 2 === games ? "Even split. Right in the mix."
      : wins > 0 ? "Some wins in the bag. Every game makes you better."
      : "Not your day on the scoreboard, but you showed up and played. That's what counts.";
    // The net change, only once placed (and from a number that was shown).
    const startShown = fresh[0].gamesBefore >= PROV_N;
    slides.push({ kind: "summary", games, wins, delta: placed && startShown ? last.ratingAfter - fresh[0].ratingBefore : null, after: last.ratingAfter, tier: tierAt(last.ratingAfter, last.gamesBefore + 1), cheer });
  }
  return { slides, upTo: Math.max(...fresh.map((x) => byId.get(x.gameId)!.g.updatedAt)) };
}

/** The story of one game you've already played (tap it in your games): its slides as they stand. */
export function gameMoments(events: MomentEvent[], r: Ratings, me: string, gameId: string): MomentSlide[] {
  const x = r.players.get(me)?.entries.find((e) => e.gameId === gameId);
  const f = events.flatMap((e) => e.games.map((g) => ({ g, e }))).find((y) => y.g.id === gameId);
  return x && f ? slidesFor(r, x, f.g, f.e.title, me) : [];
}

/** A game just scored, for the phone that scored it: your story of it if you played (the whole
 *  game first, then anything it did to your tier), or just the whole game if you didn't. */
export function matchMoments(events: MomentEvent[], r: Ratings, gameId: string, viewer: string | null): MomentSlide[] {
  const f = events.flatMap((e) => e.games.map((g) => ({ g, e }))).find((y) => y.g.id === gameId);
  if (!f) return [];
  if (viewer && [...f.g.a, ...f.g.b].includes(viewer)) {
    const mineSlides = gameMoments(events, r, viewer, gameId);
    if (mineSlides.length) return mineSlides;
  }
  const match = matchOf(r, f.g);
  return match ? [{ kind: "match", gameId, eventTitle: f.e.title, label: gameLabel(f.g), match }] : [];
}

function matchOf(r: Ratings, g: Game): Match | null {
  const res = gameResultOf(r, g);
  return res ? { a: g.a, b: g.b, scoreA: g.scoreA!, scoreB: g.scoreB!, ...res } : null;
}

/** One player's line on a game's result screen. */
export type ResultLine = {
  id: string; won: boolean;
  delta: number; before: number; after: number;
  /** Games played after this one while placing (1–PROV_N, and PROV_N is the game that places them); null once placed. */
  placingGame: number | null;
  tier: TierInfo; tierBefore: Level;
  /** Ladder place before and after, only on a placed player's latest game (on an older one "now"
   *  isn't then). Before is read against everyone else's rating now, so it's exact when this was
   *  the latest game of the day and close otherwise. */
  rankBefore: number | null; rankAfter: number | null;
};

/** Everything the result screen shows for one game: side A's chance going in and all four lines.
 *  Null if the game doesn't count in the ratings. */
export function gameResultOf(r: Ratings, g: Game): { chanceA: number; lines: ResultLine[] } | null {
  const ids = [...g.a, ...g.b];
  const entries = ids.map((id) => r.players.get(id)?.entries.find((e) => e.gameId === g.id));
  if (entries.some((e) => !e)) return null;
  const lines = entries.map((e, i): ResultLine => {
    const id = ids[i];
    const placing = e!.gamesBefore + 1 <= PROV_N;
    const latest = r.players.get(id)!.entries.at(-1)?.gameId === g.id;
    const wasPlaced = latest && e!.gamesBefore >= PROV_N;
    const others = r.ranked.filter((p) => p.id !== id);
    const rankBefore = wasPlaced ? others.filter((p) => p.rating > e!.ratingBefore).length + 1 : null;
    return {
      id, won: e!.won, delta: e!.delta, before: e!.ratingBefore, after: e!.ratingAfter,
      placingGame: placing ? e!.gamesBefore + 1 : null,
      tier: tierAt(e!.ratingAfter, e!.gamesBefore + 1), tierBefore: tierAt(e!.ratingBefore, e!.gamesBefore).level,
      rankBefore, rankAfter: latest ? r.players.get(id)?.rank ?? null : null,
    };
  });
  return { chanceA: entries[0]!.winProb, lines };
}
