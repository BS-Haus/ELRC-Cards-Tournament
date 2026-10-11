import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getRecap } from "@/lib/data";
import { RecapStory } from "@/components/RecapStory";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whose recap: ?p=<player> (a shared link), else whoever's signed in, else the day's recap. */
async function who(searchParams: Props["searchParams"]) {
  const q = (await searchParams).p;
  if (typeof q === "string" && UUID_RE.test(q)) return q;
  return (await getSession())?.playerId ?? null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return {};
  const p = await who(searchParams);
  const r = await getRecap(id, p);
  if (!r) return {};
  const title = r.recap.me ? `${r.names[r.recap.me.id]?.name}'s ${r.recap.event.title}` : `${r.recap.event.title} recap`;
  return { title, openGraph: { title, images: [`/e/${id}/recap/image${r.recap.me ? `?p=${r.recap.me.id}` : ""}`] } };
}

export default async function RecapPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [p, s] = await Promise.all([who(searchParams), getSession()]);
  const r = await getRecap(id, p);
  if (!r) notFound();
  return <RecapStory recap={r.recap} names={r.names} viewer={s?.playerId ?? null} backHref={`/e/${id}`} />;
}
