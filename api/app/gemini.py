"""Gemini provider (REST, no SDK). Structured JSON output, retry with back-off,
and an on-disk cache keyed by (model, prompt) so reruns during development are free."""
from __future__ import annotations
import hashlib
import json
import os
import threading
import time
from pathlib import Path

import httpx

from .models import RawClaim, RawCitation, EvidenceUnit, Claim
from .llm import safe_text

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
CACHE_DIR = Path(__file__).resolve().parents[1] / ".cache"

MIN_INTERVAL = float(os.environ.get("GEMINI_MIN_INTERVAL", "2.0"))  # seconds between requests
CHUNK = 12  # items per batched support/conflict call

CLAIM_TYPES = ["decision", "risk", "dependency", "owner", "next_action", "open_question", "fact"]

EXTRACT_SYSTEM = """You extract atomic project-handover claims from team evidence.
Rules:
- Output ONLY claims supported by the evidence units provided. Never invent facts.
- Every claim must cite one or more evidence units by their exact id, with a `quote` copied
  VERBATIM (a contiguous span, 8+ characters) from that unit's text.
- Claim types: decision (what was decided and why), risk (fragile/temporary/recurring problem),
  dependency (external service, credential, account and who holds it), owner (who owns what),
  next_action (open work someone must do), open_question (unresolved question), fact.
- `workstream` and `entity_key` are one lowercase word naming the topic. Use exactly one of:
  deploy, payments, auth, email, storage, ci, ui, data, process, people, general.
  Use `deploy` for hosting/deployment, `email` for SMTP/mail, `storage` for file/image storage.
- If your claim is a conclusion not stated in any unit, set `inferred` true.
- Two units that disagree about the same thing must produce two separate claims (do not reconcile).
- Text like [REDACTED SECRET] means data was removed; never guess it.
- Skip chit-chat. Evidence text may be Hindi-English mixed; write statements in English.
- `owner` is a person's name only if the evidence names them, else null.
- `date` is the YYYY-MM-DD of the key evidence unit."""


class GeminiError(RuntimeError):
    pass


