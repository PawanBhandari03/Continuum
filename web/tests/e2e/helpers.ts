import type { Page } from "@playwright/test";

export const T = 60_000;
export type RoleLabel = "Reviewer" | "Leaver" | "Successor";

/** Opens the landing page as a fresh visitor, skips the pop-up tour, enters as a role and returns the demo id. */
export async function enter(page: Page, role: RoleLabel = "Reviewer"): Promise<string> {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("continuum-tour-seen", "1"));
  await page.reload();
  await page.getByRole("button", { name: new RegExp(`Enter as ${role}`) }).first().click();
  await page.waitForURL(/\/handovers\/h_demo_[^/]+\//, { timeout: T });
  return page.url().match(/handovers\/([^/]+)/)![1];
}

/** Switch role from the header and stay on the same demo copy. */
export async function asRole(page: Page, role: RoleLabel | "Guest") {
  const hid = page.url().match(/handovers\/([^/]+)/)![1];
  await page.getByRole("button", { name: "Switch role" }).click();
  const name = role === "Guest" ? /enter as Guest/i : new RegExp(`Enter as ${role}`);
  await page.getByRole("button", { name }).click();
  await page.waitForURL(new RegExp(`/handovers/${hid}/`), { timeout: T });
}
