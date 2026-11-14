// Round 3 judge path in a real browser, as a judge would click it (no API shortcuts except reading the page).
// Usage: node tests/judge-path.mjs [webUrl] [shotsDir]
// Needs the web app running against an API (local: `python api/dev.py`, then `npm run dev`).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? null;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && problems.push("console: " + m.text().slice(0, 160)));
let n = 0;
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: false });
const T = 90000;
const hidOf = () => page.url().match(/handovers\/([^/]+)/)?.[1];

async function asRole(label) {
  // switch role from the header and come back to the same copy
  const hid = hidOf();
  await page.getByRole("button", { name: "Switch role" }).click();
  await page.getByRole("button", { name: new RegExp(`Enter as ${label}`) }).click();
  await page.waitForURL(new RegExp(`/handovers/${hid}/`), { timeout: T });
}

try {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("continuum-tour-seen", "1"));
  await page.reload();
  await page.getByRole("button", { name: /Enter as Reviewer/ }).click();
  await page.waitForURL(/\/handovers\/h_demo_[^/]+\/ledger/, { timeout: T });
  const hid = hidOf();
  check("Reviewer gets an own demo copy", /^h_demo_/.test(hid ?? ""), hid);
  await page.getByRole("heading", { name: "Claim ledger" }).waitFor({ timeout: T });
  await page.getByText(/Successor reads v1/).waitFor({ timeout: T });
  check("ledger shows published v1 with its fingerprint", true);
  await shot("ledger");

  // 1. conflict
  await page.goto(`${BASE}/handovers/${hid}/conflicts`);
  await page.getByText(/Out of date/).first().waitFor({ timeout: T });
  await shot("conflict");
  await page.getByLabel(/Keep side B/).first().check();
  await page.getByLabel(/Reason/).fill("Confirmed with Dev on a call: the Vercel commits are the live setup.");
  await page.getByRole("button", { name: /Keep this side and settle/ }).click();
  await page.getByText(/Settled: one side kept/).first().waitFor({ timeout: T });
  check("conflict settled with a reason", true);
  await page.getByRole("button", { name: /History/ }).first().click();
  await page.getByText(/Kept one side/).first().waitFor({ timeout: T });
  check("decision appears in the history", true);
  await shot("conflict-settled");

  // 2. privacy
  await page.goto(`${BASE}/handovers/${hid}/privacy`);
  await page.getByText(/Judgement about a person/).first().waitFor({ timeout: T });
  await page.getByRole("button", { name: /^Everything/ }).click(); // masked items are decided automatically
  await page.getByText(/Aadhaar number/).first().waitFor({ timeout: T });
  const body = (await page.locator("main").innerText()).toLowerCase();
  await page.getByRole("button", { name: /^Needs a decision/ }).click();
  check("privacy page shows India detectors, no raw values", /aadhaar/.test(body) && /pan number/.test(body) && /upi id/.test(body) && !/abcpe1234f|okaxis|9999 0000 1231/.test(body));
  await shot("privacy");
  const card = page.getByText("Judgement about a person", { exact: true }).first().locator("xpath=ancestor::section[1]");
  await card.getByLabel("Reason").fill("Personal remark about a teammate; lead only.");
  await card.getByRole("button", { name: /Make this passage lead-only/ }).click();
  await page.getByText(/Nothing waiting for a decision|Waiting for your decision/).first().waitFor({ timeout: T });
  check("people remark escalated to lead-only", true);

  // 3. successor question already answered by the leaver -> attach to a claim
  await page.goto(`${BASE}/handovers/${hid}/tasks`);
  await page.getByText(/Answered: needs your decision/).first().waitFor({ timeout: T });
  await page.getByRole("button", { name: /New claim from the answer/ }).first().click();
  await page.getByRole("button", { name: /Save decision/ }).click();
  await page.getByText(/^Resolved/).first().waitFor({ timeout: T });
  check("leaver's answer turned into a new claim", true);
  await shot("question-resolved");

  // 4. publish v2
  await page.goto(`${BASE}/handovers/${hid}/ledger`);
  const remaining = page.getByRole("button", { name: /Approve all remaining/ });
  await remaining.waitFor({ timeout: T });
  if (await remaining.isEnabled()) {
    await remaining.click();
    await page.getByText(/Approved \d+ remaining/).waitFor({ timeout: T });
  }
  const pub = page.getByRole("button", { name: /Publish v2/ });
  await pub.waitFor({ timeout: T });
  for (let i = 0; i < 30 && !(await pub.isEnabled()); i++) await page.waitForTimeout(500);
  await pub.click();
  await page.getByText(/Published v2/).first().waitFor({ timeout: T });
  check("published v2 (frozen, fingerprinted)", true);
  await shot("published-v2");

  // 5. successor: what changed + re-acknowledge
  await asRole("Successor");
  await page.goto(`${BASE}/handovers/${hid}/start`);
  await page.getByText(/What changed since/).waitFor({ timeout: T });
  const startTxt = await page.locator("main").innerText();
  check("successor sees what changed v1 -> v2", /v1 → v2/.test(startTxt) && /Changed in v2/.test(startTxt));
  check("no lead-only text for the successor", !/misses deadlines|supervision|unreliable|sk_test_fake/i.test(startTxt));
  await shot("successor-what-changed");
  await page.getByRole("button", { name: /I have read this/ }).first().click();
  await page.getByText(/Acknowledged/).first().waitFor({ timeout: T });
  check("section acknowledged", true);
  await page.getByRole("button", { name: /This is unclear/ }).first().click();
  await page.getByLabel(/What is unclear/).fill("Who can give me access to the Vercel project?");
  await page.getByRole("button", { name: /Send to reviewer and leaver/ }).click();
  await page.getByText(/Waiting for an answer/).first().waitFor({ timeout: T });
  check("flag creates a question shown inline", true);

  // 6. leaver answers
  await asRole("Leaver");
  await page.goto(`${BASE}/handovers/${hid}/interview`);
  await page.getByRole("tab", { name: /From your successor/ }).click();
  await page.getByLabel("Your answer").first().fill("Dev owns the Vercel team; ask him to invite you.");
  await page.getByRole("button", { name: "Save answer" }).first().click();
  await page.getByText(/Answered by/).first().waitFor({ timeout: T });
  check("leaver answers the successor", true);
  await shot("leaver-answer");

  // 7. audit verify as reviewer
  await asRole("Reviewer");
  await page.goto(`${BASE}/handovers/${hid}/activity`);
  await page.getByRole("button", { name: /Verify integrity/ }).click();
  await page.getByText(/Chain intact/).waitFor({ timeout: T });
  const act = await page.locator("main").innerText();
  check("audit chain verifies and shows views", /Chain intact/.test(act) && /Viewed the handover/.test(act));
  await shot("audit");

  // 8. guest
  await page.getByRole("button", { name: "Switch role" }).click();
  await page.getByRole("button", { name: /enter as Guest/i }).click();
  await page.waitForURL(/\/start/, { timeout: T });
  await page.getByText(/hidden by your access level/).waitFor({ timeout: T });
  check("guest sees public view with hidden count", true);
  await shot("guest");
} catch (e) {
  check("judge path ran to the end", false, String(e).split("\n")[0]);
  await shot("failure");
}
console.log("\nbrowser problems:", problems.length ? problems.slice(0, 10) : "none");
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
