"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, events, entries, stages, games, eventPhotos } from "@/db/schema";
import { hashPin, verifyPin, PIN_RE, organiserCodeMatches } from "@/lib/auth/pin";
import { codeAttemptAllowed, clearAttempts, signupAllowed } from "@/lib/auth/rateLimit";
import { getSession, setSession, clearSession, isOrganiser, ORGANISER_HOURS } from "@/lib/auth/session";
import { planStage, shuffle, mixedOrder, validScore, withSub, drawPool, seedOrder, spreadRepeats, decideTie, currentMembers, remainingGames, type Game, type StageKind } from "@/lib/cards";
import { getEventView, groupsOf, myMoments, myDrawStory, gameStory, gameResult, ratingNow, type Moments, type DrawFeed } from "@/lib/data";
import { nextRound, roundsFrom, roundDone } from "@/lib/netLadder";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

// Server actions are public endpoints, so every argument is checked before it's used.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const handleOf = (name: string) => name.toLowerCase();
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const COLORS = ["#BEF264", "#5EEAD4", "#F9A8D4", "#93C5FD", "#FDA4AF", "#FCD34D", "#C4B5FD", "#FDBA74", "#67E8F9", "#A3E635", "#F0ABFC", "#FCA5A5"];
const fail = (error: string): Result => ({ ok: false, error });

function refresh(eventId?: string) {
  revalidatePath("/", "layout");
  if (eventId) revalidatePath(`/e/${eventId}`);
}

/** The signed-in player's session, or null. A cookie whose player no longer exists (the data was
 *  cleared, say) counts as signed out, so nothing tries to write under a missing player. */
async function me() {
  const s = await getSession();
  if (!s?.playerId || !isUuid(s.playerId)) return null;
  const [p] = await db.select({ id: players.id }).from(players).where(eq(players.id, s.playerId));
  return p ? s : null;
}
async function requireOrganiser(): Promise<Result | null> {
  return isOrganiser(await getSession()) ? null : fail("Organisers only. Unlock with the organiser code on the Me tab.");
}

// ---------------------------------------------------------------------------------------------
// Accounts: a name and a 4-digit code. No email.

/** Step one of joining or signing in, which are the same thing: is this name someone coming back,
 *  a walk-in an organiser added (to claim with a code), or someone new? Names are public on the
 *  Players tab already, so this gives nothing away. */
export async function whoIs(nameIn: string): Promise<{ ok: true; kind: "back" | "claim" | "new"; name: string } | { ok: false; error: string }> {
  const name = cleanName(nameIn);
  if (name.length < 2 || name.length > 24) return { ok: false, error: "Use a name between 2 and 24 characters." };
  const [p] = await db.select({ name: players.name, pinHash: players.pinHash }).from(players).where(eq(players.handle, handleOf(name)));
  return { ok: true, kind: !p ? "new" : p.pinHash ? "back" : "claim", name: p?.name ?? name };
}

export async function signUp(nameIn: string, pin: string): Promise<Result> {
  const name = cleanName(nameIn);
  if (name.length < 2 || name.length > 24) return fail("Use a name between 2 and 24 characters.");
  if (typeof pin !== "string" || !PIN_RE.test(pin)) return fail("Pick a 4-digit code.");
  if (!(await signupAllowed())) return fail("Too many sign-ups from this device. Try again later.");
  const [existing] = await db.select().from(players).where(eq(players.handle, handleOf(name)));
  let id: string;
  if (existing?.pinHash) return fail(`${existing.name} already has a profile. Sign in instead, or add an initial to your name.`);
  if (existing) {
    // A walk-in the organiser added on the day: signing up with that name claims their history.
    await db.update(players).set({ pinHash: await hashPin(pin), name }).where(eq(players.id, existing.id));
    id = existing.id;
  } else {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(players);
    const [row] = await db.insert(players).values({ handle: handleOf(name), name, color: COLORS[n % COLORS.length], pinHash: await hashPin(pin) }).returning({ id: players.id });
    id = row.id;
  }
  const s = await getSession();
  await setSession({ playerId: id, name, orgUntil: s?.orgUntil });
  refresh();
  return { ok: true, id };
}

