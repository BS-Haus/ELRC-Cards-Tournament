import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { getSession } from "@/lib/auth/session";
import { Header, Section, Avatar, card, tierColor, fmtDate, LevelPill } from "@/components/ui";
import { levelFor } from "@/lib/levels";

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
      {mine && !player.photo && <Link href="/me" className="-mt-2 mb-4 ml-5 inline-block text-[13px] font-bold text-accent">+ Add a profile photo</Link>}

      {(() => {
        const lv = levelFor(pr.points);
        return (
          <div className="px-4 pb-4">
            <div className={`${card} p-4`}>
              <div className="flex items-center justify-between">
                <LevelPill level={lv.level} size="md" />
                <span className="tnum text-[13px] text-muted">{pr.points} points</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${lv.progress * 100}%`, background: lv.level.color }} />
              </div>
              <div className="mt-2 text-[12.5px] text-dim">{lv.next ? `${lv.next.min - pr.points} points to ${lv.next.name}. Every weekend earns points for playing, winning and your finish.` : "Net Royalty III: as high as it goes."}</div>
            </div>
          </div>
        );
      })()}

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

      {pr.events.filter((e) => e.w + e.l > 0).length > 1 && (
        <Section title="Win rate by weekend">
          <div className={`${card} flex h-36 items-end gap-2 p-4`}>
            {pr.events.filter((e) => e.w + e.l > 0).slice(0, 10).reverse().map((e) => {
              const pc = e.w / (e.w + e.l);
              return (
                <Link key={e.id} href={`/e/${e.id}/recap?p=${player.id}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-label={`${e.title}: ${Math.round(100 * pc)}% wins`}>
                  <span className="tnum text-[10px] font-bold text-muted">{Math.round(100 * pc)}%</span>
                  <span className="w-full rounded-t-md bg-accent/80" style={{ height: `${Math.max(4, pc * 80)}%` }} />
                  <span className="text-[10px] text-dim">{fmtDate(e.startsAt, false).split(" ").slice(1).join(" ")}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Weekends">
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
