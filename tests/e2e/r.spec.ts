import { expect, test } from "@playwright/test";

test("the front page of the U.S. Code lives at root with sort tabs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("post-list")).toBeVisible();
  for (const sort of ["hot", "top", "controversial", "dissolved", "kept", "order"]) {
    await expect(page.getByTestId(`sort-${sort}`)).toBeVisible();
  }
  await page.getByTestId("sort-dissolved").click();
  await expect(page).toHaveURL(/sort=dissolved/);
  await expect(page.getByTestId("post-list")).toBeVisible();
});

test("/r lists every U.S. Code title community", async ({ page }) => {
  await page.goto("/r");
  await expect(page.getByTestId("title-list")).toBeVisible();
  await page.getByRole("link", { name: /title-18-CRIMES-AND-CRIMINAL-PROCEDURE/ }).click();
  await expect(page.getByTestId("title-page-heading")).toHaveText("r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE");
});

test("subreddits scope a title with sidebar info and related laws on posts", async ({ page }) => {
  await page.goto("/r/title-18");
  await expect(page).toHaveURL(/\/r\/title-18$/);
  await expect(page.getByTestId("title-page-heading")).toContainText("r/title-18-CRIMES-AND-CRIMINAL-PROCEDURE");
  await expect(page.getByTestId("title-page-heading")).not.toContainText(" — CRIMES AND CRIMINAL PROCEDURE");
  await expect(page.getByText("moderator")).toBeVisible();
  await page.goto("/r/title-18?sort=order");
  await expect(page.getByTestId("post-list").locator("article").first()).toContainText("18 U.S.C. § 1 —");
  await page.goto("/r/title-18/1111");
  await expect(page.getByTestId("related-laws")).toBeVisible();
  await expect(page.getByTestId("related-laws").getByRole("link").first()).toBeVisible();
});

test("post-list keep and dissolve totals follow the vote arrows", async ({ page }) => {
  await page.goto("/r/title-21?sort=order");
  const post = page.getByTestId("post-list").locator("article").first();
  const arrows = post.getByTestId(/^arrows-\d+$/);
  const nodeId = Number((await arrows.getAttribute("data-testid"))!.replace("arrows-", ""));
  const initial = await page.evaluate(async (id) => (await fetch(`/api/vote?nodeId=${id}`)).json(), nodeId);
  let releaseVote!: () => void;
  const voteGate = new Promise<void>((resolve) => { releaseVote = resolve; });
  await page.route("**/api/vote", async (route) => {
    if (route.request().method() === "POST") await voteGate;
    await route.continue();
  });

  await arrows.getByTestId(/^arrow-keep-/).click();
  const totals = post.getByTestId(`vote-totals-${nodeId}`);
  // These change while the network request is deliberately still blocked.
  await expect(arrows.getByTestId(/^arrow-keep-/)).toHaveAttribute("aria-pressed", "true");
  await expect(totals).toContainText(`${initial.keepCount + 1} keep`);
  await expect(totals).toContainText(`${initial.dissolveCount} dissolve`);
  releaseVote();
  await page.unrouteAll({ behavior: "wait" });

  await arrows.getByTestId(/^arrow-dissolve-/).click();
  await expect(arrows.getByTestId(/^arrow-dissolve-/)).toHaveAttribute("aria-pressed", "true");
  await expect(totals).toContainText(`${initial.keepCount} keep`);
  await expect(totals).toContainText(`${initial.dissolveCount + 1} dissolve`);

  await arrows.getByTestId(/^arrow-dissolve-/).click();
  await expect(arrows.getByTestId(/^arrow-dissolve-/)).toHaveAttribute("aria-pressed", "false");
  if (initial.keepCount + initial.dissolveCount === 0) {
    await expect(totals).toHaveCount(0);
  } else {
    await expect(totals).toContainText(`${initial.keepCount} keep`);
    await expect(totals).toContainText(`${initial.dissolveCount} dissolve`);
  }
});

test("title names are displayed but stay out of canonical URLs", async ({ page, request }) => {
  const legacy = await request.get("/r/title-29-LABOR/1002", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers()["location"]).toBe("/r/title-29/1002");

  await page.goto("/r/title-29/1002");
  await expect(page).toHaveURL(/\/r\/title-29\/1002$/);
  await expect(page.getByText("r/title-29-LABOR", { exact: true })).toBeVisible();

  await page.goto("/r/title-29");
  await expect(page.getByTestId("title-page-heading")).toHaveText("r/title-29-LABOR");
});

