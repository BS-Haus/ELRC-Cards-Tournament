import "server-only";
import { and, asc, desc, eq, gt, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { players, events, entries, stages, games, eventPhotos } from "@/db/schema";
import { tally, groupWinner, groupRank, groupMembers, isDone, type Game, type StageKind, type Line, finalName, finalWinTitle } from "@/lib/cards";

/** `photo` is the profile picture's URL (versioned, so it can be cached for good), or null. */
export type PlayerLite = { id: string; name: string; color: string; claimed: boolean; photo: string | null };
export type EventRow = typeof events.$inferSelect;
export type EntryState = "going" | "here" | "out";
export type Entry = { playerId: string; state: EntryState; at: number };
export type StageRow = { id: string; no: number; kind: StageKind; sitting: string[] };

export type EventView = {
  event: EventRow;
  entries: Entry[];
  stages: StageRow[];
  games: Game[];
  people: Record<string, PlayerLite>;
  /** Photos from the day, oldest first: the first one leads the tournament story. */
  photos: EventPhoto[];
};

export type EventPhoto = { id: string; url: string; by: string | null };
export const photoOf = (p: { id: string; createdAt: Date; byId: string | null }): EventPhoto => ({ id: p.id, url: `/ph/${p.id}?v=${p.createdAt.getTime()}`, by: p.byId });

/** An event's photos, oldest first (no image data: that's served by /ph/[id]). */
export async function eventPhotosOf(eventId: string): Promise<EventPhoto[]> {
  const rows = await db.select({ id: eventPhotos.id, createdAt: eventPhotos.createdAt, byId: eventPhotos.byId }).from(eventPhotos).where(eq(eventPhotos.eventId, eventId)).orderBy(asc(eventPhotos.createdAt));
  return rows.map(photoOf);
}

export const photoUrl = (p: { id: string; avatarAt: Date | null }) => (p.avatarAt ? `/a/${p.id}?v=${p.avatarAt.getTime()}` : null);
const lite = (p: typeof players.$inferSelect): PlayerLite => ({ id: p.id, name: p.name, color: p.color, claimed: !!p.pinHash, photo: photoUrl(p) });

function toGame(g: typeof games.$inferSelect, st: Map<string, StageRow>): Game {
  const s = st.get(g.stageId)!;
  return {
    id: g.id, stageNo: s.no, kind: s.kind, groupNo: g.groupNo, groupName: s.kind === "final" ? finalName(g.groupName) : g.groupName, seq: g.seq, ord: g.ord, net: g.net,
    a: [g.a1, g.a2], b: [g.b1, g.b2], subs: g.subs ?? [], scoreA: g.scoreA, scoreB: g.scoreB, status: g.status as Game["status"], decider: g.decider,
  };
}

export async function allPlayers(): Promise<PlayerLite[]> {
  return (await db.select().from(players).orderBy(asc(players.name))).map(lite);
}

export async function getEventView(id: string): Promise<EventView | null> {
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) return null;
  const [ens, sts, gs, photos] = await Promise.all([
    db.select().from(entries).where(eq(entries.eventId, id)).orderBy(asc(entries.createdAt)),
    db.select().from(stages).where(eq(stages.eventId, id)).orderBy(asc(stages.no)),
    db.select().from(games).where(eq(games.eventId, id)),
    eventPhotosOf(id),
  ]);
  const stageRows = sts.map((s) => ({ id: s.id, no: s.no, kind: s.kind as StageKind, sitting: s.sitting ?? [] }));
  const stMap = new Map(sts.map((s) => [s.id, { id: s.id, no: s.no, kind: s.kind as StageKind, sitting: s.sitting ?? [] }]));
  const ids = new Set<string>(ens.map((e) => e.playerId));
  gs.forEach((g) => [g.a1, g.a2, g.b1, g.b2].forEach((x) => ids.add(x)));
  const ps = ids.size ? await db.select().from(players).where(inArray(players.id, [...ids])) : [];
  return {
    event,
    entries: ens.map((e) => ({ playerId: e.playerId, state: e.state as EntryState, at: e.createdAt.getTime() })),
    stages: stageRows,
    games: gs.map((g) => toGame(g, stMap)),
    people: Object.fromEntries(ps.map((p) => [p.id, lite(p)])),
    photos,
  };
}

