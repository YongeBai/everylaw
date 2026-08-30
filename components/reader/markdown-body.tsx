import Link from "next/link";
import { Fragment } from "react";
import { CitationText } from "@/components/reader/citation-text";
import { MermaidDiagram } from "@/components/reader/mermaid-diagram";
import { parseBlocks, type Block, type ListItem } from "@/lib/markdown";
import type { TermInline } from "@/lib/annotate-terms";
import styles from "@/app/(reader)/reader.module.css";

/**
 * Renders AI-explanation bodies written in the Notion-flavored markdown
 * subset (lib/markdown.ts). Every plain text run flows through CitationText
 * so U.S. Code references stay linked, including inside table cells. Pass
 * pre-parsed `blocks` (e.g. term-annotated via lib/annotate-terms) to skip
 * the parse; term marks render with the same data attributes the official
 * pane uses, so TermCards can bind definition cards to them.
 */
export function MarkdownBody({ source, blocks, title }: { source?: string; blocks?: Block[]; title?: number }) {
  const resolved = blocks ?? parseBlocks(source ?? "").blocks;
  return <div className={styles.mdBody}><BlockList blocks={resolved} title={title} /></div>;
}

const colorClass = (color: string | undefined) => (color ? styles[`md_${color}`] : undefined);

function InlineRun({ nodes, title }: { nodes: TermInline[]; title?: number }) {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text": return <Fragment key={index}><CitationText title={title}>{node.text}</CitationText></Fragment>;
      case "defterm": return <mark key={index} className="law-term law-term-defined" data-def={node.id} role="button" tabIndex={0}>{node.text}<sup aria-hidden="true">*</sup></mark>;
      case "artterm": return <mark key={index} className="law-term" data-term={node.term} role="button" tabIndex={0}>{node.text}</mark>;
      case "break": return <br key={index} />;
      case "code": return <code key={index}>{node.text}</code>;
      case "strong": return <strong key={index}><InlineRun nodes={node.children} title={title} /></strong>;
      case "em": return <em key={index}><InlineRun nodes={node.children} title={title} /></em>;
      case "strike": return <s key={index}><InlineRun nodes={node.children} title={title} /></s>;
      case "underline": return <u key={index}><InlineRun nodes={node.children} title={title} /></u>;
      case "color": return <span key={index} className={colorClass(node.color)}><InlineRun nodes={node.children} title={title} /></span>;
      case "link": return <Link key={index} href={node.href}><InlineRun nodes={node.children} title={title} /></Link>;
    }
  });
}

function Items({ items, title }: { items: ListItem[]; title?: number }) {
  return items.map((item, index) => <li key={index}>
    <InlineRun nodes={item.inline} title={title} />
    {item.children.length > 0 && <BlockList blocks={item.children} title={title} />}
  </li>);
}

function BlockList({ blocks, title }: { blocks: Block[]; title?: number }) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case "paragraph":
        return <p key={index} className={colorClass(block.color)}><InlineRun nodes={block.inline} title={title} /></p>;
      case "heading": {
        const Tag = (["h3", "h3", "h4", "h4"] as const)[block.level - 1];
        return <Tag key={index} className={styles[`mdH${Math.min(2, block.level)}`]}><InlineRun nodes={block.inline} title={title} /></Tag>;
      }
      case "list": {
        const Tag = block.ordered ? "ol" : "ul";
        return <Tag key={index}><Items items={block.items} title={title} /></Tag>;
      }
      case "quote":
        return <blockquote key={index}><InlineRun nodes={block.inline} title={title} /></blockquote>;
      case "callout":
        return <div key={index} className={`${styles.mdCallout} ${colorClass(block.color) ?? ""}`}>
          {block.icon && <span aria-hidden className={styles.mdCalloutIcon}>{block.icon}</span>}
          <div className={styles.mdCalloutBody}><BlockList blocks={block.children} title={title} /></div>
        </div>;
      case "toggle":
        return <details key={index} className={styles.mdToggle}>
          <summary><InlineRun nodes={block.summary} title={title} /></summary>
          <div className={styles.mdToggleBody}><BlockList blocks={block.children} title={title} /></div>
        </details>;
      case "columns":
        return <div key={index} className={styles.mdColumns}>
          {block.columns.map((column, columnIndex) => <div key={columnIndex}><BlockList blocks={column} title={title} /></div>)}
        </div>;
      case "table":
        return <div key={index} className={styles.mdTableWrap}><table className={styles.mdTable}>
          {block.headerRow && block.rows.length > 0 && <thead><tr>
            {block.rows[0].map((cell, cellIndex) => <th key={cellIndex}><InlineRun nodes={cell} title={title} /></th>)}
          </tr></thead>}
          <tbody>
            {block.rows.slice(block.headerRow ? 1 : 0).map((row, rowIndex) => <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}><InlineRun nodes={cell} title={title} /></td>)}
            </tr>)}
          </tbody>
        </table></div>;
      case "mermaid":
        return <MermaidDiagram key={index} code={block.text} />;
      case "code":
        return <pre key={index} className={styles.mdCode}>{block.text}</pre>;
      case "divider":
        return <hr key={index} className={styles.mdDivider} />;
    }
  });
}
