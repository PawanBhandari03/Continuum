"""Builds demo-data/projects/<key>.json from demo-data/projects_src.py by running the REAL pipeline in rules mode
(no AI, no database). Re-run after changing the source evidence. Usage: python build_project_fixtures.py [key ...]"""
import json
import sys
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1] / "demo-data"))

from app import main  # noqa: E402
from app.memstore import MemStore  # noqa: E402
from app.models import EvidenceUnit  # noqa: E402
from app.protect import protect  # noqa: E402
from app.rules import RuleProvider  # noqa: E402
import projects_src  # noqa: E402

TEMPLATE_IDS = {"clubsite": "h_2", "hackbot": "h_3"}
OUT = main.config.DEMO_DIR / "projects"


def build(key: str) -> dict:
    spec = projects_src.PROJECTS[key]()
    pid = TEMPLATE_IDS[key]
    b = spec["builder"]
    main.use_store(MemStore())
    main._provider = RuleProvider()
    db = main.db()
    meta = {"description": spec["description"], "team": spec["team"], "stack": spec["stack"], "repo": spec["repo"]}
    db.ins("handovers", [{"id": pid, "leaver": spec["leaver"], "successor": spec["successor"], "successor_role": "contributor",
                          "target_date": spec["target_date"], "version": 0, "title": spec["title"], "meta": meta}])
    src_rows, counts = [], {}
    for skey, name, status, label in spec["sources"]:
        sid = f"{pid}__src_{skey}"
        n = sum(1 for u in b.units if u["source"] == skey)
        counts[skey] = n
        src_rows.append({"id": sid, "handover_id": pid, "type": {"github": "github", "chat": "chat_export"}.get(skey, "notes"),
                         "name": name, "status": status, "status_reason": None, "default_label": label, "unit_count": n})
    db.ins("sources", src_rows)
    unit_rows = []
    for u in b.units:
        eu = protect(EvidenceUnit(id=f"{pid}__{u['id']}", source_id=f"{pid}__src_{u['source']}", author=u["author"],
                                  timestamp=u["ts"], text=u["text"], locator=u["locator"], label=u["label"]))
        unit_rows.append(main.unit_row(eu, pid))
    db.ins("evidence_units", unit_rows)
    db.ins("jobs", [{"id": "build", "handover_id": pid, "status": "queued", "progress": 0}])
    main._reconstruct(pid, "build")
    job = db.one("jobs", {"id": "build"})
    if job["status"] != "done":
        raise SystemExit(f"{key}: reconstruct failed: {job['error']}")
    claims = db.sel("claims", {"handover_id": pid}, order="id.asc")
    return {
        "key": key, "template_id": pid,
        "handover": {"leaver": spec["leaver"], "successor": spec["successor"], "target_date": spec["target_date"],
                     "title": spec["title"], "meta": meta},
        "demo_task": list(spec["demo_task"]),
        "sources": db.sel("sources", {"handover_id": pid}), "units": db.sel("evidence_units", {"handover_id": pid}),
        "claims": claims, "conflicts": db.sel("conflicts", {"handover_id": pid}, order="id.asc"),
        "gaps": db.sel("gaps", {"handover_id": pid}, order="id.asc"),
    }


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for key in (sys.argv[1:] or list(projects_src.PROJECTS)):
        fx = build(key)
        (OUT / f"{key}.json").write_text(json.dumps(fx, indent=1, ensure_ascii=False), encoding="utf-8")
        st = {}
        for c in fx["claims"]:
            st[c["state"]] = st.get(c["state"], 0) + 1
        print(f"{key}: {len(fx['units'])} evidence units, {len(fx['claims'])} claims {st}, "
              f"{len(fx['conflicts'])} conflicts, {len(fx['gaps'])} gaps")
