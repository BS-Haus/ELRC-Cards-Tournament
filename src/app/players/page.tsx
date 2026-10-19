import Link from "next/link";
import { getPlayerStats, getLadder, getEventView, ladderDay, type PlayerLite } from "@/lib/data";
import { Header, Section, card, Avatar, LevelPill } from "@/components/ui";
import { LiveBadge } from "@/components/CheckIn";
import { Ladder } from "@/components/kit";
import { tierOfRating } from "@/lib/levels";
import { PROV_N } from "@/lib/standings";

export const dynamic = "force-dynamic";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

/** Players, two tabs. Today: everyone at today's tournament, by what the day has done to their
 *  rating. Overall: the club's ladder, the ranked app's, everyone placed by rating, then everyone
 *  still placing. Today shows (and opens first) only while there's a tournament on or just done. */
export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, stats, { rows, placing, eventId }] = await Promise.all([searchParams, getPlayerStats(), getLadder()]);
  const people: Record<string, PlayerLite> = Object.fromEntries(stats.map((p) => [p.id, p]));
  const live = eventId ? await getEventView(eventId) : null;
  const tab = eventId && view !== "overall" ? "today" : "overall";
  const day = tab === "today" && eventId ? await ladderDay(eventId) : [];
  // Today: biggest gain first; anyone still placing (no number on show yet) after.
  const today = [...day].sort((a, b) => (b.today ?? -Infinity) - (a.today ?? -Infinity) || b.w - a.w || a.id.localeCompare(b.id));
  return (
    <main>
      <Header eyebrow="East London Roundnet" title="Players" right={live?.event.status === "live" ? <LiveBadge /> : undefined} />
      {eventId && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[.06] bg-panel p-1" role="tablist">
            {(["today", "overall"] as const).map((t) => (
              <Link key={t} href={t === "today" ? "/players" : "/players?view=overall"} role="tab" aria-selected={tab === t} className={`spk-press flex h-10 items-center justify-center rounded-lg text-[14px] font-black ${tab === t ? "bg-accent text-ink" : "text-muted"}`}>
                {t === "today" ? "Today" : "Overall"}
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "today" ? (
        <Section title={live?.event.title ?? "Today"} aside={`${today.length} playing`}>
          {today.length ? (
            <div className={`${card} overflow-hidden`}>
              {today.map((r, i) => (
                <Link key={r.id} href={`/p/${r.id}`} className="spk-press flex items-center gap-3 border-t border-white/[.04] px-4 py-3 first:border-t-0">
                  <span className="w-5 shrink-0 text-center font-mono text-[13px] font-bold text-dim">{r.today != null ? i + 1 : "🐣"}</span>
                  <Avatar p={people[r.id]} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{people[r.id]?.name ?? "Someone"}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 [&>*]:whitespace-nowrap">
                      {r.rating != null ? <LevelPill level={tierOfRating(r.rating).level} /> : <span className="text-[11.5px] font-semibold text-dim">Placing · {r.placed}/{PROV_N}</span>}
                      <span className="font-mono text-[11.5px] text-dim">{r.w}–{r.l}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {r.today != null
                      ? <span className={`block font-mono text-[18px] font-extrabold ${r.today >= 0 ? "text-win" : "text-loss"}`}>{signed(r.today)}</span>
                      : <span className="block font-mono text-[15px] font-bold text-dim">–</span>}
                    <span className="block text-[9px] font-bold uppercase tracking-[.06em] text-dimmer">{r.rating != null ? `${r.rating} rating` : "placing"}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={`${card} p-5 text-[14px] text-muted`}>Nobody&apos;s played yet today.</div>
          )}
        </Section>
      ) : (
        <Section title={rows.length ? `Ladder · ${rows.length} placed` : "Ladder"} aside={rows.length ? "By rating" : undefined}>
          {rows.length || placing.length ? (
            <Ladder rows={rows} placing={placing} people={people} />
          ) : (
            <div className={`${card} p-5 text-[14px] text-muted`}>Nobody has played yet. Everyone places after {PROV_N} games, then their rating shows here.</div>
          )}
        </Section>
      )}

      {live?.event.status === "live" && (
        <div className="px-4 pb-6">
          <Link href={`/e/${live.event.id}`} className={`${card} spk-press flex items-center justify-between gap-3 p-4`}>
            <span className="flex min-w-0 items-center gap-2.5"><LiveBadge /><span className="truncate text-[15px] font-black">{live.event.title}</span></span>
            <span className="shrink-0 text-[13.5px] font-bold text-accent">Go to tournament →</span>
          </Link>
        </div>
      )}
    </main>
  );
}