export async function signIn(nameIn: string, pin: string): Promise<Result> {
  const name = cleanName(nameIn);
  if (!name || typeof pin !== "string" || !PIN_RE.test(pin)) return fail("Enter your name and 4-digit code.");
  const handle = handleOf(name);
  if (!(await codeAttemptAllowed("pin", handle))) return fail("Too many tries. Wait 15 minutes, or ask an organiser.");
  const [p] = await db.select().from(players).where(eq(players.handle, handle));
  if (!p) { await pause(400); return fail("No profile with that name. Check the spelling, or sign up."); }
  if (!p.pinHash) return fail(`${p.name} was added on the day and has no code yet. Use Sign up with this name to claim it.`);
  if (!(await verifyPin(pin, p.pinHash))) { await pause(700); return fail("Wrong code."); }
  await clearAttempts("pin", handle);
  const s = await getSession();
  await setSession({ playerId: p.id, name: p.name, orgUntil: s?.orgUntil });
  refresh();
  return { ok: true, id: p.id };
}

/** Set (or, with null, remove) your profile picture: a small square JPEG the phone has already
 *  resized (AvatarPicker), as a data URL. Anything else, or anything big, is refused. */
const AVATAR_RE = /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const AVATAR_MAX = 120_000; // characters of base64: ~90 KB, far above a 320px JPEG
export async function setAvatar(dataUrl: string | null): Promise<Result> {
  const s = await me(); if (!s) return fail("Sign in first.");
  if (dataUrl !== null && (typeof dataUrl !== "string" || dataUrl.length > AVATAR_MAX || !AVATAR_RE.test(dataUrl))) return fail("That photo couldn't be used. Try another.");
  await db.update(players).set({ avatar: dataUrl, avatarAt: dataUrl ? new Date() : null }).where(eq(players.id, s.playerId!));
  refresh();
  return { ok: true };
}

export async function signOut(): Promise<Result> {
  await clearSession();
  refresh();
  return { ok: true };
}

export async function unlockOrganiser(code: string): Promise<Result> {
  const configured = process.env.ORGANISER_CODE;
  if (!configured || configured.length < 8) return fail("No organiser code is set up yet (ORGANISER_CODE in Vercel, 8+ characters).");
  if (!(await codeAttemptAllowed("org", "all"))) return fail("Too many tries. Wait 15 minutes.");
  if (!organiserCodeMatches(code, configured)) { await pause(700); return fail("Wrong organiser code."); }
  const s = await getSession();
  await setSession({ playerId: s?.playerId ?? null, name: s?.name ?? null, orgUntil: Date.now() + ORGANISER_HOURS * 3_600_000 });
  refresh();
  return { ok: true };
}

export async function lockOrganiser(): Promise<Result> {
  const s = await getSession();
  await setSession({ playerId: s?.playerId ?? null, name: s?.name ?? null });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Events

type EventInput = { title: string; startsAt: string; location: string; notes: string; nets: number; groupTo: number; finalTo: number; format?: "ladder" | "cards" };

function parseEvent(x: EventInput): { ok: true; v: Omit<typeof events.$inferInsert, "id"> } | { ok: false; error: string } {
  const title = cleanName(x?.title);
  if (title.length < 2 || title.length > 60) return { ok: false, error: "Give the event a name." };
  const at = new Date(x?.startsAt);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "Pick a date and time." };
  const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : d);
  return {
    ok: true,
    v: {
      title, startsAt: at,
      location: cleanName(x.location).slice(0, 80), notes: typeof x.notes === "string" ? x.notes.trim().slice(0, 500) : "",
      nets: int(x.nets, 1, 8, 2), groupTo: int(x.groupTo, 5, 25, 15), finalTo: int(x.finalTo, 5, 25, 15),
      ...(x.format === "ladder" || x.format === "cards" ? { format: x.format } : {}),
    },
  };
}

export async function createEvent(x: EventInput): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  const p = parseEvent(x); if (!p.ok) return p;
  const [row] = await db.insert(events).values(p.v).returning({ id: events.id });
  refresh(row.id);
  return { ok: true, id: row.id };
}

export async function updateEvent(id: string, x: EventInput): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(id)) return fail("Unknown event.");
  const p = parseEvent(x); if (!p.ok) return p;
  await db.update(events).set(p.v).where(eq(events.id, id));
  refresh(id);
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(id)) return fail("Unknown event.");
  await db.delete(events).where(eq(events.id, id));
  refresh();
  return { ok: true };
}

export async function finishEvent(id: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(id)) return fail("Unknown event.");
  await db.update(games).set({ status: "void" }).where(and(eq(games.eventId, id), eq(games.status, "todo")));
  await db.update(events).set({ status: "done" }).where(eq(events.id, id));
  refresh(id);
  return { ok: true };
}

