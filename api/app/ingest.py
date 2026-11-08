"""Parsers: Slack-format chat export and Markdown/PDF notes -> evidence units."""
from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .models import EvidenceUnit, AccessLabel
from .protect import protect

_SKIP_SUBTYPES = {"bot_message", "channel_join", "channel_leave", "channel_topic",
                  "channel_purpose", "channel_name", "message_deleted"}
_NOISE = {"ok", "okay", "k", "kk", "thanks", "thx", "ty", "lol", "yes", "no", "nice", "cool"}


class IngestReport(dict):
    """status: ok | partial | failed, plus counts and reason."""


def _iso(ts: str) -> str:
    return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()


def is_noise(text: str) -> bool:
    t = text.strip()
    if len(t) < 8:
        return True
    if t.lower().strip(".!") in _NOISE:
        return True
    return not re.search(r"[A-Za-z0-9ऀ-ॿ]", t)  # emoji/punctuation only


def parse_chat_export(root: Path, source_id: str = "src_chat",
                      label: AccessLabel = "contributor"):
    """Returns (units, report). Malformed day files are skipped and reported,
    so the source shows as 'partial' instead of silently dropping data."""
    root = Path(root)
    report = IngestReport(status="ok", reason=None, units=0, skipped_noise=0, bad_files=[])
    if not root.is_dir():
        report.update(status="failed", reason=f"Export folder not found: {root}")
        return [], report
    users: dict[str, str] = {}
    try:
        for u in json.loads((root / "users.json").read_text(encoding="utf-8")):
            users[u["id"]] = u.get("name") or u["id"]
    except Exception as e:  # users.json is optional; fall back to raw ids
        report["reason"] = f"users.json unreadable ({type(e).__name__}); using raw user ids"
    units: list[EvidenceUnit] = []
    files = sorted(p for p in root.glob("*/*.json"))
    if not files:
        report.update(status="failed", reason="No channel day files found in export")
        return [], report
    for f in files:
        channel = f.parent.name
        try:
            msgs = json.loads(f.read_text(encoding="utf-8"))
            assert isinstance(msgs, list)
        except Exception as e:
            report["bad_files"].append(f"{channel}/{f.name}: {type(e).__name__}")
            continue
        for m in msgs:
            try:
                if m.get("type") != "message" or m.get("subtype") in _SKIP_SUBTYPES \
                        or m.get("bot_id"):
                    report["skipped_noise"] += 1
                    continue
                text = m["text"]
                if is_noise(text):
                    report["skipped_noise"] += 1
                    continue
                thread = m.get("thread_ts")
                u = EvidenceUnit(
                    id=f"ev_{channel}_{m['ts'].replace('.', '')}",
                    source_id=source_id,
                    author=users.get(m.get("user", ""), m.get("user", "unknown")),
                    timestamp=_iso(m["ts"]), text=text,
                    locator=f"chat://{channel}/{m['ts']}" + (f"?thread={thread}" if thread else ""),
                    label=label)
                units.append(protect(u))
            except Exception:
                report["bad_files"].append(f"{channel}/{f.name}: bad message")
    report["units"] = len(units)
    if report["bad_files"]:
        report.update(status="partial",
                      reason=f"{len(report['bad_files'])} file(s)/message(s) could not be read")
    if not units and report["status"] != "failed":
        report.update(status="failed", reason="Export contained no usable messages")
    return units, report


def parse_notes(path: Path, source_id: str, label: AccessLabel = "contributor"):
    path = Path(path)
    report = IngestReport(status="ok", reason=None, units=0)
    try:
        if path.suffix.lower() == ".pdf":
            from pypdf import PdfReader
            text = "\n\n".join((p.extract_text() or "") for p in PdfReader(str(path)).pages)
        else:
            text = path.read_text(encoding="utf-8")
    except Exception as e:
        report.update(status="failed", reason=f"{type(e).__name__}: {e}")
        return [], report
    units, n = [], 0
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if len(para) < 20:
            continue
        n += 1
        units.append(protect(EvidenceUnit(
            id=f"ev_{source_id}_{n:03d}", source_id=source_id, author="notes",
            timestamp=datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
            text=para, locator=f"notes://{path.name}#p{n}", label=label)))
    report["units"] = len(units)
    if not units:
        report.update(status="failed", reason="No readable text in file")
    return units, report
