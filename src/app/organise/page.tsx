import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isOrganiser } from "@/lib/auth/session";
import { getEventCards, getEventView, allPlayers, todayEventId } from "@/lib/data";
import { Header, Section, fmtDate } from "@/components/ui";
import { NewEvent } from "@/components/HomeBits";
import { OrganiserTools } from "@/components/EventScreen";
import { OrganiserLock } from "@/components/MeScreen";

export const dynamic = "force-dynamic";

/** Organise: every organiser tool in one tab, which appears in the bottom nav once the organiser
 *  code is entered on Me. Today's event (or the one picked with ?e=) with its tools, the other
 *  events to switch to, posting a new one, and locking up again. */
export default async function OrganisePage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const [{ e }, s] = await Promise.all([searchParams, getSession()]);
  if (!isOrganiser(s)) redirect("/me");
  const { upcoming, live, past } = await getEventCards(s?.playerId ?? null);
  const events = [...live, ...upcoming, ...past.slice(0, 1)];
  const pick = (e && events.find((x) => x.id === e)?.id) ?? (await todayEventId()) ?? events[0]?.id ?? null;
  const [v, roster] = await Promise.all([pick ? getEventView(pick) : null, allPlayers()]);
  return (
    <main>
      <Header eyebrow="Organiser" title="Organise" right={<NewEvent organise />} />
      {events.length > 1 && (
        <div className="-mt-1 flex gap-1.5 overflow-x-auto px-4 pb-4 [scrollbar-width:none]" role="tablist" aria-label="Events">
          {events.map((x) => (
            <Link key={x.id} href={`/organise?e=${x.id}`} role="tab" aria-selected={x.id === pick}
              className={`spk-press shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold ${x.id === pick ? "border-accent/60 bg-accent/[.07] text-fg" : "border-white/[.06] text-muted"}`}>
              {x.title} <span className="font-semibold text-dim">· {x.status === "live" ? "live" : x.status === "done" ? "finished" : fmtDate(x.startsAt)}</span>
            </Link>
          ))}
        </div>
      )}
      {v ? (
        <>
          <div className="flex items-baseline justify-between gap-3 px-5 pb-3">
            <span className="min-w-0 truncate text-[17px] font-black">{v.event.title}</span>
            <Link href={`/e/${v.event.id}`} className="shrink-0 text-[13px] font-bold text-accent">Open event →</Link>
          </div>
          <OrganiserTools key={v.event.id} view={v} roster={roster} />
        </>
      ) : (
        <Section title="Nothing on">
          <p className="px-1 text-[14px] text-muted">No events yet. Tap New event to post the next one.</p>
        </Section>
      )}
      <div className="px-4 pb-8"><OrganiserLock until={s!.orgUntil ?? null} /></div>
    </main>
  );
}
