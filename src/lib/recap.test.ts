import { describe, expect, it } from "vitest";
import { planStage, type StageKind } from "./cards";
import { buildRecap, finishOf, type DayEvent, type DayGame } from "./recap";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const num = (id: string) => Number(id.slice(1));

/** A stage where the side holding the lower-numbered player always wins, `margin` points clear. */
function stage(eventId: string, stageNo: number, kind: StageKind, order: string[], margin = (_: DayGame) => 5): DayGame[] {
  return planStage(kind, order, 2).flatMap((g) =>
    g.games.map((x) => {
      const base: DayGame = { eventId, id: `${eventId}-${stageNo}-${g.groupNo}-${x.seq}`, stageNo, kind, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net, a: x.a, b: x.b, subs: [], scoreA: null, scoreB: null, status: "done" };
      const aWon = Math.min(...x.a.map(num)) < Math.min(...x.b.map(num));
      const m = margin(base);
      return { ...base, scoreA: aWon ? 15 : 15 - m, scoreB: aWon ? 15 - m : 15 };
    }),
  );
}

function day(id: string, startsAt: number, reverse = false): DayEvent {
  const order = reverse ? ids(8).reverse() : ids(8);
  return { id, title: id, startsAt, status: "done", games: [...stage(id, 1, "random", order), ...stage(id, 2, "final", ids(8))] };
}

describe("recap", () => {
  const week1 = day("w1", 1);
  const week2 = day("w2", 2);

  it("names the winner of every final", () => {
    const r = buildRecap(week2, null, [week1, week2]);
    expect(r.winners.map((w) => w.name)).toEqual(["Gold", "Silver"]);
    expect(r.winners[0].winner).toBe("p0");
    expect(r.me).toBeNull();
  });

  it("gives each player their own numbers, finish and partners", () => {
    const r = buildRecap(week2, "p0", [week1, week2]);
    expect(r.me?.line.l).toBe(0);
    expect(r.me?.finish).toMatchObject({ tier: "Gold", position: 1, won: true });
    expect(r.me?.streak).toBe(r.me?.line.w);
    expect(r.me?.bestPartner).not.toBeNull();
    expect(r.me?.toughest).toBeNull(); // never lost
    const bottom = buildRecap(week2, "p7", [week1, week2]).me!;
    expect(bottom.finish?.tier).toBe("Silver");
    expect(bottom.toughest).not.toBeNull();
  });

  it("finds the player's finish in the finals", () => {
    expect(finishOf(week2.games, "p4")).toMatchObject({ tier: "Silver", position: 1, won: true });
    expect(finishOf(week2.games, "nobody")).toBeNull();
  });

  it("compares with the previous weekend and builds a trend", () => {
    const r = buildRecap(week2, "p0", [week2, week1]).me!;
    expect(r.vsLast?.title).toBe("w1");
    expect(r.vsLast?.finishMove).toBe("same");
    expect(r.trend.map((t) => t.title)).toEqual(["w1", "w2"]);
    expect(buildRecap(week1, "p0", [week1, week2]).me!.vsLast).toBeNull(); // nothing before week 1
  });

  it("counts a later weekend's games only from that weekend on", () => {
    const r = buildRecap(week1, "p0", [week1, week2]).me!;
    expect(r.trend.map((t) => t.title)).toEqual(["w1"]);
  });

  it("picks the day's biggest win and longest deuce", () => {
    const ev = day("w3", 3);
    ev.games[0] = { ...ev.games[0], scoreA: 15, scoreB: 2 };
    ev.games[1] = { ...ev.games[1], scoreA: 19, scoreB: 17 };
    const r = buildRecap(ev, null, [ev]);
    expect(r.moments.biggestWin?.score).toEqual([15, 2]);
    expect(r.moments.longestGame?.score).toEqual([19, 17]);
  });

  it("leaves decider games out of everyone's numbers", () => {
    const ev = day("w4", 4);
    const d = { ...ev.games[0], id: "dec", seq: 99, decider: true };
    const withDecider = { ...ev, games: [...ev.games, d] };
    expect(buildRecap(withDecider, "p0", [withDecider]).me!.line).toEqual(buildRecap(ev, "p0", [ev]).me!.line);
  });
});
