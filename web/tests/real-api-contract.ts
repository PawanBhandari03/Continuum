// Checks that the REAL API returns the shapes the web client expects (web/lib/types.ts).
// Usage (from web/): NEXT_PUBLIC_API_URL=http://localhost:8000 npx --yes tsx tests/real-api-contract.ts
import { api } from "../lib/api";

const need = (name: string, obj: any, keys: string[]) => {
  const missing = keys.filter((k) => !(k in (obj ?? {})));
  console.log(`${missing.length ? "FAIL" : "PASS"}  ${name}${missing.length ? "  missing: " + missing.join(", ") : ""}`);
  if (missing.length) process.exitCode = 1;
};

async function main() {
  const hs = await api.listHandovers();
  need("handover", hs[0], ["id", "leaver", "successor", "successor_role", "target_date", "status", "version", "approved_by", "published_at"]);
  const hid = hs[0].id;
  const src = await api.getSources(hid);
  need("source", src[0], ["id", "type", "name", "status", "status_reason", "default_label", "unit_count"]);
  const claims = await api.getClaims(hid);
  need("claim", claims[0], ["id", "handover_id", "type", "statement", "state", "confidence_reason", "workstream", "entity_key", "owner", "label", "review_status", "sensitive", "section", "date", "citations", "conflict_id", "version", "confirmed_by", "confirmed_at"]);
  need("citation", claims[0].citations[0], ["evidence_id", "quote", "support"]);
  const cf = await api.getConflicts(hid);
  if (cf[0]) need("conflict", cf[0], ["id", "claim_ids", "summary", "resolution", "resolved_by", "note", "kind", "severity", "entity_key", "sides"]);
  const gaps = await api.getGaps(hid);
  if (gaps[0]) need("gap", gaps[0], ["id", "claim_id", "question", "evidence_found", "status", "answer", "answer_evidence_id"]);
  need("readiness", await api.getReadiness(hid), ["score", "formula", "slots_filled", "slots_total", "open_conflicts", "open_gaps"]);
  const ver = await api.getVersions(hid);
  need("versions", ver, ["published", "draft"]);
  if (ver.published[0]) need("published version", ver.published[0], ["version", "published_at", "published_by", "sha256", "summary"]);
  const view = await api.getView(hid, "contributor");
  need("view", view, ["handover", "sections", "hidden_count", "version", "draft", "not_published", "sha256", "last_ack_version", "versions"]);
  need("view section", view.sections[0], ["key", "title", "claims", "ack"]);
  const leak = JSON.stringify(view).toLowerCase();
  const leaked = ["supervision", "sk_test_fake", "+91-00000"].filter((k) => leak.includes(k));
  console.log(`${leaked.length ? "FAIL" : "PASS"}  contributor view has no lead-only text ${leaked.join(",")}`);
  if (leaked.length) process.exitCode = 1;
  const ev = await api.getEvidence(claims[0].id, "lead");
  need("evidence detail", ev[0], ["citation", "unit", "source", "context"]);
  need("evidence unit", ev[0].unit, ["id", "source_id", "author", "timestamp", "text", "locator", "label", "redactions"]);
  console.log("done");
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
