import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// READ-ONLY checks of the deployed site with the real demo data (no approvals, no uploads, no resets).
// Run: npx playwright test -c playwright.live.config.ts tests/live/deployed-check.spec.ts
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
const READY: Record<string, RegExp> = {
  "/": /Project handovers that show their work/,
  "/handovers": /Create a handover/,
  "/handovers/h_1/connect": /Connected sources/,
  "/handovers/h_1/ledger": /Handover readiness/,
  "/handovers/h_1/conflicts": /Sources disagree/,
  "/handovers/h_1/activity": /Review activity/,
  "/handovers/h_1/interview": /Gap Interview/,
  "/handovers/h_1/start": /Project in five lines/,
};

async function open(page: Page, role: string, path: string) {
  await page.addInitScript(([r]) => {
    localStorage.setItem("continuum-tour-seen", "1");
    if (r) localStorage.setItem("continuum-role", r);
    else localStorage.removeItem("continuum-role");
  }, [role]);
  await page.goto(path, { timeout: 120_000 });
  await page.getByText(READY[path]).filter({ visible: true }).first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
}

for (const s of SCREENS) {
  test(`live axe: ${s.path} (${s.role || "visitor"})`, async ({ page }) => {
    test.setTimeout(240_000);
    await open(page, s.role, s.path);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const v = r.violations.map((x) => `${x.id} (${x.impact}) x${x.nodes.length}: ${x.help} :: ${x.nodes[0]?.target?.join(" ") ?? ""}`);
    console.log(`[axe] ${s.path}: ${v.length ? v.join(" | ") : "0 violations"}`);
    expect(v).toEqual([]);
  });
}

test("live phone width: no horizontal scroll, tap targets >= 36px on ledger and Start here", async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const out: string[] = [];
  for (const s of SCREENS) {
    await open(page, s.role, s.path);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const small: string[] = [];
      document.querySelectorAll("button, a, select, input:not([type=file])").forEach((el) => {
        // a radio/checkbox wrapped in a <label> is tapped through the whole label, so measure the label
        const target = (el as HTMLInputElement).type === "radio" || (el as HTMLInputElement).type === "checkbox" ? (el.closest("label") ?? el) : el;
        const b = (target as HTMLElement).getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && b.height < 36) small.push(((el as HTMLElement).innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30) + ` ${Math.round(b.height)}px`);
      });
      return { w: de.scrollWidth, cw: de.clientWidth, small: [...new Set(small)].slice(0, 6) };
    });
    if (r.w > r.cw + 1) out.push(`${s.path}: horizontal scroll ${r.w}px`);
    if (r.small.length) out.push(`${s.path}: small targets ${r.small.join(", ")}`);
  }
  await ctx.close();
  console.log(`[phone] ${out.length ? out.join(" | ") : "all screens OK"}`);
  expect(out).toEqual([]);
});

test("live dialogs: evidence drawer keeps focus inside and returns it on Esc", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "lead", "/handovers/h_1/ledger");
  const chip = page.locator("article button[title='Open the original source text']").first();
  await chip.focus();
  await chip.press("Enter");
  await expect(page.getByRole("dialog", { name: "Evidence viewer" })).toBeVisible({ timeout: 60_000 });
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Evidence viewer" })).toBeHidden();
  await expect(chip).toBeFocused();
});

test("live export: Contributor Markdown export time and content", async ({ page }) => {
  test.setTimeout(600_000);
  await open(page, "contributor", "/handovers/h_1/start");
  const t0 = Date.now();
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 540_000 }), page.getByRole("button", { name: "Export as Markdown" }).click()]);
  const secs = (Date.now() - t0) / 1000;
  const fs = await import("node:fs");
  const md = fs.readFileSync(await dl.path(), "utf-8");
  const claims = (md.match(/^- \*\*\[/gm) ?? []).length;
  console.log(`[export] ${secs.toFixed(1)}s for ${claims} claims; file ${dl.suggestedFilename()}`);
  for (const f of ["sk_test_FAKE", "+91-00000-00000", "misses deadlines", "closer supervision"]) expect(md).not.toContain(f);
  expect(md).toContain("Generated by Continuum; every claim cites its source.");
});
