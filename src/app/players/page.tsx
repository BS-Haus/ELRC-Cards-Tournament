import Link from "next/link";
import { getPlayerStats, liveNowId, getEventView, getEventLadder, getOverallLadder, type PlayerStats, type PlayerLite } from "@/lib/data";
import { todayTable, type TodayWhere } from "@/lib/views";
import { Header, Section, card } from "@/components/ui";
import { LiveBadge } from "@/components/CheckIn";
import { Ladder } from "@/components/kit";
import type { LadderRow } from "@/lib/ladder";

export const dynamic = "force-dynamic";

/** While a tournament is live the tab splits in two: Today (just the people playing, by how their
 *  day is going) and Overall. Any other day it's only Overall, so no tabs. */
export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, stats, liveId] = await Promise.all([searchParams, getPlayerStats(), liveNowId()]);
  const live = liveId ? await getEventView(liveId) : null;
  const today = !!live && view !== "overall";
  const people: Record<string, PlayerLite> = Object.fromEntries(stats.map((p) => [p.id, p]));
  const rows = today ? await getEventLadder(live!.event.id) : await getOverallLadder();
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
      {today ? <Today {...todayTable(live!)} rows={rows} people={people} title={live!.event.title} eventId={live!.event.id} /> : <Overall rows={rows} people={people} stats={stats} />}
    </main>
  );
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** Today: just the people playing, by the XP their day has made them, each with a line on where
 *  they are now (their group and place, on a net now, or next). */
function Today({ rows, people, out, where, title, eventId }: { rows: LadderRow[]; people: Record<string, PlayerLite>; out: Set<string>; where: Record<string, TodayWhere>; title: string; eventId: string }) {
  const note = (id: string) => {
    if (out.has(id)) return "Left";
    const w = where[id];
    if (w?.onNow) return <span className="text-accent">On now</span>;
    if (w?.next) return <span className="text-accent">Next up</span>;
    return w?.group ? (w.place ? `${ordinal(w.place)} in ${w.group}` : w.group) : undefined;
  };
  return (
    <Section title={`Playing today · ${rows.length}`} aside="XP made today">
      <Ladder rows={rows} people={people} metric="today" notes={Object.fromEntries(rows.map((r) => [r.id, note(r.id)]))} />
      {/* The way back to the event: a card at the end of the list, not a link in the header,
          so it reads as somewhere to go rather than a label. */}
      <Link href={`/e/${eventId}`} className={`${card} spk-press mt-3 flex items-center justify-between gap-3 p-4`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <LiveBadge />
          <span className="truncate text-[15px] font-black">{title}</span>
        </span>
        <span className="shrink-0 text-[13.5px] font-bold text-accent">Go to tournament →</span>
      </Link>
    </Section>
  );
}

/** Everyone who's played, by XP: the club's ladder. Finals won ride along on the footer line. */
function Overall({ rows, people, stats }: { rows: LadderRow[]; people: Record<string, PlayerLite>; stats: PlayerStats[] }) {
  const byId = new Map(stats.map((p) => [p.id, p]));
  const note = (id: string) => {
    const t = Object.entries(byId.get(id)?.tierWins ?? {}).sort(([x], [y]) => x.localeCompare(y));
    const ev = byId.get(id)?.events ?? 0;
    return [t.map(([k, n]) => `★${n > 1 ? `×${n}` : ""} ${k}`).join(" "), `${ev} ${ev === 1 ? "weekend" : "weekends"}`].filter(Boolean).join(" · ");
  };
  return (
    <Section title={`${rows.length} players`} aside="By XP">
      {rows.length ? <Ladder rows={rows} people={people} metric="xp" notes={Object.fromEntries(rows.map((r) => [r.id, note(r.id)]))} />
        : <div className={`${card} p-5 text-[14px] text-muted`}>Nobody has played yet. Results show up here after the first weekend.</div>}
    </Section>
  );
}
