// Derived views of one event, shared by the server and the event screen. Pure: no database.
import { tally, rank, groupWinner, groupRank, groupMembers, isDone, netQueues, type Game, type StageKind, type Line } from "@/lib/cards";
import type { EventView } from "@/lib/data";

export type GroupView = { stageNo: number; kind: StageKind; groupNo: number; name: string; net: number; games: Game[]; table: Line[]; winner: string | null; tied: string[]; decider: "none" | "playing" | "decided" | "level"; complete: boolean };

export function groupsOf(v: EventView, stageNo: number): GroupView[] {
  const gs = v.games.filter((g) => g.stageNo === stageNo);
  const nos = [...new Set(gs.map((g) => g.groupNo))].sort((a, b) => a - b);
  return nos.map((groupNo) => {
    const games = gs.filter((g) => g.groupNo === groupNo).sort((a, b) => a.seq - b.seq);
    const live = games.filter((g) => g.status !== "void");
    const table = groupRank(tally(live, groupMembers(games)).values());
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
