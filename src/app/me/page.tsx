import { getSession, isOrganiser } from "@/lib/auth/session";
import { MeScreen } from "@/components/MeScreen";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { photoUrl } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, s] = await Promise.all([searchParams, getSession()]);
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const [p] = s?.playerId ? await db.select({ id: players.id, name: players.name, color: players.color, avatarAt: players.avatarAt }).from(players).where(eq(players.id, s.playerId)) : [];
  return <MeScreen me={p ? { id: p.id, name: p.name, color: p.color, photo: photoUrl(p) } : null} org={isOrganiser(s)} orgUntil={s?.orgUntil ?? null} next={safeNext} />;
}