export async function reopenEvent(id: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(id)) return fail("Unknown event.");
  await db.update(events).set({ status: "live" }).where(eq(events.id, id));
  refresh(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Photos from the day

const PHOTO_RE = /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const PHOTO_MAX = 450_000; // characters of base64: ~330 KB, room for a 1440px JPEG
const PHOTOS_PER_EVENT = 24;

/** Add a photo to an event: a JPEG the phone has already resized (PhotoPicker). Anyone signed in. */
export async function addEventPhoto(eventId: string, dataUrl: string): Promise<Result> {
  const s = await me(); if (!s) return fail("Sign in to add photos.");
  if (!isUuid(eventId)) return fail("Unknown event.");
  if (typeof dataUrl !== "string" || dataUrl.length > PHOTO_MAX || !PHOTO_RE.test(dataUrl)) return fail("That photo couldn't be used. Try another.");
  const [ev] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId));
  if (!ev) return fail("Unknown event.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(eventPhotos).where(eq(eventPhotos.eventId, eventId));
  if (n >= PHOTOS_PER_EVENT) return fail(`This event already has ${PHOTOS_PER_EVENT} photos.`);
  await db.insert(eventPhotos).values({ eventId, data: dataUrl, byId: s.playerId });
  refresh(eventId);
  return { ok: true };
}

/** Remove a photo: whoever added it, or an organiser. */
export async function deleteEventPhoto(photoId: string): Promise<Result> {
  if (!isUuid(photoId)) return fail("Unknown photo.");
  const [p] = await db.select({ eventId: eventPhotos.eventId, byId: eventPhotos.byId }).from(eventPhotos).where(eq(eventPhotos.id, photoId));
  if (!p) return fail("Unknown photo.");
  const s = await getSession();
  if (!(s?.playerId && s.playerId === p.byId) && !isOrganiser(s)) return fail("Only whoever added it, or an organiser, can remove a photo.");
  await db.delete(eventPhotos).where(eq(eventPhotos.id, photoId));
  refresh(p.eventId);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Sign-ups and check-in

const STATES = ["going", "here", "out"] as const;
type State = (typeof STATES)[number];

async function upsertEntry(eventId: string, playerId: string, state: State) {
  await db.insert(entries).values({ eventId, playerId, state })
    .onConflictDoUpdate({ target: [entries.eventId, entries.playerId], set: { state, updatedAt: new Date() } });
}

/** Your own place: I'm in (going), I'm here (checked in), or out (can't make it / leaving). */
export async function setMyEntry(eventId: string, state: State): Promise<Result> {
  const s = await me(); if (!s) return fail("Sign in first.");
  if (!isUuid(eventId) || !STATES.includes(state)) return fail("Unknown event.");
  const [ev] = await db.select({ status: events.status }).from(events).where(eq(events.id, eventId));
  if (!ev || ev.status === "done") return fail("This event has finished.");
  await upsertEntry(eventId, s.playerId!, state);
  refresh(eventId);
  return { ok: true };
}

/** Organiser: check someone in or out. */
export async function setEntry(eventId: string, playerId: string, state: State | "remove"): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(eventId) || !isUuid(playerId)) return fail("Unknown player.");
  if (state === "remove") await db.delete(entries).where(and(eq(entries.eventId, eventId), eq(entries.playerId, playerId)));
  else if (STATES.includes(state)) await upsertEntry(eventId, playerId, state);
  refresh(eventId);
  return { ok: true };
}

/** Organiser: add someone on the day. Finds them by name, or makes a profile they can claim later. */
export async function addWalkIn(eventId: string, nameIn: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  const name = cleanName(nameIn);
  if (!isUuid(eventId)) return fail("Unknown event.");
  if (name.length < 2 || name.length > 24) return fail("Use a name between 2 and 24 characters.");
  let [p] = await db.select().from(players).where(eq(players.handle, handleOf(name)));
  if (!p) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(players);
    [p] = await db.insert(players).values({ handle: handleOf(name), name, color: COLORS[n % COLORS.length] }).returning();
  }
  await upsertEntry(eventId, p.id, "here");
  refresh(eventId);
  return { ok: true, id: p.id };
}

// ---------------------------------------------------------------------------------------------
// Stages. A drawn game never changes shape: late arrivals join the next stage, and anyone who
// leaves is covered by a sub.

