import { describe, expect, it } from "vitest";
import { buildMoments, cheerFor, gameMoments, gameResultOf, type MomentEvent, type TimedGame } from "./moments";
import { rate, PROV_N } from "./standings";

let n = 0;
const game = (at: number, a: [string, string], b: [string, string], sa: number | null, sb: number | null, extra: Partial<TimedGame> = {}): TimedGame => ({
  id: `g${n}`, eventId: "e1", updatedAt: at, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: n++, net: 1,
  a, b, subs: [], scoreA: sa, scoreB: sb, status: sa == null ? "todo" : "done", ...extra,
});
const ev = (games: TimedGame[]): MomentEvent[] => [{ id: "e1", title: "Sunday cards", startsAt: Date.UTC(2026, 9, 3, 11), games }];
const ratings = (e: MomentEvent[]) => rate(e.map((x) => ({ ...x, groupTo: 15, finalTo: 15 })));
const moments = (games: TimedGame[], seen: number) => { const e = ev(games); return buildMoments(e, ratings(e), "me", seen); };
// `me` plays PROV_N games: wins, then a loss at the end.
const placement = () => Array.from({ length: PROV_N }, (_, i) => game(100 + i, ["me", "p"], ["x", "y"], i < PROV_N - 1 ? 15 : 12, i < PROV_N - 1 ? 9 : 15));

describe("buildMoments", () => {
  it("shows nothing when nothing new has been scored", () => {
    expect(moments([game(100, ["me", "p"], ["x", "y"], 15, 11)], 200).slides).toEqual([]);
  });

  it("a placement game keeps the number hidden and counts you through placement", () => {
    const r = moments([game(100, ["me", "p"], ["x", "y"], 15, 11)], 50);
    expect(r.slides).toHaveLength(1);
    expect(r.slides[0]).toMatchObject({ kind: "game", won: true, mine: 15, theirs: 11, partner: "p", placingGame: 1, bar: { placing: true } });
    expect(r.upTo).toBe(100);
  });

  it("the game that places you reveals your rating and tier", () => {
    const games = placement();
    const r = moments(games, 100 + PROV_N - 2); // only the last one is new
    expect(r.slides[0]).toMatchObject({ kind: "game", placingGame: PROV_N });
    expect(r.slides[1]).toMatchObject({ kind: "placed" });
    const placed = r.slides[1] as { rating: number; level: { name: string } };
    expect(placed.level.name).not.toBe("Fresh Meat");
    expect(placed.rating).toBe(ratings(ev(games)).players.get("me")!.rating);
  });

  it("once placed, a game shows its rating change", () => {
    const games = [...placement(), game(500, ["me", "x"], ["p", "y"], 15, 13)];
    const r = moments(games, 400);
    expect(r.slides[0]).toMatchObject({ kind: "game", placingGame: null });
    const s = r.slides[0] as { delta: number; before: number; after: number };
    expect(s.before + s.delta).toBe(s.after);
    expect(s.delta).toBeGreaterThan(0); // a win always pays
  });

  it("several games end in a summary", () => {
    const r = moments(placement(), 0);
    expect(r.slides.at(-1)).toMatchObject({ kind: "summary", games: PROV_N, wins: PROV_N - 1 });
  });

  it("ignores other people's games", () => {
    expect(moments([game(100, ["a", "b"], ["c", "d"], 15, 11)], 0).slides).toEqual([]);
  });

  it("gives the same message for the same game every time", () => {
    expect(cheerFor(true, 4, "g1")).toBe(cheerFor(true, 4, "g1"));
    expect(cheerFor(false, 2, "g9")).toMatch(/close|coin|right there/i);
  });
});

describe("gameMoments (replaying a past game)", () => {
  it("tells one game's story, the same as it popped up", () => {
    const games = [...placement(), game(500, ["me", "x"], ["p", "y"], 15, 13)];
    const e = ev(games), r = ratings(e);
    const live = buildMoments(e, r, "me", 400).slides[0];
    expect(gameMoments(e, r, "me", games.at(-1)!.id)[0]).toEqual(live);
    expect(gameMoments(e, r, "me", "nope")).toEqual([]);
  });
});

describe("gameResultOf (the whole game, for the phone that scored it)", () => {
  // Enough games for all four to be placed, then one more.
  const four = [["a", "b"], ["c", "d"]] as const;
  const games = Array.from({ length: PROV_N + 1 }, (_, i) =>
    game(100 + i, [...(i % 3 ? four[0] : ["a", "c"])] as [string, string], [...(i % 3 ? four[1] : ["b", "d"])] as [string, string], 15, 9 + (i % 4)));

  it("gives all four lines, matching each player's own ledger, and side A's odds going in", () => {
    const e = ev(games), r = ratings(e);
    const last = games.at(-1)!;
    const res = gameResultOf(r, last)!;
    expect(res.lines.map((l) => l.id)).toEqual([...last.a, ...last.b]);
    for (const l of res.lines) {
      const entry = r.players.get(l.id)!.entries.find((x) => x.gameId === last.id)!;
      expect(l.after - l.before).toBe(entry.delta);
      expect(l.won).toBe(entry.won);
    }
    expect(res.chanceA).toBeGreaterThan(0);
    expect(res.chanceA).toBeLessThan(1);
    expect(res.lines[2].placingGame).toBeNull(); // placed by now
  });

  it("counts placement games while placing, with no ladder place", () => {
    const e = ev(games.slice(0, 2)), r = ratings(e);
    const res = gameResultOf(r, games[1])!;
    expect(res.lines.every((l) => l.placingGame === 2 && l.rankBefore === null && l.rankAfter === null)).toBe(true);
  });
});
