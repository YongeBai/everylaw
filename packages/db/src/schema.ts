import { sql, type SQL } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  smallserial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const ltree = customType<{ data: string }>({ dataType: () => 'ltree' });
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

// ---------------------------------------------------------------------------
// Corpora — jurisdiction/corpus abstraction ('usc' now; 'cfr', state codes later)
// ---------------------------------------------------------------------------
export const corpora = pgTable('corpora', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  currentRelease: text('current_release'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Law nodes — one generic hierarchy table (title → ... → section)
// ---------------------------------------------------------------------------
export const lawNodes = pgTable(
  'law_nodes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    corpusId: smallint('corpus_id')
      .notNull()
      .references(() => corpora.id),
    // USLM identifier, e.g. '/us/usc/t18/s1111' — stable natural key across releases.
    identifier: text('identifier').notNull(),
    parentId: bigint('parent_id', { mode: 'number' }).references((): AnyPgColumn => lawNodes.id),
    nodeType: text('node_type').notNull(), // title|subtitle|chapter|subchapter|part|subpart|division|section
    levelPath: ltree('level_path'),
    sortKey: text('sort_key').notNull(),
    citation: text('citation'), // '18 U.S.C. § 1111'
    num: text('num'), // '1111', '1111a'
    heading: text('heading'),
    status: text('status').notNull().default('active'), // active|repealed|reserved|omitted|transferred
    bodyHtml: text('body_html'),
    bodyText: text('body_text'),
    sourceCredit: text('source_credit'),
    enactingPl: text('enacting_pl'), // 'Pub. L. 89-554'
    enactedDate: date('enacted_date'),
    amendmentCount: smallint('amendment_count'),
    wordCount: integer('word_count'),
    featuredTier: smallint('featured_tier').notNull().default(0), // 0 none, 1 summary, 2 full AI
    contentHash: char('content_hash', { length: 64 }),
    releasePoint: text('release_point'),
    search: tsvector('search').generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(citation, '')), 'A') || setweight(to_tsvector('english', coalesce(heading, '')), 'A') || setweight(to_tsvector('english', left(coalesce(body_text, ''), 500000)), 'C')`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('law_nodes_corpus_identifier_uq').on(t.corpusId, t.identifier),
    index('law_nodes_parent_sort_idx').on(t.parentId, t.sortKey),
    index('law_nodes_featured_idx').on(t.featuredTier),
    index('law_nodes_status_idx').on(t.status),
    index('law_nodes_type_idx').on(t.nodeType),
    index('law_nodes_search_idx').using('gin', t.search),
    index('law_nodes_level_path_idx').using('gist', t.levelPath),
    index('law_nodes_heading_trgm_idx').using('gin', sql`${t.heading} gin_trgm_ops`),
  ],
);

// ---------------------------------------------------------------------------
// AI-generated content, versioned per (node, content_type)
// ---------------------------------------------------------------------------
export const aiContents = pgTable(
  'ai_contents',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nodeId: bigint('node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    contentType: text('content_type').notNull(), // summary|explanation|origin|facts
    version: integer('version').notNull(),
    bodyMd: text('body_md').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    status: text('status').notNull().default('draft'), // draft|published|rejected
    reviewedBy: text('reviewed_by'),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_contents_node_type_version_uq').on(t.nodeId, t.contentType, t.version),
    // one published version per (node, content_type)
    uniqueIndex('ai_contents_one_published_uq')
      .on(t.nodeId, t.contentType)
      .where(sql`status = 'published'`),
    index('ai_contents_status_idx').on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Votes — anonymous, cookie-hash deduped; nullable user_id for future accounts
// ---------------------------------------------------------------------------
export const votes = pgTable(
  'votes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nodeId: bigint('node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    direction: text('direction').notNull(), // keep|dissolve
    voterHash: char('voter_hash', { length: 64 }).notNull(),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    userAgentHash: char('user_agent_hash', { length: 64 }),
    userId: bigint('user_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('votes_node_voter_uq').on(t.nodeId, t.voterHash),
    index('votes_ip_idx').on(t.ipHash),
    check('votes_direction_ck', sql`direction in ('keep', 'dissolve')`),
  ],
);

// Denormalized counts, maintained by trigger — leaderboards never scan votes.
export const voteAggregates = pgTable('vote_aggregates', {
  nodeId: bigint('node_id', { mode: 'number' })
    .primaryKey()
    .references(() => lawNodes.id),
  keepCount: integer('keep_count').notNull().default(0),
  dissolveCount: integer('dissolve_count').notNull().default(0),
  total: integer('total').notNull().default(0),
  dissolveRatio: real('dissolve_ratio').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Structured takes ("keep because…" / "dissolve because…") + take upvotes
// ---------------------------------------------------------------------------
export const takes = pgTable(
  'takes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    nodeId: bigint('node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    stance: text('stance').notNull(), // keep|dissolve
    body: text('body').notNull(),
    voterHash: char('voter_hash', { length: 64 }).notNull(),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    userId: bigint('user_id', { mode: 'number' }),
    // mirrors 0006_comment_threads
    parentId: bigint('parent_id', { mode: 'number' }),
    downvoteCount: integer('downvote_count').notNull().default(0),
    upvoteCount: integer('upvote_count').notNull().default(0),
    status: text('status').notNull().default('visible'), // visible|hidden|flagged
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('takes_node_idx').on(t.nodeId, t.stance, t.upvoteCount),
    check('takes_stance_ck', sql`stance in ('keep', 'dissolve')`),
    check('takes_body_len_ck', sql`char_length(body) <= 280`),
  ],
);

export const takeVotes = pgTable(
  'take_votes',
  {
    takeId: bigint('take_id', { mode: 'number' })
      .notNull()
      .references(() => takes.id),
    voterHash: char('voter_hash', { length: 64 }).notNull(),
    // mirrors 0006_comment_threads: 1 = upvote, -1 = downvote
    direction: smallint('direction').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.takeId, t.voterHash] })],
);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
export const tags = pgTable('tags', {
  id: smallserial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
});

export const nodeTags = pgTable(
  'node_tags',
  {
    nodeId: bigint('node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    tagId: smallint('tag_id')
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.tagId] }), index('node_tags_tag_idx').on(t.tagId)],
);

// ---------------------------------------------------------------------------
// Ingestion audit log
// ---------------------------------------------------------------------------
export const ingestionRuns = pgTable('ingestion_runs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  corpusId: smallint('corpus_id')
    .notNull()
    .references(() => corpora.id),
  releasePoint: text('release_point').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  nodesUpserted: integer('nodes_upserted').notNull().default(0),
  nodesUnchanged: integer('nodes_unchanged').notNull().default(0),
  status: text('status').notNull().default('running'), // running|succeeded|failed
  log: jsonb('log'),
});

// ---------------------------------------------------------------------------
// Head-to-head matchups + ELO (migration 0004_elo.sql — definitions mirror it)
// ---------------------------------------------------------------------------
export const matchupVotes = pgTable(
  'matchup_votes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    winnerNodeId: bigint('winner_node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    loserNodeId: bigint('loser_node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    voterHash: char('voter_hash', { length: 64 }).notNull(),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('matchup_votes_pair_idx').on(t.winnerNodeId, t.loserNodeId),
    index('matchup_votes_voter_idx').on(t.voterHash, t.createdAt),
    index('matchup_votes_ip_idx').on(t.ipHash, t.createdAt),
    check('matchup_votes_distinct_ck', sql`winner_node_id <> loser_node_id`),
  ],
);

export const eloRatings = pgTable(
  'elo_ratings',
  {
    nodeId: bigint('node_id', { mode: 'number' })
      .primaryKey()
      .references(() => lawNodes.id),
    elo: real('elo').notNull().default(1500),
    matches: integer('matches').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('elo_ratings_elo_idx').on(t.elo)],
);

export const eloSnapshots = pgTable(
  'elo_snapshots',
  {
    nodeId: bigint('node_id', { mode: 'number' })
      .notNull()
      .references(() => lawNodes.id),
    snappedOn: date('snapped_on').notNull(),
    rank: integer('rank').notNull(),
    elo: real('elo').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.nodeId, t.snappedOn] }),
    index('elo_snapshots_day_idx').on(t.snappedOn),
  ],
);

// ---------------------------------------------------------------------------
// "Can't Make It Up" real-or-fake game (migration 0005_realfake.sql — mirrors it)
// ---------------------------------------------------------------------------
export const decoys = pgTable('decoys', {
  id: smallserial('id').primaryKey(),
  citation: text('citation').notNull().unique(),
  heading: text('heading').notNull(),
});

export const guesses = pgTable(
  'guesses',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    itemKind: text('item_kind').notNull(), // 'law' | 'decoy'
    itemId: bigint('item_id', { mode: 'number' }).notNull(),
    voterHash: char('voter_hash', { length: 64 }).notNull(),
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    guessedReal: boolean('guessed_real').notNull(),
    correct: boolean('correct').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('guesses_item_idx').on(t.itemKind, t.itemId),
    index('guesses_voter_idx').on(t.voterHash, t.createdAt),
    check('guesses_kind_ck', sql`item_kind in ('law', 'decoy')`),
  ],
);

export type LawNode = typeof lawNodes.$inferSelect;
export type NewLawNode = typeof lawNodes.$inferInsert;
export type AiContent = typeof aiContents.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Take = typeof takes.$inferSelect;
