import { config } from "dotenv";
import path from "node:path";
import postgres from "postgres";

/**
 * E2E runs share one dev database and one source IP, so the hourly
 * rate-limit ledger fills up across repeated runs. Reset it before each run —
 * it is throwaway anti-abuse state, not product data.
 */
export default async function globalSetup() {
  config({ path: path.resolve(process.cwd(), ".env") });
  const url = process.env.DATABASE_URL;
  if (!url) return;
  // Wiping rate-limit history on a real deployment would disarm anti-abuse
  // throttles (vote dedup itself lives in the votes table's unique constraint,
  // not here) — never run the reset against a non-local DB.
  const host = new URL(url).hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
    console.warn(`global-setup: skipping interaction_events reset on non-local DB host "${host}"`);
    return;
  }
  const sql = postgres(url, { max: 1 });
  try {
    await sql`DELETE FROM interaction_events`;
  } finally {
    await sql.end();
  }
}
