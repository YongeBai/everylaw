import { test, expect } from "@playwright/test";

test("deals a card, records a guess, reveals the truth, and advances", async ({ page }) => {
  await page.goto("/cantmakeitup");
  await expect(page.getByTestId("rf-card")).toBeVisible();
  const heading = await page.getByTestId("rf-card").locator("h2").innerText();
  expect(heading.length).toBeGreaterThan(5);

  await page.getByTestId("rf-real").click();
  await expect(page.getByTestId("rf-reveal")).toBeVisible();
  await expect(page.getByText(/real federal law|We made it up/)).toBeVisible();
  await expect(page.getByTestId("rf-score")).toContainText("/1 this session");

  await page.getByTestId("rf-next").click();
  await expect(page.getByTestId("rf-card")).toBeVisible();
  await expect(page.getByTestId("rf-reveal")).not.toBeVisible();
});

test("a real card links back to the statute; streak resets on a miss", async ({ page }) => {
  await page.goto("/cantmakeitup");
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId("rf-card")).toBeVisible();
    await page.getByTestId("rf-fake").click(); // always guessing fake: real cards are misses
    await expect(page.getByTestId("rf-reveal")).toBeVisible();
    const wrong = await page.getByTestId("rf-wrong").isVisible().catch(() => false);
    if (wrong) {
      await expect(page.getByTestId("rf-streak")).toContainText("Streak: 0");
      await expect(page.getByRole("link", { name: /Read it/ })).toHaveAttribute("href", /\/r\/title-/);
      return;
    }
    await page.getByTestId("rf-next").click();
  }
  throw new Error("never drew a real card in 12 deals — check the 50/50 dealer");
});
