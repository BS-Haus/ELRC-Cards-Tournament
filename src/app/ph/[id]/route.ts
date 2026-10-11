import { eq } from "drizzle-orm";
import { db } from "@/db";
import { eventPhotos } from "@/db/schema";

// A photo from the day. The URL carries ?v=<when it was added>, so it can be cached for good.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });
  const [p] = await db.select({ data: eventPhotos.data }).from(eventPhotos).where(eq(eventPhotos.id, id));
  const m = p?.data.match(/^data:(image\/(?:jpeg|webp));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1], "cache-control": "public, max-age=31536000, immutable" } });
}
