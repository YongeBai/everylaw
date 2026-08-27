import { SaxesParser, type SaxesTagPlain } from 'saxes';
import fs from 'node:fs';
import { z } from 'zod';

/**
 * Streaming USLM XML parser.
 *
 * Walks one title file (e.g. usc18.xml) with a SAX stack machine and emits
 * normalized node records in parent-before-child order. Never loads the whole
 * document into memory (Title 42 is hundreds of MB uncompressed).
 */

export const parsedNodeSchema = z.object({
  identifier: z.string().min(1),
  parentIdentifier: z.string().nullable(),
  nodeType: z.string().min(1),
  levelPath: z.string().min(1),
  sortKey: z.string().min(1),
  citation: z.string().nullable(),
  num: z.string().nullable(),
  heading: z.string().nullable(),
  status: z.enum(['active', 'repealed', 'reserved', 'omitted', 'transferred']),
  bodyHtml: z.string().nullable(),
  bodyText: z.string().nullable(),
  sourceCredit: z.string().nullable(),
  enactingPl: z.string().nullable(),
  enactedDate: z.string().nullable(), // YYYY-MM-DD
  amendmentCount: z.number().int().nullable(),
  wordCount: z.number().int().nullable(),
});

export type ParsedNode = z.infer<typeof parsedNodeSchema>;

const CONTAINER_TAGS = new Set([
  'title',
  'subtitle',
  'chapter',
  'subchapter',
  'part',
  'subpart',
  'division',
  'subdivision',
]);

// Subtrees skipped entirely wherever they appear.
const GLOBAL_SKIP_TAGS = new Set(['meta', 'toc', 'notes', 'note', 'appendix', 'sidenote']);

