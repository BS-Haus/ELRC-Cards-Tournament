import { describe, expect, it } from "vitest";
import type { Game } from "./cards";
import { xpWeekends, levelFor, winXp, lossXp, LEVELS, XP } from "./levels";

let n = 0;
/** One finished game: a's score first. */
const game = (a: [string, string], b: [string, string], sa: number, sb: number, extra: Partial<Game> = {}): Game =>
  ({ id: `g${++n}`, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: n, ord: n, net: 1, a, b, subs: [], scoreA: sa, scoreB: sb, status: "done", ...extra });
const weekend = (id: string, startsAt: number, games: Game[]) => ({ id, startsAt, games });
const xp = (m: ReturnType<typeof xpWeekends>, id: string) => m.get(id)?.xp ?? 0;

describe("XP", () => {
  it("starts everyone at the bottom, Level 1, Fresh Meat", () => {
    expect(levelFor(0).level).toMatchObject({ level: 1, name: "Fresh Meat" });
    expect(LEVELS).toHaveLength(11);
    expect(LEVELS.at(-1)!.name).toBe("Scotty Beeks");
  });

  it("pays for turning up and winning, more for a bigger margin, and costs something to lose", () => {
    const r = xpWeekends([weekend("w", 1, [game(["a", "b"], ["c", "d"], 15, 4)])]);
    expect(xp(r, "a")).toBe(XP.showedUp + winXp(11));
    expect(winXp(11)).toBeGreaterThan(winXp(2));
    expect(winXp(15)).toBeLessThanOrEqual(XP.winMax);
    expect(xp(r, "c")).toBe(XP.showedUp + XP.loss);
    expect(lossXp(2)).toBe(XP.closeLoss);
  });

  it("can drop you a level after a bad weekend", () => {
    const good = Array.from({ length: 4 }, () => game(["a", "b"], ["c", "d"], 15, 3)); // 62 XP: Level 3
    const bad = Array.from({ length: 6 }, () => game(["a", "b"], ["c", "d"], 3, 15));
    const r = xpWeekends([weekend("w1", 1, good), weekend("w2", 2, bad)]);
    const w1 = r.get("a")!.weekends.get("w1")!, w2 = r.get("a")!.weekends.get("w2")!;
    expect(levelFor(w2.after).level.level).toBeLessThan(levelFor(w1.after).level.level);
  });

  it("climbs for someone who turns up and wins half their games", () => {
    const half = Array.from({ length: 6 }, (_, i) => (i % 2 ? game(["a", "b"], ["c", "d"], 15, 9) : game(["a", "b"], ["c", "d"], 9, 15)));
    const r = xpWeekends([weekend("w1", 1, half), weekend("w2", 2, half)]);
    expect(xp(r, "a")).toBeGreaterThan(xp(xpWeekends([weekend("w1", 1, half)]), "a"));
  });

  it("never goes below zero", () => {
    const r = xpWeekends([weekend("w", 1, Array.from({ length: 8 }, () => game(["a", "b"], ["c", "d"], 0, 15)))]);
    expect(xp(r, "a")).toBe(0);
  });

  it("ignores deciders and never counts a game for the sub", () => {
    const r = xpWeekends([weekend("w", 1, [game(["a", "b"], ["c", "d"], 11, 5, { decider: true }), game(["a", "sub"], ["c", "d"], 15, 5, { subs: ["sub"] })])]);
    expect(r.get("sub")).toBeUndefined();
    expect(r.get("a")!.games).toBe(1);
  });

  it("pays the A final's podium and other finals' winners, once the final is done", () => {
    const fin = (g: Game, groupNo: number) => ({ ...g, kind: "final" as const, stageNo: 2, groupNo, groupName: groupNo ? "B" : "A" });
    // A final: p1 wins all three, p2 two-ish, etc. Every pairing once, p1 always on the winning side.
    const a = [fin(game(["p1", "p2"], ["p3", "p4"], 15, 5), 0), fin(game(["p1", "p3"], ["p2", "p4"], 15, 7), 0), fin(game(["p1", "p4"], ["p2", "p3"], 15, 9), 0)];
    const b = [fin(game(["q1", "q2"], ["q3", "q4"], 15, 5), 1), fin(game(["q1", "q3"], ["q2", "q4"], 15, 7), 1), fin(game(["q1", "q4"], ["q2", "q3"], 15, 9), 1)];
    const r = xpWeekends([weekend("w", 1, [...a, ...b])]);
    const parts = (id: string) => r.get(id)!.weekends.get("w")!.parts.map((p) => p.label);
    expect(parts("p1")).toContain("Champion");
    expect(parts("q1")).toContain("B final winner");
    expect(["p2", "p3", "p4"].filter((id) => parts(id).includes("A final, 2nd"))).toHaveLength(1);
    expect(["p2", "p3", "p4"].filter((id) => parts(id).includes("A final, 3rd"))).toHaveLength(1);
    const unfinished = xpWeekends([weekend("w", 1, [...a.slice(0, 2), { ...a[2], status: "todo" as const, scoreA: null, scoreB: null }])]);
    expect(unfinished.get("p1")!.weekends.get("w")!.parts.map((p) => p.label)).not.toContain("Champion");
  });
});

describe("levels", () => {
  it("unlocks levels in order and knows how far to the next", () => {
    expect(levelFor(19).level.level).toBe(1);
    expect(levelFor(20).level).toMatchObject({ level: 2, name: "Whiff Merchant" });
    expect(levelFor(1200).next).toBeNull();
    expect(levelFor(80).progress).toBeCloseTo((80 - 60) / (110 - 60), 5);
  });

});
