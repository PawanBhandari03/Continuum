"""Run the real pipeline on the CampusKart demo data. Usage: python run_demo.py [lead|contributor]"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        if v.strip():
            os.environ.setdefault(k.strip(), v.strip())

from app.gemini import GeminiProvider  # noqa: E402
from app.ingest import parse_chat_export, parse_notes  # noqa: E402
from app.pipeline import run  # noqa: E402

DEMO = ROOT.parent / "demo-data"
role = sys.argv[1] if len(sys.argv) > 1 else "lead"
manifest = json.loads((DEMO / "manifest.json").read_text())
units = []
for s in manifest["sources"]:
    if s["type"] == "chat_export":
        u, rep = parse_chat_export(DEMO / s["path"], "src_chat", s["default_label"])
    else:
        sid = "src_" + Path(s["path"]).stem
        u, rep = parse_notes(DEMO / s["path"], sid, s["default_label"])
    print(f"{s['path']}: {rep['status']} {rep['units']} units {rep.get('reason') or ''}")
    units += u
print("total units", len(units))
prov = GeminiProvider()
res = run(units, prov, role=role, on_stage=lambda st, p: print(f"  {st} {p}%"))
print("calls", prov.calls, "errors", res.errors, "dropped", res.dropped)
print("readiness", res.readiness.model_dump())
for c in res.claims:
    print(f"[{c.state:11}] {c.type:13} {c.entity_key:9} {c.label:11} {c.statement[:110]}")
print("conflicts:", [c.summary[:120] for c in res.conflicts])
print("gaps:", [g.question for g in res.gaps])
(ROOT / f".cache_result_{role}.json").write_text(json.dumps(
    {"claims": [c.model_dump() for c in res.claims]}, indent=1), encoding="utf-8")
