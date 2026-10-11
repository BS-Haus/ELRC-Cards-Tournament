import { describe, expect, it } from "vitest";
import { splitSizes, groupGames, planStage, tally, rank, groupWinner, netQueues, needsSub, withSub, validScore, winnerScore, groupMembers, groupRank, drawPool, seedOrder, decideTie, type Game } from "./cards";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const pairKey = (x: string, y: string) => [x, y].sort().join("+");

function asGames(groups: ReturnType<typeof planStage>, stageNo = 1): Game[] {
  return groups.flatMap((g) => g.games.map((x) => ({ id: `${stageNo}-${g.groupNo}-${x.seq}`, stageNo, kind: "random" as const, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net, a: x.a, b: x.b, subs: [], scoreA: null, scoreB: null, status: "todo" as const })));
}

describe("splitSizes", () => {
  it("makes groups of 4 and 5", () => {
    expect(splitSizes(8)).toEqual([4, 4]);
    expect(splitSizes(9)).toEqual([5, 4]);
    expect(splitSizes(10)).toEqual([5, 5]);
    expect(splitSizes(12)).toEqual([4, 4, 4]);
    expect(splitSizes(13)).toEqual([5, 4, 4]);
    expect(splitSizes(3)).toEqual([]);
  });
  it("keeps everyone", () => {
    for (let n = 4; n <= 30; n++) expect(splitSizes(n).reduce((a, b) => a + b, 0)).toBe(n);
  });
});

describe("groupGames", () => {
  for (const k of [4, 5, 6, 7]) {
    it(`a group of ${k} never repeats a partner and spreads games evenly`, () => {
      const games = groupGames(ids(k));
      const partners = new Map<string, number>(), played = new Map<string, number>();
      for (const g of games) {
        for (const t of [g.a, g.b]) partners.set(pairKey(t[0], t[1]), (partners.get(pairKey(t[0], t[1])) ?? 0) + 1);
        for (const id of [...g.a, ...g.b]) played.set(id, (played.get(id) ?? 0) + 1);
        expect(new Set([...g.a, ...g.b]).size).toBe(4);
      }
      expect(Math.max(...partners.values())).toBe(1);
      const counts = [...played.values()];
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      if (k <= 5) expect(partners.size).toBe((k * (k - 1)) / 2); // every pairing once
    });
  }
});

describe("planStage", () => {
  it("puts the top of the order in group A / Gold and gives each group its own net", () => {
    const order = ids(10);
    const g = planStage("final", order, 2);
    expect(g.map((x) => x.name)).toEqual(["Gold", "Silver"]);
    expect(g[0].ids).toEqual(order.slice(0, 5));
    expect(g.map((x) => x.net)).toEqual([1, 2]);
  });
  it("shares nets when there are more groups than nets", () => {
    const g = planStage("random", ids(12), 2);
    expect(g.map((x) => x.net)).toEqual([1, 2, 1]);
    const q = netQueues(asGames(g), 2);
    expect(q[0].map((x) => x.groupName)).toEqual(["A", "C", "A", "C", "A", "C"]);
  });
});

describe("tally and ranking", () => {
  it("counts wins and points, but never for a sub", () => {
    const g: Game = { id: "x", stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: 0, net: 1, a: ["p0", "p9"], b: ["p2", "p3"], subs: ["p9"], scoreA: 15, scoreB: 10, status: "done" };
    const t = tally([g]);
    expect(t.get("p0")).toMatchObject({ gp: 1, w: 1, pf: 15, pa: 10 });
    expect(t.get("p9")).toBeUndefined();
    expect(t.get("p2")).toMatchObject({ gp: 1, l: 1 });
  });
  it("ranks by win %, then difference per game, players with no games last", () => {
    const r = rank([
      { id: "a", gp: 2, w: 1, l: 1, pf: 30, pa: 20 },
      { id: "b", gp: 3, w: 3, l: 0, pf: 45, pa: 30 },
      { id: "c", gp: 0, w: 0, l: 0, pf: 0, pa: 0 },
      { id: "d", gp: 2, w: 1, l: 1, pf: 30, pa: 29 },
    ]);
    expect(r.map((x) => x.id)).toEqual(["b", "a", "d", "c"]);
  });
  it("finds a group winner, or reports a tie", () => {
    const base = asGames(planStage("random", ids(4), 1));
    const done = base.map((g) => ({ ...g, status: "done" as const, scoreA: g.a.includes("p0") ? 15 : 10, scoreB: g.a.includes("p0") ? 10 : 15 }));
    expect(groupWinner(done).winner).toBe("p0");
    expect(groupWinner(base).winner).toBeNull();
  });
});

