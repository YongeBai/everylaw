# EveryLaw

EveryLaw ingests the official United States Code, makes every section searchable, explains selected laws in plain English, and lets anonymous visitors signal “keep” or “dissolve” and submit short structured cases.

## Local setup

Requirements: Node 24+, npm 11+, Git, and Docker. No host Postgres client or sudo access is required.

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate
```

For a tiny four-law demo database only:

```bash
ALLOW_DEMO_SEED=true npm run db:seed
```

For the official corpus through Public Law 119-102 (downloads and caches the ~400 MB OLRC zip on first run):

```bash
npm run ingest -- run --release 119-102
```

The full ingest is streaming and idempotent. Appendices and court-rule bundles are excluded. To ingest from an already-extracted directory of `uscNN.xml` files (faster; also used for partial runs):

```bash
npm run ingest -- run --release 119-102 --directory pipelines/ingest/data/uslm-all
npm run ingest -- run --release 119-102 --directory pipelines/ingest/data/uslm-all --titles 18,26
```

After any ingest, apply the curation seed (tags, browse categories, starter featured tiers — idempotent):

```bash
docker compose exec -T postgres psql -U everylaw -d everylaw < ops/seed-curation.sql
```

Start the site:

```bash
npm run dev
```

Open `http://localhost:3000`. The default local review password from `.env` is `local-review`; change it anywhere beyond local development.

## AI content

Local deterministic content exercises the complete generation/review flow without external credentials:

```bash
npm run ai:generate -- --tier 2 --limit 4
```

For Anthropic generation, set `ANTHROPIC_API_KEY` in `.env.pipelines` (see `.env.pipelines.example`; kept out of `.env` so Next never loads it), then pass `--provider anthropic`. The pipeline defaults to `claude-sonnet-5`; set `ANTHROPIC_MODEL` to override it. Generated content is draft by default. Review and publish it with `ops/publish-ai-batch.sql`; only published versions render. Use `--type summary|explanation|origin|facts` to retry one content type without duplicating accepted drafts. `--publish` is intended for trusted local fixtures or the tier-1 auto-publish workflow.

Candidate ranking is available through:

```bash
npm run ai:curate -- --limit 2500
```

## Verification

With the dev server running:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The Playwright suite exercises desktop/mobile browse and pagination, autocomplete, both duplicate-number URL variants, vote persistence and re-voting, take creation/upvotes, rankings, share/clipboard, sitemap/robots/OG output, hostile-origin rejection, and rate limiting.

## Production configuration

Set `DATABASE_URL`, a strong `VOTER_HASH_SECRET`, and `NEXT_PUBLIC_BASE_URL`. Upstash is activated when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` exist; otherwise local Postgres provides rate accounting. Plausible loads only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set. Neon’s direct connection should be used for ingestion and migrations.

Anonymous identifiers, IPs, and user agents are stored only as salted hashes. Vote rows already include a nullable `user_id` for future account claiming. Public totals are signals, not referenda.
