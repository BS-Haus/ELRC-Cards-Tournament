import { describe, expect, it } from "vitest";
import { planStage, type StageKind } from "./cards";
import { buildStory } from "./story";
import type { DayEvent, DayGame } from "./recap";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
const num = (id: string) => Number(id.slice(1));
function stage(eventId: string, stageNo: number, kind: StageKind, loserScore = (_: number) => 10): DayGame[] {
  let k = 0;
  return planStage(kind, ids(8), 2).flatMap((g) => g.games.map((x) => {
    const aWon = Math.min(...x.a.map(num)) < Math.min(...x.b.map(num));
    const l = loserScore(k++);
    const w = Math.max(15, l + 2);
    return { eventId, id: `${eventId}-${stageNo}-${g.groupNo}-${x.seq}`, stageNo, kind, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net, a: x.a, b: x.b, subs: [], scoreA: aWon ? w : l, scoreB: aWon ? l : w, status: "done" as const };
  }));
}
const day = (id: string, t: number, ls?: (k: number) => number): DayEvent => ({ id, title: id, startsAt: t, status: "done", games: [...stage(id, 1, "random", ls), ...stage(id, 2, "final", ls)] });

describe("tournament story", () => {
  const w1 = day("w1", 1);
  const w2 = day("w2", 2, (k) => (k === 0 ? 0 : k === 1 ? 18 : 10));

  it("crowns the Gold champion and counts their titles", () => {
    const s = buildStory(w2, [w1, w2]);
    expect(s.champion?.id).toBe("p0");
    expect(s.champion?.titles).toBe(2);
    expect(s.podium.map((p) => p.name)).toEqual(["Gold", "Silver"]);
    expect(s.podium[0].runnerUp).not.toBeNull();
  });

  it("tells the day's stories, strongest first, five at most", () => {
    const s = buildStory(w2, [w1, w2]);
    expect(s.stories.length).toBeGreaterThan(0);
    expect(s.stories.length).toBeLessThanOrEqual(5);
    expect(s.stories[0].kind).toBe("unbeaten");
    expect(s.stories.find((t) => t.kind === "deuce")?.stat).toBe("20–18");
  });

  it("breaks records only against earlier weekends", () => {
    const s = buildStory(w2, [w1, w2]);
    const kinds = s.records.map((r) => r.kind);
    expect(kinds).toContain("margin"); // 15–0 beats w1's 15–10
    expect(kinds).toContain("deuce"); // w1 had none
    expect(kinds).toContain("titles"); // p0's second Gold, more than anyone before
    expect(buildStory(w1, [w1, w2]).records).toEqual([]); // nothing before week 1 to beat
  });

  it("counts the day in numbers", () => {
    const s = buildStory(w2, [w1, w2]);
    expect(s.numbers.players).toBe(8);
    expect(s.numbers.games).toBe(w2.games.length);
    expect(s.numbers.deuces).toBe(2); // one 20–18 in each stage
  });
});
