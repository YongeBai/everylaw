import { expect, test } from "@playwright/test";

test("starred defined terms open a definition card linking to the title wiki", async ({ page }) => {
  // 18 U.S.C. § 1014 uses "mortgage lending business", defined at § 27 for the whole title.
  await page.goto("/r/title-18/1014");
  const starred = page.locator("[data-def]", { hasText: "mortgage lending business" });
  await expect(starred).toBeVisible();
  await starred.click();
  const card = page.getByTestId("definition-card");
  await expect(card).toContainText("“mortgage lending business”");
  await expect(card).toContainText("18 U.S.C. § 27");
  await expect(card).toContainText(/finances or refinances any debt secured by an interest in real estate/);
  await expect(card).toContainText("applies throughout the title");
  await card.getByRole("link", { name: "all defined terms in this title" }).click();
  await expect(page.getByTestId("wiki-title")).toContainText("defined terms");
});

test("a section never stars a term it defines itself", async ({ page }) => {
  // § 20 defines "financial institution" (and uses "mortgage lending business").
  await page.goto("/r/title-18/20");
  await expect(page.locator("[data-def]", { hasText: "mortgage lending business" })).toBeVisible();
  await expect(page.locator("[data-def]", { hasText: "financial institution" })).toHaveCount(0);
});

test("a section never dots a term it defines itself", async ({ page }) => {
  await page.goto("/r/title-21/343");
  await expect(page.locator('[data-term="misbranded"]')).toHaveCount(0);
});

test("the title wiki is the final title tab, lists definitions, and paginates", async ({ page }) => {
  await page.goto("/r/title-18?view=wiki");
  await expect(page).toHaveURL(/\/r\/title-18\?view=wiki/);
  await expect(page.getByTestId("wiki-title")).toContainText("r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE wiki");
  await expect(page.getByTestId("wiki-tab")).toHaveAttribute("data-active", "true");
  const followsOrder = await page.evaluate(() => {
    const order = document.querySelector('[data-testid="sort-order"]');
    const wiki = document.querySelector('[data-testid="wiki-tab"]');
    return Boolean(order && wiki && (order.compareDocumentPosition(wiki) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(followsOrder).toBe(true);
  const first = page.getByTestId("wiki-section").first();
  await expect(first).toContainText("18 U.S.C. §");
  await expect(page.getByText("“mortgage lending business”", { exact: true })).toBeVisible();
  await page.getByTestId("wiki-pages").getByRole("link", { name: "next ›" }).click();
  await expect(page.getByTestId("wiki-pages")).toContainText(/page 2 of/);
  await expect(page).toHaveURL(/view=wiki.*page=2/);
  // Entries link back to the defining section.
  await page.getByTestId("wiki-section").first().getByRole("link").first().click();
  await expect(page.getByTestId("official-text")).toBeVisible();
});

test("the retired wiki path redirects to the wiki tab", async ({ page, request }) => {
  const response = await request.get("/r/title-18/wiki", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  await page.goto("/r/title-18/wiki");
  await expect(page).toHaveURL(/\/r\/title-18\?view=wiki/);
});
