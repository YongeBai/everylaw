import { test, expect, type Page } from "@playwright/test";

async function serveFullTerm(page: Page) {
  await page.goto("/rate");
  await expect(page.getByTestId("matchup-card-0")).toBeVisible();
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId("deck-verdict").isVisible().catch(() => false)) return;
    if (await page.getByTestId("deck-reveal").isVisible().catch(() => false)) {
      await page.getByTestId("deck-next").click();
    } else if (await page.getByTestId("matchup-card-0").isVisible().catch(() => false)) {
      await page.getByTestId("matchup-card-0").click();
      await expect(page.getByTestId("deck-reveal").or(page.getByTestId("matchup-card-0"))).toBeVisible();
    }
    await page.waitForTimeout(50);
  }
  await expect(page.getByTestId("deck-verdict")).toBeVisible();
}

test("a judgment advances the term and reveals the jury's split", async ({ page }) => {
  await page.goto("/rate");
  await expect(page.getByTestId("matchup-card-0")).toBeVisible();
  await expect(page.getByTestId("deck-streak")).toContainText("Judgment 1 of 8");
  await page.getByTestId("matchup-card-0").click();
  await expect(page.getByTestId("deck-reveal")).toBeVisible();
  await expect(page.getByTestId("reveal-winner")).toBeVisible();
  await expect(page.getByTestId("reveal-loser")).toBeVisible();
  await page.getByTestId("deck-next").click();
  await expect(page.getByTestId("deck-streak")).toContainText("Judgment 2 of 8");
});

test("blind justice seals identities until the ruling", async ({ page }) => {
  await page.goto("/rate");
  await expect(page.getByTestId("matchup-card-0")).toBeVisible();
  await page.getByTestId("deck-blind-toggle").locator("input").check();
  await expect(page.getByTestId("matchup-card-0")).toContainText("Sealed case A");
  await expect(page.getByTestId("matchup-card-1")).toContainText("Sealed case B");
  await page.getByTestId("matchup-card-1").click();
  await expect(page.getByTestId("deck-reveal")).toBeVisible();
  await expect(page.getByTestId("matchup-card-1")).not.toContainText("Sealed case B");
});

test("passing a case deals another without recording a judgment", async ({ page }) => {
  await page.goto("/rate");
  await expect(page.getByTestId("matchup-card-0")).toBeVisible();
  await page.getByTestId("deck-skip").click();
  await expect(page.getByTestId("matchup-card-0")).toBeVisible();
  await expect(page.getByTestId("deck-streak")).toContainText("Judgment 1 of 8");
});

test("a full term ends in a verdict card and unlocks Your Constitution", async ({ page }) => {
  await serveFullTerm(page);
  await expect(page.getByTestId("deck-verdict")).toContainText("cases judged");
  await expect(page.getByTestId("verdict-share")).toBeVisible();
  await expect(page.getByTestId("verdict-constitution")).toBeVisible();

  await page.goto("/me");
  await expect(page.getByTestId("constitution-archetype")).toBeVisible();
  await expect(page.getByText("career judgments")).toBeVisible();

  await page.goto("/rate");
  await expect(page.getByTestId("deck-streak")).toContainText("Judgment 1 of 8");
});

test("Your Constitution stays sealed before a full term", async ({ page }) => {
  await page.goto("/me");
  await expect(page.getByTestId("constitution-locked")).toBeVisible();
  await expect(page.getByText("of 8 judgments served")).toBeVisible();
});

test("today's trial tries one law and accepts a verdict (active docket design)", async ({ page }) => {
  await page.goto("/docket");
  // "trial" design renders the sticky trial box; "classic" redirects to the
  // day's normal law post with a trial banner. Support the swap in design.ts.
  const trialBox = page.getByTestId("docket-trial");
  if (await trialBox.count()) {
    await expect(trialBox).toContainText(/\d{4} trial/);
    await expect(trialBox).toContainText("midnight PST");
    await expect(trialBox).toContainText("jurors so far");
    await page.getByTestId("trial-show-more").click();
    await expect(trialBox).toContainText("the actual law");
    const keep = trialBox.getByRole("button", { name: /Keep/ });
    await keep.click();
    await expect(keep).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("comments")).toBeVisible();
  } else {
    await expect(page).toHaveURL(/\/r\/title-\d+\/.+\?trial=\d+/);
    await expect(page.getByTestId("trial-banner")).toContainText("today’s trial");
    await expect(page.getByTestId("post-translation")).toBeVisible();
  }
});
