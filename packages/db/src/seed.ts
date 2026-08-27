import { sql } from "drizzle-orm";
import { db, sqlClient } from "./index.js";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  console.log("Demo seed skipped. Set ALLOW_DEMO_SEED=true only for an empty/demo database.");
  await sqlClient.end();
  process.exit(0);
}

const corpusRows = await db.execute(sql`
  INSERT INTO corpora (slug, name, jurisdiction, source_url, current_release)
  VALUES ('usc', 'United States Code', 'US', 'https://uscode.house.gov/download/download.shtml', 'local-demo')
  ON CONFLICT (slug) DO UPDATE SET current_release = EXCLUDED.current_release
  RETURNING id
`);
const corpusId = Number(corpusRows[0]!.id);

const nodes = [
  {
    identifier: "/us/usc/t18/s1111",
    num: "1111",
    citation: "18 U.S.C. § 1111",
    heading: "Murder",
    body: "Murder is the unlawful killing of a human being with malice aforethought. This section defines first- and second-degree murder and establishes federal penalties.",
    source: "June 25, 1948, ch. 645, 62 Stat. 756; Pub. L. 103–322, title VI, §60003(a)(12), Sept. 13, 1994, 108 Stat. 1970.",
    pl: "Pub. L. 103-322",
    date: "1948-06-25",
  },
  {
    identifier: "/us/usc/t18/s700",
    num: "700",
    citation: "18 U.S.C. § 700",
    heading: "Desecration of the flag of the United States; penalties",
    body: "Whoever knowingly mutilates, defaces, physically defiles, burns, maintains on the floor or ground, or tramples upon any flag of the United States shall be fined under this title or imprisoned for not more than one year, or both.",
    source: "Added Pub. L. 90–381, §1, July 5, 1968, 82 Stat. 291.",
    pl: "Pub. L. 90-381",
    date: "1968-07-05",
  },
  {
    identifier: "/us/usc/t21/s347",
    num: "347",
    citation: "21 U.S.C. § 347",
    heading: "Intrastate commerce in colored oleomargarine",
    body: "Colored oleomargarine or colored margarine sold in the same State or Territory in which it is produced shall be subject in the same manner and to the same extent to the provisions of this chapter as if it had been introduced in interstate commerce.",
    source: "Pub. L. 81–459, title IV, §407, Mar. 16, 1950, 64 Stat. 20.",
    pl: "Pub. L. 81-459",
    date: "1950-03-16",
  },
  {
    identifier: "/us/usc/t26/s5000A",
    num: "5000A",
    citation: "26 U.S.C. § 5000A",
    heading: "Requirement to maintain minimum essential coverage",
    body: "An applicable individual shall for each month ensure that the individual, and any dependent of the individual who is an applicable individual, is covered under minimum essential coverage for such month.",
    source: "Added Pub. L. 111–148, title I, §1501(b), Mar. 23, 2010, 124 Stat. 244.",
    pl: "Pub. L. 111-148",
    date: "2010-03-23",
  },
];

for (const title of [18, 21, 26]) {
  await db.execute(sql`
    INSERT INTO law_nodes (corpus_id, identifier, node_type, level_path, sort_key, citation, num, heading, content_hash, release_point, featured_tier)
    VALUES (${corpusId}, ${`/us/usc/t${title}`}, 'title', ${`usc.t${title}`}, ${String(title).padStart(4, "0")}, ${`Title ${title}`}, ${String(title)}, ${title === 18 ? "Crimes and Criminal Procedure" : title === 21 ? "Food and Drugs" : "Internal Revenue Code"}, md5(${`title-${title}`}), 'local-demo', 1)
    ON CONFLICT (corpus_id, identifier) DO NOTHING
  `);
}

for (const [index, node] of nodes.entries()) {
  const title = node.identifier.match(/t(\d+)/)![1]!;
  await db.execute(sql`
    INSERT INTO law_nodes (
      corpus_id, parent_id, identifier, node_type, level_path, sort_key, citation, num, heading,
      body_html, body_text, source_credit, enacting_pl, enacted_date, amendment_count,
      word_count, featured_tier, content_hash, release_point
    )
    VALUES (
      ${corpusId}, (SELECT id FROM law_nodes WHERE corpus_id = ${corpusId} AND identifier = ${`/us/usc/t${title}`}),
      ${node.identifier}, 'section', ${`usc.t${title}.s${node.num.toLowerCase()}`},
      ${`${String(title).padStart(4, "0")}.${node.num.padStart(12, "0")}`}, ${node.citation}, ${node.num}, ${node.heading},
      ${`<p>${node.body}</p>`}, ${node.body}, ${node.source}, ${node.pl}, ${node.date}, ${index + 1},
      ${node.body.split(/\s+/).length}, 2, md5(${node.body}), 'local-demo'
    )
    ON CONFLICT (corpus_id, identifier) DO NOTHING
  `);

  const nodeIdResult = await db.execute(sql`SELECT id FROM law_nodes WHERE corpus_id = ${corpusId} AND identifier = ${node.identifier}`);
  const nodeId = Number(nodeIdResult[0]!.id);
  await db.execute(sql`INSERT INTO vote_aggregates(node_id) VALUES (${nodeId}) ON CONFLICT DO NOTHING`);

  const tagName = title === "18" ? "Crime & punishment" : title === "21" ? "Food & drugs" : "Taxes & money";
  const tagSlug = title === "18" ? "crime-punishment" : title === "21" ? "food-drugs" : "taxes-money";
  const tagResult = await db.execute(sql`INSERT INTO tags(slug, name) VALUES (${tagSlug}, ${tagName}) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`);
  await db.execute(sql`INSERT INTO node_tags(node_id, tag_id) VALUES (${nodeId}, ${Number(tagResult[0]!.id)}) ON CONFLICT DO NOTHING`);

  const summary = node.num === "700"
    ? "This law makes certain acts of physical disrespect toward the U.S. flag a federal crime, although Supreme Court rulings sharply limit when it can constitutionally be enforced."
    : `This section sets federal rules concerning ${node.heading.toLowerCase()}.`;
  const explanation = `In plain English, ${summary.charAt(0).toLowerCase()}${summary.slice(1)} The exact scope depends on the definitions and exceptions in the official text and related sections.`;
  for (const [contentType, body] of [["summary", summary], ["explanation", explanation], ["origin", `Congress enacted this section in connection with ${node.pl} on ${node.date}. The source credit may also list later amendments.`], ["facts", `- The current text contains ${node.body.split(/\s+/).length} words.\n- Its source credit lists ${node.pl}.\n- It appears in Title ${title} of the U.S. Code.`]] as const) {
    await db.execute(sql`
      INSERT INTO ai_contents(node_id, content_type, body_md, model, prompt_version, status)
      SELECT ${nodeId}, ${contentType}::ai_content_type, ${body}, 'local-deterministic', 'seed.v1', 'published'
      WHERE NOT EXISTS (SELECT 1 FROM ai_contents WHERE node_id = ${nodeId} AND content_type = ${contentType}::ai_content_type AND status = 'published')
    `);
  }
}

console.log(`Seeded ${nodes.length} representative law sections`);
await sqlClient.end();
