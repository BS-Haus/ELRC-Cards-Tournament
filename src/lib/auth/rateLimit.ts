import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

// Counts live in the database because serverless instances share no memory. IPs are stored only
// as a keyed hash. If the table can't be reached the try is let through: the code still has to match.

async function ipKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.AUTH_SECRET || "dev").update(ip).digest("hex").slice(0, 32);
}

/** Count one try in `bucket`; true while under `max` tries per `windowMin` minutes. */
async function take(bucket: string, max: number, windowMin: number): Promise<boolean> {
  const expired = sql`${rateLimits.windowStart} < now() - (${windowMin} * interval '1 minute')`;
  const [row] = await db
    .insert(rateLimits)
    .values({ bucket, hits: 1 })
    .onConflictDoUpdate({
      target: rateLimits.bucket,
      set: {
        hits: sql`case when ${expired} then 1 else ${rateLimits.hits} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ hits: rateLimits.hits });
  return row.hits <= max;
}

/** A guess at a player's code or the organiser code: limited per device and per target. */
export async function codeAttemptAllowed(kind: "pin" | "org", target: string): Promise<boolean> {
  try {
    const ip = await ipKey();
    return (await take(`${kind}:ip:${ip}`, 12, 15)) && (await take(`${kind}:t:${target}`, 20, 60));
  } catch (e) {
    console.error("rate_limits unavailable:", (e as Error).message?.slice(0, 200));
    return true;
  }
}

export async function clearAttempts(kind: "pin" | "org", target: string): Promise<void> {
  try {
    await db.delete(rateLimits).where(eq(rateLimits.bucket, `${kind}:t:${target}`));
  } catch {}
}

/** Sign-ups per device, so nobody scripts a thousand profiles. */
export async function signupAllowed(): Promise<boolean> {
  try {
    return await take(`signup:ip:${await ipKey()}`, 10, 60);
  } catch {
    return true;
  }
}
