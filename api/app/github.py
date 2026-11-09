"""GitHub connector (read-only): README, commits, PRs (+comments), issues (+comments) and TODO/FIXME
comments in source files -> evidence units. Uses the REST API directly (httpx).

Event dates: the synthetic CampusKart repo carries a visible line `Date (simulated): YYYY-MM-DD` in
PR/issue bodies because GitHub's own created_at is the day the demo repo was built. When that line is
present it is used as the unit's date; otherwise GitHub's timestamp is used."""
from __future__ import annotations
import os
import re
from datetime import datetime, timezone

import httpx

from .models import EvidenceUnit, AccessLabel
from .protect import protect

API = "https://api.github.com"
_SIM = re.compile(r"Date \(simulated\):\s*(\d{4}-\d{2}-\d{2})")
_TODO = re.compile(r"\b(TODO|FIXME|HACK)\b[:\s]?(.*)")
_CODE_EXT = (".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".yaml", ".yml", ".json")


class GitHubError(RuntimeError):
    pass


def parse_repo(ref: str) -> tuple[str, str]:
    m = re.search(r"github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", (ref or "").strip())
    if not m:
        raise GitHubError("Could not parse a GitHub repo URL (expected https://github.com/owner/repo).")
    return m.group(1), m.group(2)


def sim_date(text: str | None, fallback: str) -> str:
    m = _SIM.search(text or "")
    return f"{m.group(1)}T12:00:00+00:00" if m else fallback


class _Gh:
    def __init__(self, token: str | None):
        h = {"Accept": "application/vnd.github+json", "User-Agent": "continuum-connector"}
        if token:
            h["Authorization"] = f"Bearer {token}"
        self.http = httpx.Client(timeout=30, headers=h)
        self.limited = False

    def get(self, path: str, params: dict | None = None):
        r = self.http.get(path if path.startswith("http") else API + path, params=params)
        if r.status_code in (403, 429) and r.headers.get("x-ratelimit-remaining") == "0":
            self.limited = True
            raise GitHubError("GitHub API rate limit reached")
        if r.status_code == 404:
            raise GitHubError("Repository not found, or it is private and the token cannot read it.")
        if r.status_code >= 400:
            raise GitHubError(f"GitHub API error {r.status_code}: {r.text[:120]}")
        return r

    def pages(self, path: str, params: dict | None = None, limit: int = 300):
        out, page = [], 1
        while len(out) < limit:
            rows = self.get(path, {**(params or {}), "per_page": 100, "page": page}).json()
            out += rows
            if len(rows) < 100:
                break
            page += 1
        return out[:limit]


def fetch_github(ref: str, source_id: str, label: AccessLabel = "contributor", token: str | None = None,
                 id_prefix: str = "", max_commits: int = 150):
    """Returns (units, report). report.status is ok | partial | failed with a reason, never silent."""
    report = {"status": "ok", "reason": None, "units": 0, "skipped_noise": 0, "problems": []}
    token = token or os.environ.get("GITHUB_TOKEN")
    try:
        owner, repo = parse_repo(ref)
    except GitHubError as e:
        report.update(status="failed", reason=str(e))
        return [], report
    gh = _Gh(token)
    base = f"https://github.com/{owner}/{repo}"
    units: list[EvidenceUnit] = []

    def add(uid, author, ts, text, locator):
        units.append(protect(EvidenceUnit(id=f"{id_prefix}{uid}", source_id=source_id, author=author or "unknown",
                                          timestamp=ts, text=text.strip(), locator=locator, label=label)))

    def step(name, fn):
        try:
            fn()
        except GitHubError as e:
            report["problems"].append(f"{name}: {e}")
            if "not found" in str(e).lower() and name == "repo":
                raise
        except httpx.HTTPError as e:
            report["problems"].append(f"{name}: network error {type(e).__name__}")

    def repo_info():
        info = gh.get(f"/repos/{owner}/{repo}").json()
        report["default_branch"] = info.get("default_branch", "main")

    try:
        step("repo", repo_info)
    except GitHubError as e:
        report.update(status="failed", reason=str(e))
        return [], report
    branch = report.get("default_branch", "main")

    def readme():
        r = gh.get(f"/repos/{owner}/{repo}/readme", None).json()
        text = httpx.get(r["download_url"], timeout=30).text
        add("gh_readme", owner, datetime.now(timezone.utc).isoformat(), "README.md:\n" + text, f"{base}/blob/{branch}/README.md")

    def commits():
        for c in gh.pages(f"/repos/{owner}/{repo}/commits", limit=max_commits):
            msg = c["commit"]["message"]
            if msg.startswith("Merge pull request") or len(msg) < 12:
                report["skipped_noise"] += 1
                continue
            add(f"gh_commit_{c['sha'][:7]}", c["commit"]["author"]["name"], c["commit"]["author"]["date"],
                f"Commit {c['sha'][:7]}: {msg}", c["html_url"])

    def issues_and_prs():
        items = gh.pages(f"/repos/{owner}/{repo}/issues", {"state": "all"}, limit=400)
        for it in sorted(items, key=lambda x: x["number"]):
            n, is_pr = it["number"], "pull_request" in it
            body = it.get("body") or ""
            ts = sim_date(body, it["created_at"])
            has_comments = it.get("comments", 0) > 0
            if not is_pr and it["state"] == "closed" and not has_comments:
                report["skipped_noise"] += 1  # closed, no discussion: routine tracker noise
                continue
            kind = "PR" if is_pr else "Issue"
            state = it["state"]
            if is_pr:
                try:
                    pr = gh.get(it["pull_request"]["url"]).json()
                    state = "merged" if pr.get("merged_at") else it["state"]
                except GitHubError:
                    pass
            add(f"gh_{'pr' if is_pr else 'issue'}_{n}", (it.get("user") or {}).get("login"), ts,
                f"{kind} #{n} ({state}): {it['title']}\n{body}", it["html_url"])
            if has_comments:
                for k, cm in enumerate(gh.pages(it["comments_url"], limit=20), 1):
                    add(f"gh_{'pr' if is_pr else 'issue'}_{n}_c{k}", (cm.get("user") or {}).get("login"),
                        sim_date(cm.get("body"), cm["created_at"]),
                        f"Comment on {kind} #{n}: {cm.get('body') or ''}", cm["html_url"])

    def todos():
        tree = gh.get(f"/repos/{owner}/{repo}/git/trees/{branch}", {"recursive": "1"}).json()
        files = [t for t in tree.get("tree", []) if t["type"] == "blob" and t["path"].endswith(_CODE_EXT)
                 and t.get("size", 0) < 100_000][:80]
        for f in files:
            raw = httpx.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{f['path']}", timeout=30)
            if raw.status_code != 200:
                continue
            for i, line in enumerate(raw.text.splitlines(), 1):
                if _TODO.search(line):
                    add(f"gh_todo_{re.sub(r'[^a-z0-9]+', '_', f['path'].lower())}_{i}", owner,
                        datetime.now(timezone.utc).isoformat(), f"{f['path']} line {i}: {line.strip()}",
                        f"{base}/blob/{branch}/{f['path']}#L{i}")

    for name, fn in (("readme", readme), ("commits", commits), ("issues and pull requests", issues_and_prs),
                     ("TODO scan", todos)):
        step(name, fn)

    report["units"] = len(units)
    if not units:
        report.update(status="failed", reason="; ".join(report["problems"]) or "Repository produced no evidence")
    elif report["problems"]:
        report.update(status="partial", reason="Some GitHub data could not be fetched: " + "; ".join(report["problems"]))
    return units, report
