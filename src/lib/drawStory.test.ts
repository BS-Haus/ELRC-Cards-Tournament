import { describe, expect, it } from "vitest";
import { buildDrawStory } from "./drawStory";
import { planStage, type Game, type StageKind } from "./cards";
import { rate } from "./standings";

const r = (games: Game[]) => rate([{ id: "e", startsAt: Date.UTC(2026, 9, 3, 11), groupTo: 15, finalTo: 15, games }]);

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function stageGames(kind: StageKind, stageNo: number, order: string[], nets = 2, score?: (g: { a: string[]; b: string[] }) => [number, number]): Game[] {
  return planStage(kind, order, nets, () => 0.5).flatMap((g) => g.games.map((x) => {
    const s = score?.(x);
    return { id: `${stageNo}-${g.groupNo}-${x.seq}`, stageNo, kind, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net, a: x.a, b: x.b, subs: [], scoreA: s?.[0] ?? null, scoreB: s?.[1] ?? null, status: s ? ("done" as const) : ("todo" as const) };
  }));
}

describe("buildDrawStory", () => {
  it("first draw: groups, nets, and your group and first game, no results yet", () => {
    const games = stageGames("random", 1, ids(9));
    const ev = { id: "e", title: "Sunday cards", nets: 2, stages: [{ no: 1, kind: "random" as const, createdAt: 1 }], games };
    const s = buildDrawStory(ev, r(games), 1, "p0")!;
    expect(s.results).toBeNull();
    expect(s.groups.map((g) => g.label)).toEqual(["Group A", "Group B"]);
    expect(s.players).toBe(9);
    expect(s.mine).toMatchObject({ label: "Group A", net: 1 });
    expect(s.mine!.mates).toHaveLength(4);
    expect([s.mine!.partner, ...s.mine!.opponents]).not.toContain("p0");
  });

  it("finals draw: previous tables with XP, the seeding rule, and where you landed", () => {
    // p0 and p5 win every game in their groups.
    const s1 = stageGames("random", 1, ids(10), 2, (g) => (g.a.includes("p0") || g.a.includes("p5") ? [15, 8] : g.b.includes("p0") || g.b.includes("p5") ? [8, 15] : [15, 13]));
    const s2 = stageGames("final", 2, ["p0", "p5", "p1", "p6", "p2", "p7", "p3", "p8", "p4", "p9"]);
    const games = [...s1, ...s2];
    const ev = { id: "e", title: "Sunday cards", nets: 2, stages: [{ no: 1, kind: "random" as const, createdAt: 1 }, { no: 2, kind: "final" as const, createdAt: 2 }], games };
    const s = buildDrawStory(ev, r(games), 2, "p0")!;
    expect(s.kind).toBe("final");
    expect(s.results!.groups).toHaveLength(2);
    expect(s.results!.groups[0].winner).toBe("p0");
    const p0 = s.results!.groups[0].rows[0];
    expect(p0).toMatchObject({ id: "p0", w: 4, l: 0 });
    expect(p0.placing).toBe(true); // four games in: still placing, so no number on show
    expect(p0.xp).toBeGreaterThan(0);
    expect(s.results!.xpUp).toBeGreaterThan(0);
    expect(s.results!.xpDown).toBeLessThan(0);
    expect(s.results!.closest!.score[0] - s.results!.closest!.score[1]).toBe(2);
    expect(s.seeding).toMatchObject({ from: "1st in Group A", to: "Gold final" });
    expect(s.groups[0].label).toBe("Gold final");
    // Your day: the rounds' points (rating ±) and your place among the finalists. p0 won every game.
    expect(s.day!.points).toBeGreaterThan(0);
    expect(s.day!.rank).toBeLessThanOrEqual(2);
    expect(s.day!.of).toBe(10);
    expect(buildDrawStory(ev, r(games), 1, "p0")!.day).toBeNull();
  });

  it("is null for a stage you can't find", () => {
    expect(buildDrawStory({ id: "e", title: "x", nets: 2, stages: [], games: [] }, r([]), 1, "p0")).toBeNull();
  });
});
