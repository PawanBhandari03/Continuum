import type { EvidenceUnit } from "./types";

/** Short human label for an evidence unit, derived from its locator (PR #87, #dev · 09-05, architecture.md …). */
export function chipLabel(u: EvidenceUnit): string {
  const l = u.locator;
  let m = l.match(/pull\/(\d+)/);
  if (m) return `PR #${m[1]}`;
  m = l.match(/issues\/(\d+)/);
  if (m) return `Issue #${m[1]}`;
  m = l.match(/commit\/([0-9a-f]{7})/);
  if (m) return `commit ${m[1]}`;
  m = l.match(/blob\/[^/]+\/([^#]+)/);
  if (m) return m[1];
  m = l.match(/^slack:\/\/([^/]+)\/(\d{4}-\d{2}-\d{2})/);
  if (m) return `#${m[1]} · ${m[2].slice(5)}`;
  m = l.match(/^notes:\/\/([^#]+)/);
  if (m) return m[1];
  if (l.startsWith("exit-qa://")) return "Exit Q&A";
  return u.author;
}
