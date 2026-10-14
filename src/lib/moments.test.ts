import { describe, expect, it } from "vitest";
import { buildMoments, cheerFor, type MomentEvent, type TimedGame } from "./moments";

const game = (id: string, at: number, a: [string, string], b: [string, string], sa: number | null, sb: number | null, extra: Partial<TimedGame> = {}): TimedGame => ({
  id, eventId: "e1", updatedAt: at, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: 0, net: 1,
  a, b, subs: [], scoreA: sa, scoreB: sb, status: sa == null ? "todo" : "done", ...extra,
});
const ev = (games: TimedGame[]): MomentEvent[] => [{ id: "e1", title: "Sunday cards", startsAt: 0, games }];

describe("buildMoments", () => {
  it("shows nothing when nothing new has been scored", () => {
    const r = buildMoments(ev([game("g1", 100, ["me", "p"], ["x", "y"], 15, 11)]), "me", 200);
    expect(r.slides).toEqual([]);
  });

  it("first win of the day: +10 for turning up plus the win, and a level up to Level 2", () => {
    const r = buildMoments(ev([game("g1", 100, ["me", "p"], ["x", "y"], 15, 11)]), "me", 50);
    const [g, up] = r.slides;
    expect(g).toMatchObject({ kind: "game", won: true, mine: 15, theirs: 11, partner: "p", xp: 20, turnedUp: true, before: 0, after: 20 });
    expect(up).toMatchObject({ kind: "levelUp", level: { level: 2 } });
    expect(r.upTo).toBe(100);
  });

  it("a close loss costs 3 and can drop you a level, with a kind message", () => {
    const games = [game("g1", 100, ["me", "p"], ["x", "y"], 15, 11), game("g2", 300, ["me", "x"], ["p", "y"], 13, 15)];
    const r = buildMoments(ev(games), "me", 200); // g1 already seen
    expect(r.slides[0]).toMatchObject({ kind: "game", won: false, xp: -3, before: 20, after: 17, turnedUp: false });
    expect(r.slides[1]).toMatchObject({ kind: "levelDown", level: { level: 1 } });
    expect((r.slides[1] as { cheer: string }).cheer).not.toMatch(/bad|terrible|lost it/i);
  });

  it("several games end in a summary with the day's total", () => {
    const games = [game("g1", 100, ["me", "p"], ["x", "y"], 15, 11), game("g2", 110, ["me", "x"], ["p", "y"], 15, 5), game("g3", 120, ["me", "y"], ["p", "x"], 9, 15)];
    const r = buildMoments(ev(games), "me", 0);
    const sum = r.slides.at(-1)!;
    expect(sum).toMatchObject({ kind: "summary", games: 3, wins: 2 });
    const gameXp = r.slides.filter((s) => s.kind === "game").reduce((n, s) => n + (s as { xp: number }).xp, 0);
    expect((sum as { xp: number }).xp).toBe(gameXp);
  });

  it("ignores games where you were a sub, and games for other people", () => {
    const games = [game("g1", 100, ["me", "p"], ["x", "y"], 15, 11, { subs: ["me"] }), game("g2", 100, ["a", "b"], ["c", "d"], 15, 11)];
    expect(buildMoments(ev(games), "me", 0).slides).toEqual([]);
  });

  it("gives the same message for the same game every time", () => {
    expect(cheerFor(true, 4, "g1")).toBe(cheerFor(true, 4, "g1"));
    expect(cheerFor(false, 2, "g9")).toMatch(/close|coin|right there/i);
  });
});
