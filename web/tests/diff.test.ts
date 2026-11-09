// Unit checks for the version diff (mock API snapshots + word diff). Run: npm run test:unit
import { mockApi } from "../lib/mock-api";
import { wordDiff } from "../lib/diff";

const store: Record<string, string> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] } };

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
};
const stmt = (x: unknown) => (x as { statement: string }).statement;
const rs = (x: unknown) => (x as { review_status: string }).review_status;

async function main() {
  await mockApi.resetDemo();

  // word diff
  const a = "Image uploads now go to a third-party bucket.";
  const b = "Image uploads were moved to a third-party storage bucket in late August.";
  const d = wordDiff(a, b);
  check("wordDiff marks removed and added words", d.some((p) => p.t === "del") && d.some((p) => p.t === "ins"));
  check("wordDiff reconstructs both sides", d.filter((p) => p.t !== "ins").map((p) => p.w).join("") === a && d.filter((p) => p.t !== "del").map((p) => p.w).join("") === b);
  check("wordDiff of identical text has no changes", wordDiff("a b c", "a b c").every((p) => p.t === "same"));

  // seeded versions: v1 -> v3 is exactly the reviewer's three logged actions
  const seeded = await mockApi.getVersionDiff("h_1", 1, 3);
  check("seeded v1→v3: nothing added or removed", seeded.added.length === 0 && seeded.removed.length === 0);
  const ids = seeded.changed.map((c) => c.claim_id).sort();
  check("seeded v1→v3: exactly cl_d2, cl_p2, cl_r4 changed", JSON.stringify(ids) === JSON.stringify(["cl_d2", "cl_p2", "cl_r4"]));
  const d2 = seeded.changed.find((c) => c.claim_id === "cl_d2")!;
  check("seeded v1→v3: cl_d2 has different before/after statement text", stmt(d2.before) !== stmt(d2.after));
  const same = await mockApi.getVersionDiff("h_1", 2, 3);
  check("v2→v3 shows the same three changes", same.changed.length === 3);
  const none = await mockApi.getVersionDiff("h_1", 1, 2);
  check("v1→v2 has no claim changes (leaver only looked at the list)", none.added.length + none.removed.length + none.changed.length === 0);

  // live edits create new comparable versions
  const claim = (await mockApi.getClaims("h_1")).find((c) => c.id === "cl_s3")!;
  const before = (await mockApi.getHandover("h_1")).version;
  await mockApi.patchClaim("cl_s3", { action: "edit", edited_statement: claim.statement + " Review is overdue." }, "reviewer");
  await mockApi.patchClaim("cl_f2", { action: "reject" }, "reviewer");
  const after = (await mockApi.getHandover("h_1")).version;
  check("each review action creates a new version", after === before + 2);
  const live = await mockApi.getVersionDiff("h_1", before, after);
  const edited = live.changed.find((c) => c.claim_id === "cl_s3");
  const rejected = live.changed.find((c) => c.claim_id === "cl_f2");
  check("edit shows before and after text", !!edited && stmt(edited.after).endsWith("Review is overdue.") && !stmt(edited.before).endsWith("Review is overdue."));
  check("reject shows review_status pending→rejected", !!rejected && rs(rejected.before) !== "rejected" && rs(rejected.after) === "rejected");

  // unknown version fails loudly, never a silent empty diff
  let threw = false;
  try {
    await mockApi.getVersionDiff("h_1", 1, 9999);
  } catch {
    threw = true;
  }
  check("comparing a version with no snapshot is an error, not an empty diff", threw);

  // a new handover gets a first snapshot after reconstruct
  const h = await mockApi.createHandover({ leaver: "x", successor: "y", successor_role: "contributor", target_date: "2026-12-01" });
  await mockApi.reconstruct(h.id);
  const v = (await mockApi.getHandover(h.id)).version;
  const first = await mockApi.getVersionDiff(h.id, v, v);
  check("new handover: a snapshot exists after reconstruct", first.changed.length === 0);

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
  process.exit(failed ? 1 : 0);
}
main();
