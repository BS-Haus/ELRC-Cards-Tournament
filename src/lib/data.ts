import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { players, events, entries, stages, games, eventPhotos } from "@/db/schema";
import { tally, groupWinner, groupRank, groupMembers, isDone, type Game, type StageKind, type Line, finalName, finalWinTitle } from "@/lib/cards";

/** `photo` is the profile picture's URL (versioned, so it can be cached for good), or null. */
export type PlayerLite = { id: string; name: string; color: string; claimed: boolean; photo: string | null };
export type EventRow = typeof events.$inferSelect;
export type EntryState = "going" | "here" | "out";
export type Entry = { playerId: string; state: EntryState; at: number };
export type StageRow = { id: string; no: number; kind: StageKind };

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
  const stageRows = sts.map((s) => ({ id: s.id, no: s.no, kind: s.kind as StageKind }));
  const stMap = new Map(sts.map((s) => [s.id, { id: s.id, no: s.no, kind: s.kind as StageKind }]));
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
import { finalsOf } from "@/lib/views";
import { buildRecap, type DayEvent, type Recap } from "@/lib/recap";
import { careerPoints, eventPoints } from "@/lib/levels";
import { buildStory, type Story } from "@/lib/story";

// ---------------------------------------------------------------------------------------------
// Players and profiles

export type PlayerStats = PlayerLite & Line & { events: number; tierWins: Record<string, number>; points: number };

/** Each event's games, for points (src/lib/levels.ts). */
const byEvent = (evs: { id: string; startsAt: Date }[], gs: (Game & { eventId: string })[]) =>
  evs.map((e) => ({ id: e.id, startsAt: e.startsAt.getTime(), games: gs.filter((g) => g.eventId === e.id) }));

async function everything() {
  const [ps, evs, ens, sts, gs] = await Promise.all([
    db.select().from(players),
    db.select().from(events),
    db.select().from(entries),
    db.select().from(stages),
    db.select().from(games),
  ]);
  const stMap = new Map(sts.map((s) => [s.id, { id: s.id, no: s.no, kind: s.kind as StageKind }]));
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
  const days = byEvent(evs, gs);
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
  return ps.map((p) => ({ ...lite(p), ...t.get(p.id)!, events: evByPlayer.get(p.id)?.size ?? 0, tierWins: tiers.get(p.id) ?? {}, points: careerPoints(days, p.id) }));
}

export type ProfileGame = { id: string; eventId: string; eventTitle: string; at: number; won: boolean; mine: number; theirs: number; partner: string; opponents: string[]; sub: boolean; label: string };
export type ProfileEvent = { id: string; title: string; startsAt: number; w: number; l: number; finish: string | null; points: number };
export type Profile = {
  player: PlayerLite;
  stats: Line & { events: number };
  tierWins: Record<string, number>;
  bestPartner: { id: string; w: number; gp: number } | null;
  events: ProfileEvent[];
  recent: ProfileGame[];
  names: Record<string, PlayerLite>;
  points: number;
};

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
        const table = groupRank(tally(gg.filter((g) => g.status !== "void"), groupMembers(gg)).values());
        const pos = table.findIndex((r) => r.id === id) + 1;
        const { winner } = groupWinner(gg);
        if (winner === id) tierWins[gg[0].groupName] = (tierWins[gg[0].groupName] ?? 0) + 1;
        finish = winner === id ? finalWinTitle(gg[0].groupName) : `${gg[0].groupName} final · ${ordinal(pos)}`;
      }
    }
    return { id: eid, title: ev.title, startsAt: ev.startsAt.getTime(), w: line.w, l: line.l, finish, points: eventPoints(eg, id).total };
  }).sort((a, b) => b.startsAt - a.startsAt);

  const recent: ProfileGame[] = mine
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 30)
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
      };
    });

  return { player: lite(me), stats: { ...stats, events: evIds.size }, tierWins, bestPartner: bp ? { id: bp[0], ...bp[1] } : null, events, recent, names, points: careerPoints(byEvent(evs, gs), id) };
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
    const earned = eventPoints(ev.games, recap.me.id);
    const after = careerPoints(days, recap.me.id, ev.startsAt);
    recap.progress = { earned, before: after - earned.total, after };
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
