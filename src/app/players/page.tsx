import Link from "next/link";
import { getPlayerStats, getLadder, getEventView, type PlayerLite } from "@/lib/data";
import { Header, Section, card } from "@/components/ui";
import { LiveBadge } from "@/components/CheckIn";
import { Ladder } from "@/components/kit";
import { PROV_N } from "@/lib/standings";

export const dynamic = "force-dynamic";

/** Players: the club's ladder, the ranked app's, everyone placed by rating, then everyone still
 *  placing. One list, no tabs: on a tournament day each row shows its "± today", your own day is
 *  on Me and the day's tables are on the Tournament tab. */
export default async function PlayersPage() {
  const [stats, { rows, placing, eventId }] = await Promise.all([getPlayerStats(), getLadder()]);
  const people: Record<string, PlayerLite> = Object.fromEntries(stats.map((p) => [p.id, p]));
  const live = eventId ? await getEventView(eventId) : null;
  return (
    <main>
      <Header eyebrow="East London Roundnet" title="Players" right={live?.event.status === "live" ? <LiveBadge /> : undefined} />

      <Section title={rows.length ? `Ladder · ${rows.length} placed` : "Ladder"} aside={rows.length ? "By rating" : undefined}>
        {rows.length || placing.length ? (
          <Ladder rows={rows} placing={placing} people={people} />
        ) : (
          <div className={`${card} p-5 text-[14px] text-muted`}>Nobody has played yet. Everyone places after {PROV_N} games, then their rating shows here.</div>
        )}
      </Section>

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
