import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text()); }); return errors; }

test("browse and law reading flows", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/browse/crime-punishment");
  await expect(page.getByRole("heading", { name: "Crime & punishment" })).toBeVisible();
  await page.goto("/us");
  await expect(page.getByRole("link", { name: /Title 53.*Reserved/ })).toBeVisible();
  await page.getByRole("link", { name: /Crimes and Criminal Procedure/i }).click();
  await expect(page.getByRole("heading", { name: "Title 18" })).toBeVisible();
  await page.getByRole("link", { name: "Next 200 →" }).click(); await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.goto("/us/title-18/700");
  await expect(page.getByRole("heading", { name: /Desecration of the flag/ })).toBeVisible();
  await expect(page.getByText("AI-assisted · reviewed · not legal advice").first()).toBeVisible();
  await expect(page.getByText(/Whoever knowingly mutilates/)).toBeVisible();
  await expect(page.getByTestId("law-history")).toContainText("Enacted");
  await expect(page.getByTestId("law-history")).toContainText("Why this law exists");
  await page.goto("/search");
  const input = page.getByTestId("search-input"); await input.fill("margarine");
  await expect(page.getByTestId("search-suggestions")).toBeVisible();
  await page.getByTestId("search-suggestions").getByRole("button", { name: /§ 347 —/ }).click();
  await expect(page.getByRole("heading", { name: /Intrastate sales of colored oleomargarine/ })).toBeVisible();
  await page.goto("/us/title-5/5757~2"); await expect(page.getByRole("heading", { name: "Extended assignment incentive" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("vote can change without duplicating the voter", async ({ page }) => {
  const errors = trackErrors(page); await page.goto("/us/title-18/700");
  const signalText = page.getByTestId("vote-panel").getByText(/^\d[\d,]* public signals$/);
  const initialSignals = Number((await signalText.textContent())?.replace(/[^0-9]/g, "") ?? 0);
  await page.getByTestId("vote-keep").click(); await expect(page.getByTestId("vote-keep")).toHaveClass(/ring-4/);
  await expect(signalText).toHaveText(`${initialSignals + 1} public signals`);
  await page.getByTestId("vote-dissolve").click(); await expect(page.getByTestId("vote-dissolve")).toHaveClass(/ring-4/);
  await expect(signalText).toHaveText(`${initialSignals + 1} public signals`);
  await page.reload(); await expect(page.getByTestId("vote-dissolve")).toHaveClass(/ring-4/);
  await page.goto("/rankings/most-dissolved"); await expect(page.getByText(/Desecration of the flag/).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("structured take creation and idempotent upvote", async ({ page }) => {
  const errors = trackErrors(page); await page.goto("/us/title-21/347");
  const marker = `E2E intrastate case ${Date.now()}`;
  await page.getByRole("button", { name: "Dissolve because…" }).click();
  await page.getByTestId("take-body").fill(`${marker}: the rule reaches purely intrastate sales without a useful modern justification.`);
  await page.getByTestId("submit-take").click(); await expect(page.getByText("Your case is live.")).toBeVisible();
  const take = page.getByTestId("take").filter({ hasText: marker }); await expect(take).toBeVisible();
  const upvote = take.getByRole("button"); await upvote.click(); await expect(upvote).toHaveText("▲ 1"); await upvote.click(); await expect(upvote).toHaveText("▲ 1");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("share/copy and public metadata endpoints", async ({ page, request }) => {
  const errors = trackErrors(page); await page.goto("/us/title-26/5000A");
  await page.getByRole("button", { name: "Copy link" }).click(); await expect(page.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("/us/title-26/5000A");
  for (const path of ["/api/health", "/sitemap.xml", "/robots.txt"]) { const response = await request.get(path); expect(response.ok(), path).toBeTruthy(); }
  const nodeId = await page.getByTestId("vote-panel").getAttribute("data-node-id"); const og = await request.get(`/api/og/${nodeId}`); expect(og.ok()).toBeTruthy(); expect(og.headers()["content-type"]).toContain("image/png");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("API rejects invalid origin and enforces vote rate limit", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `e2e-${Date.now()}` } }); const page = await context.newPage(); await page.goto("/us/title-18/1111");
  const nodeId = Number(await page.getByTestId("vote-panel").getAttribute("data-node-id"));
  const rejected = await context.request.post("/api/vote", { headers: { origin: "https://attacker.invalid" }, data: { nodeId, direction: "keep" } }); expect(rejected.status()).toBe(403);
  for (let index = 0; index < 30; index += 1) { const response = await page.evaluate(async ({ nodeId, index }) => { const result = await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: index % 2 ? "keep" : "dissolve" }) }); return result.status; }, { nodeId, index }); expect(response).toBe(200); }
  const limited = await page.evaluate(async (nodeId) => (await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: "keep" }) })).status, nodeId); expect(limited).toBe(429);
  await page.waitForLoadState("networkidle");
  await context.close();
});
