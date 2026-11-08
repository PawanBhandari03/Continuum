// Permission test (evidence for docs/testing.md): run with `npm run test:permissions`.
// Asserts the Contributor (successor) view and evidence API never expose lead-only content,
// the fake key, the fake phone number, or sensitive/redacted claims.
import { mockApi } from "../lib/mock-api";

const store: Record<string, string> = {};
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
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  process.exit(failed ? 1 : 0);
}
main();
