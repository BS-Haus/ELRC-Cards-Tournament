import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { getSession } from "@/lib/auth/session";
import { Header, Section, Avatar, card, tierColor, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${card} p-3.5`}>
      <div className="text-[11px] font-bold uppercase tracking-[.1em] text-dim">{label}</div>
      <div className="tnum mt-1 text-[24px] font-black leading-none">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [pr, s] = await Promise.all([getProfile(id), getSession()]);
  if (!pr) notFound();
  const { player, stats, names } = pr;
  const mine = s?.playerId === id;
  const pd = stats.gp ? (stats.pf - stats.pa) / stats.gp : 0;
  return (
    <main>
      <Header eyebrow={mine ? "Your profile" : "Player"} title={player.name} right={<Avatar p={player} size={52} />} />
      {!player.claimed && <p className="-mt-2 px-5 pb-4 text-[13px] text-dim">Added on the day. Join with this name on the Me tab to make it yours.</p>}

      <div className="grid grid-cols-2 gap-2.5 px-4 pb-6">
        <Tile label="Weekends" value={String(stats.events)} />
        <Tile label="Games" value={String(stats.gp)} sub={stats.gp ? `${stats.w} won · ${stats.l} lost` : "None yet"} />
        <Tile label="Win rate" value={stats.gp ? `${Math.round((100 * stats.w) / stats.gp)}%` : "–"} />
        <Tile label="Points +/−" value={stats.gp ? `${pd > 0 ? "+" : ""}${pd.toFixed(1)}` : "–"} sub="per game" />
      </div>

      {(Object.keys(pr.tierWins).length > 0 || pr.bestPartner) && (
        <Section title="Highlights">
          <div className="grid gap-2">
            {Object.entries(pr.tierWins).map(([t, n]) => (
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

      <Section title="Weekends">
        {pr.events.length ? (
          <div className={`${card} divide-y divide-white/[.05]`}>
            {pr.events.map((e) => (
              <Link key={e.id} href={`/e/${e.id}`} className="spk-press flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-bold">{e.title}</div>
                  <div className="text-[12.5px] text-dim">{fmtDate(e.startsAt, false)}{e.finish ? ` · ${e.finish}` : ""}</div>
                </div>
                <span className="tnum shrink-0 font-mono text-[13px] text-num">{e.w}–{e.l}</span>
              </Link>
            ))}
          </div>
        ) : <div className={`${card} p-5 text-[14px] text-muted`}>No weekends yet. Add yourself to the next one on the Events tab.</div>}
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
