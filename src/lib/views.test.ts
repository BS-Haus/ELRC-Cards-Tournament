import { describe, expect, it } from "vitest";
import { planStage, type Game } from "./cards";
import { myDay } from "./views";

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
