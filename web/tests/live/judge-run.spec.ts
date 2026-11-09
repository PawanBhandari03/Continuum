import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Automated judge-style walkthrough of the live site in a fresh browser context (no stored sign-in, like
// incognito). Records problems instead of stopping at the first one. This is NOT a real-phone test:
// the "phone" run is Chrome with a 375x812 touch viewport.
const API = (process.env.LIVE_API ?? "https://continuum-api-945j.onrender.com").replace(/\/$/, "");
const OUT = process.env.LIVE_OUT ?? path.join(process.cwd(), "live-run-output");
const LEAKS = ["sk_test_FAKE", "+91-00000-00000", "misses deadlines", "closer supervision", "Prof. Iyer"];

interface Problem {
  run: string;
  step: string;
  detail: string;
  screenshot?: string;
}
const problems: Problem[] = [];
const log: string[] = [];

function runner(page: Page, run: string) {
  mkdirSync(OUT, { recursive: true });
  let n = 0;
  const shot = async (name: string) => {
    const f = `${run}-${String(++n).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    await page.screenshot({ path: path.join(OUT, f), fullPage: false }).catch(() => {});
    return f;
  };
  const step = async (name: string, fn: () => Promise<void>) => {
    const t0 = Date.now();
    try {
      await fn();
      const f = await shot(name);
      log.push(`[${run}] OK   ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${f}`);
    } catch (e) {
      const f = await shot(`FAIL-${name}`);
      const detail = (e as Error).message.split("\n")[0].slice(0, 300);
      problems.push({ run, step: name, detail, screenshot: f });
      log.push(`[${run}] FAIL ${name}: ${detail} ${f}`);
    }
  };
  const note = (step: string, detail: string) => {
    problems.push({ run, step, detail });
    log.push(`[${run}] NOTE ${step}: ${detail}`);
  };
  return { step, note, shot };
}

async function overflowReport(page: Page, run: string, where: string, note: (s: string, d: string) => void) {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const small: string[] = [];
    document.querySelectorAll("button, a, select, input, textarea").forEach((el) => {
      const b = (el as HTMLElement).getBoundingClientRect();
      const vis = b.width > 0 && b.height > 0;
      if (vis && (b.height < 28 || b.width < 28)) small.push(((el as HTMLElement).innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30));
    });
    return { scrollW: de.scrollWidth, clientW: de.clientWidth, small: [...new Set(small)].slice(0, 8) };
  });
  if (r.scrollW > r.clientW + 1) note(`${where}: layout`, `horizontal scroll: page is ${r.scrollW}px wide in a ${r.clientW}px viewport`);
  if (r.small.length) note(`${where}: tap targets`, `controls smaller than 28px: ${r.small.join(" | ")}`);
  void run;
}

async function fullPath(page: Page, run: string, mobile: boolean) {
  const { step, note } = runner(page, run);
  const slow = { timeout: 120_000 };
  const fresh = page.getByRole("button", { name: /^Switch role$/ });

  await step("open site (cold start allowed)", async () => {
    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByRole("heading", { name: /Project handovers that show their work/ }).waitFor(slow);
    const s = (Date.now() - t0) / 1000;
    if (s > 20) note("open site", `first page took ${s.toFixed(0)}s`);
  });
  await step("tour appears for a first-time visitor", async () => {
    await page.getByRole("region", { name: "Guided tour" }).waitFor({ timeout: 10_000 });
  });
  await step("close the tour", async () => {
    await page.getByRole("button", { name: "Close the guided tour" }).click();
  });
  if (mobile) await overflowReport(page, run, "landing", note);

  await step("Enter as Reviewer", async () => {
    await page.getByRole("button", { name: /Enter as Reviewer/ }).click();
    await page.getByRole("heading", { name: "Handovers" }).waitFor(slow);
  });
  await step("open CampusKart (ledger)", async () => {
    await page.getByRole("link", { name: /Open as Reviewer/ }).first().click();
    await page.getByText("Handover readiness").waitFor(slow);
  });
  if (mobile) await overflowReport(page, run, "ledger", note);

  await step("source chip opens the original text", async () => {
    await page.locator("article button[title='Open the original source text']").first().click();
    const d = page.getByRole("dialog", { name: "Evidence viewer" });
    await d.waitFor(slow);
    await d.locator("mark").first().waitFor({ timeout: 20_000 });
    if (mobile) await overflowReport(page, run, "evidence drawer", note);
  });
  await step("Esc closes the drawer", async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Evidence viewer" }).waitFor({ state: "hidden", timeout: 5000 });
  });

  await step("conflict: resolve with a note", async () => {
    await page.getByRole("link", { name: "Conflicts", exact: true }).click();
    await page.getByRole("radio").first().check(slow);
    await page.getByLabel(/Resolution note/).fill("Judge-style test: Vercel/Render confirmed with the team.");
    await page.getByRole("button", { name: /Keep selected side and resolve/ }).click();
    await page.getByText("Resolved", { exact: true }).first().waitFor(slow);
  });

  await step("switch to Leaver", async () => {
    await fresh.click();
    await page.getByRole("button", { name: /Enter as Leaver/ }).click();
    await page.getByRole("heading", { name: "Handovers" }).waitFor(slow);
    await page.getByRole("link", { name: /Open as Leaver/ }).first().click();
    await page.getByRole("heading", { name: "Gap Interview" }).waitFor(slow);
  });
  await step("gap: answer a question", async () => {
    await page.getByLabel("Your answer").first().fill("Judge-style test answer: ask the college IT cell.");
    await page.getByRole("button", { name: "Save answer" }).first().click();
    await page.getByText(/Saved as Exit Q&A evidence/).first().waitFor(slow);
  });

  await step("switch back to Reviewer; approve all", async () => {
    await fresh.click();
    await page.getByRole("button", { name: /Enter as Reviewer/ }).click();
    await page.getByRole("link", { name: /Open as Reviewer/ }).first().click();
    await page.getByText("Handover readiness").waitFor(slow);
    await page.getByRole("button", { name: /Approve all Verified claims/ }).click();
    await page.getByText(/Approved \d+ verified claim/).waitFor(slow);
    await page.getByRole("button", { name: /Approve all remaining/ }).click();
    await page.getByText(/Approved \d+ remaining claim/).waitFor(slow);
  });
  await step("publish", async () => {
    const b = page.getByRole("button", { name: "Approve and publish" });
    await b.waitFor(slow);
    if (await b.isDisabled()) {
      const why = await page.getByRole("list", { name: "Why publishing is blocked" }).innerText().catch(() => "(no reason shown)");
      throw new Error(`Publish stayed disabled: ${why.replace(/\n/g, " ")}`);
    }
    await b.click();
    await page.getByText(/Published v\d+ · locked/).waitFor(slow);
  });

  await step("switch to Successor", async () => {
    await fresh.click();
    await page.getByRole("button", { name: /Enter as Successor/ }).click();
    await page.getByRole("link", { name: /Open as Successor/ }).first().click();
    await page.getByRole("heading", { name: /Start here/ }).waitFor(slow);
    await page.getByText(/hidden by your access level/).waitFor({ timeout: 20_000 });
  });
  await step("Successor sees no lead-only content (visible page text)", async () => {
    const text = await page.locator("body").innerText();
    const hit = LEAKS.filter((l) => text.includes(l));
    if (hit.length) throw new Error(`LEAK on page: ${hit.join(", ")}`);
  });
  await step("Successor: every claim shows a state badge and sources", async () => {
    const cards = await page.locator("article[data-claim-id]").count();
    const withChips = await page.locator("article[data-claim-id]:has(button[title='Open the original source text'])").count();
    if (cards === 0) throw new Error("no claims rendered");
    if (cards !== withChips) throw new Error(`${cards - withChips} of ${cards} claims show no source chip`);
  });
  if (mobile) await overflowReport(page, run, "Start here", note);
  await step("acknowledge a section", async () => {
    await page.getByRole("button", { name: "I have read this" }).first().click();
    await page.getByText("Acknowledged", { exact: true }).first().waitFor(slow);
  });
  await step("flag a section unclear", async () => {
    await page.getByRole("button", { name: "This is unclear" }).nth(1).click();
    await page.getByLabel(/What is unclear/).fill("Judge-style test flag.");
    await page.getByRole("button", { name: /Send to reviewer and leaver/ }).click();
    await page.getByText("Flagged unclear").first().waitFor(slow);
  });

  // API-level permission check as Contributor (not just what the UI draws)
  await step("API as Contributor: no lead-only text in /view and /claims", async () => {
    const h = { "X-Demo-Role": "contributor" };
    const view = await page.request.get(`${API}/handovers/h_1/view`, { headers: h, timeout: 120_000 });
    const claims = await page.request.get(`${API}/handovers/h_1/claims`, { headers: h, timeout: 120_000 });
    const body = (await view.text()) + (await claims.text());
    const hit = LEAKS.filter((l) => body.includes(l));
    if (hit.length) throw new Error(`API LEAK: ${hit.join(", ")}`);
    const lead = await page.request.get(`${API}/handovers/h_1/claims`, { headers: { "X-Demo-Role": "lead" }, timeout: 120_000 });
    const leadClaims = (await lead.json()) as { id: string; label: string }[];
    const leadOnly = leadClaims.filter((c) => c.label === "lead_only");
    for (const c of leadOnly) {
      const r = await page.request.get(`${API}/claims/${c.id}/evidence`, { headers: h, timeout: 120_000 });
      if (r.status() !== 403) throw new Error(`lead-only claim ${c.id} evidence returned HTTP ${r.status()} to a Contributor (expected 403)`);
    }
    log.push(`[${run}] info lead-only claims checked via API: ${leadOnly.length}`);
  });
}

async function reset(page: Page) {
  const r = await page.request.post(`${API}/handovers/h_1/reset`, { headers: { "X-Demo-Role": "lead", "Content-Type": "application/json" }, data: {}, timeout: 120_000 });
  log.push(`[reset] demo reset: HTTP ${r.status()}`);
}

test("live site: desktop then phone-width judge run", async ({ browser }) => {
  // desktop
  const d = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await d.newPage();
  await fullPath(dp, "desktop", false);
  await reset(dp);
  await d.close();

  // phone-width (Chrome emulation, touch)
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  await fullPath(mp, "phone", true);
  await reset(mp);
  await m.close();

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ problems, log }, null, 2));
  console.log("\n===== LIVE RUN LOG =====\n" + log.join("\n"));
  console.log(`\n===== PROBLEMS / NOTES (${problems.length}) =====\n` + problems.map((p) => `[${p.run}] ${p.step}: ${p.detail}${p.screenshot ? ` (${p.screenshot})` : ""}`).join("\n"));
});
