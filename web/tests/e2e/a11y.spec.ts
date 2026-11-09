import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Automated accessibility checks (axe-core, WCAG 2.0/2.1 A and AA rules) on every screen, light theme, mock mode.
// Automated checks find only part of the problems; they do not replace a manual or screen-reader audit.
const SCREENS: { role: string; path: string }[] = [
  { role: "", path: "/" },
  { role: "lead", path: "/handovers" },
  { role: "lead", path: "/handovers/h_1/connect" },
  { role: "lead", path: "/handovers/h_1/ledger" },
  { role: "lead", path: "/handovers/h_1/conflicts" },
  { role: "lead", path: "/handovers/h_1/activity" },
  { role: "leaver", path: "/handovers/h_1/interview" },
  { role: "contributor", path: "/handovers/h_1/start" },
];

async function scan(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help} :: ${v.nodes[0]?.target?.join(" ") ?? ""}`);
}

for (const s of SCREENS) {
  test(`axe: ${s.path} as ${s.role || "visitor"} has no violations`, async ({ page }) => {
    await page.addInitScript(([role]) => {
      localStorage.setItem("continuum-tour-seen", "1");
      if (role) localStorage.setItem("continuum-role", role);
    }, [s.role]);
    await page.goto(s.path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    expect(await scan(page)).toEqual([]);
  });
}

test("axe: evidence drawer, version history and edit dialog have no violations", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
  });
  await page.goto("/handovers/h_1/ledger");
  await page.locator("article button[title='Open the original source text']").first().click();
  await expect(page.getByRole("dialog", { name: "Evidence viewer" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Version history/ }).click();
  await expect(page.getByRole("dialog", { name: "Version history" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.keyboard.press("Escape");

  await page.locator('[data-claim-id="cl_s3"]').getByRole("button", { name: /Edit/ }).click();
  await expect(page.getByRole("dialog", { name: "Edit claim" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("modals: Esc closes, Tab stays inside, focus returns to the button that opened it", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
  });
  await page.goto("/handovers/h_1/ledger");

  for (const [opener, name] of [
    [page.getByRole("button", { name: /Version history/ }), "Version history"],
    [page.locator('[data-claim-id="cl_s3"]').getByRole("button", { name: /Edit/ }), "Edit claim"],
    [page.locator("article button[title='Open the original source text']").first(), "Evidence viewer"],
  ] as const) {
    await opener.focus();
    await opener.press("Enter");
    const dialog = page.getByRole("dialog", { name });
    await expect(dialog).toBeVisible();
    // focus is inside the dialog
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    // Tab many times: focus never leaves the dialog
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // focus returned to the opener
    await expect(opener).toBeFocused();
  }
});

test("phone width (375px): no horizontal scroll on any screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("continuum-tour-seen", "1"));
  const bad: string[] = [];
  for (const s of SCREENS) {
    await page.evaluate((role) => (role ? localStorage.setItem("continuum-role", role) : localStorage.removeItem("continuum-role")), s.role).catch(() => {});
    await page.goto(s.path);
    await page.evaluate((role) => (role ? localStorage.setItem("continuum-role", role) : localStorage.removeItem("continuum-role")), s.role);
    await page.goto(s.path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (w[0] > w[1] + 1) bad.push(`${s.path}: ${w[0]}px wide`);
  }
  await ctx.close();
  expect(bad).toEqual([]);
});

test("phone width: controls are at least 36px high (tap targets)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
  });
  await page.goto("/handovers/h_1/ledger");
  await page.waitForLoadState("networkidle");
  const small = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll("button, a, select, input:not([type=file])").forEach((el) => {
      const b = (el as HTMLElement).getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && b.height < 36) out.push((((el as HTMLElement).innerText || el.getAttribute("aria-label") || el.tagName) + "").trim().slice(0, 40) + ` (${Math.round(b.height)}px)`);
    });
    return out;
  });
  await ctx.close();
  expect(small).toEqual([]);
});