describe("dropouts and subs", () => {
  it("flags games with someone who left, and a sub's game doesn't count for them", () => {
    const [g] = asGames(planStage("random", ids(4), 1));
    expect(needsSub(g, new Set([g.a[0]]))).toEqual([g.a[0]]);
    const s = withSub(g, g.a[0], "late");
    expect(s.a).toContain("late");
    expect(s.subs).toEqual(["late"]);
    expect(groupMembers([{ ...g, ...s }])).not.toContain("late");
  });
});

describe("scores", () => {
  it("validates and works out winning scores", () => {
    expect(validScore(15, 13)).toBe(true);
    expect(validScore(15, 15)).toBe(false);
    expect(validScore(-1, 3)).toBe(false);
    expect(winnerScore(9, 15)).toBe(15);
    expect(winnerScore(14, 15)).toBe(16);
  });
});

describe("drawPool", () => {
  const stage1 = asGames(planStage("random", ids(8), 2));
  it("is just who's checked in before anything is drawn", () => {
    const e = [{ playerId: "p0", state: "here" }, { playerId: "p1", state: "going" }, { playerId: "p2", state: "here" }];
    expect(drawPool(e, [])).toEqual(["p0", "p2"]);
  });
  it("keeps everyone from the last stage in, even if they're no longer marked here", () => {
    // The live bug: the stage-1 players had been flipped back to "going" (signed up), and the next
    // stage refused to draw with "check in at least 4 players".
    const e = ids(8).map((playerId) => ({ playerId, state: "going" }));
    expect(drawPool(e, stage1).sort()).toEqual(ids(8).sort());
  });
  it("adds late arrivals who are checked in, and drops anyone marked out", () => {
    const e = [...ids(8).map((playerId) => ({ playerId, state: playerId === "p3" ? "out" : "here" })), { playerId: "late", state: "here" }];
    const pool = drawPool(e, stage1);
    expect(pool).toContain("late");
    expect(pool).not.toContain("p3");
    expect(pool).toHaveLength(8);
    expect(new Set(pool).size).toBe(pool.length);
  });
  it("carries a sub who's on the list, even if a mis-tap left them as Coming", () => {
    const [g, ...rest] = stage1;
    const subbed = { ...g, ...withSub(g, g.a[0], "late") };
    const e = [{ playerId: g.a[0], state: "out" }, { playerId: "late", state: "going" }];
    expect(drawPool(e, [subbed, ...rest])).toContain("late");
  });
  it("doesn't carry over someone who only ever subbed", () => {
    const [g, ...rest] = stage1;
    const subbed = { ...g, ...withSub(g, g.a[0], "sub") };
    const e = [{ playerId: g.a[0], state: "out" }];
    expect(drawPool(e, [subbed, ...rest])).not.toContain("sub");
  });
  it("only carries the latest stage, so someone who left after stage 1 isn't redrawn", () => {
    const stage2 = asGames(planStage("seeded", ids(4), 1), 2);
    expect(drawPool([], [...stage1, ...stage2]).sort()).toEqual(ids(4).sort());
  });
});