export type EventCard = EventRow & { going: number; here: number; mine: EntryState | null; champion: string | null };

/** The live event the Tournament tab opens straight into, if there is one (see liveEventId). */
export async function liveNowId(): Promise<string | null> {
  const rows = await db.select({ id: events.id, status: events.status, startsAt: events.startsAt }).from(events).where(eq(events.status, "live"));
  return liveEventId(rows, Date.now());
}

/** Today's event for the Me tab's check-in: the live one, or else one starting within the next
 *  12 hours (or that started up to 6 hours ago and hasn't begun), so people can check in first. */
export async function todayEventId(): Promise<string | null> {
  const live = await liveNowId();
  if (live) return live;
  const now = Date.now();
  const rows = await db.select({ id: events.id, startsAt: events.startsAt }).from(events).where(eq(events.status, "upcoming"));
  const soon = rows.filter((e) => e.startsAt.getTime() - now < 12 * 3600_000 && now - e.startsAt.getTime() < 6 * 3600_000)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return soon[0]?.id ?? null;
}

export async function getEventCards(me: string | null): Promise<{ upcoming: EventCard[]; live: EventCard[]; past: EventCard[] }> {
  const evs = await db.select().from(events).orderBy(desc(events.startsAt));
  const ens = evs.length ? await db.select().from(entries).where(inArray(entries.eventId, evs.map((e) => e.id))) : [];
  const done = evs.filter((e) => e.status === "done").slice(0, 12);
  const champs = new Map<string, string | null>();
  for (const e of done) {
    const v = await getEventView(e.id);
    const fin = v ? finalsOf(v) : null;
    const gold = fin?.groups[0];
    champs.set(e.id, gold?.winner ? v!.people[gold.winner]?.name ?? null : null);
  }
  const card = (e: EventRow): EventCard => {
    const mine = ens.filter((x) => x.eventId === e.id);
    return {
      ...e,
      going: mine.filter((x) => x.state !== "out").length,
      here: mine.filter((x) => x.state === "here").length,
      mine: (me && (mine.find((x) => x.playerId === me)?.state as EntryState)) || null,
      champion: champs.get(e.id) ?? null,
    };
  };
  return {
    live: evs.filter((e) => e.status === "live").map(card),
    upcoming: evs.filter((e) => e.status === "upcoming").reverse().map(card),
    past: done.map(card),
  };
}

export { groupsOf, finalsOf, eventStandings, type GroupView } from "@/lib/views";
import { finalsOf, liveEventId } from "@/lib/views";
import { buildRecap, type DayEvent, type Recap } from "@/lib/recap";
import { buildStory, type Story } from "@/lib/story";
import { buildMoments, gameMoments, matchMoments, type MomentSlide } from "@/lib/moments";
import { buildDrawStory, type DrawStory } from "@/lib/drawStory";
import { ladder, type LadderRow, type PlacingRow } from "@/lib/ladder";
import { rate, eventChange, PROV_N, type Ratings, type Ledger } from "@/lib/standings";
import { roundsFrom, ladderStory, type LadderStoryData } from "@/lib/netLadder";

// ---------------------------------------------------------------------------------------------
// Players and profiles

/** `rating` and `games` decide their tier (src/lib/levels.ts): Fresh Meat until they've placed. */
export type PlayerStats = PlayerLite & Line & { events: number; tierWins: Record<string, number>; rating: number; games: number };

