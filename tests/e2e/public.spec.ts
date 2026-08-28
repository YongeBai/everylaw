import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) { const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text()); }); return errors; }

test("browse and law reading flows", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/r");
  await expect(page.getByRole("link", { name: /r\/title-53-RESERVED/ })).toBeVisible();
  await page.getByRole("link", { name: /title-18-CRIMES-AND-CRIMINAL-PROCEDURE/ }).click();
  await expect(page.getByTestId("title-page-heading")).toHaveText("r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE");
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

test("retired /us and top-level title routes redirect permanently into /r", async ({ page, request }) => {
  const response = await request.get("/us/title-18/700", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toContain("/r/title-18/700");
  await page.goto("/us/title-18/700");
  await expect(page).toHaveURL(/\/r\/title-18\/700$/);
  await page.goto("/us");
  await expect(page).toHaveURL(/\/r$/);
  const legacy = await request.get("/title-18/700", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers()["location"]).toContain("/r/title-18/700");
});

test("citation links resolve valid sections and send missing sections to search", async ({ page }) => {
  await page.goto("/cite/1/1");
  await expect(page).toHaveURL(/\/r\/title-1\/1$/);
  await page.goto("/cite/21/1");
  await expect(page).toHaveURL(/\/r\/title-21\/1(?:%20|\s)to(?:%20|\s)5$/);
  await page.goto("/cite/21/999999999");
  await expect(page).toHaveURL(/\/search\?q=21(?:\+|%20)U\.S\.C\./);
  await expect(page.getByTestId("search-empty")).toBeVisible();
});

test("vote can change without duplicating the voter", async ({ page }) => {
  const errors = trackErrors(page); await page.goto("/r/title-18/700");
  const arrows = page.getByTestId(/^arrows-\d+$/).first();
  const nodeId = Number((await arrows.getAttribute("data-testid"))!.replace("arrows-", ""));
  const score = arrows.locator("b");
  const totals = page.getByTestId(`vote-totals-${nodeId}`);
  const initial = Number((await score.textContent())!.replace(/,/g, ""));
  const initialTotals = (await totals.textContent())!;
  const initialKeep = Number(initialTotals.match(/([\d,]+) keep/)![1].replace(/,/g, ""));
  const initialDissolve = Number(initialTotals.match(/([\d,]+) dissolve/)![1].replace(/,/g, ""));
  await arrows.getByTestId(/^arrow-keep-/).click();
  await expect(arrows.getByTestId(/^arrow-keep-/)).toHaveAttribute("aria-pressed", "true");
  await expect(score).toHaveText((initial + 1).toLocaleString("en-US"));
  await expect(totals).toContainText(`${initialKeep + 1} keep`);
  await expect(totals).toContainText(`${initialDissolve} dissolve`);
  await arrows.getByTestId(/^arrow-dissolve-/).click();
  await expect(arrows.getByTestId(/^arrow-dissolve-/)).toHaveAttribute("aria-pressed", "true");
  await expect(score).toHaveText((initial - 1).toLocaleString("en-US"));
  await expect(totals).toContainText(`${initialKeep} keep`);
  await expect(totals).toContainText(`${initialDissolve + 1} dissolve`);
  await arrows.getByTestId(/^arrow-dissolve-/).click();
  await expect(arrows.getByTestId(/^arrow-dissolve-/)).toHaveAttribute("aria-pressed", "false");
  await expect(score).toHaveText(initial.toLocaleString("en-US"));
  await expect(totals).toContainText(`${initialKeep} keep`);
  await expect(totals).toContainText(`${initialDissolve} dissolve`);
  await expect.poll(() => page.evaluate((id) => !JSON.parse(localStorage.getItem("everylaw:votes") ?? "{}")[id], nodeId)).toBe(true);
  await arrows.getByTestId(/^arrow-dissolve-/).click();
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
  const missing = await page.evaluate(async () => (await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId: 2_147_483_647, direction: null }) })).status);
  expect(missing).toBe(404);
  for (let index = 0; index < 30; index += 1) { const response = await page.evaluate(async ({ nodeId, index }) => { const result = await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: index % 2 ? "keep" : "dissolve" }) }); return result.status; }, { nodeId, index }); expect(response).toBe(200); }
  const limited = await page.evaluate(async (nodeId) => (await fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nodeId, direction: "keep" }) })).status, nodeId); expect(limited).toBe(429);
  await page.waitForLoadState("networkidle");
  await context.close();
});
