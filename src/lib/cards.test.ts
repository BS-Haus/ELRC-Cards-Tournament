import { describe, expect, it } from "vitest";
import { finalsCut, mixedOrder, splitSizes, groupGames, planStage, tally, rank, groupWinner, netQueues, needsSub, withSub, validScore, winnerScore, groupMembers, groupRank, drawPool, seedOrder, spreadRepeats, dayPoints, bracketOrder, decideTie, headToHead, finalName, finalLabel, finalWinTitle, isFinalScore, placementOrder, currentMembers, remainingGames, type Game } from "./cards";

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
  it("puts the top of the order in group A / the A final and gives each group its own net", () => {
    const order = ids(10);
    const g = planStage("final", order, 2);
    expect(g.map((x) => x.name)).toEqual(["A", "B"]);
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

  it("after a seeded stage, ranks by group finish, so the weaker group's winner can't jump into the A final", () => {
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

describe("ties and the decider", () => {
  const mk = (seq: number, a: [string, string], b: [string, string], sa: number, sb: number): Game =>
    ({ id: `g${seq}`, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq, ord: seq, net: 1, a, b, subs: [], scoreA: sa, scoreB: sb, status: "done" });
  // p0 and p1 both 2–1, +6, 40 points scored, and 1–1 against each other; p2 and p3 behind.
  const twoWay = [mk(1, ["p0", "p1"], ["p2", "p3"], 15, 9), mk(2, ["p0", "p2"], ["p1", "p3"], 15, 10), mk(3, ["p0", "p3"], ["p1", "p2"], 10, 15)];
  // Every game 15–10: p0, p1 and p2 all 2–1, +5, 40 scored.
  const threeWay = [mk(1, ["p0", "p1"], ["p2", "p3"], 15, 10), mk(2, ["p0", "p2"], ["p1", "p3"], 15, 10), mk(3, ["p0", "p3"], ["p1", "p2"], 10, 15)];
  const line = (id: string, w: number, pf: number, pa: number) => ({ id, gp: 3, w, l: 3 - w, pf, pa });

  it("ranks on wins, then points difference, then points scored", () => {
    expect(groupRank([line("x", 2, 40, 35), line("y", 2, 42, 37)]).map((r) => r.id)).toEqual(["y", "x"]);
    expect(groupRank([line("x", 2, 40, 33), line("y", 2, 42, 37)]).map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("then on head to head: who won more of their games against each other", () => {
    const g = [mk(1, ["x", "a"], ["y", "b"], 15, 10), mk(2, ["x", "b"], ["y", "a"], 15, 12), mk(3, ["x", "y"], ["a", "b"], 15, 3)];
    expect(headToHead(g, "x", "y")).toBe(1);
    expect(headToHead(g, "y", "x")).toBe(-1);
    expect(headToHead(twoWay, "p0", "p1")).toBe(0);
    expect(groupRank([line("y", 2, 40, 35), line("x", 2, 40, 35)], g).map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("goes to a one-game decider when two are still level, tied two on opposite sides", () => {
    const w = groupWinner(twoWay);
    expect(w.winner).toBeNull();
    expect([...w.tied].sort()).toEqual(["p0", "p1"]);
    const plan = decideTie(groupRank(tally(twoWay, ids(4)).values(), twoWay), [w.tied[0], w.tied[1]], () => 0.2);
    expect(plan).toHaveLength(1);
    expect(plan[0].a.includes(w.tied[0]) && plan[0].b.includes(w.tied[1])).toBe(true);
    expect([plan[0].a[1], plan[0].b[1]].sort()).toEqual(["p2", "p3"]);
  });

  it("gives the group to whoever's side wins the decider, and never changes anyone's record", () => {
    const w = groupWinner(twoWay);
    const [plan] = decideTie(groupRank(tally(twoWay, ids(4)).values(), twoWay), [w.tied[0], w.tied[1]], () => 0.7);
    const decider = { ...mk(4, plan.a, plan.b, 9, 11), decider: true };
    const r = groupWinner([...twoWay, decider]);
    expect(r).toMatchObject({ decider: "decided", winner: w.tied[1] });
    expect(tally([...twoWay, decider]).get("p2")).toEqual(tally(twoWay).get("p2"));
    expect(groupWinner([...twoWay, { ...decider, status: "todo" as const, scoreA: null, scoreB: null }]).decider).toBe("playing");
  });

  it("shows three or more level as a tie with no decider, rather than leaving one of them out", () => {
    const w = groupWinner(threeWay);
    expect(w.winner).toBeNull();
    expect([...w.tied].sort()).toEqual(["p0", "p1", "p2"]);
  });
});

describe("final names", () => {
  it("reads finals stored under the old metal names as letters, so they never clash with the ranks", () => {
    expect(["Gold", "Silver", "Bronze", "Copper", "A", "B"].map(finalName)).toEqual(["A", "B", "C", "D", "A", "B"]);
    expect(finalWinTitle("A")).toBe("Champion");
    expect(finalWinTitle("B")).toBe("Silver final winner");
    expect(["A", "B", "C", "D", "Gold"].map(finalLabel)).toEqual(["Gold", "Silver", "Bronze", "Copper", "Gold"]);
  });
});

describe("isFinalScore", () => {
  it("takes a win on the target, or two clear in a deuce", () => {
    expect([[15, 9], [9, 15], [15, 13], [17, 15], [22, 20]].every(([a, b]) => isFinalScore(a, b, 15))).toBe(true);
  });
  it("refuses short, level, one-point and overshot scores", () => {
    expect([[14, 9], [15, 15], [15, 14], [16, 9], [18, 15], [1, 0]].some(([a, b]) => isFinalScore(a, b, 15))).toBe(false);
  });
});

describe("placementOrder and finals seeding after uneven groups", () => {
  // Group A has 5 (4 games each), group B has 4 (3 games each).
  const five = ["a1", "a2", "a3", "a4", "a5"], four = ["b1", "b2", "b3", "b4"];
  const mk = (groupNo: number, ids: string[], best: string): Game[] =>
    groupGames(ids).map((x, i) => ({
      id: `${groupNo}-${i}`, stageNo: 1, kind: "random" as const, groupNo, groupName: "AB"[groupNo], seq: i + 1, ord: i, net: groupNo + 1,
      a: x.a, b: x.b, subs: [], status: "done" as const,
      // `best` wins every game by 15–5; everything else is 15–13 to side a.
      scoreA: x.a.includes(best) ? 15 : x.b.includes(best) ? 5 : 15, scoreB: x.a.includes(best) ? 5 : x.b.includes(best) ? 15 : 13,
    }));
  const games = [...mk(0, five, "a1"), ...mk(1, four, "b1")];

  it("puts every group winner ahead of every runner-up, whatever the group size", () => {
    const order = placementOrder(games);
    expect(order.slice(0, 2).sort()).toEqual(["a1", "b1"]);
    expect(order).toHaveLength(9);
    expect(order.at(-1)).toMatch(/^a/); // only group A has a 5th place
  });

  it("seeds the finals by placement after a random stage", () => {
    const order = seedOrder(games, [...five, ...four], "final");
    expect(order.slice(0, 2).sort()).toEqual(["a1", "b1"]);
  });
});

describe("currentMembers and remainingGames", () => {
  it("adds a late player to a group of 4 so everyone ends up with a fair number of games", () => {
    const four = ["p0", "p1", "p2", "p3"];
    const played: Game[] = groupGames(four).slice(0, 1).map((x, i) => ({
      id: `g${i}`, stageNo: 1, kind: "random" as const, groupNo: 0, groupName: "A", seq: 1, ord: 0, net: 1,
      a: x.a, b: x.b, subs: [], status: "done" as const, scoreA: 15, scoreB: 10,
    }));
    const members = [...four, "late"];
    const rest = remainingGames(members, played);
    const all = [...played.map((g) => ({ a: g.a, b: g.b })), ...rest];
    const count = (id: string) => all.filter((g) => [...g.a, ...g.b].includes(id)).length;
    expect(count("late")).toBeGreaterThanOrEqual(3);
    for (const id of four) expect(count(id)).toBeGreaterThanOrEqual(3);
    const pairs = new Map<string, number>();
    for (const g of all) for (const t of [g.a, g.b]) { const k = [...t].sort().join("+"); pairs.set(k, (pairs.get(k) ?? 0) + 1); }
    expect(Math.max(...pairs.values())).toBe(1);
  });

  it("plans nothing for a group too small to play", () => {
    expect(remainingGames(["x", "y", "z"], [])).toEqual([]);
  });

  it("reads members from games still to play", () => {
    const g = (status: "todo" | "done", a: [string, string], b: [string, string]): Game => ({ id: a.join(), stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: 0, net: 1, a, b, subs: [], status, scoreA: status === "done" ? 15 : null, scoreB: status === "done" ? 9 : null });
    const stage = [g("done", ["old", "p1"], ["p2", "p3"]), g("todo", ["new", "p1"], ["p2", "p3"]), { ...g("todo", ["old", "q1"], ["q2", "q3"]), id: "other", groupNo: 1, ord: 1 }];
    expect(currentMembers(stage, 0).sort()).toEqual(["new", "p1", "p2", "p3"]);
    expect(currentMembers(stage, 1)).toContain("old");
  });
});

describe("placementOrder after a mid-stage move", () => {
  it("places a moved player once, in the group they ended up in", () => {
    const G = (id: string, groupNo: number, status: "todo" | "done", a: [string, string], b: [string, string]): Game => ({ id, stageNo: 1, kind: "random", groupNo, groupName: "AB"[groupNo], seq: 1, ord: 0, net: groupNo + 1, a, b, subs: [], status, scoreA: status === "done" ? 15 : null, scoreB: status === "done" ? 10 : null });
    const games = [
      G("1", 0, "done", ["mover", "a1"], ["a2", "a3"]), // mover played one game in A, then moved to B
      G("2", 0, "todo", ["a4", "a1"], ["a2", "a3"]),
      G("3", 1, "done", ["b1", "b2"], ["b3", "b4"]),
      G("4", 1, "todo", ["mover", "b1"], ["b2", "b3"]),
    ];
    const order = placementOrder(games);
    expect(order.filter((id) => id === "mover")).toHaveLength(1);
    expect(order).not.toContain("a4"); // hasn't played yet: no record to place
    // Once everything's played, the mover still belongs to group B (their latest game).
    const finished = games.map((g) => ({ ...g, status: "done" as const, scoreA: 15, scoreB: 10, ord: g.id === "4" ? 9 : g.ord }));
    expect(currentMembers(finished, 1)).toContain("mover");
    expect(currentMembers(finished, 0)).not.toContain("mover");
  });
});

describe("finalsCut", () => {
  it("two groups of 5: top 2 of each, plus the best 3rd, make the A final of 5", () => {
    expect(finalsCut(10, 2)).toEqual({ sure: 2, extra: 1, aSize: 5 });
  });
  it("two groups of 4: the top 2 of each, exactly", () => {
    expect(finalsCut(8, 2)).toEqual({ sure: 2, extra: 0, aSize: 4 });
  });
  it("three groups of 4: each winner, plus the best runner-up", () => {
    expect(finalsCut(12, 3)).toEqual({ sure: 1, extra: 1, aSize: 4 });
  });
  it("too few for two finals: no line", () => {
    expect(finalsCut(7, 1)).toBeNull();
  });
});

describe("mixedOrder (levels spread across the groups)", () => {
  const rating = (id: string) => 1000 - Number(id.slice(1)) * 10; // p0 strongest
  const seeded = (n: number) => { let s = n; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const groupsOf = (order: string[]) => { const sizes = splitSizes(order.length); let at = 0; return sizes.map((k) => order.slice(at, (at += k))); };

  it("gives every group one player from each level band", () => {
    const groups = groupsOf(mixedOrder(ids(16), rating, seeded(3)));
    expect(groups).toHaveLength(4);
    for (let band = 0; band < 4; band++) {
      const inBand = ids(16).slice(band * 4, band * 4 + 4);
      for (const g of groups) expect(g.filter((id) => inBand.includes(id))).toHaveLength(1);
    }
  });

  it("handles uneven groups and keeps everyone in exactly once", () => {
    const order = mixedOrder(ids(9), rating, seeded(5));
    expect([...order].sort()).toEqual([...ids(9)].sort());
    const groups = groupsOf(order);
    // The two strongest are never in the same group.
    expect(groups.some((g) => g.includes("p0") && g.includes("p1"))).toBe(false);
  });

  it("draws different groups each time", () => {
    const a = groupsOf(mixedOrder(ids(12), rating, seeded(1))).map((g) => [...g].sort().join());
    const b = groupsOf(mixedOrder(ids(12), rating, seeded(99))).map((g) => [...g].sort().join());
    expect(a).not.toEqual(b);
  });
});

describe("a day of three rounds: mixed, by level, then finals (12 players, 3 nets)", () => {
  // The lower-numbered player is the stronger; the side with the stronger total wins, by more the
  // bigger the gap. Ratings for the mixed draw follow the same order.
  const skill = (id: string) => 12 - Number(id.slice(1));
  const play = (gs: Game[]) => gs.map((g) => {
    const d = g.a.reduce((n, x) => n + skill(x), 0) - g.b.reduce((n, x) => n + skill(x), 0);
    const lose = Math.max(0, 13 - Math.abs(d));
    return { ...g, status: "done" as const, scoreA: d >= 0 ? 15 : lose, scoreB: d >= 0 ? lose : 15 };
  });
  const stageOf = (groups: ReturnType<typeof planStage>, no: number, kind: "random" | "seeded" | "final") => asGames(groups, no).map((g) => ({ ...g, kind }));
  const all = ids(12);
  const r1 = play(stageOf(planStage("random", mixedOrder(all, skill, () => 0.3), 3), 1, "random"));
  const members = (gs: Game[]) => [...new Set(gs.map((g) => g.groupNo))].map((no) => groupMembers(gs.filter((g) => g.groupNo === no)));
  const sharedR1 = (a: string, b: string) => members(r1).some((m) => m.includes(a) && m.includes(b));
  const repeats = (m: string[]) => m.reduce((n, x, i) => n + m.slice(i + 1).filter((y) => sharedR1(x, y)).length, 0);

  const r2order = spreadRepeats(seedOrder(r1, all, "seeded"), r1, "seeded");
  const r2 = play(stageOf(planStage("seeded", r2order, 3), 2, "seeded"));
  const day = [...r1, ...r2];

  it("round 1 gives every net two from the top half and two from the bottom", () => {
    for (const m of members(r1)) expect(m.filter((id) => skill(id) > 6)).toHaveLength(2);
  });

  it("round 2 goes by level (the round 1 winners together) and repeats as few round 1 group-mates as it can", () => {
    const winners = members(r1).map((m) => groupRank(tally(r1, m).values(), r1)[0].id);
    const [a] = members(r2);
    expect(winners.every((w) => a.includes(w))).toBe(true);
    // Four players from three round 1 groups: one pair per group has to have met before, no more.
    for (const m of members(r2)) expect(repeats(m)).toBe(1);
  });

  it("the finals seed on both rounds together, and never replay a round 2 group", () => {
    const seeded = seedOrder(day, all, "final");
    expect(seeded).toEqual(rank(tally(day).values()).map((r) => r.id));
    const finals = spreadRepeats(seeded, day, "final");
    const fs = [finals.slice(0, 4), finals.slice(4, 8), finals.slice(8)];
    for (const f of fs) expect(members(r2).some((m) => f.every((id) => m.includes(id)))).toBe(false);
    expect([...finals].sort()).toEqual([...all].sort());
  });

  it("moves people only as far as it must: an A final that would replay round 2's group A swaps just its boundary", () => {
    const groupA = members(r2)[0].sort((x, y) => skill(y) - skill(x));
    const order = [...groupA, ...all.filter((id) => !groupA.includes(id))];
    const out = spreadRepeats(order, day, "final");
    expect(out.slice(0, 4).filter((id) => groupA.includes(id))).toHaveLength(3);
    expect(out.slice(0, 3)).toEqual(groupA.slice(0, 3));
  });

  it("leaves a draw alone when nothing repeats, and a single group alone", () => {
    expect(spreadRepeats(all, [], "seeded")).toEqual(all);
    expect(spreadRepeats(ids(5), r1, "seeded")).toEqual(ids(5));
  });
});

describe("a second mixed round: the same spread of levels, new faces", () => {
  const skill = (id: string) => 100 - Number(id.slice(1));
  const play = (gs: Game[]) => gs.map((g) => ({ ...g, status: "done" as const, scoreA: 15, scoreB: 9 }));
  const members = (gs: Game[]) => [...new Set(gs.map((g) => g.groupNo))].map((no) => groupMembers(gs.filter((g) => g.groupNo === no)));
  const roundsOf = (n: number, seed: number) => {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const all = ids(n);
    const r1 = play(asGames(planStage("random", mixedOrder(all, skill, rnd), 4), 1));
    const r2 = asGames(planStage("random", mixedOrder(all, skill, rnd, r1), 4), 2);
    const shared = (a: string, b: string) => members(r1).some((m) => m.includes(a) && m.includes(b));
    const repeats = (m: string[]) => m.reduce((k, x, i) => k + m.slice(i + 1).filter((y) => shared(x, y)).length, 0);
    return { r1, r2, repeats };
  };

  it("12 players on 3 nets: still two from the top half and two from the bottom, and only the one familiar pair a group of 4 can't avoid", () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const { r2, repeats } = roundsOf(12, seed);
      for (const m of members(r2)) {
        expect(m.filter((id) => Number(id.slice(1)) < 6)).toHaveLength(2);
        expect(repeats(m)).toBe(1);
      }
    }
  });

  it("16 players on 4 nets: nobody shares a group with anyone from round 1", () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const { r2, repeats } = roundsOf(16, seed);
      for (const m of members(r2)) expect(repeats(m)).toBe(0);
    }
  });

  it("the finals after two mixed rounds are the best records across both", () => {
    const { r1, r2 } = roundsOf(12, 5);
    const day = [...r1, ...play(r2)];
    expect(seedOrder(day, ids(12), "final")).toEqual(rank(tally(day).values()).map((r) => r.id));
  });
});

describe("the day's points (rating ± today) decide the finals", () => {
  const r1 = asGames(planStage("random", ids(8), 2), 1).map((g) => ({ ...g, status: "done" as const, scoreA: 15, scoreB: 10 }));
  const fin = asGames(planStage("final", ids(8), 2), 2).map((g) => ({ ...g, kind: "final" as const, status: "done" as const, scoreA: 15, scoreB: 3 }));
  // Everyone in a game gets +/-; p7 gets the most from every game they're in, p0 the least.
  const delta = Object.fromEntries([...r1, ...fin].map((g) => [g.id, Object.fromEntries([...g.a, ...g.b].map((id) => [id, Number(id.slice(1)) - 3]))]));

  it("adds up each player's ± over today's rounds, leaving the finals out, or one round only", () => {
    const pts = dayPoints([...r1, ...fin], delta);
    const p7games = r1.filter((g) => [...g.a, ...g.b].includes("p7")).length;
    expect(pts.get("p7")).toBe(4 * p7games);
    expect(dayPoints([...r1, ...fin], delta, 2).size).toBe(0);
  });

  it("seeds the finals best points first, whatever the wins say", () => {
    const pts = dayPoints(r1, delta);
    const order = seedOrder(r1, ids(8), "final", pts);
    expect(order).toEqual([...ids(8)].sort((x, y) => pts.get(y)! - pts.get(x)! || 0).slice(0, 8));
    expect(order[0]).toBe("p7");
    expect(order.at(-1)).toBe("p0");
  });

  it("level on points: more wins first, then points difference", () => {
    const flat = new Map(ids(8).map((id) => [id, 0]));
    const order = seedOrder(r1, ids(8), "final", flat);
    const t = tally(r1);
    for (let i = 1; i < order.length; i++) expect(t.get(order[i - 1])!.w).toBeGreaterThanOrEqual(t.get(order[i])!.w);
  });
});

describe("brackets: mixed, then even brackets, then the finals (16 on 4 nets)", () => {
  const all = ids(16);
  const rank = (id: string) => Number(id.slice(1)); // p0 best
  const r1 = asGames(planStage("random", mixedOrder(all, (id) => 100 - rank(id), () => 0.4), 4), 1).map((g) => ({ ...g, status: "done" as const, scoreA: 15, scoreB: 11 }));
  // Points that follow the ranking: p0 the most.
  const deltaFor = (gs: Game[]) => Object.fromEntries(gs.map((g) => [g.id, Object.fromEntries([...g.a, ...g.b].map((id) => [id, (16 - rank(id)) / 4]))]));
  const groupsOf4 = (order: string[]) => [0, 1, 2, 3].map((k) => order.slice(k * 4, k * 4 + 4));

  it("splits the field into halves, each dealt alternately across two nets", () => {
    const order = bracketOrder([], all, new Map());
    expect(groupsOf4(order).map((g) => g.map(rank))).toEqual([[0, 2, 4, 6], [1, 3, 5, 7], [8, 10, 12, 14], [9, 11, 13, 15]]);
  });

  it("keeps round 1 group-mates apart only by swapping ranking neighbours: nobody changes bracket, and each group keeps one of every pair", () => {
    const order = bracketOrder(r1, all, dayPoints(r1, deltaFor(r1)));
    const [a, b, c, d] = groupsOf4(order);
    expect(new Set([...a, ...b])).toEqual(new Set(all.slice(0, 8)));
    expect(new Set([...c, ...d])).toEqual(new Set(all.slice(8)));
    for (const g of [a, b, c, d]) expect(new Set(g.map((id) => Math.floor(rank(id) / 2))).size).toBe(4);
    const met = (x: string, y: string) => r1.some((g) => [...g.a, ...g.b].includes(x) && [...g.a, ...g.b].includes(y));
    const clashes = [a, b, c, d].reduce((n, g) => n + g.reduce((m, x, i) => m + g.slice(i + 1).filter((y) => met(x, y)).length, 0), 0);
    expect(clashes).toBeLessThanOrEqual(4);
  });

  it("then no final repeats more than two of a bracket group, so every final is at least half new faces", () => {
    const r2order = bracketOrder(r1, all, dayPoints(r1, deltaFor(r1)));
    const r2 = asGames(planStage("seeded", r2order, 4), 2).map((g) => ({ ...g, kind: "seeded" as const, status: "done" as const, scoreA: 15, scoreB: 12 }));
    const day = [...r1, ...r2];
    const finals = groupsOf4(spreadRepeats(seedOrder(day, all, "final", dayPoints(day, deltaFor(day))), day, "final"));
    const r2groups = groupsOf4(r2order);
    for (const f of finals) for (const g of r2groups) expect(f.filter((id) => g.includes(id)).length).toBeLessThanOrEqual(2);
    expect(finals[0].map(rank).sort((x, y) => x - y)).toEqual([0, 1, 2, 3]);
  });

  it("puts someone who hasn't played yet mid-table, and handles 12 (two nets of the top eight, one of the rest)", () => {
    const pool = [...all, "late"];
    const order = bracketOrder(r1, pool.slice(0, 12).concat("late"), dayPoints(r1, deltaFor(r1)));
    expect(order).toHaveLength(13);
    const twelve = bracketOrder([], all.slice(0, 12), new Map());
    expect(groupsOf4(twelve).slice(0, 3).map((g) => g.map(rank))).toEqual([[0, 2, 4, 6], [1, 3, 5, 7], [8, 9, 10, 11]]);
  });
});
