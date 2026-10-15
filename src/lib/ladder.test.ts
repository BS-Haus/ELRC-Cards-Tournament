import { describe, expect, it } from "vitest";
import { ladder } from "./ladder";
import { rate, type RatedEvent } from "./standings";
import type { Game } from "./cards";

let n = 0;
const g = (a: [string, string], b: [string, string], sa: number, sb: number): Game => ({
  id: `g${n}`, stageNo: 1, kind: "random", groupNo: 0, groupName: "A", seq: 1, ord: n++, net: 1, a, b, subs: [], scoreA: sa, scoreB: sb, status: "done",
});

// Four players, every pairing: ana wins everything.
const round = (): Game[] => [g(["ana", "ben"], ["cal", "dee"], 15, 9), g(["ana", "cal"], ["ben", "dee"], 15, 10), g(["ana", "dee"], ["ben", "cal"], 15, 12)];
const day1: RatedEvent = { id: "e1", startsAt: Date.UTC(2026, 9, 3, 11), groupTo: 15, finalTo: 15, games: [...round(), ...round()] };
const day2: RatedEvent = { id: "e2", startsAt: Date.UTC(2026, 9, 10, 11), groupTo: 15, finalTo: 15, games: [g(["eve", "dee"], ["ana", "ben"], 15, 13), ...round()] };

describe("ladder", () => {
  it("ranks placed players by rating; everyone else is still placing", () => {
    const { rows, placing } = ladder(rate([day1, day2]));
    expect(rows[0].id).toBe("ana");
    expect(rows.map((x) => x.rank)).toEqual(rows.map((_, i) => i + 1));
    expect(rows.every((x, i) => i === 0 || rows[i - 1].rating >= x.rating)).toBe(true);
    expect(placing.map((p) => p.id)).toEqual(["eve"]); // one game: placing
  });

  it("says what today's tournament did: rating moved and places moved", () => {
    const r = rate([day1, day2]);
    const ana = ladder(r, "e2").rows.find((x) => x.id === "ana")!;
    expect(ana.today).toBe(r.players.get("ana")!.entries.filter((e) => e.eventId === "e2").reduce((s, e) => s + e.delta, 0));
    expect(ana.move).toBe(0);
    expect(ana.form).toHaveLength(5);
    expect(ana.spark.at(-1)).toBe(ana.rating);
    expect(ladder(r).rows[0].move).toBeNull();
  });
});
