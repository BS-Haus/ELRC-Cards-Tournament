import Link from "next/link";
import { getPlayerStats, liveNowId, getEventView, type PlayerStats } from "@/lib/data";
import { todayTable, type TodayWhere } from "@/lib/views";
import { Header, Section, Avatar, card, tierColor, RankBadge } from "@/components/ui";
import { LiveBadge } from "@/components/CheckIn";
import { levelFor } from "@/lib/levels";
import type { Line } from "@/lib/cards";

export const dynamic = "force-dynamic";

/** While a tournament is live the tab splits in two: Today (just the people playing, by how their
 *  day is going) and Overall. Any other day it's only Overall, so no tabs. */
export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, stats, liveId] = await Promise.all([searchParams, getPlayerStats(), liveNowId()]);
  const live = liveId ? await getEventView(liveId) : null;
  const today = !!live && view !== "overall";
  const byId = new Map(stats.map((p) => [p.id, p]));
  return (
    <main>
      <Header eyebrow="East London Roundnet" title="Players" right={live ? <LiveBadge /> : undefined} />
      {live && (
        <div className="sticky top-0 z-20 mb-4 border-b border-white/[.08] bg-bg/90 backdrop-blur-md">
          <div className="grid grid-cols-2">
            {([["Today", "/players", today], ["Overall", "/players?view=overall", !today]] as const).map(([label, href, on]) => (
              <Link key={label} href={href} replace aria-current={on ? "page" : undefined} className={`spk-press relative py-3.5 text-center text-[15px] font-bold ${on ? "text-fg" : "text-dim"}`}>
                {label}
                {on && <span className="absolute inset-x-6 -bottom-px h-[3px] rounded-full bg-accent" aria-hidden="true" />}
              </Link>
            ))}
          </div>
        </div>
      )}
      {today ? <Today {...todayTable(live!)} byId={byId} title={live!.event.title} eventId={live!.event.id} /> : <Overall all={stats} />}
    </main>
  );
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** Today's table: what the event page's standings used to show (W–L, win %, points difference),
 *  plus where each person is now (their group or final and place) and who's on a net. */
function Today({ rows, out, where, byId, title, eventId }: { rows: Line[]; out: Set<string>; where: Record<string, TodayWhere>; byId: Map<string, PlayerStats>; title: string; eventId: string }) {
  return (
    <Section title={`Playing today · ${rows.length}`} aside={<Link href={`/e/${eventId}`} className="font-bold text-accent">{title} →</Link>}>
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-[20px_1fr_44px_44px] items-center gap-x-3 border-b border-white/[.05] px-4 py-2 text-[10.5px] font-bold uppercase tracking-[.1em] text-dim">
          <span>#</span><span>Player</span><span className="text-right">Win</span><span className="text-right">W–L</span>
        </div>
        {rows.map((r, i) => {
          const p = byId.get(r.id);
          const pdg = r.gp ? (r.pf - r.pa) / r.gp : 0;
          const left = out.has(r.id);
          const w = where[r.id];
          return (
            <Link key={r.id} href={`/p/${r.id}`} className="spk-press grid grid-cols-[20px_1fr_44px_44px] items-center gap-x-3 border-b border-white/[.03] px-4 py-2.5 last:border-0">
              <span className="text-right font-mono text-[12.5px] text-dim">{r.gp ? i + 1 : "–"}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar p={p} size={32} dim={left} />
                <span className="min-w-0">
                  <span className={`flex items-center gap-1.5 text-[14.5px] font-bold ${left ? "text-dim" : ""}`}>
                    <span className="truncate">{p?.name}</span>{p && <RankBadge level={levelFor(p.points).level} size={14} />}
                    {!left && w?.onNow && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9.5px] font-black uppercase tracking-[.08em] text-ink">On now</span>}
                    {!left && !w?.onNow && w?.next && <span className="shrink-0 rounded-full border border-accent/50 px-1.5 py-px text-[9.5px] font-black uppercase tracking-[.08em] text-accent">Next</span>}
                  </span>
                  <span className="block truncate text-[12px] text-dim">
                    {left ? "Left" : [w?.group && w.place ? `${ordinal(w.place)} in ${w.group}` : w?.group, r.gp ? `${pdg > 0 ? "+" : ""}${pdg.toFixed(1)} a game` : "yet to play"].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
              <span className="tnum text-right text-[13px] font-bold text-muted">{r.gp ? `${Math.round((100 * r.w) / r.gp)}%` : "–"}</span>
              <span className="tnum text-right font-mono text-[15px] font-black">{r.w}–{r.l}</span>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

function Overall({ all }: { all: PlayerStats[] }) {
  // Showing up is what grows the club, so the list leads with games played.
  const rows = all.filter((p) => p.gp > 0 || p.events > 0).sort((a, b) => b.gp - a.gp || b.w - a.w || a.name.localeCompare(b.name));
  return (
    <Section title={`${rows.length} players`} aside="Most games first">
      {rows.length ? (
        <div className={`${card} divide-y divide-white/[.05]`}>
          {rows.map((p) => (
            <Link key={p.id} href={`/p/${p.id}`} className="spk-press flex items-center gap-3 px-4 py-3">
              <Avatar p={p} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[15px] font-bold">{p.name}<RankBadge level={levelFor(p.points).level} size={16} /></div>
                <div className="text-[12.5px] text-dim">{levelFor(p.points).level.name} · {p.points} pts · {p.events} {p.events === 1 ? "weekend" : "weekends"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {Object.entries(p.tierWins).sort(([x], [y]) => x.localeCompare(y)).map(([t, n]) => (
                  <span key={t} className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: `${tierColor(t)}22`, color: tierColor(t) }}>★{n > 1 ? `×${n}` : ""} {t}</span>
                ))}
                <span className="tnum w-12 text-right font-mono text-[13px] text-num">{p.w}–{p.l}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : <div className={`${card} p-5 text-[14px] text-muted`}>Nobody has played yet. Results show up here after the first weekend.</div>}
    </Section>
  );
}