export async function drawStage(eventId: string, kind: Exclude<StageKind, "ladder">): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(eventId) || !["random", "seeded", "final"].includes(kind)) return fail("Unknown event.");
  const v = await getEventView(eventId);
  if (!v) return fail("Unknown event.");
  // Everyone checked in, plus everyone still in the tournament from the stage before (drawPool).
  const present = drawPool(v.entries, v.games);
  if (present.length < 4) return fail("Check in at least 4 players first.");
  const ratingOf = kind === "random" ? await ratingNow() : new Map<string, number>();
  // A mixed stage spreads the levels across the groups by rating, away from anyone you've already
  // been grouped with today (mixedOrder). A by-level round or
  // the finals seed from the results (seedOrder: after two or more rounds, all of them together),
  // then keep earlier group-mates apart where they can (spreadRepeats).
  const order = kind === "random" ? mixedOrder(present, (id) => (ratingOf.get(id) ?? 800), Math.random, v.games) : spreadRepeats(seedOrder(v.games, present, kind), v.games, kind);
  const carried = present.filter((id) => v.entries.find((e) => e.playerId === id)?.state !== "here");
  const plan = planStage(kind, order, v.event.nets);
  const stageNo = (v.stages.at(-1)?.no ?? 0) + 1;
  await db.transaction(async (tx) => {
    await tx.update(games).set({ status: "void" }).where(and(eq(games.eventId, eventId), eq(games.status, "todo")));
    const [st] = await tx.insert(stages).values({ eventId, no: stageNo, kind }).returning({ id: stages.id });
    const rows = plan.flatMap((g) => g.games.map((x) => ({
      eventId, stageId: st.id, groupNo: g.groupNo, groupName: g.name, seq: x.seq, ord: x.ord, net: g.net,
      a1: x.a[0], a2: x.a[1], b1: x.b[0], b2: x.b[1],
    })));
    await tx.insert(games).values(rows);
    // Whoever was carried over is playing, so the check-in list should say so.
    for (const playerId of carried) {
      await tx.insert(entries).values({ eventId, playerId, state: "here" })
        // Never over an "out" that landed while this draw was being worked out.
        .onConflictDoUpdate({ target: [entries.eventId, entries.playerId], set: { state: "here", updatedAt: new Date() }, setWhere: ne(entries.state, "out") });
    }
    await tx.update(events).set({ status: "live" }).where(eq(events.id, eventId));
  });
  refresh(eventId);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Editing the groups of the stage in play. Scores already entered never change: only games still
// to play are rearranged. (A game someone is mid-way through counts as still to play, so enter
// its score first if it has finished.)

async function latestStage(eventId: string) {
  if (!isUuid(eventId)) return null;
  const v = await getEventView(eventId);
  const stage = v?.stages.at(-1);
  if (!v || !stage) return null;
  if (v.event.status === "done") return null;
  const inStage = v.games.filter((g) => g.stageNo === stage.no);
  const groupNos = [...new Set(inStage.map((g) => g.groupNo))].sort((a, b) => a - b);
  const groups = groupNos.map((no) => {
    const gs = inStage.filter((g) => g.groupNo === no);
    return { no, games: gs, members: currentMembers(inStage, no), first: gs[0] };
  });
  // Rearranged games go after everything else in the stage (see stageMembers).
  const nextOrd = Math.max(0, ...inStage.map((g) => g.ord)) + 1;
  return { v, stage, inStage, groups, nextOrd };
}

/** Organiser: two players trade places in the games still to play. One of them can be someone
 *  not in this stage yet (a late arrival), who then takes the other's place. */
export async function swapPlayers(eventId: string, x: string, y: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(x) || !isUuid(y) || x === y) return fail("Pick two different players.");
  const st = await latestStage(eventId); if (!st) return fail("There's no stage in play to change.");
  const gx = st.groups.find((g) => g.members.includes(x)), gy = st.groups.find((g) => g.members.includes(y));
  if (!gx && !gy) return fail("Neither of them is in a group right now.");
  if (gx && gy && gx.no === gy.no) return fail("They're already in the same group.");
  const swap = (id: string) => (id === x ? y : id === y ? x : id);
  const todo = st.inStage.filter((g) => g.status === "todo");
  await db.transaction(async (tx) => {
    for (const g of todo) {
      const four = [...g.a, ...g.b];
      if (!four.includes(x) && !four.includes(y)) continue;
      const [a1, a2, b1, b2] = four.map(swap);
      // Same order among themselves, but after everything already in the stage.
      await tx.update(games).set({ a1, a2, b1, b2, subs: g.subs.map(swap), ord: g.ord + st.nextOrd, updatedAt: new Date() }).where(eq(games.id, g.id));
    }
  });
  refresh(eventId);
  return { ok: true };
}

