import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";

// A player's profile picture. The URL carries ?v=<when it was set>, so a new photo is a new URL
// and the old one can be cached for good.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const [p] = await db.select({ avatar: players.avatar }).from(players).where(eq(players.id, id));
  const m = p?.avatar?.match(/^data:(image\/(?:jpeg|webp|png));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "content-type": m[1], "cache-control": "public, max-age=31536000, immutable" },
  });
}
