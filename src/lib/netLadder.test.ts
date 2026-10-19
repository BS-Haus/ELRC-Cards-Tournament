import { describe, expect, it } from "vitest";
import { firstRound, nextRound, pickTeams, partnersSoFar, ladderLines, roundDone, netsFor, ladderStory, type PlayedRound, type Round } from "./netLadder";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i).padStart(2, "0")}`);
// p00 is the highest rated, then down.
const rating = (id: string) => 1000 - Number(id.slice(1)) * 10;
const key = (x: string, y: string) => [x, y].sort().join("+");

/** Play a round: side A wins every net by default, or as `aWins` says. */
const play = (r: Round, aWins: (net: number) => boolean = () => true): PlayedRound => ({
  sitting: r.sitting,
  games: r.games.map((g) => ({ ...g, scoreA: aWins(g.net) ? 11 : 6, scoreB: aWins(g.net) ? 6 : 11 })),
});

describe("the first round", () => {
  it("seeds the best four on Net 1 and so on down, with fair teams", () => {
    const r = firstRound(ids(12), rating, 3, () => 0); // 0 = always the fairest split
    expect(r.games.map((g) => [...g.a, ...g.b].sort())).toEqual([ids(12).slice(0, 4), ids(12).slice(4, 8), ids(12).slice(8, 12)]);
    // Best with worst against the middle two.
    expect(r.games[0].a.concat(r.games[0].b).length).toBe(4);
    expect([r.games[0].a, r.games[0].b].map((t) => t.slice().sort().join())).toContain("p00,p03");
    expect(r.sitting).toEqual([]);
  });

  it("uses only the nets four-a-side can fill, and sits the extras out", () => {
    expect(netsFor(10, 4)).toBe(2);
    const r = firstRound(ids(10), rating, 4);
    expect(r.games).toHaveLength(2);
    expect(r.sitting).toEqual(["p08", "p09"]);
  });
});

describe("moving up and down", () => {
  it("sends winners up a net and losers down, the top and bottom staying put", () => {
    const r1 = firstRound(ids(12), rating, 3);
    const p1 = play(r1);
    const r2 = nextRound([p1], ids(12), rating, 3)!;
    const netOf = (r: Round, id: string) => r.games.find((g) => [...g.a, ...g.b].includes(id))!.net;
    for (const g of p1.games) {
      for (const id of g.a) expect(netOf(r2, id)).toBe(Math.max(1, g.net - 1));
      for (const id of g.b) expect(netOf(r2, id)).toBe(Math.min(3, g.net + 1));
    }
  });

  it("never pairs you with last round's partner, and avoids any repeat partner on the day", () => {
    let rounds: PlayedRound[] = [play(firstRound(ids(16), rating, 4))];
    for (let i = 0; i < 3; i++) {
      const next = nextRound(rounds, ids(16), rating, 4)!;
      const before = partnersSoFar(rounds);
      for (const g of next.games) {
        expect(before.has(key(g.a[0], g.a[1]))).toBe(false);
        expect(before.has(key(g.b[0], g.b[1]))).toBe(false);
      }
      rounds = [...rounds, play(next, (n) => n % 2 === 0)];
    }
  });

  it("puts every player in exactly one place each round", () => {
    const rounds = [play(firstRound(ids(14), rating, 4))];
    const r2 = nextRound(rounds, ids(14), rating, 4)!;
    const all = [...r2.games.flatMap((g) => [...g.a, ...g.b]), ...r2.sitting].sort();
    expect(all).toEqual(ids(14));
  });
});

describe("sitting out (king of the court)", () => {
  it("sits the pair who lost on the bottom net, and brings the sitters back on the bottom net", () => {
    const people = ids(10); // 2 nets of 4, 2 sit each round
    const r1 = play(firstRound(people, rating, 2)); // side A wins every net
    const r2 = nextRound([r1], people, rating, 2)!;
    const bottomLosers = r1.games.find((g) => g.net === 2)!.b;
    expect([...r2.sitting].sort()).toEqual([...bottomLosers].sort());
    const bottom2 = r2.games.find((g) => g.net === 2)!;
    for (const id of r1.sitting) expect([...bottom2.a, ...bottom2.b]).toContain(id);
  });

  it("never sits the same people two rounds running, even when they lose on the bottom again", () => {
    const people = ids(10);
    let rounds: PlayedRound[] = [play(firstRound(people, rating, 2))];
    for (let i = 0; i < 5; i++) {
      const next = nextRound(rounds, people, rating, 2)!;
      for (const id of next.sitting) expect(rounds.at(-1)!.sitting).not.toContain(id);
      rounds = [...rounds, play(next, (n) => n !== 2)]; // the bottom net's B side always wins
    }
  });

  it("sits one of the bottom losers when only one has to sit, the one who's sat least", () => {
    const people = ids(9); // 2 nets, 1 sits
    const r1 = play(firstRound(people, rating, 2));
    const r2 = nextRound([r1], people, rating, 2)!;
    expect(r2.sitting).toHaveLength(1);
    expect(r1.games.find((g) => g.net === 2)!.b).toContain(r2.sitting[0]);
  });

  it("falls back to taking turns when the bottom net wasn't played", () => {
    const people = ids(10);
    const r1 = play(firstRound(people, rating, 2));
    const unplayed: PlayedRound = { ...r1, games: r1.games.map((g) => (g.net === 2 ? { ...g, scoreA: null, scoreB: null } : g)) };
    const r2 = nextRound([unplayed], people, rating, 2)!;
    expect(r2.sitting).toHaveLength(2);
    for (const id of r2.sitting) expect(r1.sitting).not.toContain(id);
  });
});

describe("people arriving and leaving", () => {
  it("drops someone who's left and seeds a newcomer by rating", () => {
    const r1 = play(firstRound(ids(8), rating, 2));
    // p07 leaves, and a new top player turns up.
    const now = [...ids(7), "new"];
    const r = (id: string) => (id === "new" ? 2000 : rating(id));
    const r2 = nextRound([r1], now, r, 2)!;
    const everyone = r2.games.flatMap((g) => [...g.a, ...g.b]);
    expect(everyone).not.toContain("p07");
    expect(r2.games[0].a.concat(r2.games[0].b)).toContain("new");
  });

  it("returns null when there aren't four to play", () => {
    expect(nextRound([], ids(3), rating, 2)).toBeNull();
  });
});

describe("pickTeams", () => {
  it("with no randomness, picks the closest match when nobody has partnered yet", () => {
    const t = pickTeams(["p00", "p01", "p02", "p03"], rating, new Set(), () => 0);
    expect([t.a, t.b].map((x) => x.slice().sort().join())).toEqual(expect.arrayContaining(["p00,p03", "p01,p02"]));
  });
  it("gives up balance before it repeats a partnership", () => {
    const t = pickTeams(["p00", "p01", "p02", "p03"], rating, new Set([key("p00", "p03")]), () => 0.99);
    expect([t.a, t.b].map((x) => x.slice().sort().join())).not.toContain("p00,p03");
  });
});

describe("variety", () => {
  const big = (id: string) => ({ a: 1300, b: 1000, c: 900, d: 600 } as Record<string, number>)[id];
  it("picks at random among splits close to even, never a lopsided one", () => {
    // Close (all within CLOSE_ENOUGH): every split turns up.
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const t = pickTeams(["p00", "p01", "p02", "p03"], rating, new Set(), () => (i % 3) / 3);
      seen.add([t.a, t.b].map((x) => x.slice().sort().join()).sort().join("|"));
    }
    expect(seen.size).toBe(3);
    // Far apart: only the fair split (a+d vs b+c, 1900 v 1900); a+b vs c+d (2300 v 1500) never.
    for (const x of [0, 0.5, 0.99]) {
      const t = pickTeams(["a", "b", "c", "d"], big, new Set(), () => x);
      expect([t.a, t.b].map((y) => y.slice().sort().join())).toContain("a,d");
    }
  });
});

describe("the day's lines", () => {
  it("counts wins, points, the best net reached and time on the top net", () => {
    const r1 = play(firstRound(ids(8), rating, 2));
    const lines = ladderLines([r1]);
    const top = r1.games[0].a[0];
    expect(lines.get(top)).toMatchObject({ w: 1, l: 0, pf: 11, pa: 6, bestNet: 1, topRounds: 1, topWins: 1 });
    expect(roundDone(r1)).toBe(true);
    expect(roundDone({ ...r1, games: [{ ...r1.games[0], scoreA: null, scoreB: null }] })).toBe(false);
  });
});

describe("the end-of-day story", () => {
  it("names the top earners, the king of the top net, the biggest upset and the viewer's day", () => {
    const r1 = play(firstRound(ids(8), rating, 2));
    const r2 = play(nextRound([r1], ids(8), rating, 2)!, () => false);
    const today = new Map(ids(8).map((id, i) => [id, i === 7 ? null : 20 - i * 5] as [string, number | null]));
    const chance = new Map([["2:1", 0.8]]); // round 2, net 1: side A was the favourite and lost
    const s = ladderStory([r1, r2], today, chance, "p00");
    expect(s).toMatchObject({ players: 8, rounds: 2, games: 4 });
    expect(s.earners.map((e) => e.id)).toEqual(["p00", "p01", "p02"]);
    expect(s.upset).toMatchObject({ net: 1 });
    expect(s.upset!.chance).toBeCloseTo(0.2, 6);
    expect(s.me).toMatchObject({ id: "p00", w: 1, l: 1, today: 20, bestNet: 1 });
    expect(s.king).not.toBeNull();
  });
});
