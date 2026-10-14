// "Level moments": what each newly scored game did to your level, as story slides that pop up the
// next time you're in the app. Pure: games and a "seen up to" time in, slides out.
//
// XP is always worked out from the whole history (levels.ts), so a game's effect is simply your XP
// with it minus your XP without it. Games are replayed in the order they were scored, so the
// "+10 for turning up", the 0 floor and a finals bonus land exactly where they happened.
import { isDone, gameLabel, type Game } from "@/lib/cards";
import { xpWeekends, levelFor, type Level } from "@/lib/levels";

export type TimedGame = Game & { eventId: string; updatedAt: number };
export type MomentEvent = { id: string; title: string; startsAt: number; games: TimedGame[] };

type LevelStep = { before: number; after: number; from: Level; to: Level; progressFrom: number; progressTo: number; next: Level | null; toNext: number };

export type GameSlide = LevelStep & {
  kind: "game"; gameId: string; eventTitle: string; label: string; won: boolean; mine: number; theirs: number;
  partner: string; opponents: [string, string]; xp: number; turnedUp: boolean; cheer: string;
};
export type FinishSlide = LevelStep & { kind: "finish"; label: string; xp: number; cheer: string };
type LevelChange = { level: Level; next: Level | null; toNext: number; xp: number; cheer: string };
export type LevelUpSlide = LevelChange & { kind: "levelUp" };
export type LevelDownSlide = LevelChange & { kind: "levelDown" };
export type SummarySlide = { kind: "summary"; games: number; wins: number; xp: number; before: number; after: number; level: Level; next: Level | null; toNext: number; progress: number; cheer: string };
export type MomentSlide = GameSlide | FinishSlide | LevelUpSlide | LevelDownSlide | SummarySlide;

const counted = (g: Game) => isDone(g) && !g.decider;
const involves = (g: Game, me: string) => [...g.a, ...g.b].includes(me) && !g.subs.includes(me);

/** Pick a line by a stable hash, so the same game always gets the same message. */
function pick(lines: string[], seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return lines[Math.abs(h) % lines.length];
}

export function cheerFor(won: boolean, margin: number, seed: string): string {
  if (won) {
    if (margin >= 8) return pick(["Absolute demolition 💥", "That was a statement.", "Ruthless. Love it."], seed);
    if (margin <= 3) return pick([`Clutch! Won by ${margin}.`, "Nerves of steel 🧊", "Down to the wire, and you got it."], seed);
    return pick(["Get in! 🙌", "That's how it's done.", "Clinical.", "Nets on fire 🔥", "Big win. Keep rolling."], seed);
  }
  if (margin <= 3) return pick([`So close, only ${margin} in it. Only cost you 3 XP.`, "A coin-flip game. The next one's yours.", "That close? You're right there."], seed);
  return pick(["Shake it off. Next game's a fresh start.", "Every loss is a lesson. You'll get them next time.", "Tough one. The best players lose plenty too.", "Head up. Plenty more games today 💪"], seed);
}

const upLines = (l: Level) => [`Welcome to ${l.name} ${l.icon}`, `${l.name} ${l.icon}. You earned this one.`, `Up you go: ${l.name} ${l.icon}`];
const downLines = ["A dip, not a drop-off. One good win and you're climbing again.", "Everyone slips sometimes. Your next win starts the climb back.", "Ranks move both ways. That's what makes the climb worth it."];

function step(before: number, after: number): LevelStep {
  const a = levelFor(before), b = levelFor(after);
  return {
    before, after, from: a.level, to: b.level,
    progressFrom: a.level.level === b.level.level ? a.progress : b.level.level > a.level.level ? 0 : 1,
    progressTo: b.progress, next: b.next, toNext: b.next ? b.next.min - after : 0,
  };
}

/**
 * The slides for everything scored for `me` since `seenAt` (ms). `upTo` is the latest of those
 * games' times, to mark as seen afterwards (not "now", so a game scored while the story was open
 * still pops up after). Returns no slides when there's nothing new.
 */