/**
 * Organiser: move someone into another group, or take them out of this stage (toGroup = null).
 * Each group that changes keeps its played games and has the rest redrawn for its new line-up.
 */
export async function movePlayer(eventId: string, playerId: string, toGroup: number | null): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(playerId) || (toGroup !== null && !Number.isInteger(toGroup))) return fail("Pick a player and a group.");
  const st = await latestStage(eventId); if (!st) return fail("There's no stage in play to change.");
  const from = st.groups.find((g) => g.members.includes(playerId)) ?? null;
  const to = toGroup === null ? null : st.groups.find((g) => g.no === toGroup);
  if (toGroup !== null && !to) return fail("Unknown group.");
  if ((from?.no ?? null) === (to?.no ?? null)) return fail(to ? "They're already in that group." : "They're not in a group right now.");
  const changes: { group: (typeof st.groups)[number]; members: string[] }[] = [];
  if (from) changes.push({ group: from, members: from.members.filter((id) => id !== playerId) });
  if (to) changes.push({ group: to, members: [...to.members, playerId] });
  for (const c of changes) {
    if (c.members.length > 0 && c.members.length < 4) {
      return fail(`Group ${c.group.first.groupName} would be down to ${c.members.length}. Swap someone in instead, or redraw the stage.`);
    }
  }
  const G = st.groups.length;
  const ord = st.nextOrd;
  await db.transaction(async (tx) => {
    for (const { group, members } of changes) {
      const kept: Game[] = group.games.filter((g) => g.status !== "todo" || g.decider);
      const drop = group.games.filter((g) => g.status === "todo" && !g.decider).map((g) => g.id);
      if (drop.length) await tx.delete(games).where(inArray(games.id, drop));
      const plan = remainingGames(members, kept);
      const seq0 = Math.max(0, ...kept.map((g) => g.seq));
      if (plan.length) {
        await tx.insert(games).values(plan.map((x, i) => ({
          eventId, stageId: st.stage.id, groupNo: group.no, groupName: group.first.groupName,
          seq: seq0 + i + 1, ord: ord + i * G + group.no, net: group.first.net,
          a1: x.a[0], a2: x.a[1], b1: x.b[0], b2: x.b[1],
        })));
      }
    }
  });
  refresh(eventId);
  return { ok: true };
}

/**
 * Organiser: fresh groups for the stage in play, from everyone in the tournament now. If nothing
 * in it has a score yet it's simply drawn again; otherwise the scores so far stay (as an earlier
 * stage, still counting in the standings) and a new stage of the same kind is drawn.
 */
export async function redrawStage(eventId: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  const st = await latestStage(eventId); if (!st) return fail("There's no stage in play to redraw.");
  if (!st.inStage.some((g) => g.status === "done")) await db.delete(stages).where(eq(stages.id, st.stage.id));
  if (st.stage.kind === "ladder") return fail("Use Next round on a ladder.");
  return drawStage(eventId, st.stage.kind);
}

/**
 * Organiser: settle a tie at the top of a group with one decider game (decideTie): the tied pair
 * on opposite sides, each partnered with one of the next two in the table. It goes on the group's
 * net, next in line, and counts for nothing but who tops the group.
 */
export async function addDecider(eventId: string, stageNo: number, groupNo: number): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(eventId) || !Number.isInteger(stageNo) || !Number.isInteger(groupNo)) return fail("Unknown group.");
  const v = await getEventView(eventId);
  if (!v) return fail("Unknown event.");
  if (v.event.status === "done") return fail("This event has finished. Reopen it first.");
  const stage = v.stages.find((st) => st.no === stageNo);
  const g = stage && groupsOf(v, stageNo).find((x) => x.groupNo === groupNo);
  if (!stage || !g) return fail("Unknown group.");
  if (g.tied.length !== 2) return fail("Nobody's tied at the top of this group.");
  if (g.decider === "playing" || g.decider === "decided") return fail("This group already has a decider.");
  const plan = decideTie(g.table, [g.tied[0], g.tied[1]]);
  if (!plan.length) return fail("A decider needs two other players in the group.");
  const inStage = v.games.filter((x) => x.stageNo === stageNo);
  const seq = Math.max(0, ...g.games.map((x) => x.seq));
  // Next on this net: just after whatever's still to play there (or straight on if it's free).
  const ord = Math.max(0, ...inStage.map((x) => x.ord));
  await db.insert(games).values(plan.map((x, i) => ({
    eventId, stageId: stage.id, groupNo, groupName: g.name, seq: seq + i + 1, ord: ord + i + 1, net: g.net,
    a1: x.a[0], a2: x.a[1], b1: x.b[0], b2: x.b[1], decider: true,
  })));
  refresh(eventId);
  return { ok: true };
}