// Ratings (src/lib/standings.ts), refitted from every game. The ledger from the last call is kept
// in memory, so a new score only fits what changed; a cold start refits the lot (fine at a club's
// size: a season of weekends is a few hundred games).
let lastLedger: Ledger | undefined;
function ratingsOf(evs: { id: string; startsAt: Date; groupTo: number; finalTo: number }[], gs: (Game & { eventId: string })[]): Ratings {
  const r = rate(evs.map((e) => ({ id: e.id, startsAt: e.startsAt.getTime(), groupTo: e.groupTo, finalTo: e.finalTo, games: gs.filter((g) => g.eventId === e.id) })), { ledger: lastLedger });
  lastLedger = r.ledger;
  return r;
}

async function everything() {
  const [ps, evs, ens, sts, gs] = await Promise.all([
    db.select().from(players),
    db.select().from(events),
    db.select().from(entries),
    db.select().from(stages),
    db.select().from(games),
  ]);
  const stMap = new Map(sts.map((s) => [s.id, { id: s.id, no: s.no, kind: s.kind as StageKind, sitting: s.sitting ?? [] }]));
  return { ps, evs, ens, sts, gs: gs.map((g) => ({ ...toGame(g, stMap), eventId: g.eventId, updatedAt: g.updatedAt.getTime() })) };
}

/** Finals winners per event: tier name → player id. */
function tierWinners(evGames: Game[]): { tier: string; winner: string }[] {
  const fin = evGames.filter((g) => g.kind === "final");
  if (!fin.length) return [];
  const lastStage = Math.max(...fin.map((g) => g.stageNo));
  const inStage = fin.filter((g) => g.stageNo === lastStage);
  const out: { tier: string; winner: string }[] = [];
  for (const no of new Set(inStage.map((g) => g.groupNo))) {
    const gg = inStage.filter((g) => g.groupNo === no);
    const { winner } = groupWinner(gg);
    if (winner) out.push({ tier: gg[0].groupName, winner });
  }
  return out;
}

export async function getPlayerStats(): Promise<PlayerStats[]> {
  const { ps, evs, ens, gs } = await everything();
  const t = tally(gs.filter((g) => g.status === "done"), ps.map((p) => p.id));
  const r = ratingsOf(evs, gs);
  const evByPlayer = new Map<string, Set<string>>();
  for (const e of ens) if (e.state === "here") (evByPlayer.get(e.playerId) ?? evByPlayer.set(e.playerId, new Set()).get(e.playerId)!).add(e.eventId);
  for (const g of gs) if (isDone(g)) for (const id of [...g.a, ...g.b]) if (!g.subs.includes(id)) (evByPlayer.get(id) ?? evByPlayer.set(id, new Set()).get(id)!).add(g.eventId);
  const tiers = new Map<string, Record<string, number>>();
  for (const evId of new Set(gs.map((g) => g.eventId))) {
    for (const { tier, winner } of tierWinners(gs.filter((g) => g.eventId === evId))) {
      const r = tiers.get(winner) ?? tiers.set(winner, {}).get(winner)!;
      r[tier] = (r[tier] ?? 0) + 1;
    }
  }
  return ps.map((p) => ({ ...lite(p), ...t.get(p.id)!, events: evByPlayer.get(p.id)?.size ?? 0, tierWins: tiers.get(p.id) ?? {}, rating: r.players.get(p.id)?.rating ?? 0, games: r.players.get(p.id)?.games ?? 0 }));
}

/** `xp`: the rating the game moved them by (null while they were placing: `placing` is which of
 *  their placement games it was). */
export type ProfileGame = { id: string; eventId: string; eventTitle: string; at: number; won: boolean; mine: number; theirs: number; partner: string; opponents: string[]; sub: boolean; label: string; xp: number | null; placing: number | null };
/** `change` is the rating that weekend moved them by, `after` where it left them (null while placing). */
export type ProfileEvent = { id: string; title: string; startsAt: number; live: boolean; w: number; l: number; finish: string | null; change: number | null; after: number | null };
export type Profile = {
  player: PlayerLite;
  stats: Line & { events: number };
  tierWins: Record<string, number>;
  bestPartner: { id: string; w: number; gp: number } | null;
  events: ProfileEvent[];
  recent: ProfileGame[];
  names: Record<string, PlayerLite>;
  rating: number;
  /** Counted games: below PROV_N they're still placing. */
  games: number;
  /** Position among placed players (0 while placing) and how many are placed. */
  rank: number;
  of: number;
  /** Their last five results, oldest first, and their rating after each of their latest placed games. */
  form: ("W" | "L")[];
  trail: number[];
  /** Biggest winning margin and longest run of wins, over every counted game. */
  biggestWin: number;
  bestRun: number;
};

