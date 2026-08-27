import { expect, test } from "@playwright/test";

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