export function buildMoments(events: MomentEvent[], me: string, seenAt: number): { slides: MomentSlide[]; upTo: number } {
  const fresh = events.flatMap((e) => e.games.filter((g) => counted(g) && involves(g, me) && g.updatedAt > seenAt).map((g) => ({ g, e })))
    .sort((x, y) => x.g.updatedAt - y.g.updatedAt);
  if (!fresh.length) return { slides: [], upTo: seenAt };
  const freshIds = new Set(fresh.map((f) => f.g.id));

  // XP with only some of the fresh games scored: the rest count as not played yet.
  const xpWith = (scored: Set<string>) => {
    const evs = events.map((e) => ({ id: e.id, startsAt: e.startsAt, games: e.games.map((g) => (freshIds.has(g.id) && !scored.has(g.id) ? { ...g, status: "todo" as const, scoreA: null, scoreB: null } : g)) }));
    const p = xpWeekends(evs).get(me);
    return { xp: p?.xp ?? 0, weekends: p?.weekends };
  };

  const slides: MomentSlide[] = [];
  const scored = new Set<string>();
  let prev = xpWith(scored);
  const start = prev.xp;
  let wins = 0;
  for (const { g, e } of fresh) {
    scored.add(g.id);
    const now = xpWith(scored);
    const before = prev.weekends?.get(e.id), after = now.weekends?.get(e.id);
    // A finals bonus that this game completed gets its own slide.
    const finishOf = (w: typeof after) => w?.parts.find((p) => !["Played"].includes(p.label) && !/\b(win|wins|loss|losses)$/.test(p.label));
    const newFinish = finishOf(after) && !finishOf(before) ? finishOf(after)! : null;
    const turnedUp = !before && !!after;
    const onA = g.a.includes(me);
    const won = onA ? g.scoreA! > g.scoreB! : g.scoreB! > g.scoreA!;
    if (won) wins++;
    const side = onA ? g.a : g.b, other = onA ? g.b : g.a;
    const gameAfter = now.xp - (newFinish?.xp ?? 0);
    const margin = Math.abs(g.scoreA! - g.scoreB!);
    const gs: GameSlide = {
      kind: "game", ...step(prev.xp, gameAfter), gameId: g.id, eventTitle: e.title, label: gameLabel(g), won,
      mine: onA ? g.scoreA! : g.scoreB!, theirs: onA ? g.scoreB! : g.scoreA!,
      partner: side[0] === me ? side[1] : side[0], opponents: [other[0], other[1]],
      xp: gameAfter - prev.xp, turnedUp, cheer: cheerFor(won, margin, g.id),
    };
    slides.push(gs);
    pushLevelChange(slides, prev.xp, gameAfter, g.id);
    if (newFinish) {
      const champ = newFinish.label === "Champion";
      slides.push({ kind: "finish", ...step(gameAfter, now.xp), label: newFinish.label, xp: newFinish.xp, cheer: champ ? "Champion of the day 🏆 Take a bow." : "Finals finish. What a day 🎉" });
      pushLevelChange(slides, gameAfter, now.xp, `${g.id}-finish`);
    }
    prev = now;
  }

  const games = fresh.length;
  if (games > 1) {
    const end = levelFor(prev.xp);
    const total = prev.xp - start;
    const cheer = wins === games ? "Perfect run. Unstoppable 🔥"
      : wins * 2 > games ? "Winning more than you lose. Cracking stuff."
      : wins * 2 === games ? "Even split. Right in the mix."
      : wins > 0 ? "Some wins in the bag. Every game makes you better."
      : "Not your day on the scoreboard, but you showed up and played. That's what counts.";
    slides.push({ kind: "summary", games, wins, xp: total, before: start, after: prev.xp, level: end.level, next: end.next, toNext: end.next ? end.next.min - prev.xp : 0, progress: end.progress, cheer });
  }
  return { slides, upTo: fresh.at(-1)!.g.updatedAt };
}

function pushLevelChange(slides: MomentSlide[], before: number, after: number, seed: string) {
  const a = levelFor(before).level, b = levelFor(after);
  if (b.level.level === a.level) return;
  const toNext = b.next ? b.next.min - after : 0;
  if (b.level.level > a.level) slides.push({ kind: "levelUp", level: b.level, next: b.next, toNext, xp: after, cheer: pick(upLines(b.level), seed) });
  else slides.push({ kind: "levelDown", level: b.level, next: b.next, toNext, xp: after, cheer: pick(downLines, seed) });
}

/**
 * The story of one game you've already played, for tapping it in your recent games: the same
 * slides it popped up with, worked out as things stood when it was scored (anything scored after
 * it counts as not played yet). No slides if it wasn't a counted game of yours.
 */
export function gameMoments(events: MomentEvent[], me: string, gameId: string): MomentSlide[] {
  const target = events.flatMap((e) => e.games).find((g) => g.id === gameId);
  if (!target || !counted(target) || !involves(target, me)) return [];
  const t = target.updatedAt;
  const asThen = events.map((e) => ({
    ...e,
    games: e.games.map((g) => (g.id !== gameId && g.updatedAt >= t ? { ...g, status: "todo" as const, scoreA: null, scoreB: null } : g)),
  }));
  return buildMoments(asThen, me, t - 1).slides;
}

/** What each game did to your XP (the number on its story's first slide), by game id. */
export function gameXps(events: MomentEvent[], me: string, gameIds: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of gameIds) {
    const s = gameMoments(events, me, id).find((x) => x.kind === "game");
    if (s?.kind === "game") out.set(id, s.xp);
  }
  return out;
}