/** The headline of a player's weekends: their rating and place, their totals, A-final titles and
 *  every weekend. Shown on the Me page and at the top of a profile. */
export type Season = { id: string; rating: number; games: number; position: number; of: number; stats: Line & { events: number }; titles: number; events: ProfileEvent[] };

export async function getSeason(pr: Profile): Promise<Season> {
  return { id: pr.player.id, rating: pr.rating, games: pr.games, stats: pr.stats, titles: pr.tierWins.A ?? 0, events: pr.events, position: pr.rank, of: pr.of };
}

/** One player's rating at one weekend so far, for the event page's You tab (null if none yet, or
 *  while they're still placing: `games` is how many they've played in all). */
export async function weekendXp(eventId: string, playerId: string): Promise<{ before: number; after: number; games: number } | null> {
  const { evs, gs } = await everything();
  const r = ratingsOf(evs, gs);
  const c = eventChange(r, playerId, eventId);
  return c ? { before: c.before, after: c.after, games: c.gamesBefore + c.games } : null;
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { ps, evs, ens, gs } = await everything();
  const me = ps.find((p) => p.id === id);
  if (!me) return null;
  const names = Object.fromEntries(ps.map((p) => [p.id, lite(p)]));
  const evById = new Map(evs.map((e) => [e.id, e]));
  const mine = gs.filter((g) => isDone(g) && [...g.a, ...g.b].includes(id));
  const counted = mine.filter((g) => !g.subs.includes(id));
  const stats = tally(counted, [id]).get(id)!;

  const partners = new Map<string, { w: number; gp: number }>();
  for (const g of counted) {
    const side = g.a.includes(id) ? g.a : g.b;
    const mate = side[0] === id ? side[1] : side[0];
    const won = g.a.includes(id) ? g.scoreA! > g.scoreB! : g.scoreB! > g.scoreA!;
    const r = partners.get(mate) ?? partners.set(mate, { w: 0, gp: 0 }).get(mate)!;
    r.gp++; if (won) r.w++;
  }
  const bp = [...partners.entries()].filter(([, r]) => r.gp >= 2).sort((x, y) => y[1].w - x[1].w || y[1].gp - x[1].gp)[0];

  const r = ratingsOf(evs, gs);
  const rated = r.players.get(id);
  const evIds = new Set<string>([...counted.map((g) => g.eventId), ...ens.filter((e) => e.playerId === id && e.state === "here").map((e) => e.eventId)]);
  const tierWins: Record<string, number> = {};
  const events: ProfileEvent[] = [...evIds].map((eid) => {
    const ev = evById.get(eid)!;
    const eg = gs.filter((g) => g.eventId === eid);
    const line = tally(counted.filter((g) => g.eventId === eid), [id]).get(id)!;
    let finish: string | null = null;
    const fin = eg.filter((g) => g.kind === "final");
    if (fin.length) {
      const last = Math.max(...fin.map((g) => g.stageNo));
      const myGroup = fin.filter((g) => g.stageNo === last && [...g.a, ...g.b].includes(id) && !g.subs.includes(id));
      if (myGroup.length) {
        const gg = fin.filter((g) => g.stageNo === last && g.groupNo === myGroup[0].groupNo);
        const table = groupRank(tally(gg.filter((g) => g.status !== "void"), groupMembers(gg)).values(), gg);
        const pos = table.findIndex((r) => r.id === id) + 1;
        const { winner } = groupWinner(gg);
        if (winner === id) tierWins[gg[0].groupName] = (tierWins[gg[0].groupName] ?? 0) + 1;
        finish = winner === id ? finalWinTitle(gg[0].groupName) : `${gg[0].groupName} final · ${ordinal(pos)}`;
      }
    }
    const wk = eventChange(r, id, eid);
    const placed = wk && wk.gamesBefore + wk.games >= PROV_N;
    // Only the part of the weekend after they placed shows as a change.
    const shownFrom = wk && placed ? rated!.entries.filter((e) => e.eventId === eid && e.gamesBefore >= PROV_N)[0]?.ratingBefore : undefined;
    return { id: eid, title: ev.title, startsAt: ev.startsAt.getTime(), live: ev.status === "live", w: line.w, l: line.l, finish, change: placed && shownFrom !== undefined ? wk!.after - shownFrom : null, after: placed ? wk!.after : null };
  }).sort((a, b) => b.startsAt - a.startsAt);

  const latest = mine.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
  const entry = new Map((rated?.entries ?? []).map((e) => [e.gameId, e]));
  const recent: ProfileGame[] = latest
    .map((g) => {
      const onA = g.a.includes(id);
      const side = onA ? g.a : g.b, other = onA ? g.b : g.a;
      const ev = evById.get(g.eventId)!;
      return {
        id: g.id, eventId: g.eventId, eventTitle: ev.title, at: ev.startsAt.getTime(),
        won: onA ? g.scoreA! > g.scoreB! : g.scoreB! > g.scoreA!,
        mine: onA ? g.scoreA! : g.scoreB!, theirs: onA ? g.scoreB! : g.scoreA!,
        partner: side[0] === id ? side[1] : side[0], opponents: [...other], sub: g.subs.includes(id),
        label: g.kind === "final" ? `${g.groupName} final` : `Group ${g.groupName}`,
        xp: entry.has(g.id) && entry.get(g.id)!.gamesBefore >= PROV_N ? entry.get(g.id)!.delta : null,
        placing: entry.has(g.id) && entry.get(g.id)!.gamesBefore < PROV_N ? entry.get(g.id)!.gamesBefore + 1 : null,
      };
    });

  const es = rated?.entries ?? [];
  let run = 0, bestRun = 0, biggestWin = 0;
  for (const e of es) {
    if (e.won) { run++; bestRun = Math.max(bestRun, run); biggestWin = Math.max(biggestWin, e.gf - e.ga); } else run = 0;
  }
  return {
    player: lite(me), stats: { ...stats, events: evIds.size }, tierWins, bestPartner: bp ? { id: bp[0], ...bp[1] } : null, events, recent, names,
    rating: rated?.rating ?? 0, games: rated?.games ?? 0, rank: rated?.rank ?? 0, of: r.ranked.length,
    form: es.slice(-5).map((e) => (e.won ? "W" : "L")), trail: es.filter((e) => e.gamesBefore + 1 >= PROV_N).map((e) => e.ratingAfter), biggestWin, bestRun,
  };
}

