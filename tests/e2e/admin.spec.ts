import "dotenv/config";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";

const marker = `E2E review fixture ${randomUUID()}`;
let database: ReturnType<typeof postgres>;

test.beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for admin browser tests");
  database = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const [node] = await database<{ id: number }[]>`
    select n.id from law_nodes n
    where n.node_type = 'section' and not exists (select 1 from ai_contents a where a.node_id = n.id)
    limit 1
  `;
  if (!node) throw new Error("No law node is available for the review fixture");
  for (const contentType of ["summary", "explanation", "origin"] as const) {
    await database`
      insert into ai_contents(node_id, content_type, body_md, model, prompt_version, status)
      values (${node.id}, ${contentType}::ai_content_type, ${`${marker} ${contentType}`}, 'e2e-fixture', ${`e2e.${contentType}`}, 'draft')
    `;
  }
});

test.afterAll(async () => {
  if (!database) return;
  await database`delete from ai_contents where prompt_version like 'e2e.%' or body_md like ${`${marker}%`}`;
  await database.end();
});

test("admin authentication and publish/reject/regenerate actions", async ({ page }) => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is required for admin browser tests");

  await page.goto("/admin/review");
  await page.getByTestId("admin-password").fill("wrong");
  await page.getByTestId("load-drafts").click();
  await expect(page.getByText("Unauthorized")).toBeVisible();

  await page.getByTestId("admin-password").fill(password);
  await page.getByTestId("load-drafts").click();
  const summary = page.getByTestId("review-item").filter({ hasText: `${marker} summary` });
  const explanation = page.getByTestId("review-item").filter({ hasText: `${marker} explanation` });
  const origin = page.getByTestId("review-item").filter({ hasText: `${marker} origin` });
  await expect(summary).toBeVisible();
  await summary.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("publish complete.")).toBeVisible();
  await explanation.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("reject complete.")).toBeVisible();
  await origin.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByText("regenerate complete.")).toBeVisible();
  await page.waitForLoadState("networkidle");
});
