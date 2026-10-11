import { createHash, scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/** Each player's own code: 4 digits, set when they sign up. */
export const PIN_RE = /^\d{4}$/;

/** scrypt$<saltHex>$<hashHex>, Node's built-in scrypt (same format as the Spike ladder app). */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Constant-time compare for the organiser code. Never matches when none is configured. */
export function organiserCodeMatches(typed: unknown, configured: string | undefined): boolean {
  if (!configured || configured.length < 8 || typeof typed !== "string") return false;
  const d = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(d(typed), d(configured));
}
