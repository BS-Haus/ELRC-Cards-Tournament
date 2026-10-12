import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, getSeason } from "@/lib/data";
import { getSession } from "@/lib/auth/session";
import { Section, Avatar, RankAvatar, card, tierColor, fmtDate } from "@/components/ui";
import { MySeason } from "@/components/MySeason";
import { levelFor } from "@/lib/levels";

export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [pr, s] = await Promise.all([getProfile(id), getSession()]);
  if (!pr) notFound();
  const { player, names } = pr;
  const mine = s?.playerId === id;
  const season = await getSeason(pr);
  return (
    <main>
      {/* The same top as the Me page: photo in the rank ring with the division banner, then the
          weekends at a glance. Tapping someone's name anywhere lands here. */}
      <header className="flex flex-col items-center px-5 pt-[calc(22px+env(safe-area-inset-top))] pb-5 text-center">
        <RankAvatar p={player} rank={levelFor(pr.points).level} />
        <h1 className="mt-5 text-[26px] font-black leading-tight tracking-[-.02em]">{player.name}</h1>
        <div className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">{mine ? "Your profile" : "Player"}</div>
        {!player.claimed && <p className="mt-2 text-[13px] text-dim">Added on the day. Join with this name on the Me tab to make it yours.</p>}
        {mine && !player.photo && <Link href="/me" className="mt-2 text-[13px] font-bold text-accent">+ Add a profile photo</Link>}
      </header>

      <MySeason s={season} title="At a glance" more={false} />

      {(Object.keys(pr.tierWins).length > 0 || pr.bestPartner) && (
        <Section title="Highlights">
          <div className="grid gap-2">
            {Object.entries(pr.tierWins).sort(([x], [y]) => x.localeCompare(y)).map(([t, n]) => (
              <div key={t} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: `${tierColor(t)}18`, border: `1px solid ${tierColor(t)}40` }}>
                <span className="text-xl" aria-hidden="true">★</span>
                <span className="text-[15px] font-bold">{t} final winner{n > 1 ? ` ×${n}` : ""}</span>
              </div>
            ))}
            {pr.bestPartner && (
              <Link href={`/p/${pr.bestPartner.id}`} className={`${card} spk-press flex items-center gap-3 p-4`}>
                <Avatar p={names[pr.bestPartner.id]} size={30} />
                <span className="text-[14.5px]"><b>Best partner:</b> {names[pr.bestPartner.id]?.name}, won {pr.bestPartner.w} of {pr.bestPartner.gp} together</span>
              </Link>
            )}
          </div>
        </Section>
      )}

      <Section title="Every weekend">
        {pr.events.length ? (
          <div className={`${card} divide-y divide-white/[.05]`}>
            {pr.events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <Link href={`/e/${e.id}`} className="spk-press min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold">{e.title}</div>
                  <div className="text-[12.5px] text-dim">{fmtDate(e.startsAt, false)}{e.finish ? ` · ${e.finish}` : ""} · <span className="tnum font-mono">{e.w}–{e.l}</span>{e.points > 0 && <span className="tnum font-bold text-accent"> · +{e.points} pts</span>}</div>
                </Link>
                {e.w + e.l > 0 && (
                  <Link href={`/e/${e.id}/recap?p=${player.id}`} className="spk-press flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-black text-ink">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Review
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : <div className={`${card} p-5 text-[14px] text-muted`}>No weekends yet. Add yourself to the next one on the Tournament tab.</div>}
      </Section>

      {pr.recent.length > 0 && (
        <Section title="Recent games">
          <div className={`${card} divide-y divide-white/[.05]`}>
            {pr.recent.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-6 shrink-0 text-center text-[12px] font-black ${g.won ? "text-win" : "text-loss"}`}>{g.won ? "W" : "L"}</span>
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <div className="truncate">with <b>{names[g.partner]?.name}</b> vs {g.opponents.map((o) => names[o]?.name).join(" & ")}</div>
                  <div className="truncate text-[12px] text-dim">{g.label} · {g.eventTitle}{g.sub ? " · as a sub, not counted" : ""}</div>
                </div>
                <span className="tnum shrink-0 font-mono text-[13.5px] font-bold">{g.mine}–{g.theirs}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </main>
  );
}