test("a law post carries official text with term definitions, translation, and history", async ({ page }) => {
  await page.goto("/r/title-18/1111");
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", /\/r\/title-18\/1111$/);
  await expect(page.getByTestId("post-official")).toContainText("uscode.house.gov");
  await expect(page.getByTestId("post-official")).toContainText("malice aforethought");
  await page.getByTestId("official-text").locator("mark.law-term").first().click();
  await expect(page.getByTestId("term-definition")).toBeVisible();
  await expect(page.getByTestId("post-translation")).toBeVisible();
  await expect(page.getByTestId("post-history")).toContainText("Enacted");
  await expect(page.getByTestId("post-history")).toContainText("1948");
});

test("statutory tables retain compact table structure", async ({ page }) => {
  await page.goto("/r/title-26/1");
  const table = page.getByTestId("official-text").locator("table").first();
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveCount(2);
  await expect(table.locator("tbody tr")).toHaveCount(5);
  await expect(table).toHaveCSS("display", "table");
  await expect(table).toHaveCSS("border-collapse", "collapse");
  await expect(table.locator("tbody tr").first().locator("td")).toHaveCount(2);
});

test("a term-of-art definition opens beside the clicked term and stays in view", async ({ page }) => {
  await page.goto("/r/title-18/700");
  const term = page.getByTestId("official-text").locator('mark.law-term[data-term="whoever"]');
  await term.click();

  const definition = page.getByTestId("term-definition");
  await expect(definition).toContainText("Statutory drafting's universal subject");
  await expect(definition.getByRole("link", { name: "1 U.S.C. § 1" }))
    .toHaveAttribute("href", "/cite/1/1");
  await expect.poll(async () => {
    const [termBox, definitionBox] = await Promise.all([term.boundingBox(), definition.boundingBox()]);
    if (!termBox || !definitionBox) return false;
    return Math.abs(definitionBox.y - (termBox.y + termBox.height + 4)) < 2
      && definitionBox.y >= 0
      && definitionBox.y + definitionBox.height <= await page.evaluate(() => window.innerHeight);
  }).toBe(true);
});

test("voting from arrows records to browser history with dissent framing", async ({ page }) => {
  await page.goto("/r/title-18/700");
  const arrows = page.getByTestId(/^arrows-\d+$/).first();
  await arrows.getByRole("button", { name: /Dissolve/ }).click();
  await expect(arrows.getByRole("button", { name: /Dissolve/ })).toHaveAttribute("aria-pressed", "true");
  await arrows.getByRole("button", { name: /Remove Dissolve vote/ }).click();
  await expect(arrows.getByRole("button", { name: /Dissolve/ })).toHaveAttribute("aria-pressed", "false");
  await arrows.getByRole("button", { name: /Dissolve/ }).click();
  await page.getByTestId("history-link").click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId("history-list")).toContainText("18 U.S.C. § 700");
  await expect(page.getByTestId("history-share")).toContainText(/section(s)? judged/);
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
  await arrows.getByRole("button", { name: /Remove Dissolve vote/ }).click();
  await expect(page.getByTestId(`cvote-${id}`)).toHaveCount(0);
  await arrows.getByRole("button", { name: /Dissolve/ }).click();
  await expect(page.getByTestId(`cvote-${id}`)).toContainText("downvoted");

  let releaseTakeVote!: () => void;
  const takeVoteGate = new Promise<void>((resolve) => { releaseTakeVote = resolve; });
  await page.route("**/api/take-vote", async (route) => {
    if (route.request().method() === "POST") await takeVoteGate;
    await route.continue();
  });
  await page.getByTestId(`cup-${id}`).click();
  // Comment score and selection also update before the API responds.
  await expect(page.getByTestId(`cscore-${id}`)).toContainText("1 point");
  await expect(page.getByTestId(`cup-${id}`)).toHaveAttribute("aria-pressed", "true");
  releaseTakeVote();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByTestId(`cup-${id}`).click();
  await expect(page.getByTestId(`cscore-${id}`)).toContainText("0 points");
  await expect(page.getByTestId(`cup-${id}`)).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId(`cdown-${id}`).click();
  await expect(page.getByTestId(`cscore-${id}`)).toContainText("-1 point");
  await expect(page.getByTestId(`cdown-${id}`)).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId(`cdown-${id}`).click();
  await expect(page.getByTestId(`cscore-${id}`)).toContainText("0 points");
  await expect(page.getByTestId(`cdown-${id}`)).toHaveAttribute("aria-pressed", "false");

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
  await page.goto("/random");
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
  await expect(card.getByText("your argument is live on the section's page")).toBeVisible();
});

test("header search suggests laws and routes into canonical title pages", async ({ page }) => {
  await page.goto("/r");
  await page.getByTestId("r-search").fill("margarine");
  await expect(page.getByTestId("r-search-suggestions")).toBeVisible();
  await page.getByTestId("r-search-suggestions").getByRole("button", { name: /21 U\.S\.C\. § 347/ }).first().click();
  await expect(page).toHaveURL(/\/r\/title-21\/347/);
});
