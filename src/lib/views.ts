// Derived views of one event, shared by the server and the event screen. Pure: no database.
import { tally, rank, groupWinner, groupRank, groupMembers, isDone, type Game, type StageKind, type Line } from "@/lib/cards";
import type { EventView } from "@/lib/data";

export type GroupView = { stageNo: number; kind: StageKind; groupNo: number; name: string; net: number; games: Game[]; table: Line[]; winner: string | null; tied: string[]; complete: boolean };

export function groupsOf(v: EventView, stageNo: number): GroupView[] {
  const gs = v.games.filter((g) => g.stageNo === stageNo);
  const nos = [...new Set(gs.map((g) => g.groupNo))].sort((a, b) => a - b);
  return nos.map((groupNo) => {
    const games = gs.filter((g) => g.groupNo === groupNo).sort((a, b) => a.seq - b.seq);
    const live = games.filter((g) => g.status !== "void");
    const table = groupRank(tally(live, groupMembers(games)).values());
    const { winner, tied } = groupWinner(games);
    return { stageNo, kind: games[0].kind, groupNo, name: games[0].groupName, net: games[0].net, games, table, winner, tied, complete: live.every(isDone) };
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

