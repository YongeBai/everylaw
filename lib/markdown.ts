/**
 * Parser for the Notion-flavored markdown subset AI explanations are written
 * in (see pipelines/ai/prompts/explanation.v4.md for the authoring contract).
 * Produces a typed AST; the renderer builds React elements from it, so model
 * output never reaches dangerouslySetInnerHTML. Unrecognized syntax degrades
 * to literal text rather than erroring.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong" | "em" | "strike" | "underline"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "color"; color: string; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] }
  | { kind: "break" };

export type ListItem = { inline: Inline[]; children: Block[] };

export type Block =
  | { kind: "paragraph"; inline: Inline[]; color?: string }
  | { kind: "heading"; level: 1 | 2 | 3 | 4; inline: Inline[] }
  | { kind: "list"; ordered: boolean; items: ListItem[] }
  | { kind: "quote"; inline: Inline[] }
  | { kind: "callout"; icon?: string; color?: string; children: Block[] }
  | { kind: "toggle"; summary: Inline[]; children: Block[] }
  | { kind: "columns"; columns: Block[][] }
  | { kind: "table"; headerRow: boolean; rows: Inline[][][] }
  | { kind: "code"; language: string | null; text: string }
  | { kind: "mermaid"; text: string }
  | { kind: "divider" };

export const NOTION_COLORS = new Set([
  "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red",
  "gray_bg", "brown_bg", "orange_bg", "yellow_bg", "green_bg", "blue_bg", "purple_bg", "pink_bg", "red_bg",
]);

// ---------------------------------------------------------------------------
// Inline parsing

const SPAN_OPEN = /^<span\s+(color="([a-z_]+)"|underline="true")\s*>/;

/** Find the end of a delimited run (e.g. ** … **), or -1. */
function findCloser(src: string, from: number, delimiter: string): number {
  for (let i = from; i <= src.length - delimiter.length; i++) {
    if (src[i] === "\\") { i += 1; continue; }
    if (src.startsWith(delimiter, i)) return i;
  }
  return -1;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ kind: "text", text }); text = ""; } };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length) { text += src[i + 1]; i += 2; continue; }
    if (ch === "\n") { flush(); out.push({ kind: "break" }); i += 1; continue; }
    if (src.startsWith("<br>", i) || src.startsWith("<br/>", i) || src.startsWith("<br />", i)) {
      flush(); out.push({ kind: "break" });
      i = src.indexOf(">", i) + 1;
      continue;
    }
    let matchedDelimiter = false;
    for (const [delimiter, kind] of [["**", "strong"], ["~~", "strike"], ["*", "em"]] as const) {
      if (src.startsWith(delimiter, i) && src[i + delimiter.length] && !/\s/.test(src[i + delimiter.length])) {
        const end = findCloser(src, i + delimiter.length, delimiter);
        if (end > i + delimiter.length) {
          flush();
          out.push({ kind, children: parseInline(src.slice(i + delimiter.length, end)) });
          i = end + delimiter.length;
          matchedDelimiter = true;
          break;
        }
      }
    }
    if (matchedDelimiter) continue;
    if (ch === "`") {
      const end = findCloser(src, i + 1, "`");
      if (end > i + 1) { flush(); out.push({ kind: "code", text: src.slice(i + 1, end) }); i = end + 1; continue; }
    }
    if (ch === "<") {
      const span = SPAN_OPEN.exec(src.slice(i));
      if (span) {
        const end = src.indexOf("</span>", i + span[0].length);
        if (end !== -1) {
          flush();
          const children = parseInline(src.slice(i + span[0].length, end));
          if (span[2] && NOTION_COLORS.has(span[2])) out.push({ kind: "color", color: span[2], children });
          else out.push(span[2] ? { kind: "text", text: src.slice(i + span[0].length, end) } : { kind: "underline", children });
          i = end + "</span>".length;
          continue;
        }
      }
    }
    if (ch === "[") {
      const closeBracket = findCloser(src, i + 1, "]");
      if (closeBracket !== -1 && src[closeBracket + 1] === "(") {
        const closeParen = src.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          const href = src.slice(closeBracket + 2, closeParen).trim();
          const label = src.slice(i + 1, closeBracket);
          flush();
          // Only site-internal links are honored; anything else keeps the label text.
          if (href.startsWith("/")) out.push({ kind: "link", href, children: parseInline(label) });
          else out.push(...parseInline(label));
          i = closeParen + 1;
          continue;
        }
      }
    }
    text += ch;
    i += 1;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Block parsing

