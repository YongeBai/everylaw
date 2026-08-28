import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// The schema source of truth is the hand-written SQL in db/migrations/.
// All queries go through db.execute(sql`...`) — there is deliberately no
// drizzle schema mirror to drift out of sync with the migrations.

const databaseUrl = process.env.DATABASE_URL ?? (process.env.NODE_ENV === 'test'
  ? 'postgres://test:test@127.0.0.1:1/test'
  : undefined);
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

/** Shared serverless connection used by the web application. */
export const sqlClient = postgres(databaseUrl, { max: 1, prepare: false });
export const db = drizzle(sqlClient);
