// Permission test (evidence for docs/testing.md): run with `npm run test:permissions`.
// Asserts the Contributor (successor) view and evidence API never expose lead-only content,
// the fake key, the fake phone number, or sensitive/redacted claims.
import { mockApi } from "../lib/mock-api";
import { GENERATED_LINE, buildExportModel, safeQuote, toMarkdown } from "../lib/export";

const store: Record<string, string> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] } };

const FORBIDDEN = ["sk_test_FAKE", "+91-00000-00000", "misses deadlines", "closer supervision", "Prof. Iyer", "mentor", "Mentor"];
let failed = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failed++; };

async function main() {
  await mockApi.resetDemo();
  for (const role of ["contributor", "leaver"] as const) {
    const view = await mockApi.getView("h_1", role);
    const blob = JSON.stringify(view);
    check(`${role} view has no forbidden strings`, FORBIDDEN.every((f) => !blob.includes(f)));
    check(`${role} view reports hidden_count > 0 (count only)`, view.hidden_count > 0);
    const claims = view.sections.flatMap((s) => s.claims);
    check(`${role} view: every claim has >= 1 citation`, claims.every((c) => c.citations.length > 0));
    check(`${role} view: no lead_only or sensitive claims`, claims.every((c) => c.label !== "lead_only" && !c.sensitive));
    let leaked = false;
    for (const c of ["cl_r3", "cl_r4"]) {
      try { const ev = await mockApi.getEvidence(c, role); if (ev.length) leaked = true; } catch { /* expected: not permitted */ }
    }
    check(`${role} cannot fetch evidence of lead-only claims`, !leaked);
  }
  const lead = await mockApi.getView("h_1", "lead");
  check("lead view includes the lead-only mentor claim", JSON.stringify(lead).includes("misses deadlines"));
  check("lead view hides redacted claim content? (redacted claims excluded)", !lead.sections.flatMap((s) => s.claims).some((c) => c.id === "cl_r4"));
  const ev = await mockApi.getEvidence("cl_r3", "lead");
  check("lead evidence marks secret + PII as redactions", ev[0].unit.redactions.length === 2);

  // publish gating
  let r = await mockApi.publish("h_1", "reviewer");
  check("publish blocked while conflict open + claims pending", !r.ok && r.reasons.length >= 1);
  await mockApi.resolveConflict("cf_1", { resolution: "unresolved_followup", note: "" }, "reviewer");
  await mockApi.bulkApproveVerified("h_1", "reviewer");
  for (const c of await mockApi.getClaims("h_1", { review_status: "pending" })) await mockApi.patchClaim(c.id, { action: "approve" }, "reviewer");
  r = await mockApi.publish("h_1", "reviewer");
  check("publish succeeds once conflict is marked and claims reviewed", r.ok);
  const h = await mockApi.getHandover("h_1");
  check("published handover is locked with approver recorded", h.status === "published" && h.approved_by === "reviewer");
  const after = await mockApi.getView("h_1", "contributor");
  check("after publish, contributor still sees no forbidden strings", FORBIDDEN.every((f) => !JSON.stringify(after).includes(f)));
  // ---- export (Markdown / print share this model) ----
  for (const role of ["contributor", "leaver"] as const) {
    const model = await buildExportModel(mockApi, "h_1", role);
    const md = toMarkdown(model);
    check(`${role} Markdown export has no forbidden strings`, FORBIDDEN.every((f) => !md.includes(f)));
    check(`${role} export has no lead-only claims (cl_r3/cl_r4 absent)`, !model.sections.some((s) => s.claims.some((c) => c.id === "cl_r3" || c.id === "cl_r4")));
    check(`${role} export has the generated-by line and a hidden COUNT only`, md.includes(GENERATED_LINE) && /\d+ items? (were|was) withheld/.test(md));
    check(`${role} export: every claim lists >= 1 source`, model.sections.every((s) => s.claims.every((c) => c.citations.length > 0)));
    check(`${role} export shows evidence states`, md.includes("[Verified]") && md.includes("[Inferred]"));
  }
  const cmd = toMarkdown(await buildExportModel(mockApi, "h_1", "contributor"));
  check("export links GitHub PR URLs as Markdown links", /\[PR #87 — [^\]]+\]\(https:\/\/github\.com\/[^)]*\/pull\/87\)/.test(cmd));
  check("export uses 'source name (label) — quote' where no URL exists", /- [^\n[]+ \(#dev · 08-25\) — “/.test(cmd));
  check("published export header names approver, version, status", /Approved by: reviewer/.test(cmd) && /Version: v\d+/.test(cmd) && /Status: Published/.test(cmd));
  const lmd = toMarkdown(await buildExportModel(mockApi, "h_1", "lead"));
  check("lead export includes the lead-only mentor claim", lmd.includes("misses deadlines"));
  check("lead export never contains the fake key or fake phone", !lmd.includes("sk_test_FAKE") && !lmd.includes("+91-00000-00000"));
  const unit = { id: "x", source_id: "s", author: "a", timestamp: "", label: "lead_only" as const, locator: "notes://n", text: "Key sk_test_FAKE_1 here", redactions: [{ start: 4, end: 18, kind: "secret" as const }] };
  check("safeQuote masks a quote that overlaps a redaction", safeQuote(unit, "Key sk_test_FAKE_1 here") === "Key [redacted] here");
  check("safeQuote withholds a quote it cannot locate in a redacted source", safeQuote(unit, "something else").startsWith("[quote withheld"));
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  process.exit(failed ? 1 : 0);
}
main();
