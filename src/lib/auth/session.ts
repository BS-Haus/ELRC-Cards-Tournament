import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "cards_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days: sign in once, stay signed in
export const ORGANISER_HOURS = 12;

const EXAMPLE_SECRET = "dev-only-change-me-please-0000000000000000000000";
function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  if (process.env.NODE_ENV === "production" && (s.length < 32 || s === EXAMPLE_SECRET)) {
    throw new Error("AUTH_SECRET is too weak for production: use `openssl rand -base64 32`");
  }
  return new TextEncoder().encode(s);
}

/** `orgUntil` (epoch ms) is set only after the organiser code was typed; it's signed, so it can't be forged. */
export type Session = { playerId: string | null; name: string | null; orgUntil?: number };

export async function setSession(s: Session): Promise<void> {
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { playerId: (payload.playerId as string) ?? null, name: (payload.name as string) ?? null, orgUntil: payload.orgUntil as number | undefined };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export const isOrganiser = (s: Session | null) => !!s?.orgUntil && s.orgUntil > Date.now();
