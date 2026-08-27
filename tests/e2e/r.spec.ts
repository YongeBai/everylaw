import { expect, test } from "@playwright/test";

test("the front page of the U.S. Code lives at root with sort tabs", async ({ page }) => {
  await page.goto("/r");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("post-list")).toBeVisible();
  for (const sort of ["hot", "top", "controversial", "dissolved", "kept"]) {
    await expect(page.getByTestId(`sort-${sort}`)).toBeVisible();
  }
  await page.getByTestId("sort-dissolved").click();
  await expect(page).toHaveURL(/sort=dissolved/);
  await expect(page.getByTestId("post-list")).toBeVisible();
});

test("subreddits scope a title with sidebar info and related laws on posts", async ({ page }) => {
  await page.goto("/r/title-18");
  // Bare title slugs redirect to the named canonical subreddit.
  await expect(page).toHaveURL(/\/r\/title-18-CRIMES-AND-CRIMINAL-PROCEDURE$/);
  await expect(page.getByTestId("subreddit-title")).toContainText("r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE");
  await expect(page.getByTestId("subreddit-title")).toContainText(/crimes and criminal procedure/i);
  await expect(page.getByText("moderator")).toBeVisible();
  await page.goto("/r/title-18/1111");
  await expect(page.getByTestId("related-laws")).toBeVisible();
  await expect(page.getByTestId("related-laws").getByRole("link").first()).toBeVisible();
});

test("a law post carries official text with term definitions, translation, and history", async ({ page }) => {
  await page.goto("/r/title-18/1111");
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", /\/us\/title-18\/1111$/);
  await expect(page.getByTestId("post-official")).toContainText("uscode.house.gov");
  await expect(page.getByTestId("post-official")).toContainText("malice aforethought");
  await page.getByTestId("official-text").locator("mark.law-term").first().click();
  await expect(page.getByTestId("term-definition")).toBeVisible();
  await expect(page.getByTestId("post-translation")).toBeVisible();
  await expect(page.getByTestId("post-history")).toContainText("Enacted");
  await expect(page.getByTestId("post-history")).toContainText("1948");
});

test("voting from arrows records to browser history with dissent framing", async ({ page }) => {
  await page.goto("/r/title-18/700");
  const arrows = page.getByTestId(/^arrows-\d+$/).first();
  await arrows.getByRole("button", { name: /Dissolve/ }).click();
  await expect(arrows.getByRole("button", { name: /Dissolve/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("r-history-link").click();
  await expect(page).toHaveURL(/\/r\/history$/);
  await expect(page.getByTestId("history-list")).toContainText("18 U.S.C. § 700");
  await expect(page.getByTestId("history-share")).toContainText("laws judged");
});

test("comments carry the commenter's post vote and follow vote changes", async ({ page }) => {
  await page.goto("/r/title-21/347");
  const stamp = Date.now();
  const arrows = page.getByTestId(/^arrows-\d+$/).first();
  await arrows.getByRole("button", { name: /Keep/ }).click();
  await expect(arrows.getByRole("button", { name: /Keep/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("comment-body").fill(`Pat-shape rules are settled lobby residue ${stamp}`);
  await page.getByTestId("comment-save").click();
  const comment = page.getByTestId(/^comment-\d+$/).filter({ hasText: String(stamp) }).first();
  await expect(comment).toBeVisible();
  const id = (await comment.getAttribute("data-testid"))!.replace("comment-", "");
  await expect(page.getByTestId(`cvote-${id}`)).toContainText("upvoted");

  // Changing the post vote flips the badge on the viewer's own comments.
  await arrows.getByRole("button", { name: /Dissolve/ }).click();
  await expect(page.getByTestId(`cvote-${id}`)).toContainText("downvoted");

  await page.getByTestId(`cup-${id}`).click();
  await expect(page.getByTestId(`cscore-${id}`)).toContainText("1 point");
  await page.getByTestId(`cdown-${id}`).click();
  await expect(page.getByTestId(`cscore-${id}`)).toContainText("-1 point");

  await page.getByTestId(`creply-${id}`).click();
  await page.getByTestId(`reply-body-${id}`).fill(`Disclosure still catches substitution ${stamp}`);
  await page.getByTestId(`reply-save-${id}`).click();
  const reply = page.getByTestId(/^comment-\d+$/).filter({ hasText: `Disclosure still catches substitution ${stamp}` }).first();
  await expect(reply).toBeVisible();
  await expect(reply.locator('[data-testid^="cvote-"]').first()).toContainText("downvoted");

  // The badge survives a reload because it derives from the stored vote.
  await page.reload();
  await expect(page.getByTestId(`cvote-${id}`)).toContainText("downvoted");
});

test("plain english leads the post and the actual law follows", async ({ page }) => {
  await page.goto("/r/title-18/1111");
  const order = await page.evaluate(() => {
    const translation = document.querySelector('[data-testid="post-translation"]');
    const official = document.querySelector('[data-testid="post-official"]');
    return translation && official ? translation.compareDocumentPosition(official) & Node.DOCUMENT_POSITION_FOLLOWING : 0;
  });
  expect(order).toBeTruthy();
  await expect(page.getByTestId("post-official")).toContainText("the actual law");
});

test("random feed deals laws endlessly and takes votes and cases", async ({ page }) => {
  await page.goto("/r/random");
  await expect(page.locator('[data-testid^="random-card-"]').first()).toBeVisible();
  const initial = await page.locator('[data-testid^="random-card-"]').count();
  expect(initial).toBeGreaterThanOrEqual(3);
  await page.getByTestId("random-more").click();
  await expect(async () => {
    expect(await page.locator('[data-testid^="random-card-"]').count()).toBeGreaterThan(initial);
  }).toPass();

  const card = page.locator('[data-testid^="random-card-"]').first();
  await card.getByRole("button", { name: /Keep/ }).click();
  await expect(card.getByRole("button", { name: /Keep/ })).toHaveAttribute("aria-pressed", "true");

  await card.getByRole("button", { name: "give your take" }).click();
  await card.locator("textarea").fill("Sampled at random and it still reads like it earns its place.");
  await card.getByRole("button", { name: "save" }).click();
  await expect(card.getByText("your case is live on the law's page")).toBeVisible();
});

test("voting anywhere offers the random-law hand-off", async ({ page }) => {
  await page.goto("/us/title-18/700");
  await page.getByTestId("vote-keep").click();
  const next = page.getByTestId("vote-next-random");
  await expect(next).toBeVisible();
  await expect(next).toHaveAttribute("href", "/r/random");
});

test("header search suggests laws and routes into /r", async ({ page }) => {
  await page.goto("/r");
  await page.getByTestId("r-search").fill("margarine");
  await expect(page.getByTestId("r-search-suggestions")).toBeVisible();
  await page.getByTestId("r-search-suggestions").getByRole("button", { name: /21 U\.S\.C\. § 347/ }).first().click();
  await expect(page).toHaveURL(/\/r\/title-21-FOOD-AND-DRUGS\/347/);
});