/** Organiser: take back the latest stage if nothing in it has been played. */
export async function undoStage(eventId: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  const v = isUuid(eventId) ? await getEventView(eventId) : null;
  const last = v?.stages.at(-1);
  if (!v || !last) return fail("Nothing to undo.");
  if (v.games.some((g) => g.stageNo === last.no && g.status === "done")) return fail("Games in this stage have scores, so it can't be undone.");
  await db.delete(stages).where(eq(stages.id, last.id));
  const prev = v.stages.at(-2);
  if (prev) {
    // Bring back the previous stage's unplayed games.
    const ids = v.games.filter((g) => g.stageNo === prev.no && g.status === "void" && g.scoreA == null).map((g) => g.id);
    if (ids.length) await db.update(games).set({ status: "todo" }).where(inArray(games.id, ids));
  } else await db.update(events).set({ status: "upcoming" }).where(eq(events.id, eventId));
  refresh(eventId);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Games

async function gameFor(gameId: string) {
  if (!isUuid(gameId)) return null;
  const [g] = await db.select().from(games).where(eq(games.id, gameId));
  return g ?? null;
}

/** Anyone signed in can enter or correct a score, in any order. */
export async function enterScore(gameId: string, scoreA: number, scoreB: number): Promise<Result> {
  const s = await me(); if (!s) return fail("Sign in to enter scores.");
  if (!validScore(scoreA, scoreB)) return fail("Scores must be whole numbers and can't be level.");
  const g = await gameFor(gameId); if (!g) return fail("Unknown game.");
  if (g.status === "void") return fail("This game was skipped.");
  const [ev] = await db.select({ format: events.format }).from(events).where(eq(events.id, g.eventId));
  if (ev?.format === "ladder") {
    const rating = await ratingNow();
    await db.transaction(async (tx) => {
      await lockEvent(tx, g.eventId);
      await tx.update(games).set({ scoreA, scoreB, status: "done", enteredById: s.playerId, updatedAt: new Date() }).where(eq(games.id, gameId));
      await advanceLadder(tx, g.eventId, rating, false);
    });
  } else {
    await db.update(games).set({ scoreA, scoreB, status: "done", enteredById: s.playerId, updatedAt: new Date() }).where(eq(games.id, gameId));
  }
  refresh(g.eventId);
  return { ok: true };
}

/** Organiser: wipe a score (the game goes back to being played). */
export async function clearScore(gameId: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  const g = await gameFor(gameId); if (!g) return fail("Unknown game.");
  await db.update(games).set({ scoreA: null, scoreB: null, status: "todo", updatedAt: new Date() }).where(eq(games.id, gameId));
  refresh(g.eventId);
  return { ok: true };
}

/** Skip a game nobody can play (or bring a skipped one back). */
export async function setSkipped(gameId: string, skipped: boolean): Promise<Result> {
  const s = await me(); if (!s && !isOrganiser(await getSession())) return fail("Sign in first.");
  const g = await gameFor(gameId); if (!g) return fail("Unknown game.");
  if (g.status === "done") return fail("This game already has a score.");
  await db.update(games).set({ status: skipped ? "void" : "todo", updatedAt: new Date() }).where(eq(games.id, gameId));
  refresh(g.eventId);
  return { ok: true };
}

/** Put a sub in for someone in a game still to play. The result won't count for the sub. */
export async function subIn(gameId: string, fromId: string, subId: string, allRemaining = false): Promise<Result> {
  const s = await me(); if (!s && !isOrganiser(await getSession())) return fail("Sign in first.");
  const g = await gameFor(gameId); if (!g) return fail("Unknown game.");
  if (!isUuid(fromId) || !isUuid(subId)) return fail("Pick who's coming off and who's going on.");
  if (g.status !== "todo") return fail("Only games still to play can have a sub.");
  const four = [g.a1, g.a2, g.b1, g.b2];
  if (!four.includes(fromId)) return fail("That player isn't in this game.");
  if (four.includes(subId)) return fail("That player is already in this game.");
  // Optionally cover every game the player still had left in this stage, where the sub is free to.
  const targets = allRemaining
    ? (await db.select().from(games).where(and(eq(games.stageId, g.stageId), eq(games.status, "todo")))).filter((x) => [x.a1, x.a2, x.b1, x.b2].includes(fromId) && ![x.a1, x.a2, x.b1, x.b2].includes(subId))
    : [g];
  for (const t of targets) {
    const next = withSub({ a: [t.a1, t.a2], b: [t.b1, t.b2], subs: t.subs ?? [] }, fromId, subId);
    await db.update(games).set({ a1: next.a[0], a2: next.a[1], b1: next.b[0], b2: next.b[1], subs: next.subs, updatedAt: new Date() }).where(eq(games.id, t.id));
  }
  refresh(g.eventId);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Level moments

export type Feed = { levels: Moments | null; draw: DrawFeed | null };

/** What's new for you since you last looked: your scored games (level moments) and any stage
 *  you're in that's been drawn (draw story). Null when there's nothing (or you're not signed in).
 *  Polled by every signed-in phone, so the empty case is two small queries. */
export async function checkMoments(): Promise<Feed | null> {
  const s = await me(); if (!s) return null;
  // Only the draw stories pop up during the day now. Each game's result shows once, in a small
  // sheet on the phone that scored it; your own story of the day is at the end (the recap).
  const draw = await myDrawStory(s.playerId!).catch(() => null);
  return draw ? { levels: null, draw } : null;
}

/** Mark draw stories up to `at` (the stage's creation time, ms) as seen. Never moves backwards. */
export async function seenDraw(at: number): Promise<Result> {
  const s = await me(); if (!s) return fail("Sign in first.");
  if (!Number.isFinite(at) || at <= 0) return fail("Nothing to mark.");
  const t = new Date(Math.min(at + 1, Date.now() + 60_000));
  await db.update(players).set({ stageSeenAt: sql`greatest(${players.stageSeenAt}, ${t.toISOString()}::timestamptz)` }).where(eq(players.id, s.playerId!));
  return { ok: true };
}

/** Mark everything up to `upTo` (ms) as seen. Never moves backwards. */
export async function seenMoments(upTo: number): Promise<Result> {
  const s = await me(); if (!s) return fail("Sign in first.");
  if (!Number.isFinite(upTo) || upTo <= 0) return fail("Nothing to mark.");
  // +1 ms: the database keeps microseconds, the phone only had milliseconds.
  const at = new Date(Math.min(upTo + 1, Date.now() + 60_000));
  await db.update(players).set({ xpSeenAt: sql`greatest(${players.xpSeenAt}, ${at.toISOString()}::timestamptz)` }).where(eq(players.id, s.playerId!));
  return { ok: true };
}

/** The story of one past game for a player, replayed from their profile. Anyone can look: it's
 *  the same results the profile already shows. */
export async function replayGame(playerId: string, gameId: string): Promise<Moments | null> {
  if (!isUuid(playerId) || !isUuid(gameId)) return null;
  try { return await gameStory(playerId, gameId); } catch { return null; }
}

/** The story of a game this phone just scored: the whole game, then yours if you played in it. */
export async function resultOf(gameId: string): Promise<(Moments & { played: boolean }) | null> {
  if (!isUuid(gameId)) return null;
  try { return await gameResult(gameId, (await me())?.playerId ?? null); } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// The ladder (src/lib/netLadder.ts): one game per net each round, winners up and losers down. The
// next round is drawn the moment the last net's score goes in, so nobody has to press anything.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** One draw at a time per event: two nets finishing together can't both draw the next round. */
async function lockEvent(tx: Tx, eventId: string) {
  await tx.execute(sql`select id from ${events} where id = ${eventId} for update`);
}

/**
 * Draw the next ladder round if the current one is finished (or `force`: the organiser moving on
 * without a net that hasn't played, whose game is skipped). The first round is seeded by rating.
 */
async function advanceLadder(tx: Tx, eventId: string, rating: Map<string, number>, force: boolean): Promise<boolean> {
  const [ev] = await tx.select().from(events).where(eq(events.id, eventId));
  if (!ev || ev.format !== "ladder" || ev.status === "done") return false;
  const [ens, sts, gs] = await Promise.all([
    tx.select().from(entries).where(eq(entries.eventId, eventId)),
    tx.select().from(stages).where(eq(stages.eventId, eventId)),
    tx.select().from(games).where(eq(games.eventId, eventId)),
  ]);
  const stageNo = new Map(sts.map((x) => [x.id, x.no]));
  const view = gs.map((x) => ({ id: x.id, stageNo: stageNo.get(x.stageId)!, net: x.net, a: [x.a1, x.a2] as [string, string], b: [x.b1, x.b2] as [string, string], scoreA: x.scoreA, scoreB: x.scoreB, status: x.status }));
  const rounds = roundsFrom(sts.map((x) => ({ no: x.no, kind: x.kind, sitting: x.sitting ?? [] })), view);
  const last = rounds.at(-1);
  if (last && !roundDone(last)) {
    if (!force) return false;
    const latest = Math.max(...sts.map((x) => x.no));
    const todo = view.filter((x) => x.stageNo === latest && x.status === "todo").map((x) => x.id);
    // Their players stay on the net they were on (nextRound reads an unplayed game that way).
    if (todo.length) await tx.update(games).set({ status: "void" }).where(inArray(games.id, todo));
  }
  // Everyone checked in and not out: sitting players stay in, anyone who's left drops out.
  const present = ens.filter((e) => e.state === "here").map((e) => e.playerId);
  const next = nextRound(rounds, present, (id) => rating.get(id) ?? 800, ev.nets);
  if (!next) return false;
  const no = Math.max(0, ...sts.map((x) => x.no)) + 1;
  const [st] = await tx.insert(stages).values({ eventId, no, kind: "ladder", sitting: next.sitting }).returning({ id: stages.id });
  await tx.insert(games).values(next.games.map((g) => ({
    eventId, stageId: st.id, groupNo: g.net - 1, groupName: `Net ${g.net}`, seq: 1, ord: g.net, net: g.net,
    a1: g.a[0], a2: g.a[1], b1: g.b[0], b2: g.b[1],
  })));
  if (ev.status !== "live") await tx.update(events).set({ status: "live" }).where(eq(events.id, eventId));
  return true;
}

/** Organiser: start the ladder with everyone checked in, seeded onto the nets by rating. */
export async function startLadder(eventId: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(eventId)) return fail("Unknown event.");
  const rating = await ratingNow();
  const drawn = await db.transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const [st] = await tx.select({ id: stages.id }).from(stages).where(eq(stages.eventId, eventId)).limit(1);
    if (st) return false;
    return advanceLadder(tx, eventId, rating, false);
  });
  if (!drawn) return fail("Check in at least 4 players first.");
  refresh(eventId);
  return { ok: true };
}

