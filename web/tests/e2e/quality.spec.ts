import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { asRole, enter, T } from "./helpers";

const LEAD = ["connect", "reconstruct", "ledger", "conflicts", "tasks", "privacy", "interview", "activity", "start"];

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
}

test("axe: no serious or critical violations on every screen, per role", async ({ page }) => {
  test.setTimeout(240_000);
  const hid = await enter(page, "Reviewer");
  const bad: string[] = [];
  const scan = async (label: string) => {
    await settle(page);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    for (const v of r.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) bad.push(`${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`);
  };
  await page.goto("/");
  await scan("landing");
  await page.goto("/tour");
  await scan("tour");
  for (const seg of LEAD) {
    await page.goto(`/handovers/${hid}/${seg}`);
    await scan(`lead/${seg}`);
  }
  await asRole(page, "Leaver");
  await page.goto(`/handovers/${hid}/interview`);
  await scan("leaver/interview");
  await asRole(page, "Successor");
  await page.goto(`/handovers/${hid}/start`);
  await scan("contributor/start");
  await asRole(page, "Guest");
  await scan("guest/start");
  expect(bad, bad.join("\n")).toEqual([]);
});

test.describe("375 px phone width", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  test("no sideways page scroll and tap targets are usable", async ({ page }) => {
    test.setTimeout(240_000);
    const hid = await enter(page, "Reviewer");
    const offenders: string[] = [];
    const check = async (label: string) => {
      await settle(page);
      const w = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      if (w.s > w.c + 1) offenders.push(`${label}: page is ${w.s}px wide`);
    };
    await check("landing-after-enter");
    for (const seg of ["ledger", "conflicts", "tasks", "privacy", "activity", "start"]) {
      await page.goto(`/handovers/${hid}/${seg}`);
      await check(seg);
    }
    await page.goto("/tour");
    await check("tour");
    // header and nav controls should be at least 32 px tall (WCAG 2.2 minimum is 24 px)
    await page.goto(`/handovers/${hid}/ledger`);
    await settle(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("header a, header button, nav[aria-label='Handover steps'] a")]
        .map((e) => ({ t: (e.textContent ?? "").trim().slice(0, 20), h: e.getBoundingClientRect().height }))
        .filter((x) => x.h > 0 && x.h < 24),
    );
    expect(small, JSON.stringify(small)).toEqual([]);
    expect(offenders, offenders.join("\n")).toEqual([]);
    void T;
  });
});
