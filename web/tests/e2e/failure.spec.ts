import { expect, test } from "@playwright/test";

// With the (simulated) server down, every screen must show a friendly error with Retry, never a blank
// page or raw error, and must recover when the server comes back. Uses the mock failure switch
// (localStorage "continuum-mock-fail") because the mock and real clients share the same UI layer.
const SCREENS: { role: string; path: string; ok: RegExp }[] = [
  { role: "lead", path: "/handovers", ok: /Create a handover/ },
  { role: "lead", path: "/handovers/h_1/connect", ok: /Connected sources/ },
  { role: "lead", path: "/handovers/h_1/ledger", ok: /Handover readiness/ },
  { role: "lead", path: "/handovers/h_1/conflicts", ok: /README says the app deploys on Render/ },
  { role: "leaver", path: "/handovers/h_1/interview", ok: /Question 1 of/ },
  { role: "contributor", path: "/handovers/h_1/start", ok: /Project in five lines/ },
];

for (const s of SCREENS) {
  test(`${s.path} as ${s.role}: friendly error, then recovers on Retry`, async ({ page }) => {
    await page.addInitScript(([role]) => {
      localStorage.setItem("continuum-tour-seen", "1");
      localStorage.setItem("continuum-role", role);
      localStorage.setItem("continuum-mock-fail", "down");
    }, [s.role]);
    await page.goto(s.path);
    const alert = page.getByRole("alert").filter({ hasText: "This didn't load." });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText("couldn't reach the server");
    await expect(page.locator("body")).not.toContainText(/TypeError|stack|undefined/);
    await page.evaluate(() => localStorage.removeItem("continuum-mock-fail"));
    await alert.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText(s.ok).first()).toBeVisible({ timeout: 15_000 });
    await expect(alert).toBeHidden();
  });
}

test("a slow (sleeping) server shows the waking banner, then the screen fills in by itself", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("continuum-tour-seen", "1");
    localStorage.setItem("continuum-role", "lead");
    localStorage.setItem("continuum-mock-fail", "slow");
  });
  await page.goto("/handovers/h_1/ledger");
  await expect(page.getByText(/Waking the server, this can take up to a minute/)).toBeVisible();
  await expect(page.getByText("Handover readiness")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Waking the server/)).toBeHidden();
});
