import { getSession, isOrganiser } from "@/lib/auth/session";
import { MeScreen } from "@/components/MeScreen";

export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, s] = await Promise.all([searchParams, getSession()]);
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
  return <MeScreen me={s?.playerId ? { id: s.playerId, name: s.name ?? "" } : null} org={isOrganiser(s)} orgUntil={s?.orgUntil ?? null} next={safeNext} />;
}
