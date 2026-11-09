// Real-mode browser check: the actual web app against the LIVE API (no mocks).
// Usage: start the web app with NEXT_PUBLIC_USE_MOCKS=false NEXT_PUBLIC_API_URL=<api> on port 3100, then
//   node tests/real-e2e.mjs [baseUrl]
// It mutates the demo handover h_1 and resets it at the end (POST /handovers/h_1/reset).
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3100";
const API = process.env.API ?? "https://continuum-api-945j.onrender.com";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text().slice(0, 160)));
page.on("requestfailed", (r) => problems.push("request failed: " + r.url().slice(0, 100)));
page.on("response", (r) => r.status() >= 400 && !r.url().includes("favicon") && problems.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`));

async function asRole(role, path) {
  await page.goto(BASE + "/");
  await page.evaluate(([r]) => { localStorage.setItem("continuum-role", r); localStorage.setItem("continuum-tour-seen", "1"); }, [role]);
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
}

try {
  // 1. Reviewer opens the ledger with real claims
  await asRole("lead", "/handovers/h_1/ledger");
  await page.getByRole("heading", { name: "Claim ledger" }).waitFor({ timeout: 120000 });
  const cards = await page.locator("article, [data-claim], li").count();
  const body1 = await page.locator("body").innerText();
  check("ledger shows real claims from the API", /Verified/.test(body1) && /Inferred/.test(body1) && body1.length > 3000, `chars=${body1.length}`);
  check("readiness score shown", /readiness/i.test(body1));

  // 2. Evidence drawer from a source chip (real evidence text)
  const chip = page.getByRole("button", { name: /PR #87|gh_pr_87|#87/ }).first();
  if (await chip.count()) {
    await chip.click();
    const drawer = page.getByRole("dialog", { name: "Evidence viewer" });
    await drawer.waitFor({ timeout: 30000 });
    const t = await drawer.innerText();
    check("evidence drawer shows original text", /UPI|gateway|KYC/i.test(t), t.slice(0, 80).replace(/\n/g, " "));
    await page.keyboard.press("Escape");
  } else check("evidence drawer shows original text", false, "no PR #87 chip found");

  // 3. Conflicts: mark every open conflict "unresolved, successor to follow up"
  await page.goto(BASE + "/handovers/h_1/conflicts", { waitUntil: "networkidle" });
  const markBtn = page.getByRole("button", { name: /Mark unresolved/ });
  let n = await markBtn.count();
  check("conflicts page lists real conflicts", n > 0, `open=${n}`);
  while ((n = await markBtn.count()) > 0) { await markBtn.first().click(); await page.waitForTimeout(1500); }
  check("all conflicts handled", (await markBtn.count()) === 0);

  // 4. Leaver answers a Gap Interview question
  await asRole("leaver", "/handovers/h_1/interview");
  const ans = page.getByLabel("Your answer").first();
  if (await ans.count()) {
    await ans.fill("Prof. Iyer's office set it up; ask the college IT cell.");
    await page.getByRole("button", { name: "Save answer" }).first().click();
    await page.waitForTimeout(2500);
    check("gap answer saved", /answered|Saved|Thanks|Answered/i.test(await page.locator("body").innerText()));
  } else check("gap answer saved", false, "no open question");

  // 5. Reviewer approves everything, publishes
  await asRole("lead", "/handovers/h_1/ledger");
  await page.getByRole("button", { name: /Approve all Verified claims/ }).click();
  await page.getByText(/Approved \d+ verified/).waitFor({ timeout: 240000 });
  const rest = page.getByRole("button", { name: /Approve all remaining/ });
  if (await rest.isEnabled()) { await rest.click(); await page.getByText(/Approved \d+ remaining/).waitFor({ timeout: 240000 }); }
  const pub = page.getByRole("button", { name: "Approve and publish" });
  await page.waitForTimeout(1500);
  check("publish enabled after review", await pub.isEnabled());
  await pub.click();
  await page.getByText(/Published/).first().waitFor({ timeout: 60000 });
  check("handover published and locked", true);

  // 6. Successor: sees handover, hidden count, no lead-only text, can acknowledge + flag
  await asRole("contributor", "/handovers/h_1/start");
  await page.getByText(/hidden by your access level/i).first().waitFor({ timeout: 60000 });
  const txt = (await page.locator("body").innerText()).toLowerCase();
  check("successor sees hidden-by-access note", true);
  check("successor view has no lead-only text", !["supervision", "sk_test_fake", "+91-00000"].some((k) => txt.includes(k)));
  const ackBtn = page.getByRole("button", { name: /Acknowledge/ }).first();
  await ackBtn.click();
  await page.waitForTimeout(1500);
  check("section acknowledged", /Acknowledged/.test(await page.locator("body").innerText()));
  await page.getByRole("button", { name: /This is unclear/ }).first().click();
  await page.getByRole("button", { name: /Send to reviewer and leaver/ }).click();
  await page.waitForTimeout(1500);
  check("section flagged unclear", /Flagged unclear/.test(await page.locator("body").innerText()));
} catch (e) {
  check("script ran to the end", false, String(e).split("\n")[0]);
}

// leave the demo clean
const reset = await fetch(`${API}/handovers/h_1/reset`, { method: "POST", headers: { "X-Demo-Role": "lead" } });
console.log("demo reset:", reset.status);
console.log("\nbrowser problems:", problems.length ? problems.slice(0, 12) : "none");
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