/** Organiser: draw the next round now, skipping any net that hasn't played (its players stay put). */
export async function nextLadderRound(eventId: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(eventId)) return fail("Unknown event.");
  const rating = await ratingNow();
  const drawn = await db.transaction(async (tx) => { await lockEvent(tx, eventId); return advanceLadder(tx, eventId, rating, true); });
  if (!drawn) return fail("Need at least 4 players checked in.");
  refresh(eventId);
  return { ok: true };
}

/**
 * Organiser: someone has to drop out of a game that hasn't been scored. `inId` (someone here and
 * not playing this round) takes their place, and the game counts for them as normal. The player
 * swapped out sits out instead, unless they've left.
 */
export async function swapLadderPlayer(gameId: string, outId: string, inId: string): Promise<Result> {
  const no = await requireOrganiser(); if (no) return no;
  if (!isUuid(gameId) || !isUuid(outId) || !isUuid(inId) || outId === inId) return fail("Pick who's coming off and who's going on.");
  const g = await gameFor(gameId); if (!g) return fail("Unknown game.");
  if (g.status !== "todo") return fail("This game already has a score.");
  const [st] = await db.select().from(stages).where(eq(stages.id, g.stageId));
  if (st?.kind !== "ladder") return fail("Not a ladder game.");
  const slots = [g.a1, g.a2, g.b1, g.b2];
  if (!slots.includes(outId)) return fail("They're not in this game.");
  const round = await db.select().from(games).where(eq(games.stageId, st.id));
  if (round.some((x) => x.status !== "void" && [x.a1, x.a2, x.b1, x.b2].includes(inId))) return fail("They're already playing this round.");
  const ens = await db.select().from(entries).where(eq(entries.eventId, g.eventId));
  if (ens.find((e) => e.playerId === inId)?.state !== "here") return fail("Check them in first.");
  const swap = (id: string) => (id === outId ? inId : id);
  const outStays = ens.find((e) => e.playerId === outId)?.state === "here";
  const sitting = [...(st.sitting ?? []).filter((id) => id !== inId), ...(outStays ? [outId] : [])];
  await db.transaction(async (tx) => {
    await tx.update(games).set({ a1: swap(g.a1), a2: swap(g.a2), b1: swap(g.b1), b2: swap(g.b2), updatedAt: new Date() }).where(eq(games.id, gameId));
    await tx.update(stages).set({ sitting }).where(eq(stages.id, st.id));
  });
  refresh(g.eventId);
  return { ok: true };
}
