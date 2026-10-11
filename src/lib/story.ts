// The tournament's own story: who won, the stories of the day, and the records it broke. Pure:
// one event's games plus every earlier event in, story out. The personal review (recap.ts) is the
// second act; this is the first.
import { tally, rank, isDone, groupMembers, type Game, type Line } from "@/lib/cards";
import { stageResults, finishOf, type DayEvent } from "@/lib/recap";

export type Story = {
  event: { id: string; title: string; startsAt: number; done: boolean };
  champion: { id: string; line: Line; titles: number } | null;
  /** Every final (or group, before finals): winner and runner-up. */
  podium: { name: string; winner: string | null; runnerUp: string | null; tied: string[] }[];
  stories: Tale[];
  records: Record[];
  numbers: { players: number; games: number; points: number; deuces: number; nets: number };
};

/** One short headline about the day, with who it's about and the number that makes it. */
export type Tale = { kind: "unbeaten" | "streak" | "climber" | "partnership" | "blowout" | "deuce" | "points" | "firstTitle"; title: string; ids: string[]; stat: string; detail: string };

/** A best-ever (or first-ever) the day set, against every earlier weekend. */
export type Record = { kind: "margin" | "deuce" | "streak" | "wins" | "points" | "titles"; label: string; ids: string[]; value: string; previous: string | null };

const counted = (g: Game) => isDone(g) && !g.decider;
const margin = (g: Game) => Math.abs(g.scoreA! - g.scoreB!);
const total = (g: Game) => g.scoreA! + g.scoreB!;
const winners = (g: Game) => (g.scoreA! > g.scoreB! ? g.a : g.b);
const order = (x: Game, y: Game) => x.stageNo - y.stageNo || x.ord - y.ord || x.seq - y.seq;
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
/** A game that went past its target to win-by-two. The target isn't stored on a game, so it's the
 *  day's lowest winning score (every game to 15 has a 15 somewhere). */
const isDeuce = (g: Game, to: number) => margin(g) === 2 && Math.max(g.scoreA!, g.scoreB!) > to;
const targetOf = (played: Game[]) => Math.min(...played.map((g) => Math.max(g.scoreA!, g.scoreB!)));
const score = (g: Game) => `${Math.max(g.scoreA!, g.scoreB!)}–${Math.min(g.scoreA!, g.scoreB!)}`;

/** The day's bests, per measure: the raw material for both stories and records. */
export function dayBests(games: Game[]) {
  const played = games.filter(counted).sort(order);
  const lines = [...tally(played).values()].filter((l) => l.gp > 0);
  const blowout = [...played].sort((x, y) => margin(y) - margin(x) || order(x, y))[0] ?? null;
  const to = targetOf(played);
  const deuce = played.filter((g) => isDeuce(g, to)).sort((x, y) => total(y) - total(x) || order(x, y))[0] ?? null;
  const streaks = new Map<string, number>();
  const run = new Map<string, number>();
  for (const g of played) {
    for (const id of [...g.a, ...g.b]) {
      if (g.subs.includes(id)) continue;
      const n = winners(g).includes(id) ? (run.get(id) ?? 0) + 1 : 0;
      run.set(id, n);
      streaks.set(id, Math.max(streaks.get(id) ?? 0, n));
    }
  }
  const streak = [...streaks].sort((x, y) => y[1] - x[1])[0] ?? null;
  const mostWins = [...lines].sort((x, y) => y.w - x.w || (y.pf - y.pa) - (x.pf - x.pa))[0] ?? null;
  const mostPoints = [...lines].sort((x, y) => y.pf - x.pf)[0] ?? null;
  return { played, lines, blowout, deuce, streak: streak ? { id: streak[0], n: streak[1] } : null, mostWins, mostPoints };
}

/** Gold champions of an event, if it has finals and they're decided. */
function goldChampion(games: Game[]): string | null {
  const res = stageResults(games);
  return res?.kind === "final" ? res.groups[0]?.winner ?? null : null;
}

