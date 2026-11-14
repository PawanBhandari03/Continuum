import { expect, test } from "@playwright/test";
import { asRole, enter, T } from "./helpers";

// The Round 3 judge journey against the local in-memory API: conflict -> privacy -> question -> publish v2
// -> successor sees what changed -> flag -> leaver answers -> audit verifies -> guest.
test("judge journey, one demo copy, every role", async ({ page }) => {
  test.setTimeout(240_000);
  const hid = await enter(page, "Reviewer");
  await expect(page.getByRole("heading", { name: "Claim ledger" })).toBeVisible({ timeout: T });

  // conflict: keep a side with a reason, see it in the history
  await page.goto(`/handovers/${hid}/conflicts`);
  await page.getByText(/Out of date/).first().waitFor({ timeout: T });
  await page.getByLabel(/Keep side B/).first().check();
  await page.getByLabel(/Reason/).fill("Confirmed with Dev on a call: the Vercel commits are the live setup.");
  await page.getByRole("button", { name: /Keep this side and settle/ }).click();
  await expect(page.getByText(/Settled: one side kept/).first()).toBeVisible({ timeout: T });
  await page.getByRole("button", { name: /History/ }).first().click();
  await expect(page.getByText(/Kept one side/).first()).toBeVisible({ timeout: T });

  // privacy: no raw values, escalate the people remark
  await page.goto(`/handovers/${hid}/privacy`);
  await page.getByText(/Judgement about a person/).first().waitFor({ timeout: T });
  await page.getByRole("button", { name: /^Everything/ }).click();
  await page.getByText(/Aadhaar number/).first().waitFor({ timeout: T });
  const body = (await page.locator("main").innerText()).toLowerCase();
  expect(body).not.toMatch(/abcpe1234f|okaxis|9999 0000 1231/);
  await page.getByRole("button", { name: /^Needs a decision/ }).click();
  const card = page.getByText("Judgement about a person", { exact: true }).first().locator("xpath=ancestor::section[1]");
  await card.getByLabel("Reason").fill("Personal remark about a teammate; lead only.");
  await card.getByRole("button", { name: /Make this passage lead-only/ }).click();
  await expect(page.getByText(/Nothing waiting for a decision|Waiting for your decision/).first()).toBeVisible({ timeout: T });

  // question from the successor, already answered: new claim from the answer
  await page.goto(`/handovers/${hid}/tasks`);
  await page.getByText(/Answered: needs your decision/).first().waitFor({ timeout: T });
  await page.getByRole("button", { name: /New claim from the answer/ }).first().click();
  await page.getByRole("button", { name: /Save decision/ }).click();
  await expect(page.getByText(/^Resolved/).first()).toBeVisible({ timeout: T });

  // publish v2
  await page.goto(`/handovers/${hid}/ledger`);
  const remaining = page.getByRole("button", { name: /Approve remaining/ });
  await remaining.waitFor({ timeout: T });
  if (await remaining.isEnabled()) {
    await remaining.click();
    await page.getByText(/Approved \d+ remaining/).waitFor({ timeout: T });
  }
  const pub = page.getByRole("button", { name: /Publish v2/ });
  await expect(pub).toBeEnabled({ timeout: T });
  await pub.click();
  await expect(page.getByText(/Published v2/).first()).toBeVisible({ timeout: T });

  // successor: what changed, no lead-only text, acknowledge, flag
  await asRole(page, "Successor");
  await page.goto(`/handovers/${hid}/start`);
  await page.getByText(/What changed since/).waitFor({ timeout: T });
  const txt = await page.locator("main").innerText();
  expect(txt).toMatch(/v1 → v2/);
  expect(txt).not.toMatch(/misses deadlines|supervision|unreliable|sk_test_fake/i);
  await page.getByRole("button", { name: /I have read this/ }).first().click();
  await expect(page.getByText(/Acknowledged/).first()).toBeVisible({ timeout: T });
  await page.getByRole("button", { name: /This is unclear/ }).first().click();
  await page.getByLabel(/What is unclear/).fill("Who can give me access to the Vercel project?");
  await page.getByRole("button", { name: /Send to reviewer and leaver/ }).click();
  await expect(page.getByText(/Waiting for an answer/).first()).toBeVisible({ timeout: T });

  // leaver answers
  await asRole(page, "Leaver");
  await page.goto(`/handovers/${hid}/interview`);
  await page.getByRole("tab", { name: /From your successor/ }).click();
  await page.getByLabel("Your answer").first().fill("Dev owns the Vercel team; ask him to invite you.");
  await page.getByRole("button", { name: "Save answer" }).first().click();
  await expect(page.getByText(/Answered by/).first()).toBeVisible({ timeout: T });

  // reviewer: audit chain, filters, CSV link
  await asRole(page, "Reviewer");
  await page.goto(`/handovers/${hid}/activity`);
  await page.getByRole("button", { name: /Verify integrity/ }).click();
  await expect(page.getByText(/Chain intact/)).toBeVisible({ timeout: T });
  await page.getByRole("button", { name: "Views", exact: true }).click();
  await expect(page.getByRole("list", { name: "Activity log" }).getByText(/Viewed the handover|Opened sources/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /CSV/ })).toBeVisible();

  // guest
  await page.getByRole("button", { name: "Switch role" }).click();
  await page.getByRole("button", { name: /enter as Guest/i }).click();
  await page.waitForURL(/\/start/, { timeout: T });
  await expect(page.getByText(/hidden by your access level/)).toBeVisible({ timeout: T });
});

test("refresh as reviewer keeps access to lead pages (role race regression)", async ({ page }) => {
  const hid = await enter(page, "Reviewer");
  for (const seg of ["privacy", "activity", "conflicts"]) {
    await page.goto(`/handovers/${hid}/${seg}`);
    await page.reload();
    await expect(page.getByText(/is not permitted/)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Handover steps" })).toBeVisible({ timeout: T });
  }
});

test("a contributor cannot open lead pages", async ({ page }) => {
  const hid = await enter(page, "Successor");
  await page.goto(`/handovers/${hid}/privacy`);
  await page.waitForURL(/\/start/, { timeout: T });
});

test("judge's tour page switches role and opens the screen", async ({ page }) => {
  await page.goto("/tour");
  await page.evaluate(() => localStorage.setItem("continuum-tour-seen", "1"));
  await page.getByRole("button", { name: /Open Conflicts/ }).click();
  await page.waitForURL(/\/handovers\/h_demo_[^/]+\/conflicts/, { timeout: T });
  await expect(page.getByRole("heading", { name: /Conflicts/ }).first()).toBeVisible({ timeout: T });
});

test("API down shows a friendly error with Retry, never a stack trace", async ({ page }) => {
  const hid = await enter(page, "Reviewer");
  await page.route(/localhost:8000\/handovers\/.*\/audit/, (r) => r.abort());
  await page.goto(`/handovers/${hid}/activity`);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/TypeError|at .*\.js/)).toHaveCount(0);
});
