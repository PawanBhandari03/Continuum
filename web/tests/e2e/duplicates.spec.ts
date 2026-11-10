import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
  });
});

test("the same GitHub repository cannot be connected twice", async ({ page }) => {
  await page.goto("/handovers/h_1/connect");
  const url = "https://github.com/example-org/demo-repo";
  await page.getByLabel("Repository URL").fill(url);
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: url })).toHaveCount(1);
  await page.getByLabel("Repository URL").fill(url + "/");
  await page.getByRole("button", { name: "Connect repository" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already connected" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: url })).toHaveCount(1);
});

test("the CampusKart sample sources cannot be added twice, and a file name cannot repeat", async ({ page }) => {
  await page.goto("/handovers");
  await page.getByLabel("Leaver (who is leaving)").fill("a");
  await page.getByLabel("Successor (who takes over)").fill("b");
  await page.getByLabel("Handover target date").fill("2026-12-01");
  await page.getByRole("button", { name: /Create and connect sources/ }).click();
  await page.getByRole("button", { name: "Use CampusKart sample sources" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "CampusKart repo" }).first()).toBeVisible();
  const before = await page.getByRole("listitem").count();
  await page.getByRole("button", { name: "Use CampusKart sample sources" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already connected" })).toBeVisible();
  expect(await page.getByRole("listitem").count()).toBe(before);

  const f = { name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("One.\n\nTwo.") };
  await page.getByLabel("Upload Notes and docs").setInputFiles(f);
  await expect(page.getByRole("listitem").filter({ hasText: "notes.md" })).toHaveCount(1);
  await page.getByLabel("Upload Notes and docs").setInputFiles(f);
  await expect(page.getByRole("alert").filter({ hasText: "already connected" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "notes.md" })).toHaveCount(1);
});

test("phone width: the Reconstruct finished row and the step tabs fit without wrapping off-screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
  });
  await page.goto("/handovers/h_1/reconstruct");
  // tabs are one scrollable row (about one row tall), not three wrapped rows
  const navH = await page.getByRole("navigation", { name: "Handover steps" }).evaluate((e) => e.getBoundingClientRect().height);
  expect(navH).toBeLessThan(80);
  await page.getByRole("button", { name: "Start reconstruction" }).click();
  const link = page.getByRole("link", { name: /Open the claim ledger/ });
  await link.waitFor({ timeout: 20_000 });
  const box = await link.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await ctx.close();
});