describe("seedOrder", () => {
  // p0 beats everyone; otherwise the side with the lower-numbered player wins.
  const score = (gs: Game[]) => gs.map((g) => {
    const best = (t: string[]) => Math.min(...t.map((x) => Number(x.slice(1))));
    const aWon = best(g.a) < best(g.b);
    return { ...g, status: "done" as const, scoreA: aWon ? 15 : 10, scoreB: aWon ? 10 : 15 };
  });

  it("puts a late arrival at the bottom of the finals, but mid-table for a seeded stage", () => {
    const g = score(asGames(planStage("random", ids(8), 2)));
    const pool = [...ids(8), "late"];
    expect(seedOrder(g, pool, "final").at(-1)).toBe("late");
    expect(seedOrder(g, pool, "seeded").indexOf("late")).toBe(4);
  });

  it("after a seeded stage, ranks by group finish, so the weaker group's winner can't jump into Gold", () => {
    // Stage 2, seeded: group A = p0..p3 (the strong four), group B = p4..p7.
    const stage2 = score(asGames(planStage("seeded", ids(8), 2), 2)).map((g) => ({ ...g, kind: "seeded" as const }));
    // Group B's winner went unbeaten, so on win % alone they'd top the table.
    const order = seedOrder(stage2, ids(8), "final");
    const groupA = new Set(stage2.filter((g) => g.groupNo === 0).flatMap((g) => [...g.a, ...g.b]));
    expect(order.slice(0, 4).every((id) => groupA.has(id))).toBe(true);
    expect(order).toHaveLength(8);
  });

  it("only seeds people in the pool, each exactly once", () => {
    const g = score(asGames(planStage("random", ids(8), 2)));
    const order = seedOrder(g, ["p1", "p5", "p6", "p7", "x"], "final");
    expect([...order].sort()).toEqual(["p1", "p5", "p6", "p7", "x"]);
  });
});

describe("decider", () => {
  // A group of 4 where p0, p1 and p3 all go 2–1, +5: the top two are level.
  const base = asGames(planStage("random", ids(4), 1));
  const wins = (g: Game, side: "a" | "b") => ({ ...g, status: "done" as const, scoreA: side === "a" ? 15 : 10, scoreB: side === "a" ? 10 : 15 });
  // Games: (p0,p1 v p2,p3), (p0,p2 v p1,p3), (p0,p3 v p1,p2). p0+p1 win, then p1+p3 win, then p0+p3 win.
  const tiedGroup = [wins(base[0], "a"), wins(base[1], "b"), wins(base[2], "a")];
  const d = (x: Game, i: number, plan: { a: [string, string]; b: [string, string] }, sa: number, sb: number): Game =>
    ({ ...x, id: `d${i}`, seq: 4 + i, a: plan.a, b: plan.b, decider: true, status: "done", scoreA: sa, scoreB: sb });

  it("reports the tie, then pairs the tied two against each other with swapped partners", () => {
    const w = groupWinner(tiedGroup);
    expect(w.winner).toBeNull();
    expect(w.tied).toHaveLength(2);
    const table = groupRank(tally(tiedGroup, ids(4)).values());
    const plan = decideTie(table, [w.tied[0], w.tied[1]]);
    expect(plan).toHaveLength(2);
    const [x, y] = w.tied;
    // Opposite sides in both games, and each partners each of the other two exactly once.
    for (const g of plan) expect(g.a.includes(x) && g.b.includes(y)).toBe(true);
    expect(new Set([plan[0].a[1], plan[1].a[1]]).size).toBe(2);
    expect(plan[0].a[1]).toBe(plan[1].b[1]);
  });

  it("decides on total points across both games, and never changes anyone's record", () => {
    const w = groupWinner(tiedGroup);
    const table = groupRank(tally(tiedGroup, ids(4)).values());
    const plan = decideTie(table, [w.tied[0], w.tied[1]]);
    const games = [...tiedGroup, d(base[0], 0, plan[0], 11, 9), d(base[0], 1, plan[1], 8, 11)];
    const r = groupWinner(games);
    expect(r.decider).toBe("decided");
    expect(r.winner).toBe(w.tied[1]); // y: 9 + 11 = 20 beats x: 11 + 8 = 19
    expect(tally(games).get("p0")).toEqual(tally(tiedGroup).get("p0"));
  });

  it("is playing until both games have scores, and level if the points tie", () => {
    const w = groupWinner(tiedGroup);
    const table = groupRank(tally(tiedGroup, ids(4)).values());
    const plan = decideTie(table, [w.tied[0], w.tied[1]]);
    const one = d(base[0], 0, plan[0], 11, 9);
    expect(groupWinner([...tiedGroup, one, { ...d(base[0], 1, plan[1], 0, 0), status: "todo", scoreA: null, scoreB: null }]).decider).toBe("playing");
    expect(groupWinner([...tiedGroup, one, d(base[0], 1, plan[1], 9, 11)]).decider).toBe("level");
  });
});