// ---------------------------------------------------------------------------------------------
// The ladder (src/lib/ladder.ts)

/** Placed players by rating, then everyone still placing. While an event is live (or on the day
 *  it finished) each row says what it did to them. */
export async function getLadder(): Promise<{ rows: LadderRow[]; placing: PlacingRow[]; eventId: string | null }> {
  const { evs, gs } = await everything();
  const today = evs.filter((e) => e.status === "live" || (e.status === "done" && Date.now() - e.startsAt.getTime() < 20 * 3600_000)).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
  return { ...ladder(ratingsOf(evs, gs), today?.id ?? null), eventId: today?.id ?? null };
}

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

// ---------------------------------------------------------------------------------------------
// Recaps

/** One event's recap from a player's point of view (src/lib/recap.ts), with everyone's names. */
export async function getRecap(eventId: string, playerId: string | null): Promise<{ recap: Recap; names: Record<string, PlayerLite> } | null> {
  const { ps, evs, gs } = await everything();
  const days: DayEvent[] = evs.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.getTime(), status: e.status, games: gs.filter((g) => g.eventId === e.id) }));
  const ev = days.find((d) => d.id === eventId);
  if (!ev) return null;
  const who = playerId && ps.some((p) => p.id === playerId) ? playerId : null;
  const recap = buildRecap(ev, who, days);
  if (recap.me) {
    // What the weekend did to their rating. Each game's change is fixed when it's played, so later
    // weekends don't alter this one's.
    const c = eventChange(ratingsOf(evs, gs), recap.me.id, ev.id);
    recap.progress = c ? { before: c.before, after: c.after, gamesBefore: c.gamesBefore, games: c.games } : null;
  }
  return { recap, names: Object.fromEntries(ps.map((p) => [p.id, lite(p)])) };
}

