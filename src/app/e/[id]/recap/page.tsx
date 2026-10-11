import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getRecap, getStory } from "@/lib/data";
import { RecapStory } from "@/components/RecapStory";
import { TournamentStory } from "@/components/TournamentStory";

export const dynamic = "force-dynamic";

// /e/[id]/recap is the tournament's story, for everyone: the champion, the day's stories, records.
// /e/[id]/recap?p=<player> is that player's own review of the day, the second act.

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const playerParam = async (sp: Props["searchParams"]) => { const p = (await sp).p; return typeof p === "string" && UUID_RE.test(p) ? p : null; };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return {};
  const p = await playerParam(searchParams);
  if (p) {
    const r = await getRecap(id, p);
    if (!r?.recap.me) return {};
    const title = `${r.names[p]?.name}'s ${r.recap.event.title}`;
    return { title, openGraph: { title, images: [`/e/${id}/recap/image?p=${p}`] } };
  }
  const s = await getStory(id);
  if (!s) return {};
  const title = s.story.champion ? `${s.names[s.story.champion.id]?.name} wins ${s.story.event.title}` : `${s.story.event.title}: the story`;
  return { title, openGraph: { title, images: [`/e/${id}/recap/image`] } };
}

export default async function RecapPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [p, session] = await Promise.all([playerParam(searchParams), getSession()]);
  const viewer = session?.playerId ?? null;
  if (p) {
    const r = await getRecap(id, p);
    if (!r) notFound();
    return <RecapStory recap={r.recap} names={r.names} viewer={viewer} backHref={`/e/${id}`} />;
  }
  const s = await getStory(id);
  if (!s) notFound();
  // Did the viewer play? Then the story ends by offering their own review.
  const mine = viewer ? await getRecap(id, viewer) : null;
  return <TournamentStory story={s.story} names={s.names} viewer={viewer} viewerPlayed={!!mine?.recap.me} />;
}
