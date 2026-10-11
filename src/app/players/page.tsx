import Link from "next/link";
import { getPlayerStats } from "@/lib/data";
import { Header, Section, Avatar, card, tierColor, RankBadge } from "@/components/ui";
import { levelFor } from "@/lib/levels";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const all = (await getPlayerStats()).filter((p) => p.gp > 0 || p.events > 0);
  // Showing up is what grows the club, so the list leads with games played.
  const rows = all.sort((a, b) => b.gp - a.gp || b.w - a.w || a.name.localeCompare(b.name));
  return (
    <main>
      <Header eyebrow="East London Roundnet" title="Players" />
      <p className="-mt-2 px-5 pb-5 text-[14.5px] leading-relaxed text-muted">Everyone who&apos;s played a cards weekend, most games first. Tap a name for their history.</p>
      <Section title={`${rows.length} players`}>
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
                  {Object.entries(p.tierWins).map(([t, n]) => (
                    <span key={t} className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ background: `${tierColor(t)}22`, color: tierColor(t) }}>★{n > 1 ? `×${n}` : ""} {t}</span>
                  ))}
                  <span className="tnum w-12 text-right font-mono text-[13px] text-num">{p.w}–{p.l}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : <div className={`${card} p-5 text-[14px] text-muted`}>Nobody has played yet. Results show up here after the first weekend.</div>}
      </Section>
    </main>
  );
}