export function buildStory(ev: DayEvent, history: DayEvent[]): Story {
  const before = history.filter((e) => e.id !== ev.id && e.startsAt < ev.startsAt);
  const b = dayBests(ev.games);
  const res = stageResults(ev.games);

  // The champion: Gold's winner, with how many Gold titles they now hold.
  const champId = goldChampion(ev.games);
  const priorTitles = (id: string) => before.filter((e) => goldChampion(e.games) === id).length;
  const champion = champId ? { id: champId, line: tally(b.played, [champId]).get(champId)!, titles: priorTitles(champId) + 1 } : null;

  const podium = (res?.groups ?? []).map((g) => {
    const members = groupMembers(g.games.filter((x) => !x.decider));
    const table = rank(tally(g.games.filter((x) => x.status !== "void"), members).values()).map((r) => r.id);
    const runnerUp = g.winner ? table.filter((id) => id !== g.winner)[0] ?? null : null;
    return { name: res!.kind === "final" ? g.name : `Group ${g.name}`, winner: g.winner, runnerUp, tied: g.tied };
  });

  // Stories: the few things people will talk about. Strongest first, at most five.
  const stories: Tale[] = [];
  const groupLines = [...tally(b.played.filter((g) => g.kind !== "final")).values()].filter((l) => l.gp >= 3);
  const unbeaten = b.lines.filter((l) => l.gp >= 4 && l.l === 0);
  if (unbeaten.length) stories.push({ kind: "unbeaten", title: unbeaten.length === 1 ? "Perfect day" : "Nobody could beat them", ids: unbeaten.map((l) => l.id), stat: `${unbeaten[0].w}–0`, detail: "Won every game they played." });
  if (champion && champion.titles === 1 && before.some((e) => goldChampion(e.games))) stories.push({ kind: "firstTitle", title: "A first Gold title", ids: [champion.id], stat: "1st", detail: "Never won Gold before today." });
  // The climber: furthest from their group-stage place to their finish (bottom half into Gold).
  const groupOrder = rank(groupLines).map((r) => r.id);
  const climbs = groupOrder.map((id, i) => ({ id, from: i + 1, f: finishOf(ev.games, id) })).filter((c) => c.f && c.f.tierIndex === 0 && c.from > Math.ceil(groupOrder.length / 2));
  const climber = climbs.sort((x, y) => y.from - x.from)[0];
  if (climber) stories.push({ kind: "climber", title: "The climb", ids: [climber.id], stat: `${ordinal(climber.from)} → Gold`, detail: `Scraped into Gold from ${ordinal(climber.from)} after the groups${climber.f!.won ? " and won it" : ""}.` });
  if (b.streak && b.streak.n >= 4 && !unbeaten.some((l) => l.id === b.streak!.id)) stories.push({ kind: "streak", title: "On fire", ids: [b.streak.id], stat: `${b.streak.n} in a row`, detail: "The longest winning run of the day." });
  // Best partnership: most wins together, then points difference (2+ games).
  const pairs = new Map<string, { ids: string[]; w: number; gp: number; diff: number }>();
  for (const g of b.played) for (const side of [g.a, g.b]) {
    if (side.some((id) => g.subs.includes(id))) continue;
    const key = [...side].sort().join("+");
    const p = pairs.get(key) ?? { ids: [...side].sort(), w: 0, gp: 0, diff: 0 };
    const won = winners(g) === side;
    p.gp++; if (won) p.w++; p.diff += won ? margin(g) : -margin(g);
    pairs.set(key, p);
  }
  const duo = [...pairs.values()].filter((p) => p.gp >= 2 && p.w === p.gp).sort((x, y) => y.w - x.w || y.diff - x.diff)[0];
  if (duo) stories.push({ kind: "partnership", title: "Dream team", ids: duo.ids, stat: `${duo.w}–0 together`, detail: `+${duo.diff} on points as a pair.` });
  if (b.blowout && margin(b.blowout) >= 10) stories.push({ kind: "blowout", title: "Biggest win", ids: [...winners(b.blowout)], stat: score(b.blowout), detail: "The widest margin of the day." });
  if (b.deuce) stories.push({ kind: "deuce", title: "The epic", ids: [...b.deuce.a, ...b.deuce.b], stat: score(b.deuce), detail: "The longest deuce of the day." });
  if (b.mostPoints && stories.length < 5) stories.push({ kind: "points", title: "Points machine", ids: [b.mostPoints.id], stat: `${b.mostPoints.pf} pts`, detail: "Scored more than anyone." });

  // Records: today's best against every earlier weekend's best, on the same measure.
  const records: Record[] = [];
  if (before.length) {
    const prev = before.map((e) => dayBests(e.games));
    const best = <T,>(f: (x: ReturnType<typeof dayBests>) => T | null, cmp: (t: T) => number) => {
      const vals = prev.map(f).filter((v): v is T => v !== null);
      return vals.length ? vals.sort((x, y) => cmp(y) - cmp(x))[0] : null;
    };
    if (b.blowout) {
      const p = best((x) => x.blowout, margin);
      if (!p || margin(b.blowout) > margin(p)) records.push({ kind: "margin", label: "Biggest winning margin", ids: [...winners(b.blowout)], value: score(b.blowout), previous: p ? score(p) : null });
    }
    if (b.deuce) {
      const p = best((x) => x.deuce, total);
      if (!p || total(b.deuce) > total(p)) records.push({ kind: "deuce", label: "Longest deuce", ids: [...b.deuce.a, ...b.deuce.b], value: score(b.deuce), previous: p ? score(p) : null });
    }
    if (b.streak && b.streak.n >= 3) {
      const p = best((x) => x.streak, (s) => s.n);
      if (!p || b.streak.n > p.n) records.push({ kind: "streak", label: "Longest winning streak", ids: [b.streak.id], value: `${b.streak.n} in a row`, previous: p ? `${p.n}` : null });
    }
    if (b.mostWins) {
      const p = best((x) => x.mostWins, (l) => l.w);
      if (!p || b.mostWins.w > p.w) records.push({ kind: "wins", label: "Most wins in a day", ids: [b.mostWins.id], value: `${b.mostWins.w} wins`, previous: p ? `${p.w}` : null });
    }
    if (b.mostPoints) {
      const p = best((x) => x.mostPoints, (l) => l.pf);
      if (!p || b.mostPoints.pf > p.pf) records.push({ kind: "points", label: "Most points in a day", ids: [b.mostPoints.id], value: `${b.mostPoints.pf} pts`, previous: p ? `${p.pf}` : null });
    }
    if (champion && champion.titles > 1) {
      const most = Math.max(0, ...[...new Set(before.map((e) => goldChampion(e.games)).filter(Boolean))].map((id) => before.filter((e) => goldChampion(e.games) === id).length));
      if (champion.titles > most) records.push({ kind: "titles", label: "Most Gold titles", ids: [champion.id], value: `${champion.titles} titles`, previous: `${most}` });
    }
  }

  return {
    event: { id: ev.id, title: ev.title, startsAt: ev.startsAt, done: ev.status === "done" },
    champion,
    podium,
    stories: stories.slice(0, 5),
    records,
    numbers: {
      players: b.lines.length,
      games: b.played.length,
      points: b.played.reduce((n, g) => n + total(g), 0),
      deuces: b.played.length ? b.played.filter((g) => isDeuce(g, targetOf(b.played))).length : 0,
      nets: new Set(b.played.map((g) => g.net)).size,
    },
  };
}
