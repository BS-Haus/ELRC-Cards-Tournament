// "Draw stories": when the organiser draws a stage (random groups, a seeded round, or the finals),
// everyone in it gets a short story next time they're in the app: how the last stage finished
// (tables, XP won and lost), how the seeding works and where they've landed, then the new groups
// being dealt out, their own group, net and first game. Pure: games in, story out.
import { tally, groupRank, stageMembers, isDone, finalName, gameLabel, netQueues, type Game, type StageKind } from "@/lib/cards";
import { xpWeekends, winXp, lossXp } from "@/lib/levels";

export type StoryRow = { id: string; w: number; l: number; pd: number; xp: number };
export type ResultGroup = { label: string; rows: StoryRow[]; winner: string | null; points: number; xp: number };
export type DrawGroup = { label: string; net: number; members: string[]; tier: number };
export type MyDraw = { label: string; net: number; mates: string[]; partner: string; opponents: [string, string]; ahead: number; sitsFirst: boolean };

export type DrawStory = {
  eventId: string;
  eventTitle: string;
  kind: StageKind;
  stageNo: number;
  createdAt: number;
  players: number;
  nets: number;
  /** The stage before this one, when there was one. */
  results: { kind: StageKind; groups: ResultGroup[]; points: number; xpUp: number; xpDown: number; climber: { id: string; xp: number } | null; closest: { score: [number, number]; label: string } | null } | null;
  /** How this draw was made, and where you came from and landed. */
  seeding: { rule: string; from: string | null; to: string } | null;
  groups: DrawGroup[];
  mine: MyDraw | null;
};

const labelFor = (kind: StageKind, name: string) => (kind === "final" ? `${finalName(name)} final` : `Group ${name}`);
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** XP each player gained or lost from one set of games, by replaying XP with and without them. */
export function xpFrom(events: { id: string; startsAt: number; games: Game[] }[], ids: Set<string>): Map<string, number> {
  const without = events.map((e) => ({ ...e, games: e.games.map((g) => (ids.has(g.id) ? { ...g, status: "todo" as const, scoreA: null, scoreB: null } : g)) }));
  const a = xpWeekends(without), b = xpWeekends(events);
  const out = new Map<string, number>();
  for (const [id, p] of b) out.set(id, p.xp - (a.get(id)?.xp ?? 0));
  return out;
}

/**
 * The story for stage `stageNo` of an event, as `me` sees it. `history` is every event's games
 * (for XP); `event.games` are this event's. Later stages' games are left out of everything, so the
 * story reads the same whenever it's opened.
 */
