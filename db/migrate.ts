import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// dotenv never overrides vars that are already set, so load cwd .env first
// (it wins), then the repo-root .env as the fallback for other cwds.
config();
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const client = postgres(url, { max: 1 });
// Extensions must exist before migrations that use ltree/gin_trgm_ops run.
await client.unsafe(`CREATE EXTENSION IF NOT EXISTS ltree`);
await client.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
await migrate(drizzle(client), { migrationsFolder });
console.log('migrations applied');
await client.end();
