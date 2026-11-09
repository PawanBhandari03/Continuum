import { expect, test } from "@playwright/test";

// A brand-new browser context (empty localStorage) must reach "published, then acknowledged as
// Successor" by following only the on-screen guided-tour hints and visible buttons.
test("fresh visitor completes the whole handover using only on-screen hints", async ({ page }) => {
  await page.goto("/");
  const tour = page.getByRole("region", { name: "Guided tour" });
  await expect(tour).toContainText("Step 1 of 8");

  const go = (name: RegExp) => tour.getByRole("button", { name });
  const next = () => tour.getByRole("button", { name: /^Next/ }).click();

  // 1 pick a role
  await go(/Enter as Reviewer/).click();
  await expect(page.getByText("Viewing as: Reviewer (Lead)")).toBeVisible();
  await next();

  // 2 open the ledger
  await go(/Open the claim ledger/).click();
  await expect(page.getByRole("heading", { name: "Claim ledger" })).toBeVisible();
  await next();

  // 3 source chip -> evidence drawer with highlighted quote
  await page.getByRole("button", { name: /PR #87/ }).first().click();
  const drawer = page.getByRole("dialog", { name: "Evidence viewer" });
  await expect(drawer.locator("mark").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await next();

  // 4 resolve the conflict
  await go(/Open Conflicts/).click();
  await page.getByRole("radio").first().check();
  await page.getByLabel(/Resolution note/).fill("Confirmed with the team: Vercel is the live frontend.");
  await page.getByRole("button", { name: /Keep selected side and resolve/ }).click();
  await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();
  await next();

  // 5 leaver answers a gap question
  await go(/Gap Interview as Leaver/).click();
  await page.getByLabel("Your answer").first().fill("Prof. Iyer's office set it up; ask the college IT cell.");
  await page.getByRole("button", { name: "Save answer" }).first().click();
  await expect(page.getByText(/Saved as Exit Q&A evidence/).first()).toBeVisible();
  await next();

  // 6 approve and publish
  await go(/Back to the ledger as Reviewer/).click();
  await page.getByRole("button", { name: /Approve all Verified claims/ }).click();
  await page.getByRole("button", { name: /Approve all remaining/ }).click();
  const publish = page.getByRole("button", { name: "Approve and publish" });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByText(/Published v\d+ · locked/)).toBeVisible();
  await next();

  // 7 successor sees hidden count
  await go(/Start here as Successor/).click();
  await expect(page.getByText(/hidden by your access level/)).toBeVisible();
  await next();

  // 8 acknowledge
  await page.getByRole("button", { name: "I have read this" }).first().click();
  await expect(page.getByText("Acknowledged").first()).toBeVisible();
});

test("tour is dismissible, remembered, and re-openable from Help", async ({ page }) => {
  await page.goto("/");
  const tour = page.getByRole("region", { name: "Guided tour" });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Close the guided tour" }).click();
  await expect(tour).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Project handovers that show their work/ })).toBeVisible();
  await expect(tour).toBeHidden();
  await page.getByRole("button", { name: /open the guided tour/i }).click();
  await expect(tour).toBeVisible();
});
