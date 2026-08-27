import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@everylaw/db/schema';

export * from '@everylaw/db/schema';
export { schema };

export type Db = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  /** Max pool connections. Ingestion wants more; serverless wants 1. */
  max?: number;
}

export function createDb(url = process.env.DATABASE_URL, opts: CreateDbOptions = {}): Db {
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, { max: opts.max ?? 10, prepare: false });
  return drizzle(client, { schema });
}

const databaseUrl = process.env.DATABASE_URL ?? (process.env.NODE_ENV === 'test'
  ? 'postgres://test:test@127.0.0.1:1/test'
  : undefined);
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

/** Shared serverless connection used by the web application. */
export const sqlClient = postgres(databaseUrl, { max: 1, prepare: false });
export const db: Db = drizzle(sqlClient, { schema });
