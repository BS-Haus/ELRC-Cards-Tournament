import Link from "next/link";
import { getPlayerStats, liveNowId, getEventView, type PlayerStats } from "@/lib/data";
import { todayTable } from "@/lib/views";
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

function Today({ rows, out, byId, title, eventId }: { rows: Line[]; out: Set<string>; byId: Map<string, PlayerStats>; title: string; eventId: string }) {
  return (
    <Section title={`Playing today · ${rows.length}`} aside={<Link href={`/e/${eventId}`} className="font-bold text-accent">{title} →</Link>}>
      <div className={`${card} divide-y divide-white/[.05]`}>
        {rows.map((r, i) => {
          const p = byId.get(r.id);
          const pd = r.pf - r.pa;
          const left = out.has(r.id);
          return (
            <Link key={r.id} href={`/p/${r.id}`} className="spk-press flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 text-right font-mono text-[12.5px] text-dim">{r.gp ? i + 1 : "–"}</span>
              <Avatar p={p} size={34} dim={left} />
              <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-1.5 truncate text-[15px] font-bold ${left ? "text-dim" : ""}`}>{p?.name}{p && <RankBadge level={levelFor(p.points).level} size={15} />}</div>
                <div className="text-[12.5px] text-dim">{left ? "Left" : r.gp ? `${r.gp} ${r.gp === 1 ? "game" : "games"} · ${pd > 0 ? "+" : ""}${pd} points` : "Yet to play"}</div>
              </div>
              <span className="tnum shrink-0 font-mono text-[16px] font-black">{r.w}–{r.l}</span>
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
