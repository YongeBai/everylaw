import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const execFileAsync = promisify(execFile);

/** Release point "119-102" → OLRC bulk zip URL. */
function releaseZipUrl(release: string): string {
  const m = release.match(/^(\d+)-(\d+)$/);
  if (!m) throw new Error(`invalid release point: ${release} (expected e.g. 119-102)`);
  return `https://uscode.house.gov/download/releasepoints/us/pl/${m[1]}/${m[2]}/xml_uscAll@${release}.zip`;
}

/**
 * Download + unzip a release point into the cache. Idempotent: cached by
 * release; never re-downloads a completed extract.
 */
export async function downloadRelease(release: string, cacheRoot: string): Promise<string> {
  const dir = path.join(cacheRoot, release);
  const doneMarker = path.join(dir, '.complete');
  if (fs.existsSync(doneMarker)) return dir;

  fs.mkdirSync(dir, { recursive: true });
  const zipPath = path.join(dir, 'all.zip');
  if (!fs.existsSync(zipPath)) {
    const url = releaseZipUrl(release);
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
    await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(zipPath));
  }
  console.log(`extracting ${zipPath}`);
  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', dir], { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(doneMarker, new Date().toISOString());
  return dir;
}

/** Main-edition title files (usc01.xml … usc54.xml), excluding appendixes (usc05A.xml …). */
export function listTitleFiles(dir: string): Array<{ file: string; titleNum: number }> {
  return fs
    .readdirSync(dir)
    .map((f) => ({ f, m: f.match(/^usc(\d{2})\.xml$/i) }))
    .filter((x): x is { f: string; m: RegExpMatchArray } => x.m !== null)
    .map((x) => ({ file: path.join(dir, x.f), titleNum: Number(x.m[1]) }))
    .sort((a, b) => a.titleNum - b.titleNum);
}
