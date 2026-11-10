import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    if (!localStorage.getItem("continuum-role")) localStorage.setItem("continuum-role", "lead");
  });
});

test("Review activity: seeded history, new actions appear, filters work", async ({ page }) => {
  await page.goto("/handovers/h_1/activity");
  const log = page.getByRole("list", { name: "Activity log" });
  await expect(log).toContainText("Handover created.");
  await expect(log).toContainText("Redacted");
  const before = await log.getByRole("listitem").count();

  // do real things, then see them recorded (newest first)
  await page.goto("/handovers/h_1/conflicts");
  await page.getByRole("button", { name: /Mark unresolved/ }).click();
  await expect(page.getByText(/Marked unresolved/)).toBeVisible();
  await page.goto("/handovers/h_1/ledger");
  await page.getByRole("button", { name: /Approve all Verified claims/ }).click();
  await page.getByRole("button", { name: /Approve all remaining/ }).click();
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.getByText(/Published v\d+ · locked/)).toBeVisible();

  await page.goto("/handovers/h_1/activity");
  await expect(log.getByRole("listitem").first()).toContainText("Published");
  expect(await log.getByRole("listitem").count()).toBeGreaterThan(before + 5);
  await expect(log).toContainText("Conflict resolved or marked");

  await page.getByLabel("Action").selectOption("publish");
  await expect(log.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByLabel("Person").selectOption("system");
  await expect(log).not.toContainText("Published");
});

test("successor acknowledgement and flag appear in the lead's activity log", async ({ page }) => {
  await page.goto("/handovers/h_1/start");
  await page.evaluate(() => localStorage.setItem("continuum-role", "contributor"));
  await page.goto("/handovers/h_1/start");
  await page.getByRole("button", { name: "I have read this" }).first().click();
  await expect(page.getByText("Acknowledged", { exact: true }).first()).toBeVisible(); // wait for the call to finish
  await page.getByRole("button", { name: "This is unclear" }).nth(1).click();
  await page.getByLabel(/What is unclear/).fill("Not sure who owns the SMTP account.");
  await page.getByRole("button", { name: /Send to reviewer and leaver/ }).click();
  await page.evaluate(() => localStorage.setItem("continuum-role", "lead"));
  await page.goto("/handovers/h_1/activity");
  const log = page.getByRole("list", { name: "Activity log" });
  await expect(log).toContainText("Acknowledged (successor)");
  await expect(log).toContainText("Flagged unclear (successor)");
  await expect(log).toContainText("Not sure who owns the SMTP account.");
});

test("a Contributor cannot open the activity page", async ({ page }) => {
  await page.goto("/handovers/h_1/start");
  await page.evaluate(() => localStorage.setItem("continuum-role", "contributor"));
  await page.goto("/handovers/h_1/activity");
  await expect(page).toHaveURL(/\/handovers\/h_1\/start$/);
  await expect(page.getByRole("list", { name: "Activity log" })).toHaveCount(0);
});

test("tapping 'I have read this' repeatedly logs the acknowledgement once", async ({ page }) => {
  await page.goto("/handovers/h_1/start");
  await page.evaluate(() => localStorage.setItem("continuum-role", "contributor"));
  await page.goto("/handovers/h_1/start");
  const btn = page.getByRole("button", { name: "I have read this" }).first();
  await btn.waitFor();
  for (let i = 0; i < 5; i++) await btn.click({ force: true, noWaitAfter: true }).catch(() => {});
  await expect(page.getByText("Acknowledged", { exact: true }).first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem("continuum-role", "lead"));
  await page.goto("/handovers/h_1/activity");
  const log = page.getByRole("list", { name: "Activity log" });
  await expect(log.getByRole("listitem").filter({ hasText: "Acknowledged (successor)" })).toHaveCount(1);
});