const LIST_ITEM = /^(\s*)(?:[-*]|(\d+)[.)])\s+(.*)$/;
const FENCE = /^```([\w-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BLOCK_COLOR = /\s*\{color="([a-z_]+)"\}\s*$/;
const CELL = /<t([dh])[^>]*>([\s\S]*?)<\/t\1>/g;

type ParseState = { lines: string[]; index: number; errors: string[] };

function stripColor(line: string): { line: string; color?: string } {
  const match = BLOCK_COLOR.exec(line);
  if (!match) return { line };
  return { line: line.slice(0, match.index), color: NOTION_COLORS.has(match[1]) ? match[1] : undefined };
}

function indentDepth(ws: string): number {
  let depth = 0;
  for (const ch of ws) depth += ch === "\t" ? 2 : 1;
  return depth >> 1; // one level = a tab or two spaces
}

/** Collect lines until the matching close tag of `name`, handling nesting. */
function collectXmlBody(state: ParseState, name: string): string[] {
  const open = new RegExp(`<${name}(\\s|>)`);
  const close = `</${name}>`;
  const body: string[] = [];
  let depth = 1;
  while (state.index < state.lines.length) {
    const line = state.lines[state.index];
    state.index += 1;
    if (open.test(line.trim())) depth += 1;
    if (line.includes(close)) {
      depth -= 1;
      if (depth === 0) {
        const before = line.slice(0, line.indexOf(close));
        if (before.trim()) body.push(before);
        return body;
      }
    }
    body.push(line);
  }
  state.errors.push(`unclosed <${name}>`);
  return body;
}

/** Remove one shared indentation level from nested block content. */
function dedent(lines: string[]): string[] {
  const indented = lines.filter((line) => line.trim());
  if (indented.length === 0 || !indented.every((line) => /^(\t| {2,})/.test(line))) return lines;
  return lines.map((line) => line.replace(/^(\t| {1,4})/, ""));
}

function parseAttrs(raw: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of (raw ?? "").matchAll(/([\w-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function parseTableXml(openAttrs: string | undefined, body: string[]): Block {
  const attrs = parseAttrs(openAttrs);
  const rows: Inline[][][] = [];
  let sawHeaderCell = false;
  for (const rowMatch of body.join("\n").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells: Inline[][] = [];
    for (const cell of rowMatch[1].matchAll(CELL)) {
      if (cell[1] === "h" && rows.length === 0) sawHeaderCell = true;
      cells.push(parseInline(cell[2].trim()));
    }
    if (cells.length) rows.push(cells);
  }
  return { kind: "table", headerRow: attrs["header-row"] === "true" || sawHeaderCell, rows };
}

function parsePipeTable(state: ParseState): Block {
  const rows: Inline[][][] = [];
  let headerRow = false;
  while (state.index < state.lines.length) {
    const line = state.lines[state.index].trim();
    if (!line.startsWith("|")) break;
    state.index += 1;
    if (/^\|?[\s:|-]+\|?$/.test(line) && line.includes("-")) { headerRow = rows.length > 0; continue; }
    const cells = line.replace(/^\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/);
    rows.push(cells.map((cell) => parseInline(cell.trim())));
  }
  return { kind: "table", headerRow, rows };
}

function parseList(state: ParseState): Block {
  type Frame = { list: { ordered: boolean; items: ListItem[] }; depth: number };
  const root: Frame = { list: { ordered: false, items: [] }, depth: -1 };
  const stack: Frame[] = [root];
  let first = true;
  while (state.index < state.lines.length) {
    const line = state.lines[state.index];
    const match = LIST_ITEM.exec(line);
    if (!match) {
      // An indented plain line continues the previous item's text.
      const last = stack[stack.length - 1].list.items.at(-1);
      if (last && /^(\t| {2,})\S/.test(line)) {
        last.inline.push({ kind: "break" }, ...parseInline(stripColor(line.trim()).line));
        state.index += 1;
        continue;
      }
      break;
    }
    state.index += 1;
    const depth = indentDepth(match[1]);
    const ordered = match[2] !== undefined;
    if (first) { root.list.ordered = ordered; root.depth = depth; first = false; }
    while (stack.length > 1 && depth < stack[stack.length - 1].depth) stack.pop();
    const top = stack[stack.length - 1];
    if (depth > top.depth && top.list.items.length > 0) {
      const nested = { ordered, items: [] as ListItem[] };
      top.list.items[top.list.items.length - 1].children.push({ kind: "list", ...nested });
      stack.push({ list: nested, depth });
    }
    const target = stack[stack.length - 1];
    target.list.items.push({ inline: parseInline(stripColor(match[3]).line), children: [] });
  }
  return { kind: "list", ...root.list };
}

export function parseBlocks(source: string): { blocks: Block[]; errors: string[] } {
  const state: ParseState = { lines: source.replace(/\r\n/g, "\n").split("\n"), index: 0, errors: [] };
  return { blocks: parseFrom(state), errors: state.errors };
}

function parseFrom(state: ParseState): Block[] {
  const blocks: Block[] = [];
  while (state.index < state.lines.length) {
    const raw = state.lines[state.index];
    const line = raw.trim();
    if (!line || line === "<empty-block/>") { state.index += 1; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      state.index += 1;
      const body: string[] = [];
      while (state.index < state.lines.length && !FENCE.test(state.lines[state.index].trim())) {
        body.push(state.lines[state.index]);
        state.index += 1;
      }
      if (state.index >= state.lines.length) state.errors.push("unclosed code fence");
      else state.index += 1;
      const text = body.join("\n").trim();
      if (fence[1] === "mermaid") blocks.push(text ? { kind: "mermaid", text } : (state.errors.push("empty mermaid block"), { kind: "code", language: "mermaid", text }));
      else blocks.push({ kind: "code", language: fence[1] || null, text });
      continue;
    }

    const tagMatch = /^<(callout|details|columns|table)(\s[^>]*)?>/.exec(line);
    if (tagMatch) {
      const tag = tagMatch[1];
      state.index += 1;
      const closeInline = line.indexOf(`</${tag}>`);
      const body = closeInline !== -1
        ? [line.slice(tagMatch[0].length, closeInline)]
        : collectXmlBody(state, tag);
      if (tag === "table") { blocks.push(parseTableXml(tagMatch[2], body)); continue; }
      if (tag === "columns") {
        const columns: Block[][] = [];
        const columnState: ParseState = { lines: dedent(body), index: 0, errors: state.errors };
        while (columnState.index < columnState.lines.length) {
          const inner = columnState.lines[columnState.index].trim();
          if (/^<column(\s[^>]*)?>/.test(inner)) {
            columnState.index += 1;
            const closeCol = inner.indexOf("</column>");
            const columnBody = closeCol !== -1 ? [inner.slice(inner.indexOf(">") + 1, closeCol)] : collectXmlBody(columnState, "column");
            columns.push(parseFrom({ lines: dedent(columnBody), index: 0, errors: state.errors }));
          } else columnState.index += 1;
        }
        blocks.push({ kind: "columns", columns });
        continue;
      }
      if (tag === "details") {
        let summary: Inline[] = [];
        const rest: string[] = [];
        for (const bodyLine of body) {
          const summaryMatch = /<summary>([\s\S]*?)<\/summary>/.exec(bodyLine);
          if (summaryMatch && summary.length === 0) {
            summary = parseInline(summaryMatch[1].trim());
            const remainder = bodyLine.replace(summaryMatch[0], "").trim();
            if (remainder) rest.push(remainder);
          } else rest.push(bodyLine);
        }
        blocks.push({ kind: "toggle", summary, children: parseFrom({ lines: dedent(rest), index: 0, errors: state.errors }) });
        continue;
      }
      const attrs = parseAttrs(tagMatch[2]);
      blocks.push({
        kind: "callout",
        icon: attrs.icon || undefined,
        color: attrs.color && NOTION_COLORS.has(attrs.color) ? attrs.color : undefined,
        children: parseFrom({ lines: dedent(body), index: 0, errors: state.errors }),
      });
      continue;
    }

    if (line.startsWith("|")) { blocks.push(parsePipeTable(state)); continue; }
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) { blocks.push({ kind: "divider" }); state.index += 1; continue; }

    const heading = HEADING.exec(line);
    if (heading) {
      const { line: text } = stripColor(heading[2].replace(/\s*\{[^}]*\}\s*$/, ""));
      blocks.push({ kind: "heading", level: Math.min(4, heading[1].length) as 1 | 2 | 3 | 4, inline: parseInline(text) });
      state.index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (state.index < state.lines.length && state.lines[state.index].trim().startsWith(">")) {
        quoteLines.push(stripColor(state.lines[state.index].trim().replace(/^>\s?/, "")).line);
        state.index += 1;
      }
      blocks.push({ kind: "quote", inline: parseInline(quoteLines.join("\n")) });
      continue;
    }

    if (LIST_ITEM.test(raw)) { blocks.push(parseList(state)); continue; }

    // Paragraph: consecutive plain lines, single newlines preserved as breaks.
    const paragraphLines: string[] = [];
    let color: string | undefined;
    while (state.index < state.lines.length) {
      const next = state.lines[state.index];
      const trimmed = next.trim();
      if (!trimmed || FENCE.test(trimmed) || HEADING.test(trimmed) || trimmed.startsWith(">") || trimmed.startsWith("|")
        || /^-{3,}$/.test(trimmed) || LIST_ITEM.test(next) || /^<(callout|details|columns|table)(\s[^>]*)?>/.test(trimmed)) break;
      const stripped = stripColor(trimmed);
      color ??= stripped.color;
      paragraphLines.push(stripped.line);
      state.index += 1;
    }
    blocks.push({ kind: "paragraph", inline: parseInline(paragraphLines.join("\n")), color });
  }
  return blocks;
}

/** Generation-time guard: structural problems worth rejecting a draft over. */
export function lintMarkdown(source: string): string[] {
  const { blocks, errors } = parseBlocks(source);
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (block.kind === "table" && block.rows.length === 0) errors.push("table with no rows");
      if (block.kind === "table" && block.headerRow && block.rows.length === 1) errors.push("table with a header but no body rows");
      if (block.kind === "table" && new Set(block.rows.map((row) => row.length)).size > 1) errors.push("table with ragged rows");
      if (block.kind === "callout" || block.kind === "toggle") walk(block.children);
      if (block.kind === "columns") block.columns.forEach(walk);
    }
  };
  walk(blocks);
  return errors;
}
