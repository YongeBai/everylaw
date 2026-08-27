import 'dotenv/config';
import { Command } from 'commander';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadRelease, listTitleFiles } from './download.ts';
import { parseUslmFile } from './parse.ts';
import { ensureCorpus, Loader } from './load.ts';

const CACHE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.cache');

const program = new Command('ingest');

program
  .command('run')
  .description('Download a US Code release point and load it into Postgres')
  .requiredOption('--release <point>', 'release point, e.g. 119-102')
  .option('--directory <path>', 'use an existing directory of uscNN.xml files')
  .option('--titles <list>', 'comma-separated title numbers to ingest (default: all)')
  .action(async (opts: { release: string; directory?: string; titles?: string }) => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const sql = postgres(url, { max: 4, prepare: false });

    const dir = opts.directory ? path.resolve(opts.directory) : await downloadRelease(opts.release, CACHE_ROOT);
    let files = listTitleFiles(dir);
    if (opts.titles) {
      const wanted = new Set(opts.titles.split(',').map((t) => Number(t.trim())));
      files = files.filter((f) => wanted.has(f.titleNum));
    }
    if (files.length === 0) throw new Error('no title files matched');

    const corpusId = await ensureCorpus(sql, 'usc', 'United States Code', 'us');
    const [run] = await sql<{ id: number }[]>`
      insert into ingestion_runs (corpus_id, release_point) values (${corpusId}, ${opts.release})
      returning id
    `;

    const warningLog: { [key: string]: string | { count: number; samples: string[] } } = {};
    let upserted = 0;
    let unchanged = 0;
    try {
      for (const { file, titleNum } of files) {
        const started = Date.now();
        const loader = new Loader(sql, corpusId, opts.release, run.id);
        const warnings = await parseUslmFile(file, (node) => loader.add(node));
        await loader.flush();
        upserted += loader.upserted;
        unchanged += loader.unchanged;
        if (warnings.count > 0) warningLog[`title-${titleNum}`] = warnings;
        console.log(
          `title ${titleNum}: ${loader.upserted} upserted, ${loader.unchanged} unchanged, ` +
            `${warnings.count} warnings, ${((Date.now() - started) / 1000).toFixed(1)}s`,
        );
      }
      await sql`
        update ingestion_runs set finished_at = now(), status = 'completed',
          stats = ${sql.json({ upserted, unchanged })}, warnings = ${sql.json(warningLog)}
        where id = ${run.id}
      `;
      // NULL the hash so a section that reappears in a later release is always
      // rewritten (NULL IS DISTINCT FROM any hash) and its real status restored.
      // status <> 'omitted' keeps the sweep a no-op for rows omitted on prior runs.
      if (!opts.titles) await sql`
        update law_nodes set status = 'omitted', content_hash = null, updated_at = now()
        where corpus_id = ${corpusId} and last_seen_run_id is distinct from ${run.id}
          and status <> 'omitted'
      `;
      await sql`update corpora set current_release = ${opts.release} where id = ${corpusId}`;
      console.log(`done: ${upserted} upserted, ${unchanged} unchanged`);
    } catch (err) {
      await sql`
        update ingestion_runs set finished_at = now(), status = 'failed',
          stats = ${sql.json({ upserted, unchanged })},
          warnings = ${sql.json({ ...warningLog, error: String(err) })}
        where id = ${run.id}
      `;
      throw err;
    } finally {
      await sql.end();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