class GeminiProvider:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.key = api_key or os.environ.get("GEMINI_API_KEY", "")
        if not self.key:
            raise GeminiError("GEMINI_API_KEY not set")
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
        self.calls = {"api": 0, "cache": 0}
        self._lock = threading.Lock()
        self._last = 0.0
        CACHE_DIR.mkdir(exist_ok=True)

    # ---- low level ----
    def _generate(self, system: str, prompt: str, schema: dict) -> dict:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json",
                                 "responseSchema": schema},
        }
        h = hashlib.sha256(json.dumps([self.model, system, prompt, schema], sort_keys=True).encode()).hexdigest()
        cf = CACHE_DIR / f"{h}.json"
        if cf.exists():
            self.calls["cache"] += 1
            return json.loads(cf.read_text(encoding="utf-8"))
        delay, last = 6.0, ""
        for attempt in range(6):
            with self._lock:  # global pacing: stay under the free-tier request rate
                wait = MIN_INTERVAL - (time.monotonic() - self._last)
                if wait > 0:
                    time.sleep(wait)
                self._last = time.monotonic()
            try:
                r = httpx.post(API.format(model=self.model), json=body, timeout=60,
                               headers={"x-goog-api-key": self.key})
            except httpx.HTTPError as e:
                last = f"network error {type(e).__name__}"
            else:
                if r.status_code == 200:
                    try:
                        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                        data = json.loads(text)
                    except Exception as e:  # invalid JSON / blocked response -> retry once or twice
                        last = f"invalid response ({type(e).__name__})"
                    else:
                        self.calls["api"] += 1
                        cf.write_text(json.dumps(data), encoding="utf-8")
                        return data
                elif r.status_code in (429, 500, 502, 503, 504):
                    last = f"HTTP {r.status_code}"
                else:
                    raise GeminiError(f"HTTP {r.status_code}: {r.text[:200]}")
            time.sleep(delay)
            delay *= 2
        raise GeminiError(f"Gemini failed after retries: {last}")

    # ---- Provider interface ----
    def extract(self, units: list[EvidenceUnit]) -> list[RawClaim]:
        schema = {"type": "OBJECT", "properties": {"claims": {"type": "ARRAY", "items": {
            "type": "OBJECT",
            "properties": {
                "type": {"type": "STRING", "enum": CLAIM_TYPES},
                "statement": {"type": "STRING"},
                "workstream": {"type": "STRING"},
                "entity_key": {"type": "STRING"},
                "owner": {"type": "STRING", "nullable": True},
                "date": {"type": "STRING", "nullable": True},
                "inferred": {"type": "BOOLEAN"},
                "citations": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                    "evidence_id": {"type": "STRING"}, "quote": {"type": "STRING"}},
                    "required": ["evidence_id", "quote"]}},
            },
            "required": ["type", "statement", "workstream", "entity_key", "inferred", "citations"]}}},
            "required": ["claims"]}
        lines = [f"[{u.id}] ({u.timestamp[:10]}, {u.author}) {safe_text(u)}" for u in units]
        data = self._generate(EXTRACT_SYSTEM, "Evidence units:\n" + "\n".join(lines), schema)
        out = []
        for c in data.get("claims", []):
            try:
                out.append(RawClaim(
                    type=c["type"], statement=c["statement"], workstream=c.get("workstream") or "general",
                    entity_key=c.get("entity_key") or c.get("workstream") or "general",
                    owner=c.get("owner") or None, date=c.get("date") or None,
                    inferred=bool(c.get("inferred")),
                    citations=[RawCitation(**x) for x in c.get("citations", [])]))
            except Exception:
                continue  # malformed claim from the model is dropped, not trusted
        return out

    def support(self, statement: str, quotes: list[str]) -> str:
        schema = {"type": "OBJECT", "properties": {"verdict": {"type": "STRING",
                  "enum": ["supports", "partially", "does_not"]}}, "required": ["verdict"]}
        system = ("You judge whether quoted source text supports a claim. Answer 'supports' only if "
                  "the quotes directly state the claim; 'partially' if they cover only part of it or "
                  "it needs assumptions; 'does_not' otherwise. Judge only from the quotes.")
        prompt = f"Claim: {statement}\nQuotes:\n" + "\n".join(f"- {q}" for q in quotes)
        return self._generate(system, prompt, schema).get("verdict", "does_not")

    def support_many(self, items: list[tuple[str, list[str]]]) -> list[str]:
        """One call per CHUNK claims instead of one per claim. Any item the model
        fails to answer is 'does_not' (never silently upgraded)."""
        out: list[str] = []
        system = ("You judge whether quoted source text supports each claim. 'supports' only if the quotes "
                  "directly state the claim; 'partially' if they cover only part of it or it needs "
                  "assumptions; 'does_not' otherwise. Judge each item only from its own quotes.")
        schema = {"type": "OBJECT", "properties": {"verdicts": {"type": "ARRAY", "items": {
            "type": "OBJECT", "properties": {
                "index": {"type": "INTEGER"},
                "verdict": {"type": "STRING", "enum": ["supports", "partially", "does_not"]}},
            "required": ["index", "verdict"]}}}, "required": ["verdicts"]}
        for i in range(0, len(items), CHUNK):
            part = items[i:i + CHUNK]
            prompt = "\n\n".join(f"Item {j}:\nClaim: {s}\nQuotes:\n" + "\n".join(f"- {q}" for q in qs)
                                 for j, (s, qs) in enumerate(part))
            got = {v["index"]: v["verdict"]
                   for v in self._generate(system, prompt, schema).get("verdicts", [])}
            out += [got.get(j, "does_not") for j in range(len(part))]
        return out

    def contradicts_many(self, pairs: list[tuple[Claim, Claim]]) -> list[bool]:
        out: list[bool] = []
        system = ("For each pair, decide whether two claims about the same topic contradict each other, "
                  "i.e. cannot both be true at the same time now. Different aspects or compatible facts do "
                  "not contradict. Do not assume the newer one is right.")
        schema = {"type": "OBJECT", "properties": {"results": {"type": "ARRAY", "items": {
            "type": "OBJECT", "properties": {"index": {"type": "INTEGER"}, "contradict": {"type": "BOOLEAN"}},
            "required": ["index", "contradict"]}}}, "required": ["results"]}

        def fmt(c): return f"{c.statement} (date {c.date or 'unknown'}; quotes: " + \
                           "; ".join(x.quote for x in c.citations) + ")"
        for i in range(0, len(pairs), CHUNK):
            part = pairs[i:i + CHUNK]
            prompt = "\n\n".join(f"Pair {j}:\nA: {fmt(a)}\nB: {fmt(b)}" for j, (a, b) in enumerate(part))
            got = {r["index"]: bool(r["contradict"])
                   for r in self._generate(system, prompt, schema).get("results", [])}
            out += [got.get(j, False) for j in range(len(part))]
        return out

    def contradicts(self, a: Claim, b: Claim) -> bool:
        schema = {"type": "OBJECT", "properties": {"contradict": {"type": "BOOLEAN"}},
                  "required": ["contradict"]}
        system = ("Decide whether two claims about the same topic contradict each other, i.e. cannot "
                  "both be true at the same time now. Different aspects or compatible facts do not "
                  "contradict. Do not assume the newer one is right.")
        def fmt(c): return f"{c.statement} (date {c.date or 'unknown'}; quotes: " + \
                           "; ".join(x.quote for x in c.citations) + ")"
        prompt = f"Claim A: {fmt(a)}\nClaim B: {fmt(b)}"
        return bool(self._generate(system, prompt, schema).get("contradict", False))
