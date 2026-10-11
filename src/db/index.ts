import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// One client across hot reloads in dev. Neon needs SSL; local Postgres doesn't.
const g = globalThis as unknown as { _cardsSql?: ReturnType<typeof postgres> };
const sql = g._cardsSql ?? postgres(url, { max: 5, ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require" });
if (process.env.NODE_ENV !== "production") g._cardsSql = sql;

export const db = drizzle(sql, { schema });
