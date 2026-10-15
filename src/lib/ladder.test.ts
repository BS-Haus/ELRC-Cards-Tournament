import { describe, expect, it } from "vitest";
import { eventLadder, overallLadder, xpTrail, type LadderEvent, type TimedGame } from "./ladder";
import { xpWeekends, winXp, XP } from "./levels";

const g = (id: string, at: number, a: [string, string], b: [string, string], sa: number, sb: number): TimedGame => ({
  id, updatedAt: at, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: 0, net: 1, a, b, subs: [], scoreA: sa, scoreB: sb, status: "done",
});

const day1: LadderEvent = { id: "e1", startsAt: 1, games: [g("1", 10, ["ana", "ben"], ["cal", "dee"], 15, 9), g("2", 20, ["ana", "cal"], ["ben", "dee"], 13, 15), g("3", 30, ["ana", "dee"], ["ben", "cal"], 15, 6)] };
const day2: LadderEvent = { id: "e2", startsAt: 2, games: [g("4", 40, ["ben", "cal"], ["ana", "dee"], 15, 12)] };
const ids = ["ana", "ben", "cal", "dee", "eve"];

describe("xpTrail", () => {
  it("ends every weekend exactly on its XP, game by game in between", () => {
    const xp = xpWeekends([day1, day2]);
    const t = xpTrail([day1, day2], "ana", xp);
    expect(t.map((x) => x.won)).toEqual([true, false, true, false]);
    expect(t[2].xp).toBe(xp.get("ana")!.weekends.get("e1")!.after);
    expect(t.at(-1)!.xp).toBe(xp.get("ana")!.xp);
    expect(t[0].xp).toBe(XP.showedUp + winXp(6)); // turned up + a win by 6
  });
});

describe("eventLadder", () => {
  it("ranks the day, with today's XP as the headline and today's dots", () => {
    const rows = eventLadder([day1, day2], "e1", ids);
    expect(rows[0]).toMatchObject({ id: "ana", rank: 1, w: 2, l: 1, form: ["W", "L", "W"] });
    expect(rows[0].change).toBeGreaterThan(0);
    expect(rows[0].spark[0]).toBe(0); // starts from their XP before the day
    expect(rows.at(-1)!.id).toBe("eve"); // no games yet: last
    const played = rows.filter((r) => r.w + r.l > 0).map((r) => r.change);
    expect(played).toEqual([...played].sort((a, b) => b - a)); // the big number and the order agree
  });
});

describe("overallLadder", () => {
  it("ranks by XP, leaves out anyone who hasn't played, and keeps the last five results", () => {
    const rows = overallLadder([day1, day2], ids);
    expect(rows.map((r) => r.id)).not.toContain("eve");
    expect(rows[0].xp).toBeGreaterThanOrEqual(rows[1].xp);
    const ana = rows.find((r) => r.id === "ana")!;
    expect(ana.form).toEqual(["W", "L", "W", "L"]);
    expect(ana.spark.at(-1)).toBe(ana.xp);
  });
});
