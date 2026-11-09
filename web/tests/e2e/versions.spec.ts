import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    if (!localStorage.getItem("continuum-role")) localStorage.setItem("continuum-role", "lead");
  });
});

test("compare versions: seeded v1→v3 shows the reviewer's edit as a word-level before/after", async ({ page }) => {
  await page.goto("/handovers/h_1/ledger");
  await page.getByRole("button", { name: /Version history/ }).click();
  const drawer = page.getByRole("dialog", { name: "Version history" });
  await page.getByLabel("From version").selectOption("1");
  await page.getByLabel("To version").selectOption("3");
  await drawer.getByRole("button", { name: "Show changes" }).click();
  await expect(drawer.getByTestId("diff-summary")).toHaveText("v1 → v3: 0 added · 0 removed · 3 changed");
  await expect(drawer.getByText("Edited text")).toBeVisible();
  await expect(drawer.getByLabel("Text change").locator("del").first()).toBeVisible(); // removed words struck through
  await expect(drawer.getByLabel("Text change").locator("ins").first()).toBeVisible(); // added words underlined
  await expect(drawer.getByText(/Review status:/).first()).toBeVisible();
});

test("a new edit and a rejection show up when comparing against the earlier version", async ({ page }) => {
  await page.goto("/handovers/h_1/ledger");
  const card = page.locator('[data-claim-id="cl_s3"]');
  await card.getByRole("button", { name: /Edit/ }).click();
  await page.getByLabel("Claim statement").fill("The seller dashboard (PR #94) is open, not merged, and overdue.");
  await page.getByRole("button", { name: "Save edit" }).click();
  await expect(card).toContainText("overdue");
  await page.locator('[data-claim-id="cl_f2"]').getByRole("button", { name: /Reject/ }).click();
  await expect(page.locator('[data-claim-id="cl_f2"]')).toContainText("Rejected");

  await page.getByRole("button", { name: /Version history/ }).click();
  const drawer = page.getByRole("dialog", { name: "Version history" });
  const options = await page.getByLabel("To version").locator("option").allTextContents();
  const latest = options[options.length - 1].replace("v", "");
  await page.getByLabel("From version").selectOption("3");
  await page.getByLabel("To version").selectOption(latest);
  await drawer.getByRole("button", { name: "Show changes" }).click();
  await expect(drawer.getByTestId("diff-summary")).toContainText("2 changed");
  await expect(drawer.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(drawer.locator("ins", { hasText: "overdue" })).toBeVisible();
});

test("comparing the same version twice is blocked", async ({ page }) => {
  await page.goto("/handovers/h_1/ledger");
  await page.getByRole("button", { name: /Version history/ }).click();
  await page.getByLabel("From version").selectOption("2");
  await page.getByLabel("To version").selectOption("2");
  await expect(page.getByRole("button", { name: "Show changes" })).toBeDisabled();
});
