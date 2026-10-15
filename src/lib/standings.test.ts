import { describe, expect, it } from "vitest";
import { rate, PROV_N, START, winFloor, eventChange, type RatedEvent } from "./standings";
import { tierFor } from "./levels";
import type { Game } from "./cards";

let n = 0;
const g = (a: [string, string], b: [string, string], sa: number | null, sb: number | null, extra: Partial<Game> = {}): Game => ({
  id: `g${n}`, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: n++, net: 1, a, b, subs: [], scoreA: sa, scoreB: sb, status: sa == null ? "todo" : "done", ...extra,
});
const ev = (id: string, day: number, games: Game[]): RatedEvent => ({ id, startsAt: Date.UTC(2026, 9, day, 11), groupTo: 15, finalTo: 15, games });

describe("rate", () => {
  it("everyone starts on the same number, and each game's change adds up to the rating", () => {
    const r = rate([ev("e1", 3, [g(["a", "b"], ["c", "d"], 15, 9), g(["a", "c"], ["b", "d"], 12, 15), g(["a", "d"], ["b", "c"], 15, 13)])]);
    for (const p of r.players.values()) {
      expect(p.entries[0].ratingBefore).toBe(START);
      expect(START + p.entries.reduce((s, e) => s + e.delta, 0)).toBe(p.rating);
      p.entries.forEach((e) => expect(e.ratingBefore + e.delta).toBe(e.ratingAfter));
    }
  });

  it("a win always pays at least the floor, and losses can still cost", () => {
    const r = rate([ev("e1", 3, [g(["a", "b"], ["c", "d"], 15, 2), g(["a", "b"], ["c", "d"], 15, 13)])]);
    const a = r.players.get("a")!;
    expect(a.entries[1].delta).toBeGreaterThanOrEqual(winFloor(15, 13));
    expect(r.players.get("c")!.entries[0].delta).toBeLessThan(0);
  });

  it("ignores unplayed and skipped games, and the entry order doesn't change the fit", () => {
    const games = [g(["a", "b"], ["c", "d"], 15, 9), g(["a", "c"], ["b", "d"], 12, 15), g(["a", "d"], ["b", "c"], null, null)];
    const r1 = rate([ev("e1", 3, games)]);
    expect(r1.players.get("a")!.games).toBe(2);
    // The same games, listed the other way round (same running order): same ratings.
    const r2 = rate([ev("e1", 3, [...games].reverse())]);
    for (const id of ["a", "b", "c", "d"]) expect(r2.players.get(id)!.rating).toBe(r1.players.get(id)!.rating);
  });

  it("places after PROV_N games: Fresh Meat until then, then a tier by rating", () => {
    const games = Array.from({ length: PROV_N }, () => g(["a", "b"], ["c", "d"], 15, 10));
    const almost = rate([ev("e1", 3, games.slice(0, -1))]).players.get("a")!;
    expect(almost.provisional).toBe(true);
    expect(tierFor({ rating: almost.rating, games: almost.games }).level.name).toBe("Fresh Meat");
    const placed = rate([ev("e1", 3, games)]);
    const a = placed.players.get("a")!;
    expect(a.provisional).toBe(false);
    expect(a.rank).toBe(1);
    expect(tierFor({ rating: a.rating, games: a.games }).placing).toBe(false);
    expect(placed.ranked.map((p) => p.id).slice(0, 2).sort()).toEqual(["a", "b"]);
  });

  it("reuses an earlier ledger: same answer, and a new game only extends it", () => {
    const e1 = [g(["a", "b"], ["c", "d"], 15, 9), g(["a", "c"], ["b", "d"], 12, 15)];
    const r1 = rate([ev("e1", 3, e1)]);
    const more = [...e1, g(["a", "d"], ["b", "c"], 15, 11)];
    const warm = rate([ev("e1", 3, more)], { ledger: r1.ledger });
    const cold = rate([ev("e1", 3, more)]);
    expect(warm.ledger.snaps[0]).toBe(r1.ledger.snaps[0]);
    for (const id of ["a", "b", "c", "d"]) expect(Math.abs(warm.players.get(id)!.rating - cold.players.get(id)!.rating)).toBeLessThanOrEqual(1);
  });

  it("eventChange: before and after one event", () => {
    const r = rate([ev("e1", 3, [g(["a", "b"], ["c", "d"], 15, 9)]), ev("e2", 10, [g(["a", "c"], ["b", "d"], 15, 9)])]);
    const c = eventChange(r, "a", "e2")!;
    expect(c.before).toBe(r.players.get("a")!.entries[0].ratingAfter);
    expect(c.after).toBe(r.players.get("a")!.rating);
    expect(eventChange(r, "a", "nope")).toBeNull();
  });
});
