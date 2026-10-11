import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

// Connect on first use, not at import: a build that never touches the database (or a preview
// without one) shouldn't fail just because DATABASE_URL isn't there.
const g = globalThis as unknown as { _cardsDb?: DB };
function connect(): DB {
  if (g._cardsDb) return g._cardsDb;
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon database to this Vercel project.");
  const local = url.includes("localhost") || url.includes("127.0.0.1");
  g._cardsDb = drizzle(postgres(url, { max: 5, ssl: local ? false : "require" }), { schema });
  return g._cardsDb;
}

export const db = new Proxy({} as DB, {
  get(_, key) {
    const real = connect() as unknown as Record<PropertyKey, unknown>;
    const v = real[key];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
