import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@everylaw/db/schema';

export * from '@everylaw/db/schema';
export { schema };

export type Db = PostgresJsDatabase<typeof schema>;

const databaseUrl = process.env.DATABASE_URL ?? (process.env.NODE_ENV === 'test'
  ? 'postgres://test:test@127.0.0.1:1/test'
  : undefined);
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

/** Shared serverless connection used by the web application. */
export const sqlClient = postgres(databaseUrl, { max: 1, prepare: false });
export const db: Db = drizzle(sqlClient, { schema });