/** One event's tournament story (src/lib/story.ts), with everyone's names. */
export async function getStory(eventId: string): Promise<{ story: Story; names: Record<string, PlayerLite>; photos: EventPhoto[] } | null> {
  const { ps, evs, gs } = await everything();
  const days: DayEvent[] = evs.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.getTime(), status: e.status, games: gs.filter((g) => g.eventId === e.id) }));
  const ev = days.find((d) => d.id === eventId);
  if (!ev) return null;
  return { story: buildStory(ev, days), names: Object.fromEntries(ps.map((p) => [p.id, lite(p)])), photos: await eventPhotosOf(eventId) };
}

// ---------------------------------------------------------------------------------------------
// Level moments: your games scored since you last looked, as a story (src/lib/moments.ts).

export type Moments = { slides: MomentSlide[]; upTo: number; names: Record<string, PlayerLite>; me: PlayerLite; ladder?: LadderNext };
/** After a ladder game: the next round if this score finished the round (who's on which net),
 *  or the nets still playing. */
export type LadderNext = { round: number; next: { net: number; a: [string, string]; b: [string, string] }[] | null; sitting: string[]; waiting: number[] };

export async function myMoments(playerId: string): Promise<Moments | null> {
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p) return null;
  // Cheap check first (this runs every few seconds per signed-in phone): anything new at all?
  // Ladder games never pop up on players' phones: the one card on the scorer's phone covers them.
  const [hit] = await db.select({ id: games.id }).from(games).innerJoin(events, eq(events.id, games.eventId))
    .where(and(eq(games.status, "done"), ne(events.format, "ladder"), gt(games.updatedAt, p.xpSeenAt), or(eq(games.a1, playerId), eq(games.a2, playerId), eq(games.b1, playerId), eq(games.b2, playerId))))
    .limit(1);
  if (!hit) return null;
  const { ps, evs, gs } = await everything();
  const { slides, upTo } = buildMoments(momentEvents(evs.filter((e) => e.format !== "ladder"), gs), ratingsOf(evs, gs), playerId, p.xpSeenAt.getTime());
  if (!slides.length) return null;
  return { slides, upTo, names: Object.fromEntries(ps.map((x) => [x.id, lite(x)])), me: lite(p) };
}

// ---------------------------------------------------------------------------------------------
// Draw stories: a stage you're in, drawn since you last looked (src/lib/drawStory.ts).

export type DrawFeed = { story: DrawStory; names: Record<string, PlayerLite>; me: PlayerLite };

export async function myDrawStory(playerId: string): Promise<DrawFeed | null> {
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p) return null;
  // Cheap check first: the newest stage drawn since they looked that has them in a game.
  const [hit] = await db.select({ id: stages.id, eventId: stages.eventId, no: stages.no }).from(stages)
    .innerJoin(games, eq(games.stageId, stages.id))
    .where(and(gt(stages.createdAt, p.stageSeenAt), ne(stages.kind, "ladder"), or(eq(games.a1, playerId), eq(games.a2, playerId), eq(games.b1, playerId), eq(games.b2, playerId))))
    .orderBy(desc(stages.createdAt)).limit(1);
  if (!hit) return null;
  const { ps, evs, sts, gs } = await everything();
  const ev = evs.find((e) => e.id === hit.eventId);
  if (!ev) return null;
  const story = buildDrawStory(
    { id: ev.id, title: ev.title, nets: ev.nets, stages: sts.filter((s) => s.eventId === ev.id).map((s) => ({ no: s.no, kind: s.kind as StageKind, createdAt: s.createdAt.getTime() })), games: gs.filter((g) => g.eventId === ev.id) },
    ratingsOf(evs, gs), hit.no, playerId,
  );
  if (!story) return null;
  return { story, names: Object.fromEntries(ps.map((x) => [x.id, lite(x)])), me: lite(p) };
}

