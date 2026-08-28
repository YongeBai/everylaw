import { expect, test } from "@playwright/test";

test("today's trial tries one law and accepts a verdict", async ({ page }) => {
  await page.goto("/docket");
  const trialBox = page.getByTestId("docket-trial");
  await expect(trialBox).toContainText(/\d{4} trial/);
  await expect(trialBox).toContainText("midnight Pacific");
  await expect(trialBox).toContainText("jurors so far");
  await page.getByTestId("trial-show-more").click();
  await expect(trialBox).toContainText("the actual law");
  const keep = trialBox.getByRole("button", { name: /Keep/ });
  await keep.click();
  await expect(keep).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("comments")).toBeVisible();
});
