import { describe, expect, it } from "vitest";
import { planStage, type Game } from "./cards";
import { myDay, liveEventId, LIVE_FOR_MS, todayTable } from "./views";
import type { EventView } from "./data";

const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
const plan = planStage("random", ids, 2, () => 0.5);
const games: Game[] = plan.flatMap((g) => g.games.map((x) => ({ id: `${g.groupNo}-${x.seq}`, stageNo: 1, kind: "random" as const, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net, a: x.a, b: x.b, subs: [], scoreA: null, scoreB: null, status: "todo" as const })));
const score = (gs: Game[], id: string, a: number, b: number) => gs.map((g) => (g.id === id ? { ...g, status: "done" as const, scoreA: a, scoreB: b } : g));

describe("myDay", () => {
  const me = plan[0].ids[0];
  const myGames = games.filter((g) => [...g.a, ...g.b].includes(me));

  it("lists what's coming in the order the net will reach it, the first one on now", () => {
    const d = myDay(games, 2, me);
    expect(d.played).toEqual([]);
    expect(d.next.map((x) => x.game.id)).toEqual([...myGames].sort((x, y) => x.ord - y.ord).map((g) => g.id));
    expect(d.next.every((x) => x.net === plan[0].net)).toBe(true);
    expect(d.next.map((x) => x.ahead)).toEqual([...d.next.map((x) => x.ahead)].sort((x, y) => x - y));
  });

  it("reads a played game from your side: your score first, your partner, and the result", () => {
    const g = myGames[0];
    const onA = g.a.includes(me);
    const d = myDay(score(games, g.id, 15, 9), 2, me);
    expect(d.played).toHaveLength(1);
    expect(d.played[0].score).toEqual(onA ? [15, 9] : [9, 15]);
    expect(d.played[0].won).toBe(onA);
    expect(d.played[0].partner).toBe((onA ? g.a : g.b).find((id) => id !== me));
    expect(d.line).toMatchObject({ gp: 1, w: onA ? 1 : 0 });
    expect(d.next.map((x) => x.game.id)).not.toContain(g.id);
  });

  it("shows a game you subbed into but doesn't count it for you", () => {
    const g = myGames[0];
    const d = myDay(score(games.map((x) => (x.id === g.id ? { ...x, subs: [me] } : x)), g.id, 15, 3), 2, me);
    expect(d.played[0].sub).toBe(true);
    expect(d.line.gp).toBe(0);
  });
});

describe("liveEventId", () => {
  const now = Date.UTC(2026, 9, 17, 14);
  const ev = (id: string, status: string, hoursAgo: number) => ({ id, status, startsAt: new Date(now - hoursAgo * 3600_000) });

  it("opens the live event, the latest if there are two", () => {
    expect(liveEventId([ev("old", "live", 5), ev("new", "live", 3), ev("next", "upcoming", -48)], now)).toBe("new");
  });

  it("shows the list when nothing is live, or the only live one was left running", () => {
    expect(liveEventId([ev("up", "upcoming", -2), ev("done", "done", 4)], now)).toBeNull();
    expect(liveEventId([ev("forgotten", "live", LIVE_FOR_MS / 3600_000 + 1)], now)).toBeNull();
  });
});

describe("todayTable", () => {
  const g = games[0];
  const [winner] = g.a;
  const absent = ids.find((id) => ![...g.a, ...g.b].includes(id))!;
  const left = new Set([winner, absent]); // one played and then left, one left without playing
  const v = { event: { nets: 2 }, stages: [{ no: 1 }], entries: ids.map((id) => ({ playerId: id, state: left.has(id) ? "out" : "here", at: 0 })), games: score(games, g.id, 15, 4) } as unknown as EventView;
  const t = todayTable(v);

  it("puts the day's winners first and those yet to play last", () => {
    expect(t.rows.slice(0, 2).map((r) => r.id).sort()).toEqual([...g.a].sort());
    expect(t.rows.slice(-3).every((r) => r.gp === 0)).toBe(true);
  });

  it("keeps someone who played and then left, but not someone who left without playing", () => {
    expect(t.rows.map((r) => r.id)).toContain(winner);
    expect(t.rows.map((r) => r.id)).not.toContain(absent);
    expect(t.out.has(winner)).toBe(true);
  });

  it("says which group each player is in, their place, and who's on a net now", () => {
    expect(t.where[g.a[0]]).toMatchObject({ group: `Group ${g.groupName}`, place: 1 });
    const onNow = games.filter((x) => x.id !== g.id).sort((x, y) => x.ord - y.ord).find((x) => x.net === g.net)!;
    expect([...onNow.a, ...onNow.b].every((id) => !t.where[id] || t.where[id].onNow)).toBe(true);
  });
});

