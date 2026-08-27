import { createHash } from 'node:crypto';
import type { Sql } from 'postgres';
import type { ParsedNode } from './parse.ts';

const UPSERT_COLUMNS = [
  'corpus_id',
  'identifier',
  'parent_id',
  'node_type',
  'level_path',
  'sort_key',
  'citation',
  'num',
  'heading',
  'status',
  'body_html',
  'body_text',
  'source_credit',
  'enacting_pl',
  'enacted_date',
  'amendment_count',
  'word_count',
  'content_hash',
  'release_point',
  'last_seen_run_id',
];

type Row = Record<string, unknown>;

export function contentHash(n: ParsedNode): string {
  // Cover every parser-derived column the loader writes — otherwise a parser
  // fix (e.g. to source-credit parsing) never propagates on re-ingest.
  const canonical = JSON.stringify([
    n.identifier,
    n.nodeType,
    n.num,
    n.heading,
    n.status,
    n.citation,
    n.bodyText,
    n.bodyHtml,
    n.sourceCredit,
    n.enactingPl,
    n.enactedDate,
    n.amendmentCount,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

export async function ensureCorpus(
  sql: Sql,
  slug: string,
  name: string,
  jurisdiction: string,
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into corpora (slug, name, jurisdiction, source_url)
    values (${slug}, ${name}, ${jurisdiction}, ${'https://uscode.house.gov/download/download.shtml'})
    on conflict (slug) do update set name = excluded.name
    returning id
  `;
  return rows[0].id;
}

/**
 * Idempotent hash-diffed loader. Containers are upserted immediately (they are
 * few and are parents); sections are buffered and flushed in batches. Parse
 * order guarantees parents are seen before children.
 */
export class Loader {
  private idByIdentifier = new Map<string, number>();
  private sectionBuffer: Row[] = [];
  upserted = 0;
  unchanged = 0;

  constructor(
    private sql: Sql,
    private corpusId: number,
    private releasePoint: string,
    private runId: number,
    private batchSize = 200,
  ) {}

  private toRow(n: ParsedNode): Row {
    const parentId = n.parentIdentifier ? (this.idByIdentifier.get(n.parentIdentifier) ?? null) : null;
    if (n.parentIdentifier && parentId === null) {
      console.warn(`warn: parent ${n.parentIdentifier} not yet loaded for ${n.identifier}`);
    }
    return {
      corpus_id: this.corpusId,
      identifier: n.identifier,
      parent_id: parentId,
      node_type: n.nodeType,
      level_path: n.levelPath,
      sort_key: n.sortKey,
      citation: n.citation ?? '',
      num: n.num ?? '',
      heading: n.heading ?? '',
      status: n.status,
      body_html: n.bodyHtml ?? '',
      body_text: n.bodyText ?? '',
      source_credit: n.sourceCredit,
      enacting_pl: n.enactingPl,
      enacted_date: n.enactedDate,
      amendment_count: n.amendmentCount ?? 0,
      word_count: n.wordCount ?? 0,
      content_hash: contentHash(n),
      release_point: this.releasePoint,
      last_seen_run_id: this.runId,
    };
  }

  private async upsertRows(rows: Row[]): Promise<Map<string, number>> {
    const sql = this.sql;
    const changed = await sql<{ id: number; identifier: string }[]>`
      insert into law_nodes ${sql(rows, ...UPSERT_COLUMNS)}
      on conflict (corpus_id, identifier) do update set
        parent_id = excluded.parent_id,
        node_type = excluded.node_type,
        level_path = excluded.level_path,
        sort_key = excluded.sort_key,
        citation = excluded.citation,
        num = excluded.num,
        heading = excluded.heading,
        status = excluded.status,
        body_html = excluded.body_html,
        body_text = excluded.body_text,
        source_credit = excluded.source_credit,
        enacting_pl = excluded.enacting_pl,
        enacted_date = excluded.enacted_date,
        amendment_count = excluded.amendment_count,
        word_count = excluded.word_count,
        content_hash = excluded.content_hash,
        release_point = excluded.release_point,
        last_seen_run_id = excluded.last_seen_run_id,
        updated_at = now()
      where law_nodes.content_hash is distinct from excluded.content_hash
         or law_nodes.parent_id is distinct from excluded.parent_id
      returning id, identifier
    `;
    const ids = new Map<string, number>();
    for (const r of changed) ids.set(r.identifier, r.id);
    this.upserted += changed.length;

    // Unchanged rows are skipped by the gated SET above, so stamp them seen
    // here — otherwise the CLI's omitted sweep would flag every unchanged row.
    const missing = rows.map((r) => r.identifier as string).filter((i) => !ids.has(i));
    if (missing.length > 0) {
      const existing = await sql<{ id: number; identifier: string }[]>`
        update law_nodes set last_seen_run_id = ${this.runId}
        where corpus_id = ${this.corpusId} and identifier in ${sql(missing)}
        returning id, identifier
      `;
      for (const r of existing) ids.set(r.identifier, r.id);
      this.unchanged += existing.length;
    }
    return ids;
  }

  async add(n: ParsedNode): Promise<void> {
    if (n.nodeType === 'section') {
      this.sectionBuffer.push(this.toRow(n));
      if (this.sectionBuffer.length >= this.batchSize) await this.flush();
      return;
    }
    // Container: upsert immediately so children can resolve parent_id.
    const ids = await this.upsertRows([this.toRow(n)]);
    for (const [identifier, id] of ids) this.idByIdentifier.set(identifier, id);
  }

  async flush(): Promise<void> {
    if (this.sectionBuffer.length === 0) return;
    const rows = this.sectionBuffer;
    this.sectionBuffer = [];
    const ids = await this.upsertRows(rows);
    for (const [identifier, id] of ids) this.idByIdentifier.set(identifier, id);
  }
}
