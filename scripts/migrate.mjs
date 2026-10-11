// Applies any new migrations in ./drizzle before the build, so a deploy brings its own schema.
// With no DATABASE_URL (a fresh clone, CI) it does nothing.
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.log("migrate: no DATABASE_URL, skipping");
  process.exit(0);
}
const local = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrate: up to date");
} finally {
  await sql.end();
}
