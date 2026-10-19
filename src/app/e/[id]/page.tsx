import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession, isOrganiser } from "@/lib/auth/session";
import { getEventView, allPlayers, weekendXp, drawPending } from "@/lib/data";
import { EventScreen } from "@/components/EventScreen";
import { LadderScreen } from "@/components/LadderScreen";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ net?: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const v = UUID_RE.test(id) ? await getEventView(id) : null;
  if (!v) return {};
  const when = v.event.startsAt.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Europe/London" });
  const going = v.entries.filter((e) => e.state !== "out").length;
  return {
    title: `${v.event.title} · ${v.event.format === "ladder" ? "Ladder" : "Cards"}`,
    description: `${when}${v.event.location ? `, ${v.event.location}` : ""}. ${going} in so far. Tap to add yourself.`,
    openGraph: { title: v.event.title, description: `${when}${v.event.location ? ` · ${v.event.location}` : ""} · ${going} in so far` },
  };
}

export default async function EventPage({ params, searchParams }: Props) {
  const [{ id }, { net }] = await Promise.all([params, searchParams]);
  // ?net=2: open on that net (the now bar's link to your game).
  const focusNet = Number.isInteger(Number(net)) && Number(net) > 0 ? Number(net) : null;
  if (!UUID_RE.test(id)) notFound();
  const [v, s] = await Promise.all([getEventView(id), getSession()]);
  if (!v) notFound();
  const org = isOrganiser(s);
  if (v.event.format === "ladder") {
    const roster = org ? await allPlayers() : [];
    return <LadderScreen view={v} me={s?.playerId ?? null} org={org} roster={roster} />;
  }
  const [myXp, roster, hidden] = await Promise.all([s?.playerId ? weekendXp(id, s.playerId) : null, org ? allPlayers() : [], s?.playerId ? drawPending(id, s.playerId) : false]);
  return <EventScreen view={v} me={s?.playerId ?? null} org={org} roster={roster} myXp={myXp} drawPending={hidden} focusNet={focusNet} />;
}
