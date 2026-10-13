// Derived views of one event, shared by the server and the event screen. Pure: no database.
import { tally, rank, groupWinner, groupRank, groupMembers, isDone, netQueues, drawPool, type Game, type StageKind, type Line } from "@/lib/cards";
import type { EventView } from "@/lib/data";

export type GroupView = { stageNo: number; kind: StageKind; groupNo: number; name: string; net: number; games: Game[]; table: Line[]; winner: string | null; tied: string[]; decider: "none" | "playing" | "decided" | "level"; complete: boolean };

export function groupsOf(v: EventView, stageNo: number): GroupView[] {
  const gs = v.games.filter((g) => g.stageNo === stageNo);
  const nos = [...new Set(gs.map((g) => g.groupNo))].sort((a, b) => a - b);
  return nos.map((groupNo) => {
    const games = gs.filter((g) => g.groupNo === groupNo).sort((a, b) => a.seq - b.seq);
    const live = games.filter((g) => g.status !== "void");
    const table = groupRank(tally(live, groupMembers(games)).values(), live);
    const { winner, tied, decider } = groupWinner(games);
    return { stageNo, kind: games[0].kind, groupNo, name: games[0].groupName, net: games[0].net, games, table, winner, tied, decider, complete: live.every(isDone) };
  });
}

export function finalsOf(v: EventView): { stageNo: number; groups: GroupView[] } | null {
  const st = [...v.stages].reverse().find((s) => s.kind === "final");
  return st ? { stageNo: st.no, groups: groupsOf(v, st.no) } : null;
}

/** The event's standings across its group stages (finals are scored separately). */
export function eventStandings(v: EventView): Line[] {
  const present = v.entries.filter((e) => e.state === "here").map((e) => e.playerId);
  return rank(tally(v.games.filter((g) => g.kind !== "final"), present).values());
}


/** One of your games, from your side: who you played with and against, and how it went. */
export type MyGame = { game: Game; partner: string; opponents: [string, string]; score: [number, number] | null; won: boolean | null; sub: boolean };
/** A game you're still to play: its net, and how many games are ahead of it there (0 = on now). */
export type MyNext = MyGame & { net: number; ahead: number };
export type MyDay = { played: MyGame[]; next: MyNext[]; line: Line };

/** Your day at an event: the games you've played, the ones still to come in the order the nets
 *  will reach them, and your record (a sub's appearance and deciders don't count, as in tally). */
export function myDay(games: Game[], nets: number, me: string): MyDay {
  const from = (g: Game): MyGame => {
    const mine = g.a.includes(me) ? g.a : g.b;
    const theirs = mine === g.a ? g.b : g.a;
    const done = isDone(g);
    const score: [number, number] | null = done ? (mine === g.a ? [g.scoreA!, g.scoreB!] : [g.scoreB!, g.scoreA!]) : null;
    return { game: g, partner: mine.find((id) => id !== me)!, opponents: theirs, score, won: score ? score[0] > score[1] : null, sub: g.subs.includes(me) };
  };
  const has = (g: Game) => g.a.includes(me) || g.b.includes(me);
  const played = games.filter((g) => has(g) && isDone(g)).sort((x, y) => x.stageNo - y.stageNo || x.ord - y.ord).map(from);
  const next = netQueues(games, nets)
    .flatMap((q, i) => q.map((g, ahead) => ({ g, ahead, net: i + 1 })))
    .filter((x) => has(x.g))
    .sort((x, y) => x.ahead - y.ahead || x.g.stageNo - y.g.stageNo || x.g.ord - y.g.ord)
    .map((x) => ({ ...from(x.g), net: x.net, ahead: x.ahead }));
  return { played, next, line: tally(games, [me]).get(me)! };
}

/** How long after its start a live event still counts as today's. Past this, an event an
 *  organiser forgot to finish stops hijacking the Tournament tab. */
export const LIVE_FOR_MS = 18 * 60 * 60 * 1000;

/** The event the Tournament tab should open straight into: the latest live one that started in
 *  the last LIVE_FOR_MS (or is about to), else null and the tab shows the list. */
export function liveEventId(evs: { id: string; status: string; startsAt: Date }[], now: number): string | null {
  const on = evs
    .filter((e) => e.status === "live" && now - e.startsAt.getTime() < LIVE_FOR_MS)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return on[0]?.id ?? null;
}

/** Your check-in as the next draw sees it: anyone from the last stage who isn't out is still in,
 *  so they read as "here" without checking in again. */
export function myCheckIn(entries: { playerId: string; state: "going" | "here" | "out" }[], games: Game[], me: string): "going" | "here" | "out" | null {
  const raw = entries.find((e) => e.playerId === me)?.state ?? null;
  return raw !== "out" && drawPool(entries, games).includes(me) ? "here" : raw;
}

/** Where someone is right now at a live event: their group or final in the latest stage and their
 *  place in it, and whether they're on a net now or next. */
export type TodayWhere = { group: string | null; place: number; onNow: boolean; next: boolean };

/** The Players tab's Today table at a live event (it replaced the event page's standings): everyone
 *  in it (the next draw's pool, plus anyone who has played today and since left), best day first
 *  (win %, then points difference per game), those yet to play last. `out` is who has left. */
export function todayTable(v: EventView): { rows: Line[]; out: Set<string>; where: Record<string, TodayWhere> } {
  const ids = new Set([...drawPool(v.entries, v.games), ...v.games.filter(isDone).flatMap((g) => [...g.a, ...g.b].filter((id) => !g.subs.includes(id)))]);
  const latest = Math.max(0, ...v.games.map((g) => g.stageNo));
  const groups = latest ? groupsOf(v, latest) : [];
  const heads = netQueues(v.games, v.event.nets);
  const where: Record<string, TodayWhere> = {};
  for (const id of ids) {
    const g = groups.find((x) => x.table.some((r) => r.id === id));
    where[id] = {
      group: g ? (g.kind === "final" ? `${g.name} final` : `Group ${g.name}`) : null,
      place: g ? g.table.findIndex((r) => r.id === id) + 1 : 0,
      onNow: heads.some((q) => !!q[0] && [...q[0].a, ...q[0].b].includes(id)),
      next: heads.some((q) => !!q[1] && [...q[1].a, ...q[1].b].includes(id)),
    };
  }
  return { rows: rank(tally(v.games, ids).values()), out: new Set(v.entries.filter((e) => e.state === "out").map((e) => e.playerId)), where };
}
