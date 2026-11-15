import { chromium } from "@playwright/test";
const BASE = "https://continuum-web-kodb.onrender.com";
const API = "https://continuum-api-945j.onrender.com";
const OUT = process.argv[2];
const b = await chromium.launch({ channel: "chrome" });
const report = [];
const projects = ["campuskart", "clubsite", "hackbot"];
const hids = {};
for (const pr of projects) {
  const r = await fetch(`${API}/demo/sandbox?project=${pr}`, { method: "POST" });
  hids[pr] = (await r.json()).handover_id;
}
const screens = {
  lead: ["ledger", "connect", "reconstruct", "conflicts", "tasks", "privacy", "interview", "start", "activity", "people"],
  leaver: ["interview", "tasks", "start"],
  contributor: ["start", "tasks"],
  guest: ["start"],
};
const pages = [["/", null], ["/tour", null], ["/handovers", "lead"], ["/signin", null], ["/verify", null]];
for (const pr of projects) for (const [role, list] of Object.entries(screens)) for (const s of list)
  if (pr === "campuskart" || role === "lead" || s === "start") pages.push([`/handovers/${hids[pr]}/${s}`, role, pr]);
for (const [name, w, h] of [["d", 1280, 900], ["m", 375, 812]]) {
  for (const [path, role, pr] of pages) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(([role, hid, pr]) => {
      localStorage.setItem("continuum-tour-seen", "1");
      if (role) localStorage.setItem("continuum-role", role);
      if (hid) { localStorage.setItem("continuum-demo-hid", hid); localStorage.setItem("continuum-demo-project", pr);
        localStorage.setItem("continuum-demo-map", JSON.stringify({ [pr]: hid })); }
    }, [role, pr ? hids[pr] : null, pr]);
    const p = await ctx.newPage();
    const errs = [];
    p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 150)));
    p.on("pageerror", (e) => errs.push("PAGEERR " + e.message.slice(0, 150)));
    p.on("response", (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url().slice(0, 120)}`));
    try {
      await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 });
      await p.waitForTimeout(1500);
    } catch (e) { errs.push("NAV " + e.message.slice(0, 100)); }
    const info = await p.evaluate(() => {
      const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
      const over = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > cw + 1) && getComputedStyle(el).position !== "fixed") {
          let anc = el.parentElement, clipped = false;
          while (anc) { const o = getComputedStyle(anc).overflowX; if (o === "auto" || o === "hidden" || o === "scroll") { clipped = true; break; } anc = anc.parentElement; }
          if (!clipped) over.push(el.tagName + "." + (el.className?.toString?.() || "").slice(0, 60) + " :: " + (el.textContent || "").trim().slice(0, 40));
        }
      }
      const text = document.body.innerText;
      const bad = ["undefined", "NaN", "[object Object]", "null"].filter((x) => new RegExp(`\b${x.replace(/[[\]]/g, "\$&")}\b`).test(text));
      const emptyBtns = [...document.querySelectorAll("button,a")].filter((x) => !x.textContent.trim() && !x.getAttribute("aria-label") && !x.getAttribute("title")).length;
      return { sw, cw, over: over.slice(0, 5), bad, emptyBtns, h1: document.querySelector("h1")?.textContent };
    });
    const tag = `${name}-${(pr || "x")}-${role || "anon"}-${path.split("/").pop() || "home"}`;
    await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    report.push({ tag, errs, ...info });
    await ctx.close();
  }
}
console.log(JSON.stringify(report, null, 1));
await b.close();
