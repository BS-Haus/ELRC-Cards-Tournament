import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSeason } from "@/lib/data";
import { getSession } from "@/lib/auth/session";
import { RankAvatar } from "@/components/ui";
import { PlayerBody } from "@/components/PlayerBody";
import { levelFor } from "@/lib/levels";

export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [pr, s] = await Promise.all([getProfile(id), getSession()]);
  if (!pr) notFound();
  const { player } = pr;
  const mine = s?.playerId === id;
  const season = await getSeason(pr);
  return (
    <main>
      {/* The same page as Me, for anyone: photo in the rank ring with the division banner, then
          PlayerBody. Tapping a name anywhere lands here. */}
      <header className="flex flex-col items-center px-5 pt-[calc(22px+env(safe-area-inset-top))] pb-5 text-center">
        <RankAvatar p={player} rank={levelFor(pr.xp).level} />
        <h1 className="mt-5 text-[26px] font-black leading-tight tracking-[-.02em]">{player.name}</h1>
        <div className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">{mine ? "Your profile" : "Player"}</div>
        {!player.claimed && <p className="mt-2 text-[13px] text-dim">Added on the day. Join with this name on the Me tab to make it yours.</p>}
        {mine && !player.photo && <Link href="/me" className="mt-2 text-[13px] font-bold text-accent">+ Add a profile photo</Link>}
      </header>

      <PlayerBody season={season} pr={pr} />
    </main>
  );
}
