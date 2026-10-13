import { describe, expect, it } from "vitest";
import type { Game } from "./cards";
import { rateWeekends, rankFor, climb, RANKS, START, PLACING_GAMES } from "./levels";

let n = 0;
/** One finished game: a beat b by the score given (a's score first). */
const game = (a: [string, string], b: [string, string], sa: number, sb: number, extra: Partial<Game> = {}): Game =>
  ({ id: `g${++n}`, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: n, ord: n, net: 1, a, b, subs: [], scoreA: sa, scoreB: sb, status: "done", ...extra });
const weekend = (id: string, startsAt: number, games: Game[]) => ({ id, startsAt, games });
const rating = (m: ReturnType<typeof rateWeekends>, id: string) => m.get(id)?.rating ?? START;

describe("rating", () => {
  it("moves winners up and losers down by the same amount", () => {
    const r = rateWeekends([weekend("w1", 1, [game(["a", "b"], ["c", "d"], 15, 9)])]);
    expect(rating(r, "a")).toBeGreaterThan(START);
    expect(rating(r, "c")).toBeLessThan(START);
    expect(rating(r, "a") - START).toBeCloseTo(START - rating(r, "c"), 5);
  });

  it("pays more for a bigger margin", () => {
    const close = rateWeekends([weekend("w", 1, [game(["a", "b"], ["c", "d"], 15, 13)])]);
    const big = rateWeekends([weekend("w", 1, [game(["a", "b"], ["c", "d"], 15, 2)])]);
    expect(rating(big, "a")).toBeGreaterThan(rating(close, "a"));
  });

  it("can go down as well as up: a strong player who starts losing drops", () => {
    const wins = Array.from({ length: 6 }, () => game(["s", "x"], ["y", "z"], 15, 5));
    const losses = Array.from({ length: 6 }, () => game(["s", "x"], ["y", "z"], 5, 15));
    const r = rateWeekends([weekend("w1", 1, wins), weekend("w2", 2, losses)]);
    const after1 = r.get("s")!.weekends.get("w1")!.after;
    expect(after1).toBeGreaterThan(START);
    expect(rating(r, "s")).toBeLessThan(after1);
  });

  it("rewards beating a stronger pair more than a weaker one, and costs less to lose to one", () => {
    const build = Array.from({ length: 8 }, () => game(["s1", "s2"], ["f1", "f2"], 15, 3)); // s1, s2 get strong
    const vsStrong = rateWeekends([weekend("w1", 1, build), weekend("w2", 2, [game(["u1", "u2"], ["s1", "s2"], 15, 13)])]);
    const vsWeak = rateWeekends([weekend("w1", 1, build), weekend("w2", 2, [game(["u1", "u2"], ["f1", "f2"], 15, 13)])]);
    expect(rating(vsStrong, "u1")).toBeGreaterThan(rating(vsWeak, "u1"));
    const lossToStrong = rateWeekends([weekend("w1", 1, build), weekend("w2", 2, [game(["u1", "u2"], ["s1", "s2"], 13, 15)])]);
    const lossToWeak = rateWeekends([weekend("w1", 1, build), weekend("w2", 2, [game(["u1", "u2"], ["f1", "f2"], 13, 15)])]);
    expect(rating(lossToStrong, "u1")).toBeGreaterThan(rating(lossToWeak, "u1"));
  });

  it("lets a close loss to a far stronger pair gain a little", () => {
    const build = Array.from({ length: 20 }, () => game(["s1", "s2"], ["f1", "f2"], 15, 0));
    const r = rateWeekends([weekend("w1", 1, build), weekend("w2", 2, [game(["f1", "f2"], ["s1", "s2"], 13, 15)])]);
    const w2 = r.get("f1")!.weekends.get("w2")!;
    expect(w2.after).toBeGreaterThan(w2.before);
  });

  it("always gives a winner something, even a narrow win as heavy favourites", () => {
    const build = Array.from({ length: 10 }, () => game(["s1", "s2"], ["f1", "f2"], 15, 0));
    const r = rateWeekends([weekend("w1", 1, build), weekend("w2", 2, [game(["s1", "s2"], ["f1", "f2"], 15, 13)])]);
    const w2 = r.get("s1")!.weekends.get("w2")!;
    expect(w2.after).toBeGreaterThan(w2.before);
  });

  it("places you after a handful of games, and moves you less once placed", () => {
    const games = Array.from({ length: PLACING_GAMES + 1 }, () => game(["a", "b"], ["c", "d"], 15, 9));
    const r = rateWeekends([weekend("w", 1, games.slice(0, PLACING_GAMES - 1))]);
    expect(r.get("a")!.placed).toBe(false);
    const all = rateWeekends([weekend("w", 1, games)]);
    expect(all.get("a")!.placed).toBe(true);
  });

  it("ignores deciders and never moves a sub", () => {
    const r = rateWeekends([weekend("w", 1, [game(["a", "b"], ["c", "d"], 11, 5, { decider: true }), game(["a", "sub"], ["c", "d"], 15, 5, { subs: ["sub"] })])]);
    expect(r.get("sub")).toBeUndefined();
    expect(r.get("a")!.games).toBe(1);
  });

  it("records each weekend's before and after", () => {
    const r = rateWeekends([weekend("w2", 2, [game(["a", "b"], ["c", "d"], 9, 15)]), weekend("w1", 1, [game(["a", "b"], ["c", "d"], 15, 9)])]);
    const a = r.get("a")!;
    expect(a.weekends.get("w1")!.before).toBe(START);
    expect(a.weekends.get("w2")!.before).toBeCloseTo(a.weekends.get("w1")!.after, 5);
  });
});

describe("ranks", () => {
  it("uses the ranked app's ten ranks on the same scale, and Fresh Meat while placing", () => {
    expect(RANKS).toHaveLength(10);
    expect(rankFor(800, true).rank.name).toBe("Pocket Sniper");
    expect(rankFor(799, true).rank.name).toBe("Roll-Shot Rascal");
    expect(rankFor(1450, true).rank.name).toBe("Scotty Beeks");
    expect(rankFor(1450, true).next).toBeNull();
    expect(rankFor(1200, false).rank.name).toBe("Fresh Meat");
    expect(rankFor(850, true).progress).toBeCloseTo(0.5, 5);
  });

  it("draws the rank lines a climb (or a dip) crosses", () => {
    expect(climb([]).marks).toEqual([]);
    expect(climb([780, 830, 910]).marks.map((m) => m.name)).toEqual(["Pocket Sniper", "Spike Lee"]);
    expect(climb([760, 690]).marks.map((m) => m.name)).toEqual(["Roll-Shot Rascal", "Pocket Sniper"]);
  });
});
