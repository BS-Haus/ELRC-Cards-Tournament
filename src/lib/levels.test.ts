import { describe, expect, it } from "vitest";
import { planStage, type Game, type StageKind } from "./cards";
import { eventPoints, levelFor, careerPoints, LEVELS, POINTS } from "./levels";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const num = (id: string) => Number(id.slice(1));
const stage = (stageNo: number, kind: StageKind): Game[] =>
  planStage(kind, ids(8), 2).flatMap((g) => g.games.map((x) => {
    const aWon = Math.min(...x.a.map(num)) < Math.min(...x.b.map(num));
    return { id: `${stageNo}-${g.groupNo}-${x.seq}`, stageNo, kind, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net, a: x.a, b: x.b, subs: [], scoreA: aWon ? 15 : 9, scoreB: aWon ? 9 : 15, status: "done" as const };
  }));
const day = [...stage(1, "random"), ...stage(2, "final")];

describe("points and levels", () => {
  it("pays for turning up, games, wins and the finish", () => {
    const e = eventPoints(day, "p0");
    expect(e.parts.map((p) => p.label)).toContain("Gold champion");
    expect(e.total).toBe(e.parts.reduce((n, p) => n + p.points, 0));
    expect(e.total).toBeGreaterThan(POINTS.showedUp + POINTS.champion[0]);
  });
  it("gives the Gold champion more than the Silver champion, and nothing to someone who didn't play", () => {
    expect(eventPoints(day, "p0").total).toBeGreaterThan(eventPoints(day, "p4").total);
    expect(eventPoints(day, "p4").parts.map((p) => p.label)).toContain("Silver champion");
    expect(eventPoints(day, "nobody")).toEqual({ total: 0, parts: [] });
  });
  it("turns points into five ranks of three divisions", () => {
    expect(levelFor(0).level.name).toBe("Rim Rat I");
    expect(levelFor(150).level.name).toBe("Hinge Hero I");
    expect(levelFor(299).level.name).toBe("Hinge Hero III");
    expect([...new Set(LEVELS.map((l) => l.tier))]).toEqual(["Rim Rat", "Dig Dog", "Hinge Hero", "Spike Sorcerer", "Net Royalty"]);
    expect(LEVELS).toHaveLength(15);
    expect(LEVELS.at(-1)!.name).toBe("Net Royalty III");
    expect(levelFor(LEVELS[1].min).level.name).toBe(LEVELS[1].name);
    const mid = levelFor((LEVELS[2].min + LEVELS[3].min) / 2);
    expect(mid.level.name).toBe(LEVELS[2].name);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(levelFor(99999).next).toBeNull();
  });
  it("adds up a career, only counting weekends up to a date", () => {
    const evs = [{ id: "a", startsAt: 1, games: day }, { id: "b", startsAt: 2, games: day }];
    expect(careerPoints(evs, "p0")).toBe(2 * eventPoints(day, "p0").total);
    expect(careerPoints(evs, "p0", 1)).toBe(eventPoints(day, "p0").total);
  });
});
