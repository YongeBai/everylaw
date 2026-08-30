import { describe, expect, it } from "vitest";
import { lintMarkdown, parseBlocks, parseInline, type Block } from "./markdown";

const kinds = (source: string) => parseBlocks(source).blocks.map((block) => block.kind);

describe("parseInline", () => {
  it("parses plain text", () => {
    expect(parseInline("see section 7703 of this title")).toEqual([{ kind: "text", text: "see section 7703 of this title" }]);
  });

  it("parses bold, italic, strike, code", () => {
    expect(parseInline("a **b** *c* ~~d~~ `e`")).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", children: [{ kind: "text", text: "b" }] },
      { kind: "text", text: " " },
      { kind: "em", children: [{ kind: "text", text: "c" }] },
      { kind: "text", text: " " },
      { kind: "strike", children: [{ kind: "text", text: "d" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "e" },
    ]);
  });

  it("leaves unmatched delimiters as text", () => {
    expect(parseInline("15% * rate")).toEqual([{ kind: "text", text: "15% * rate" }]);
  });

  it("handles colored spans and underline", () => {
    expect(parseInline('<span color="red">no</span> <span underline="true">yes</span>')).toEqual([
      { kind: "color", color: "red", children: [{ kind: "text", text: "no" }] },
      { kind: "text", text: " " },
      { kind: "underline", children: [{ kind: "text", text: "yes" }] },
    ]);
  });

  it("keeps only internal links", () => {
    expect(parseInline("[here](/r/title-26/1) [there](https://x.com)")).toEqual([
      { kind: "link", href: "/r/title-26/1", children: [{ kind: "text", text: "here" }] },
      { kind: "text", text: " " },
      { kind: "text", text: "there" },
    ]);
  });

  it("honors br tags and escapes", () => {
    expect(parseInline("a<br>b \\*not bold\\*")).toEqual([
      { kind: "text", text: "a" },
      { kind: "break" },
      { kind: "text", text: "b *not bold*" },
    ]);
  });
});

describe("parseBlocks", () => {
  it("splits paragraphs on blank lines and keeps line breaks", () => {
    const { blocks } = parseBlocks("one\ntwo\n\nthree");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ kind: "paragraph", inline: [{ kind: "text", text: "one" }, { kind: "break" }, { kind: "text", text: "two" }], color: undefined });
  });

  it("parses headings, capping at h4", () => {
    const { blocks } = parseBlocks("# a\n###### b");
    expect(blocks).toEqual([
      { kind: "heading", level: 1, inline: [{ kind: "text", text: "a" }] },
      { kind: "heading", level: 4, inline: [{ kind: "text", text: "b" }] },
    ]);
  });

  it("parses nested lists", () => {
    const { blocks } = parseBlocks("- a\n\t- a1\n- b");
    const list = blocks[0] as Extract<Block, { kind: "list" }>;
    expect(list.items).toHaveLength(2);
    expect(list.items[0].children[0]).toMatchObject({ kind: "list", items: [{ inline: [{ kind: "text", text: "a1" }] }] });
  });

  it("parses ordered lists with space indentation", () => {
    const { blocks } = parseBlocks("1. first\n2. second\n  - sub");
    const list = blocks[0] as Extract<Block, { kind: "list" }>;
    expect(list.ordered).toBe(true);
    expect(list.items[1].children).toHaveLength(1);
  });

  it("parses pipe tables with header separators", () => {
    const { blocks } = parseBlocks("| Income | Rate |\n|---|---|\n| up to $18,450 | 15% |");
    const table = blocks[0] as Extract<Block, { kind: "table" }>;
    expect(table.headerRow).toBe(true);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][1]).toEqual([{ kind: "text", text: "15%" }]);
  });

  it("parses Notion xml tables", () => {
    const source = '<table header-row="true">\n\t<tr><td>Filing status</td><td>Rate</td></tr>\n\t<tr><td>Joint</td><td>15%</td></tr>\n</table>';
    const table = parseBlocks(source).blocks[0] as Extract<Block, { kind: "table" }>;
    expect(table.headerRow).toBe(true);
    expect(table.rows).toHaveLength(2);
  });

  it("parses callouts with icon and children", () => {
    const source = '<callout icon="⚠️" color="yellow_bg">\n\tKey point here.\n\t- one\n\t- two\n</callout>';
    const callout = parseBlocks(source).blocks[0] as Extract<Block, { kind: "callout" }>;
    expect(callout.icon).toBe("⚠️");
    expect(callout.color).toBe("yellow_bg");
    expect(callout.children.map((child) => child.kind)).toEqual(["paragraph", "list"]);
  });

  it("parses single-line callouts", () => {
    const callout = parseBlocks('<callout icon="💡">One liner.</callout>').blocks[0] as Extract<Block, { kind: "callout" }>;
    expect(callout.children).toEqual([{ kind: "paragraph", inline: [{ kind: "text", text: "One liner." }], color: undefined }]);
  });

  it("parses toggles", () => {
    const source = "<details>\n<summary>The fine print</summary>\nHidden detail.\n</details>";
    const toggle = parseBlocks(source).blocks[0] as Extract<Block, { kind: "toggle" }>;
    expect(toggle.summary).toEqual([{ kind: "text", text: "The fine print" }]);
    expect(toggle.children).toHaveLength(1);
  });

  it("parses columns", () => {
    const source = "<columns>\n<column>\nleft\n</column>\n<column>\nright\n</column>\n</columns>";
    const columns = parseBlocks(source).blocks[0] as Extract<Block, { kind: "columns" }>;
    expect(columns.columns).toHaveLength(2);
  });

  it("parses mermaid and code fences", () => {
    expect(kinds("```mermaid\nflowchart TD\nA-->B\n```\n\n```\nplain\n```")).toEqual(["mermaid", "code"]);
  });

  it("parses quotes and dividers", () => {
    expect(kinds("> quoted words\n\n---")).toEqual(["quote", "divider"]);
  });

  it("treats unknown tags as literal paragraph text", () => {
    const { blocks } = parseBlocks("<mention-user url=\"x\">someone</mention-user>");
    expect(blocks[0].kind).toBe("paragraph");
  });
});

describe("lintMarkdown", () => {
  it("accepts clean documents", () => {
    expect(lintMarkdown("Intro.\n\n| a | b |\n|---|---|\n| 1 | 2 |")).toEqual([]);
  });

  it("flags unclosed fences and tags", () => {
    expect(lintMarkdown("```mermaid\nflowchart TD")).toContain("unclosed code fence");
    expect(lintMarkdown("<callout>\nnever closed")).toContain("unclosed <callout>");
  });

  it("flags header-only tables", () => {
    expect(lintMarkdown("| a | b |\n|---|---|")).toContain("table with a header but no body rows");
  });

  it("flags ragged tables", () => {
    expect(lintMarkdown("| a | b |\n|---|---|\n| only-one |")).toContain("table with ragged rows");
  });
});
