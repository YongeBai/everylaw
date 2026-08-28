import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text()); }); return errors; }

test("browse and law reading flows", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/r");
  await expect(page.getByRole("link", { name: /r\/title-53-RESERVED/ })).toBeVisible();
  await page.getByRole("link", { name: /title-18-CRIMES-AND-CRIMINAL-PROCEDURE/ }).click();
  await expect(page.getByTestId("subreddit-title")).toContainText(/crimes and criminal procedure/i);
  await page.getByTestId("subreddit-pages").getByRole("link", { name: "next ›" }).click();
  await expect(page.getByTestId("subreddit-pages")).toContainText(/page 2 of/);
  await page.goto("/r/title-18/700");
  await expect(page.getByRole("heading", { name: /Desecration of the flag/ })).toBeVisible();
  await expect(page.getByText("AI-generated · not legal advice").first()).toBeVisible();
  await expect(page.getByText(/Whoever knowingly mutilates/)).toBeVisible();
  await expect(page.getByTestId("post-history")).toContainText("Enacted");
  await page.goto("/search?q=margarine");
  await expect(page.getByTestId("search-results")).toBeVisible();
  await page.getByRole("link", { name: /Intrastate sales of colored oleomargarine/ }).first().click();
  await expect(page.getByRole("heading", { name: /Intrastate sales of colored oleomargarine/ })).toBeVisible();
  await page.goto("/r/title-5/5757~2"); await expect(page.getByRole("heading", { name: /Extended assignment incentive/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("the retired /us record redirects permanently into /r", async ({ page, request }) => {
  const response = await request.get("/us/title-18/700", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toContain("/r/title-18/700");
  await page.goto("/us/title-18/700");
  await expect(page).toHaveURL(/\/r\/title-18\/700$/);
  await page.goto("/us");
  await expect(page).toHaveURL(/\/r$/);
});

test("vote can change without duplicating the voter", async ({ page }) => {
  const errors = trackErrors(page); await page.goto("/r/title-18/700");
  const arrows = page.getByTestId(/^arrows-\d+$/).first();
  const score = arrows.locator("b");
  const initial = Number((await score.textContent())!.replace(/,/g, ""));
  await arrows.getByTestId(/^arrow-keep-/).click();
  await expect(arrows.getByTestId(/^arrow-keep-/)).toHaveAttribute("aria-pressed", "true");
  await expect(score).toHaveText((initial + 1).toLocaleString("en-US"));
  await arrows.getByTestId(/^arrow-dissolve-/).click();
  await expect(arrows.getByTestId(/^arrow-dissolve-/)).toHaveAttribute("aria-pressed", "true");
  await expect(score).toHaveText((initial - 1).toLocaleString("en-US"));
  await page.reload(); await expect(page.getByTestId(/^arrow-dissolve-/).first()).toHaveAttribute("aria-pressed", "true");
 
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("public metadata endpoints stay healthy", async ({ page, request }) => {
  const errors = trackErrors(page); await page.goto("/r/title-26/5000A");
  for (const path of ["/api/health", "/sitemap.xml", "/robots.txt"]) { const response = await request.get(path); expect(response.ok(), path).toBeTruthy(); }
  const nodeId = (await page.getByTestId(/^arrows-\d+$/).first().getAttribute("data-testid"))!.replace("arrows-", "");
  const og = await request.get(`/api/og/${nodeId}`); expect(og.ok()).toBeTruthy(); expect(og.headers()["content-type"]).toContain("image/png");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("API rejects invalid origin and enforces vote rate limit", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `e2e-${Date.now()}` } }); const page = await context.newPage(); await page.goto("/r/title-18/1111");
  const nodeId = Number((await page.getByTestId(/^arrows-\d+$/).first().getAttribute("data-testid"))!.replace("arrows-", ""));
  const rejected = await context.request.post("/api/vote", { headers: { origin: "https://attacker.invalid" }, data: { nodeId, direction: "keep" } }); expect(rejected.status()).toBe(403);
  for (let index = 0; index < 30; index += 1) { const response = await page.evaluate(async ({ nodeId, index }) => { const result = await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: index % 2 ? "keep" : "dissolve" }) }); return result.status; }, { nodeId, index }); expect(response).toBe(200); }
  const limited = await page.evaluate(async (nodeId) => (await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: "keep" }) })).status, nodeId); expect(limited).toBe(429);
  await page.waitForLoadState("networkidle");
  await context.close();
});
