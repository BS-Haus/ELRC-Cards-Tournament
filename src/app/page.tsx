import Link from "next/link";
import { getSession, isOrganiser } from "@/lib/auth/session";
import { getEventCards, type EventCard } from "@/lib/data";
import { Header, Section, card, fmtDate } from "@/components/ui";
import { RsvpButton, NewEvent } from "@/components/HomeBits";

export const dynamic = "force-dynamic";

function Row({ e, signedIn }: { e: EventCard; signedIn: boolean }) {
  return (
    <div className={`${card} spk-up flex items-center gap-3 p-4`}>
      <Link href={`/e/${e.id}`} className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-accent">{fmtDate(e.startsAt)}</div>
        <div className="mt-0.5 truncate text-[17px] font-extrabold">{e.title}</div>
        <div className="mt-0.5 truncate text-[13px] text-muted">
          {e.location ? `${e.location} · ` : ""}{e.going} {e.going === 1 ? "player" : "players"} in
        </div>
      </Link>
      {e.status === "upcoming" && <RsvpButton eventId={e.id} mine={e.mine} signedIn={signedIn} />}
    </div>
  );
}

export default async function Home() {
  const s = await getSession();
  const { upcoming, live, past } = await getEventCards(s?.playerId ?? null);
  const org = isOrganiser(s);
  return (
    <main>
      <Header eyebrow="East London Roundnet" title="Cards" />
      <p className="-mt-2 px-5 pb-5 text-[14.5px] leading-relaxed text-muted">
        Weekend tournaments at Victoria Park. You play in small groups with a new partner every game, then regroup by level, so every game is a close one.
      </p>

      {live.length > 0 && (
        <Section title="On now">
          <div className="grid gap-2.5">
            {live.map((e) => (
              <Link key={e.id} href={`/e/${e.id}`} className="spk-press spk-up flex items-center gap-3 rounded-2xl bg-accent p-4 text-ink">
                <span className="spk-live h-2.5 w-2.5 rounded-full bg-ink" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] font-black">{e.title}</div>
                  <div className="text-[13px] font-semibold opacity-75">{e.here} playing · scores, groups and who&apos;s on</div>
                </div>
                <span aria-hidden="true" className="text-xl font-black">→</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Coming up" aside={org ? <NewEvent /> : undefined}>
        {upcoming.length ? (
          <div className="grid gap-2.5">{upcoming.map((e) => <Row key={e.id} e={e} signedIn={!!s?.playerId} />)}</div>
        ) : (
          <div className={`${card} p-5 text-[14px] text-muted`}>
            Nothing scheduled yet. {org ? "Tap New event to post the next one." : "The next session will appear here once it's posted in the WhatsApp group."}
          </div>
        )}
      </Section>

      {past.length > 0 && (
        <Section title="Past events">
          <div className={`${card} divide-y divide-white/[.05]`}>
            {past.map((e) => (
              <Link key={e.id} href={`/e/${e.id}`} className="spk-press flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-bold">{e.title}</div>
                  <div className="text-[12.5px] text-dim">{fmtDate(e.startsAt, false)} · {e.here || e.going} played</div>
                </div>
                {e.champion && <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[12px] font-bold text-gold">★ {e.champion}</span>}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </main>
  );
}