/** True while `playerId` is in this event's newest stage but hasn't seen its draw story yet: the
 *  event page keeps that stage's groups (and their games) under wraps until they have, so the
 *  story is how they find out. */
export async function drawPending(eventId: string, playerId: string): Promise<boolean> {
  const [p] = await db.select({ seen: players.stageSeenAt }).from(players).where(eq(players.id, playerId));
  if (!p) return false;
  const [st] = await db.select({ id: stages.id, at: stages.createdAt }).from(stages).where(eq(stages.eventId, eventId)).orderBy(desc(stages.no)).limit(1);
  if (!st || st.at <= p.seen) return false;
  const [hit] = await db.select({ id: games.id }).from(games)
    .where(and(eq(games.stageId, st.id), or(eq(games.a1, playerId), eq(games.a2, playerId), eq(games.b1, playerId), eq(games.b2, playerId))))
    .limit(1);
  return !!hit;
}

type Everything = Awaited<ReturnType<typeof everything>>;
const momentEvents = (evs: Everything["evs"], gs: Everything["gs"]) =>
  evs.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt.getTime(), games: gs.filter((g) => g.eventId === e.id) }));

/** The story of one of a player's past games, for tapping it on their profile (null if it isn't
 *  a counted game of theirs). */
export async function gameStory(playerId: string, gameId: string): Promise<Moments | null> {
  const { ps, evs, gs } = await everything();
  const p = ps.find((x) => x.id === playerId);
  const g = gs.find((x) => x.id === gameId);
  if (!p || !g) return null;
  const slides = gameMoments(momentEvents(evs, gs), ratingsOf(evs, gs), playerId, gameId);
  if (!slides.length) return null;
  return { slides, upTo: g.updatedAt, names: Object.fromEntries(ps.map((x) => [x.id, lite(x)])), me: lite(p) };
}

/** The story of a game just scored, for the phone that scored it (see matchMoments). `played`:
 *  the viewer was in it, so it's their story of the game and can be marked seen. */
export async function gameResult(gameId: string, viewer: string | null): Promise<(Moments & { played: boolean }) | null> {
  const { ps, evs, gs } = await everything();
  const g = gs.find((x) => x.id === gameId);
  const me = viewer ? ps.find((x) => x.id === viewer) : undefined;
  if (!g || g.status !== "done" || !me) return null;
  const ev = evs.find((e) => e.id === g.eventId);
  // On a ladder it's one small card, like the ranked app's: the game for everyone, then where
  // everyone goes next. Nothing personal follows it.
  const isLadder = ev?.format === "ladder";
  const slides = matchMoments(momentEvents(evs, gs), ratingsOf(evs, gs), gameId, isLadder ? null : viewer);
  if (!slides.length) return null;
  let ladder: LadderNext | undefined;
  if (isLadder) {
    const sts = await db.select().from(stages).where(eq(stages.eventId, g.eventId));
    const nextStage = sts.find((x) => x.no === g.stageNo + 1 && x.kind === "ladder");
    const evGames = gs.filter((x) => x.eventId === g.eventId);
    ladder = nextStage
      ? { round: sts.filter((x) => x.kind === "ladder" && x.no <= nextStage.no).length, next: evGames.filter((x) => x.stageNo === nextStage.no).sort((x, y) => x.net - y.net).map((x) => ({ net: x.net, a: x.a, b: x.b })), sitting: nextStage.sitting ?? [], waiting: [] }
      : { round: sts.filter((x) => x.kind === "ladder" && x.no <= g.stageNo).length, next: null, sitting: [], waiting: evGames.filter((x) => x.stageNo === g.stageNo && x.status === "todo").map((x) => x.net).sort((x, y) => x - y) };
  }
  return { slides, upTo: g.updatedAt, names: Object.fromEntries(ps.map((x) => [x.id, lite(x)])), me: lite(me), played: !isLadder && [...g.a, ...g.b].includes(me.id), ladder };
}