// Body serialization: USLM element -> [openHtml, closeHtml]. Missing = unwrap (keep text).
const BLOCK_LEVELS = new Set([
  'subsection',
  'paragraph',
  'subparagraph',
  'clause',
  'subclause',
  'item',
  'subitem',
  'subsubitem',
]);
const HTML_MAP: Record<string, [string, string]> = {
  chapeau: ['<p class="chapeau">', '</p>'],
  content: ['<p>', '</p>'],
  continuation: ['<p class="continuation">', '</p>'],
  p: ['<p>', '</p>'],
  num: ['<span class="num">', '</span>'],
  heading: ['<span class="hd">', '</span>'],
  quotedContent: ['<blockquote>', '</blockquote>'],
  table: ['<table>', '</table>'],
  thead: ['<thead>', '</thead>'],
  tbody: ['<tbody>', '</tbody>'],
  tr: ['<tr>', '</tr>'],
  th: ['<th>', '</th>'],
  td: ['<td>', '</td>'],
  caption: ['<caption>', '</caption>'],
  i: ['<em>', '</em>'],
  em: ['<em>', '</em>'],
  b: ['<strong>', '</strong>'],
  strong: ['<strong>', '</strong>'],
  sub: ['<sub>', '</sub>'],
  sup: ['<sup>', '</sup>'],
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function localName(name: string): string {
  const i = name.indexOf(':');
  return i === -1 ? name : name.slice(i + 1);
}

/** ltree labels allow [A-Za-z0-9_] only. */
function ltreeLabel(identifierSegment: string): string {
  const label = identifierSegment.replace(/[^A-Za-z0-9_]/g, '_');
  return label.length > 0 ? label : 'x';
}

/** Zero-pad the leading digits of a section/container num so text sort works. */
export function makeSortKey(num: string | null, fallback: string): string {
  const src = (num ?? fallback).trim();
  const m = src.match(/^(\d+)(.*)$/);
  if (!m) return src.toLowerCase().padStart(8, '0');
  return m[1].padStart(6, '0') + m[2].toLowerCase();
}

export interface SourceCreditInfo {
  enactingPl: string | null;
  enactedDate: string | null;
  amendmentCount: number;
}

/** Extract enacting Public Law, first date, and amendment count from a sourceCredit line. */
export function parseSourceCredit(credit: string | null): SourceCreditInfo {
  if (!credit) return { enactingPl: null, enactedDate: null, amendmentCount: 0 };
  const normalized = credit.replace(/[–—]/g, '-');
  const plMatches = normalized.match(/Pub\.\s*L\.\s*\d+-\d+/g) ?? [];
  let enactingPl: string | null = plMatches[0]?.replace(/\s+/g, ' ') ?? null;
  if (!enactingPl) {
    // Pre-1957 acts are cited as chapter laws: "June 25, 1948, ch. 645, 62 Stat. 683".
    const ch = normalized.match(/ch\.\s*\d+/);
    if (ch) enactingPl = ch[0].replace(/\s+/g, ' ');
  }
  let enactedDate: string | null = null;
  const dm = normalized.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z.]*\s+(\d{1,2}),\s+(\d{4})/i,
  );
  if (dm) {
    const month = MONTHS[dm[1].slice(0, 3).toLowerCase()];
    const day = Number(dm[2]);
    const year = Number(dm[3]);
    if (month && day >= 1 && day <= 31) {
      enactedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return { enactingPl, enactedDate, amendmentCount: plMatches.length };
}

function deriveStatus(
  attrStatus: string | undefined,
  num: string | null,
  heading: string | null,
): ParsedNode['status'] {
  const attr = attrStatus?.toLowerCase();
  if (attr === 'repealed' || attr === 'transferred' || attr === 'reserved' || attr === 'omitted') {
    return attr;
  }
  if (attr === 'renumbered') return 'transferred';
  const hay = `${num ?? ''} ${heading ?? ''}`.toLowerCase();
  for (const s of ['repealed', 'reserved', 'omitted', 'transferred'] as const) {
    if (hay.includes(s)) return s;
  }
  return 'active';
}

interface ContainerFrame {
  tag: string;
  identifier: string;
  parentIdentifier: string | null;
  levelPath: string;
  depth: number; // element depth at which the container tag sits
  attrStatus?: string;
  numValue: string | null;
  numText: string;
  headingText: string;
  capturing: 'num' | 'heading' | null;
  captureDepth: number;
  emitted: boolean;
  sawStructuralChild: boolean;
}

interface SectionFrame {
  identifier: string;
  parentIdentifier: string | null;
  levelPath: string;
  attrStatus?: string;
  depth: number; // element depth at which the <section> sits
  numValue: string | null;
  numText: string;
  headingText: string;
  headingDone: boolean;
  capturing: 'num' | 'heading' | 'credit' | null;
  captureDepth: number;
  credit: string;
  html: string[];
  text: string[];
  skipDepth: number; // inside notes/toc within the section
}

export interface ParseWarnings {
  count: number;
  samples: string[];
}

export async function parseUslmFile(
  filePath: string,
  onNode: (node: ParsedNode) => void | Promise<void>,
): Promise<ParseWarnings> {
  const parser = new SaxesParser({ xmlns: false });
  const warnings: ParseWarnings = { count: 0, samples: [] };
  const warn = (msg: string) => {
    warnings.count++;
    if (warnings.samples.length < 20) warnings.samples.push(msg);
  };

  let depth = 0;
  let globalSkipDepth = 0; // >0 → inside a skipped subtree (meta/toc/notes/appendix)
  const containers: ContainerFrame[] = [];
  let section: SectionFrame | null = null;
  let titleNum: string | null = null;
  // USLM reuses identifiers (repealed-then-recreated chapters, duplicate-numbered
  // sections): second and later occurrences get a ~n suffix so rows never collide.
  const identifierCounts = new Map<string, number>();
  const pending: ParsedNode[] = [];

  const emitNode = (node: ParsedNode) => {
    const checked = parsedNodeSchema.safeParse(node);
    if (!checked.success) {
      warn(`invalid node ${node.identifier}: ${checked.error.issues[0]?.message}`);
      return;
    }
    pending.push(checked.data);
  };

  const emitContainer = (frame: ContainerFrame) => {
    if (frame.emitted) return;
    frame.emitted = true;
    const num = frame.numValue ?? (frame.numText.trim() || null);
    const heading = frame.headingText.trim() || null;
    emitNode({
      identifier: frame.identifier,
      parentIdentifier: frame.parentIdentifier,
      nodeType: frame.tag,
      levelPath: frame.levelPath,
      sortKey: makeSortKey(num, frame.identifier.split('/').pop() ?? 'x'),
      citation: null,
      num,
      heading,
      status: deriveStatus(frame.attrStatus, num, heading),
      bodyHtml: null,
      bodyText: null,
      sourceCredit: null,
      enactingPl: null,
      enactedDate: null,
      amendmentCount: null,
      wordCount: null,
    });
  };

  const emitAncestors = () => {
    for (const frame of containers) emitContainer(frame);
  };

  const finishSection = (s: SectionFrame) => {
    const num = s.numValue ?? (s.numText.replace(/[§.\s]/g, '') || null);
    const heading = s.headingText.trim() || null;
    const bodyHtml = s.html.join('').trim() || null;
    const bodyText = s.text.join(' ').replace(/\s+/g, ' ').trim() || null;
    const credit = s.credit.trim() || null;
    const { enactingPl, enactedDate, amendmentCount } = parseSourceCredit(credit);
    const citation = titleNum && num ? `${titleNum} U.S.C. § ${num}` : null;
    emitNode({
      identifier: s.identifier,
      parentIdentifier: s.parentIdentifier,
      nodeType: 'section',
      levelPath: s.levelPath,
      sortKey: makeSortKey(num, s.identifier.split('/').pop() ?? 'x'),
      citation,
      num,
      heading,
      status: deriveStatus(s.attrStatus, num, heading),
      bodyHtml,
      bodyText,
      sourceCredit: credit,
      enactingPl,
      enactedDate,
      amendmentCount,
      wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
    });
  };

  parser.on('opentag', (tag: SaxesTagPlain) => {
    depth++;
    const name = localName(tag.name);

    if (globalSkipDepth > 0) {
      globalSkipDepth++;
      return;
    }
    if (section && section.skipDepth > 0) {
      section.skipDepth++;
      return;
    }
    if (GLOBAL_SKIP_TAGS.has(name)) {
      if (section) section.skipDepth = 1;
      else globalSkipDepth = 1;
      return;
    }

    if (section) {
      // Inside a section: capture num/heading/sourceCredit at the section's own
      // level; everything else is body content to serialize.
      if (section.capturing !== null) return; // markup inside a captured element — text only
      const directChild = depth === section.depth + 1;
      if (directChild && name === 'num' && !section.numValue && !section.headingDone) {
        section.numValue = (tag.attributes.value as string | undefined) ?? null;
        section.capturing = 'num';
        section.captureDepth = depth;
        return;
      }
      if (directChild && name === 'heading' && !section.headingDone) {
        section.capturing = 'heading';
        section.captureDepth = depth;
        return;
      }
      if (directChild && name === 'sourceCredit' && section.credit === '') {
        section.capturing = 'credit';
        section.captureDepth = depth;
        return;
      }
      const mapped = HTML_MAP[name];
      if (BLOCK_LEVELS.has(name)) {
        section.html.push('<div class="lvl">');
      } else if (mapped) {
        section.html.push(mapped[0]);
      } else if (name === 'br') {
        section.html.push('<br/>');
      }
      return;
    }

    // Outside any section
    if (CONTAINER_TAGS.has(name)) {
      const sourceIdentifier = tag.attributes.identifier as string | undefined;
      if (!sourceIdentifier) {
        // Reserved-range placeholders ("CHAPTERS 1035–1047 [RESERVED]") carry no
        // identifier and contain no sections; skip those silently.
        if ((tag.attributes.status as string | undefined)?.toLowerCase() !== 'reserved') {
          warn(`container <${name}> without identifier at depth ${depth}`);
        }
        globalSkipDepth = 1;
        return;
      }
      const occurrence = (identifierCounts.get(sourceIdentifier) ?? 0) + 1;
      identifierCounts.set(sourceIdentifier, occurrence);
      const identifier = occurrence === 1 ? sourceIdentifier : `${sourceIdentifier}~${occurrence}`;
      const parent = containers[containers.length - 1] ?? null;
      const segment = ltreeLabel(identifier.split('/').pop() ?? 'x');
      const frame: ContainerFrame = {
        tag: name,
        identifier,
        parentIdentifier: parent?.identifier ?? null,
        levelPath: parent ? `${parent.levelPath}.${segment}` : segment,
        depth,
        attrStatus: tag.attributes.status as string | undefined,
        numValue: null,
        numText: '',
        headingText: '',
        capturing: null,
        captureDepth: 0,
        emitted: false,
        sawStructuralChild: false,
      };
      if (parent) parent.sawStructuralChild = true;
      containers.push(frame);
      if (name === 'title') {
        const m = sourceIdentifier.match(/\/t([0-9a-zA-Z-]+)$/);
        titleNum = m ? m[1] : null;
      }
      return;
    }

    const current = containers[containers.length - 1];
    if (name === 'section') {
      const sourceIdentifier = tag.attributes.identifier as string | undefined;
      if (!sourceIdentifier) {
        warn(`section without identifier under ${current?.identifier ?? 'root'}`);
        globalSkipDepth = 1;
        return;
      }
      const occurrence = (identifierCounts.get(sourceIdentifier) ?? 0) + 1;
      identifierCounts.set(sourceIdentifier, occurrence);
      const identifier = occurrence === 1 ? sourceIdentifier : `${sourceIdentifier}~${occurrence}`;
      emitAncestors();
      const segment = ltreeLabel(identifier.split('/').pop() ?? 'x');
      section = {
        identifier,
        parentIdentifier: current?.identifier ?? null,
        levelPath: current ? `${current.levelPath}.${segment}` : segment,
        attrStatus: tag.attributes.status as string | undefined,
        depth,
        numValue: null,
        numText: '',
        headingText: '',
        headingDone: false,
        capturing: null,
        captureDepth: 0,
        credit: '',
        html: [],
        text: [],
        skipDepth: 0,
      };
      if (current) current.sawStructuralChild = true;
      return;
    }

    if (current && !current.emitted) {
      if (name === 'num' && depth === current.depth + 1) {
        current.numValue = (tag.attributes.value as string | undefined) ?? null;
        current.capturing = 'num';
        current.captureDepth = depth;
      } else if (name === 'heading' && depth === current.depth + 1) {
        current.capturing = 'heading';
        current.captureDepth = depth;
      }
    }
  });

  parser.on('text', (text: string) => {
    if (globalSkipDepth > 0) return;
    if (section) {
      if (section.skipDepth > 0) return;
      if (section.capturing === 'num') {
        section.numText += text;
      } else if (section.capturing === 'heading') {
        section.headingText += text;
      } else if (section.capturing === 'credit') {
        section.credit += text;
      } else {
        if (text.trim().length > 0) {
          section.html.push(escapeHtml(text));
          section.text.push(text);
        }
      }
      return;
    }
    const current = containers[containers.length - 1];
    if (current?.capturing === 'num') current.numText += text;
    else if (current?.capturing === 'heading') current.headingText += text;
  });

  parser.on('closetag', (tag: SaxesTagPlain) => {
    const name = localName(tag.name);

    if (globalSkipDepth > 0) {
      globalSkipDepth--;
      depth--;
      return;
    }

    if (section) {
      if (section.skipDepth > 0) {
        section.skipDepth--;
        depth--;
        return;
      }
      if (section.capturing && depth === section.captureDepth) {
        if (section.capturing === 'heading') section.headingDone = true;
        section.capturing = null;
        depth--;
        return;
      }
      if (name === 'section' && depth === section.depth) {
        finishSection(section);
        section = null;
        depth--;
        return;
      }
      if (section.capturing === null) {
        const mapped = HTML_MAP[name];
        if (BLOCK_LEVELS.has(name)) {
          section.html.push('</div>');
          section.text.push('\n');
        } else if (mapped) {
          section.html.push(mapped[1]);
          if (mapped[1] === '</p>' || name === 'table') section.text.push('\n');
        }
      }
      depth--;
      return;
    }

    const current = containers[containers.length - 1];
    if (current?.capturing && depth === current.captureDepth) {
      current.capturing = null;
      depth--;
      return;
    }
    if (current && CONTAINER_TAGS.has(name) && depth === current.depth) {
      // Emit any container that closed without ever seeing a child section
      // (empty/reserved chapters) — ancestors first.
      emitAncestors();
      containers.pop();
      if (name === 'title') titleNum = null;
    }
    depth--;
  });

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  for await (const chunk of stream) {
    parser.write(chunk as string);
    if (pending.length > 0) {
      for (const node of pending.splice(0)) await onNode(node);
    }
  }
  parser.close();
  for (const node of pending) await onNode(node);
  return warnings;
}
