import { getSession, isOrganiser } from "@/lib/auth/session";
import { MeScreen } from "@/components/MeScreen";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { photoUrl, todayEventId, getEventView, getProfile, getSeason } from "@/lib/data";
import { myCheckIn } from "@/lib/views";

export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, s] = await Promise.all([searchParams, getSession()]);
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const [p] = s?.playerId ? await db.select({ id: players.id, name: players.name, color: players.color, avatarAt: players.avatarAt }).from(players).where(eq(players.id, s.playerId)) : [];
  // On the day, your check-in lives here, not under the event's tabs: it's about you, not the event.
  const liveId = p ? await todayEventId() : null;
  const v = liveId ? await getEventView(liveId) : null;
  const today = v && p ? { id: v.event.id, title: v.event.title, state: myCheckIn(v.entries, v.games, p.id), started: v.stages.length > 0, photos: v.photos } : null;
  // Every weekend you've played, summarised: rank, numbers, the climb (src/components/PlayerBody).
  const pr = p ? await getProfile(p.id) : null;
  const season = pr ? await getSeason(pr) : null;
  return <MeScreen me={p ? { id: p.id, name: p.name, color: p.color, photo: photoUrl(p) } : null} org={isOrganiser(s)} orgUntil={s?.orgUntil ?? null} next={safeNext} today={today} season={season} profile={pr ? { player: pr.player, tierWins: pr.tierWins, bestPartner: pr.bestPartner, recent: pr.recent, names: pr.names, form: pr.form, trail: pr.trail, biggestWin: pr.biggestWin, bestRun: pr.bestRun } : null} />;
}
