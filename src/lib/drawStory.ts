// "Draw stories": when the organiser draws a stage (random groups, a seeded round, or the finals),
// everyone in it gets a short story next time they're in the app. A round: the shuffle, the groups
// dealt out, your group, net and first game. The finals: your points from the day, then each final
// revealed from Bronze up to Gold, then yours. (`results` and `seeding`, the last stage's tables
// and the rule, are still worked out but no longer shown: everyone watched them happen.) Pure.
import { finalLabel, POINTS_CUSHION, tally, groupRank, stageMembers, isDone, finalName, gameLabel, netQueues, type Game, type StageKind } from "@/lib/cards";
import { PROV_N, type Ratings } from "@/lib/standings";

/** `xp` is the rating the stage won or lost them; `placing` when they're still placing after it
 *  (their number isn't shown yet). */
export type StoryRow = { id: string; w: number; l: number; pd: number; xp: number; placing: boolean };
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
  /** Finals only: your points from today's rounds (rating ±, what seeds the finals) and where they
   *  put you among everyone in the finals. */
  day: { points: number; rank: number; of: number } | null;
};

const labelFor = (kind: StageKind, name: string) => (kind === "final" ? `${finalLabel(name)} final` : `Group ${name}`);
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** Rating each player gained or lost over one set of games (their lines in the ledger), and
 *  whether they're still placing after them. */
export function ratingFrom(r: Ratings, ids: Set<string>): Map<string, { delta: number; placing: boolean }> {
  const out = new Map<string, { delta: number; placing: boolean }>();
  for (const p of r.players.values()) {
    const es = p.entries.filter((e) => ids.has(e.gameId));
    if (es.length) out.set(p.id, { delta: es.reduce((n, e) => n + e.delta, 0), placing: es.at(-1)!.gamesBefore + 1 < PROV_N });
  }
  return out;
}

/**
 * The story for stage `stageNo` of an event, as `me` sees it, with everyone's ratings (`r`). Later stages' games are left out of everything, so the
 * story reads the same whenever it's opened.
 */
export function buildDrawStory(
  event: { id: string; title: string; nets: number; stages: { no: number; kind: StageKind; createdAt: number }[]; games: Game[] },
  r: Ratings,
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

  // The stage before: its tables, with rating won and lost there.
  const prevStage = [...event.stages].filter((s) => s.no < stageNo).sort((a, b) => b.no - a.no)[0];
  let results: DrawStory["results"] = null;
  let seeding: DrawStory["seeding"] = null;
  if (prevStage) {
    const prev = event.games.filter((g) => g.stageNo === prevStage.no && g.status !== "void");
    const played = prev.filter((g) => isDone(g) && !g.decider);
    if (played.length) {
      const moved = ratingFrom(r, new Set(played.map((g) => g.id)));
      const pm = stageMembers(prev);
      const lines = tally(prev);
      const rg: ResultGroup[] = [...pm.keys()].map((no) => {
        const gs = prev.filter((g) => g.groupNo === no);
        const rows = groupRank(pm.get(no)!.map((id) => lines.get(id) ?? { id, gp: 0, w: 0, l: 0, pf: 0, pa: 0 }))
          .map((x) => ({ id: x.id, w: x.w, l: x.l, pd: x.pf - x.pa, xp: moved.get(x.id)?.delta ?? 0, placing: moved.get(x.id)?.placing ?? true }));
        const done = gs.filter((g) => isDone(g) && !g.decider);
        return {
          label: labelFor(prevStage.kind, gs[0].groupName), rows, winner: done.length ? rows[0]?.id ?? null : null,
          points: done.reduce((n, g) => n + g.scoreA! + g.scoreB!, 0), xp: rows.reduce((n, r) => n + r.xp, 0),
        };
      });
      // The climber is the biggest mover whose number is on show.
      const deltas = [...moved.entries()].filter(([id, m]) => !m.placing && rg.some((g) => g.rows.some((x) => x.id === id))).map(([id, m]) => [id, m.delta] as const);
      const top = [...deltas].sort((a, b) => b[1] - a[1])[0];
      const close = [...played].sort((a, b) => Math.abs(a.scoreA! - a.scoreB!) - Math.abs(b.scoreA! - b.scoreB!))[0];
      // Rating won and given back, game by game, across everyone.
      let xpUp = 0, xpDown = 0;
      const ids = new Set(played.map((g) => g.id));
      for (const p of r.players.values()) for (const e of p.entries) if (ids.has(e.gameId)) { if (e.delta > 0) xpUp += e.delta; else xpDown += e.delta; }
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
        ? "Seeded on the day's points per game: everyone's rating ± from today's rounds over the games they played (plus two, so one short round can't beat a full day). Top four go to the Gold final."
        : "Brackets on the day's points: the top half plays the top half, the bottom half the bottom half, each split across two nets.";
      seeding = { rule, from, to: mine?.label ?? "the next stage" };
    }
  }

  // Finals: your points across today's rounds, and your place on them among the finalists.
  let day: DrawStory["day"] = null;
  if (stage.kind === "final") {
    const rounds = event.games.filter((g) => g.kind !== "final" && g.stageNo < stageNo && isDone(g) && !g.decider);
    const moved = ratingFrom(r, new Set(rounds.map((g) => g.id)));
    const everyone = groups.flatMap((g) => g.members);
    const pts = (id: string) => moved.get(id)?.delta ?? 0;
    // Ranked as the finals were drawn: points per game, cushioned (dayAverages).
    const played = (id: string) => rounds.filter((g) => [...g.a, ...g.b].includes(id)).length + POINTS_CUSHION;
    if (rounds.length && everyone.includes(me)) {
      const sorted = [...everyone].sort((a, b) => pts(b) / played(b) - pts(a) / played(a));
      day = { points: Math.round(pts(me)), rank: sorted.indexOf(me) + 1, of: everyone.length };
    }
  }

  return {
    eventId: event.id, eventTitle: event.title, kind: stage.kind, stageNo, createdAt: stage.createdAt,
    players: groups.reduce((n, g) => n + g.members.length, 0), nets: new Set(groups.map((g) => g.net)).size,
    results, seeding, groups, mine, day,
  };
}