/** Everyone's rating now (placed or not: the ladder seeds by it either way), by player id. */
export async function ratingNow(): Promise<Map<string, number>> {
  const { evs, gs } = await everything();
  const r = ratingsOf(evs, gs);
  return new Map([...r.players.values()].map((p) => [p.id, p.rating]));
}

// ---------------------------------------------------------------------------------------------
// The ladder (src/lib/netLadder.ts)

/** One player's day on a ladder event: their rating (null while placing, with games so far
 *  instead), what today has done to it, and their record today. */
export type LadderDayRow = { id: string; rating: number | null; placed: number | null; today: number | null; w: number; l: number };

/** Everyone in a ladder event (checked in or played), best rating first, placing players last. */
export async function ladderDay(eventId: string): Promise<LadderDayRow[]> {
  const { evs, ens, gs } = await everything();
  const r = ratingsOf(evs, gs);
  const ids = new Set<string>(ens.filter((e) => e.eventId === eventId && e.state !== "out").map((e) => e.playerId));
  for (const g of gs) if (g.eventId === eventId && isDone(g)) [...g.a, ...g.b].forEach((id) => ids.add(id));
  const rows = [...ids].map((id): LadderDayRow => {
    const p = r.players.get(id);
    const es = p?.entries.filter((e) => e.eventId === eventId) ?? [];
    const placedNow = !!p && !p.provisional;
    const ch = eventChange(r, id, eventId);
    // Today's change only counts from a number that was on show: a game that placed you starts it.
    const today = ch && placedNow ? p!.rating - (ch.gamesBefore >= PROV_N ? ch.before : es.find((e) => e.gamesBefore + 1 >= PROV_N)?.ratingAfter ?? p!.rating) : null;
    return { id, rating: placedNow ? p!.rating : null, placed: placedNow ? null : p?.games ?? 0, today, w: es.filter((e) => e.won).length, l: es.filter((e) => !e.won).length };
  });
  return rows.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.placed ?? 0) - (a.placed ?? 0) || a.id.localeCompare(b.id));
}

/** A finished (or running) ladder day's story, from the viewer's side when they played. */
export async function getLadderStory(eventId: string, viewer: string | null): Promise<{ event: { id: string; title: string; startsAt: number }; story: LadderStoryData; names: Record<string, PlayerLite> } | null> {
  const v = await getEventView(eventId);
  if (!v || v.event.format !== "ladder") return null;
  const [day, { ps, evs, gs }] = await Promise.all([ladderDay(eventId), everything()]);
  const r = ratingsOf(evs, gs);
  const rounds = roundsFrom(v.stages, v.games);
  // Each game's side-A chance going in, keyed as the story keys them: round number, then net.
  const roundOf = new Map(v.stages.filter((s) => s.kind === "ladder").sort((a, b) => a.no - b.no).map((s, i) => [s.no, i + 1]));
  const winChance = new Map<string, number>();
  for (const g of v.games) {
    const e = r.players.get(g.a[0])?.entries.find((x) => x.gameId === g.id);
    if (e && roundOf.has(g.stageNo)) winChance.set(`${roundOf.get(g.stageNo)}:${g.net}`, e.winProb);
  }
  const story = ladderStory(rounds, new Map(day.map((x) => [x.id, x.today])), winChance, viewer);
  return { event: { id: v.event.id, title: v.event.title, startsAt: v.event.startsAt.getTime() }, story, names: Object.fromEntries(ps.map((x) => [x.id, lite(x)])) };
}
