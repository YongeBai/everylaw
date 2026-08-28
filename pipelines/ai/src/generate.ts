import "./env.js";
import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { sql } from "drizzle-orm";
import { db, sqlClient } from "@/db";
import { deterministicContent, lintContent, type ContentType, type LawInput } from "./content.js";

const options = new Command()
  .option("--tier <number>", "featured tier", "2")
  .option("--limit <number>", "law limit", "1000")
  .option("--provider <provider>", "local or anthropic", "local")
  .option("--type <type>", "generate only summary, explanation, origin, or facts")
  .option("--publish", "publish instead of creating drafts")
  .parse().opts<{ tier: string; limit: string; provider: "local"|"anthropic"; type?: string; publish?: boolean }>();
const validTypes: ContentType[] = ["summary", "explanation", "origin", "facts"];
if (!(["local", "anthropic"] as const).includes(options.provider)) throw new Error(`Invalid provider: ${options.provider}`);
const tier = Number(options.tier);
const limit = Number(options.limit);
if (!Number.isInteger(tier) || tier < 0 || tier > 2) throw new Error(`Invalid tier: ${options.tier}`);
if (!Number.isInteger(limit) || limit < 1) throw new Error(`Invalid limit: ${options.limit}`);
// Keep these explicit so every generated row records the prompt file used.
const promptVersions: Record<ContentType, string> = { summary: "v2", explanation: "v3", origin: "v2", facts: "v1" };
if (options.type && !validTypes.includes(options.type as ContentType)) throw new Error(`Invalid content type: ${options.type}`);
const types: ContentType[] = options.type ? [options.type as ContentType] : tier >= 2 ? validTypes : ["summary"];
const rows = await db.execute(sql`SELECT id, citation, heading, body_text, source_credit, enacting_pl, enacted_date, word_count, amendment_count FROM law_nodes WHERE node_type='section' AND featured_tier >= ${tier} ORDER BY sort_key LIMIT ${limit}`);

type Generated = { body: string; model: string; input: number; output: number; truncated?: boolean };

// One client and one read per prompt file for the whole run, not per law × type.
let clientPromise: Promise<InstanceType<typeof import("@anthropic-ai/sdk").default>> | undefined;
const promptCache = new Map<ContentType, Promise<string>>();

async function anthropicGenerate(type: ContentType, law: LawInput): Promise<Generated> {
  const apiKey = process.env.ANTHROPIC_API_KEY; const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for --provider anthropic");
  clientPromise ??= import("@anthropic-ai/sdk").then(({ default: Anthropic }) => new Anthropic({ apiKey }));
  const client = await clientPromise;
  let instructionPromise = promptCache.get(type);
  if (!instructionPromise) {
    instructionPromise = readFile(new URL(`../prompts/${type}.${promptVersions[type]}.md`, import.meta.url), "utf8");
    promptCache.set(type, instructionPromise);
  }
  const instruction = await instructionPromise;
  // Current Claude models may spend part of max_tokens on internal processing.
  // Content lint below remains the user-visible length guard.
  const maxTokens: Record<ContentType, number> = { summary: 180, explanation: 900, origin: 1200, facts: 500 };
  const message = await client.messages.create({ model, max_tokens: maxTokens[type], system: instruction, messages: [{ role: "user", content: JSON.stringify(law) }] });
  const body = message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  return { body, model, input: message.usage.input_tokens, output: message.usage.output_tokens, truncated: message.stop_reason === "max_tokens" };
}

let created = 0;
let skipped = 0;
let inputTokens = 0;
let outputTokens = 0;
for (const row of rows) {
  const law: LawInput = { citation: String(row.citation), heading: String(row.heading), bodyText: String(row.body_text), sourceCredit: row.source_credit ? String(row.source_credit) : null, enactingPl: row.enacting_pl ? String(row.enacting_pl) : null, enactedDate: row.enacted_date ? String(row.enacted_date) : null, wordCount: Number(row.word_count), amendmentCount: Number(row.amendment_count) };
  for (const type of types) {
    const generated: Generated = options.provider === "anthropic" ? await anthropicGenerate(type, law) : { body: deterministicContent(type, law), model: "local-deterministic", input: 0, output: 0 };
    inputTokens += generated.input;
    outputTokens += generated.output;
    const errors = lintContent(type, generated.body);
    if (generated.truncated) errors.push("output reached the token limit");
    if (errors.length) { skipped += 1; console.warn(`${law.citation} ${type}: ${errors.join(", ")}`); continue; }
    const nodeId = Number(row.id);
    const promptVersion = `${type}.${promptVersions[type]}`;
    if (options.publish) {
      // The partial unique index allows one published row per node/type. Keep
      // replacement atomic so a failed insert cannot leave the node unpublished.
      await db.transaction(async (tx) => {
        await tx.execute(sql`UPDATE ai_contents SET status='draft' WHERE node_id=${nodeId} AND content_type=${type}::ai_content_type AND status='published'`);
        await tx.execute(sql`INSERT INTO ai_contents(node_id, content_type, body_md, model, prompt_version, input_tokens, output_tokens, status) VALUES (${nodeId}, ${type}::ai_content_type, ${generated.body}, ${generated.model}, ${promptVersion}, ${generated.input}, ${generated.output}, 'published')`);
      });
    } else {
      await db.execute(sql`INSERT INTO ai_contents(node_id, content_type, body_md, model, prompt_version, input_tokens, output_tokens, status) VALUES (${nodeId}, ${type}::ai_content_type, ${generated.body}, ${generated.model}, ${promptVersion}, ${generated.input}, ${generated.output}, 'draft')`);
    }
    created += 1;
  }
}
console.log(JSON.stringify({ provider: options.provider, laws: rows.length, attempted: rows.length * types.length, created, skipped, inputTokens, outputTokens }, null, 2));
await sqlClient.end();