export function buildDrawStory(
  event: { id: string; title: string; nets: number; stages: { no: number; kind: StageKind; createdAt: number }[]; games: Game[] },
  history: { id: string; startsAt: number; games: Game[] }[],
  stageNo: number,
  me: string,
): DrawStory | null {
  const stage = event.stages.find((s) => s.no === stageNo);
  if (!stage) return null;
  const inStage = event.games.filter((g) => g.stageNo === stageNo);
  if (!inStage.length) return null;
  const members = stageMembers(inStage);
  const nos = [...members.keys()];
  const groups: DrawGroup[] = nos.map((no, tier) => {
    const first = inStage.find((g) => g.groupNo === no)!;
    return { label: labelFor(stage.kind, first.groupName), net: first.net, members: members.get(no)!, tier };
  });

  // Your group and first game.
  let mine: MyDraw | null = null;
  const myNo = nos.find((no) => members.get(no)!.includes(me));
  if (myNo !== undefined) {
    const mineG = groups[nos.indexOf(myNo)];
    const queue = netQueues(inStage, Math.max(...inStage.map((g) => g.net))).flat().filter((g) => g.groupNo === myNo);
    const firstMine = queue.find((g) => [...g.a, ...g.b].includes(me));
    if (firstMine) {
      const onA = firstMine.a.includes(me);
      const side = onA ? firstMine.a : firstMine.b, other = onA ? firstMine.b : firstMine.a;
      mine = {
        label: mineG.label, net: mineG.net, mates: mineG.members.filter((id) => id !== me),
        partner: side[0] === me ? side[1] : side[0], opponents: [other[0], other[1]],
        ahead: queue.indexOf(firstMine), sitsFirst: queue.indexOf(firstMine) > 0,
      };
    }
  }

  // The stage before: its tables, with XP won and lost there.
  const prevStage = [...event.stages].filter((s) => s.no < stageNo).sort((a, b) => b.no - a.no)[0];
  let results: DrawStory["results"] = null;
  let seeding: DrawStory["seeding"] = null;
  const upTo = (n: number) => history.map((e) => (e.id === event.id ? { ...e, games: e.games.filter((g) => g.stageNo <= n) } : e));
  if (prevStage) {
    const prev = event.games.filter((g) => g.stageNo === prevStage.no && g.status !== "void");
    const played = prev.filter((g) => isDone(g) && !g.decider);
    if (played.length) {
      const xp = xpFrom(upTo(prevStage.no), new Set(played.map((g) => g.id)));
      const pm = stageMembers(prev);
      const lines = tally(prev);
      const rg: ResultGroup[] = [...pm.keys()].map((no) => {
        const gs = prev.filter((g) => g.groupNo === no);
        const rows = groupRank(pm.get(no)!.map((id) => lines.get(id) ?? { id, gp: 0, w: 0, l: 0, pf: 0, pa: 0 }))
          .map((r) => ({ id: r.id, w: r.w, l: r.l, pd: r.pf - r.pa, xp: xp.get(r.id) ?? 0 }));
        const done = gs.filter((g) => isDone(g) && !g.decider);
        return {
          label: labelFor(prevStage.kind, gs[0].groupName), rows, winner: done.length ? rows[0]?.id ?? null : null,
          points: done.reduce((n, g) => n + g.scoreA! + g.scoreB!, 0), xp: rows.reduce((n, r) => n + r.xp, 0),
        };
      });
      const deltas = [...xp.entries()].filter(([id]) => rg.some((g) => g.rows.some((r) => r.id === id)));
      const top = deltas.sort((a, b) => b[1] - a[1])[0];
      const close = [...played].sort((a, b) => Math.abs(a.scoreA! - a.scoreB!) - Math.abs(b.scoreA! - b.scoreB!))[0];
      // XP won in victories and given back in defeats, game by game (sub games don't count).
      let xpUp = 0, xpDown = 0;
      for (const g of played) {
        const m = Math.abs(g.scoreA! - g.scoreB!), aWon = g.scoreA! > g.scoreB!;
        for (const id of aWon ? g.a : g.b) if (!g.subs.includes(id)) xpUp += winXp(m);
        for (const id of aWon ? g.b : g.a) if (!g.subs.includes(id)) xpDown += lossXp(m);
      }
      results = {
        kind: prevStage.kind, groups: rg,
        points: played.reduce((n, g) => n + g.scoreA! + g.scoreB!, 0),
        xpUp, xpDown,
        climber: top && top[1] > 0 ? { id: top[0], xp: top[1] } : null,
        closest: close ? { score: [Math.max(close.scoreA!, close.scoreB!), Math.min(close.scoreA!, close.scoreB!)], label: gameLabel(close) } : null,
      };
      // Where you came from (your place in your old group) and where you've landed.
      const myOld = rg.find((g) => g.rows.some((r) => r.id === me));
      const from = myOld ? `${ordinal(myOld.rows.findIndex((r) => r.id === me) + 1)} in ${myOld.label}` : null;
      const rule = stage.kind === "final"
        ? prevStage.kind === "random"
          ? "Group winners go top, then runners-up, then the rest, by win % and points per game. Best of them fill the A final."
          : "The top group's finishers lead the way into the A final, the next group's into the B final."
        : "Regrouped by level: the best of the last round together, then the next, so every game is a close one.";
      seeding = { rule, from, to: mine?.label ?? "the next stage" };
    }
  }

  return {
    eventId: event.id, eventTitle: event.title, kind: stage.kind, stageNo, createdAt: stage.createdAt,
    players: groups.reduce((n, g) => n + g.members.length, 0), nets: new Set(groups.map((g) => g.net)).size,
    results, seeding, groups, mine,
  };
}
