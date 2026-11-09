#!/usr/bin/env python3
"""Creates the SYNTHETIC "CampusKart" demo repository on GitHub (PawanBhandari03/campuskart).

Why: Continuum needs a realistic project to read. Everything here is fake: invented people,
invented project, fake commit authors (@campuskart.example). Commit dates are SIMULATED (git
author/committer dates are set to the story timeline); GitHub's own PR/issue "created" times
are real (the day this script runs), so PR/issue bodies carry a visible line
"Date (simulated): YYYY-MM-DD" that the Continuum GitHub connector uses as the event date.

PR/issue numbers matter (the chat and notes refer to PR #87, #91, #94): GitHub numbers issues
and PRs together, so this script creates items strictly in order 1..94.

Usage: python seed_campuskart_repo.py     (needs GITHUB_TOKEN in api/.env; repo must be empty)
"""
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

OWNER, REPO = "PawanBhandari03", "campuskart"
ENV = Path(__file__).resolve().parents[1] / "api" / ".env"
for line in ENV.read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        if v.strip():
            os.environ.setdefault(k.strip(), v.strip())
TOKEN = os.environ["GITHUB_TOKEN"]
AUTH_B64 = base64.b64encode(f"x-access-token:{TOKEN}".encode()).decode()
REMOTE = f"https://github.com/{OWNER}/{REPO}.git"

PEOPLE = {
    "aditi": ("Aditi Sharma", "aditi@campuskart.example"),
    "rohan": ("Rohan Verma", "rohan@campuskart.example"),
    "meera": ("Meera Nair", "meera@campuskart.example"),
    "dev": ("Dev Patel", "dev@campuskart.example"),
}


# ---------------- GitHub API ----------------
def api(method, path, body=None):
    for attempt in range(6):
        req = urllib.request.Request(
            f"https://api.github.com{path}", method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json",
                     "Content-Type": "application/json", "User-Agent": "continuum-seed"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            txt = e.read().decode()[:300]
            if e.code in (403, 429) and ("rate" in txt.lower() or "abuse" in txt.lower() or "secondary" in txt.lower()):
                print(f"  rate limited, sleeping 65s ({txt[:80]})")
                time.sleep(65)
                continue
            if e.code == 409 and method == "GET":
                return None  # empty repo
            raise RuntimeError(f"{method} {path}: HTTP {e.code} {txt}")
    raise RuntimeError(f"{method} {path}: gave up")


# ---------------- local git ----------------
WORK = Path(tempfile.mkdtemp(prefix="campuskart_seed_"))


def git(*args, author=None, date=None, check=True):
    env = dict(os.environ)
    if author:
        n, e = PEOPLE[author]
        env.update(GIT_AUTHOR_NAME=n, GIT_AUTHOR_EMAIL=e, GIT_COMMITTER_NAME=n, GIT_COMMITTER_EMAIL=e)
    if date:
        d = date.strftime("%Y-%m-%dT%H:%M:%S+05:30")
        env.update(GIT_AUTHOR_DATE=d, GIT_COMMITTER_DATE=d)
    r = subprocess.run(["git", *args], cwd=WORK, env=env, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {r.stderr[:400]}")
    return r.stdout


def push(*refs):
    git("-c", f"http.extraheader=AUTHORIZATION: basic {AUTH_B64}", "push", "origin", *refs)


def write_files(files):
    for p, content in files.items():
        f = WORK / p
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(content, encoding="utf-8", newline="\n")


def commit(author, date, msg, files):
    write_files(files)
    git("add", "-A")
    git("commit", "-m", msg, author=author, date=date)


# ---------------- repo content ----------------
def comp(name, extra=""):
    return (f'export default function {name}() {{\n  // {extra or name + " component"}\n'
            f'  return <section className="{name.lower()}">{name}</section>;\n}}\n')


README = """# CampusKart

CampusKart is a campus marketplace where students buy and sell second-hand items.

## Deployment

The app is deployed on Render (see render.yaml). Pushes to `main` redeploy automatically.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local`
3. `npm run dev`
"""

NOTICE = """# Synthetic demo repository

CampusKart is a **fictional** project created for the Continuum hackathon demo
(https://github.com/PawanBhandari03/Continuum). All people, messages and data are invented.
Git commit dates are **simulated** to tell a project story over several months; commit authors
use the reserved `campuskart.example` domain. GitHub's own PR/issue creation times are real, so
PR/issue bodies include a visible line `Date (simulated): YYYY-MM-DD`. Nothing here is real
project history.
"""

PKG = {"name": "campuskart", "version": "0.3.0", "private": True,
       "scripts": {"dev": "next dev", "build": "next build", "start": "next start", "deploy": "render deploy"},
       "dependencies": {"next": "14.2.5", "react": "18.3.1", "react-dom": "18.3.1"}}

GATEWAY = """// Card payments through a third-party payment gateway.
export async function chargeCard(orderId: string, amountPaise: number, token: string) {
  const res = await fetch(process.env.GATEWAY_URL + "/charge", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GATEWAY_KEY}` },
    body: JSON.stringify({ orderId, amountPaise, token }),
  });
  if (!res.ok) throw new Error("gateway charge failed");
  return res.json();
}
"""

UPI = """// UPI deep-link payments. No merchant gateway account is needed.
export function upiLink(orderId: string, amountPaise: number, payeeVpa: string) {
  const rupees = (amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({ pa: payeeVpa, pn: "CampusKart", am: rupees, tr: orderId, cu: "INR" });
  return `upi://pay?${params.toString()}`;
}

export function openUpi(orderId: string, amountPaise: number, payeeVpa: string) {
  window.location.href = upiLink(orderId, amountPaise, payeeVpa);
}
"""

SESSION_V1 = """// Session handling for sign-in.
export function readSession(cookie: string | undefined) {
  if (!cookie) return null;
  try {
    return JSON.parse(Buffer.from(cookie, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function requireSession(cookie: string | undefined) {
  const s = readSession(cookie);
  if (!s) throw new Error("not signed in");
  return s;
}
"""

SESSION_V2 = """// Session handling for sign-in.
export function readSession(cookie: string | undefined) {
  if (!cookie) return null;
  try {
    return JSON.parse(Buffer.from(cookie, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export function requireSession(cookie: string | undefined) {
  const s = readSession(cookie);
  if (!s) throw new Error("not signed in");
  return s;
}

// Temporary fix for the login loop: clear the session cookie when a redirect loops.
// TODO: remove this hack once refresh token rotation is implemented (auth/session.ts)
export function clearOnRedirectLoop(res: { setHeader(k: string, v: string): void }) {
  res.setHeader("Set-Cookie", "session=; Max-Age=0; Path=/");
}
"""

MAILER = """// Sends sign-up verification emails through the college SMTP account.
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendVerification(to: string, link: string) {
  await transport.sendMail({ from: "CampusKart <no-reply@campuskart.example>", to, subject: "Verify your email", text: link });
}
"""

STORAGE = """// Item images are uploaded to a third-party object bucket (BUCKET_URL / BUCKET_KEY in env).
export async function uploadImage(file: Blob, name: string) {
  const res = await fetch(`${process.env.BUCKET_URL}/${name}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${process.env.BUCKET_KEY}` },
    body: file,
  });
  if (!res.ok) throw new Error("upload failed");
  return `${process.env.BUCKET_URL}/${name}`;
}
"""

ENV_EXAMPLE = """SMTP_HOST=smtp.example.edu
SMTP_USER=
SMTP_PASS=
BUCKET_URL=
BUCKET_KEY=
GATEWAY_URL=
GATEWAY_KEY=
"""

RENDER_YAML = """services:
  - type: web
    name: campuskart
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start
"""

VERCEL_JSON = '{\n  "framework": "nextjs",\n  "buildCommand": "npm run build"\n}\n'


def pkg_json(deploy):
    d = json.loads(json.dumps(PKG))
    d["scripts"]["deploy"] = deploy
    return json.dumps(d, indent=2) + "\n"


T = lambda m, d, h=10, mi=0: datetime(2026, m, d, h, mi)  # noqa: E731

# Direct commits to main (not tied to a numbered PR)
DIRECT = [
    (T(7, 20, 9), "aditi", "Initial commit: Next.js scaffold", {
        "README.md": README, "NOTICE.md": NOTICE, "package.json": json.dumps(PKG, indent=2) + "\n",
        "render.yaml": RENDER_YAML, ".env.example": ENV_EXAMPLE, ".gitignore": "node_modules\n.next\n.env*.local\n",
        "src/app/page.tsx": comp("Home")}),
    (T(7, 22), "meera", "Add image storage helper", {"src/lib/storage.ts": STORAGE}),
    (T(7, 25), "rohan", "Add mailer for verification emails", {"src/lib/mailer.ts": MAILER}),
    (T(8, 2), "aditi", "Add card payment gateway module", {"src/payments/gateway.ts": GATEWAY}),
    (T(8, 5), "aditi", "Add session handling", {"auth/session.ts": SESSION_V1}),
    (T(8, 16), "rohan", "Fix cart total rounding: use paise integers", {
        "src/lib/money.ts": "// Amounts are integers in paise, never floats.\nexport const toPaise = (rupees: number) => Math.round(rupees * 100);\n"}),
    (T(8, 28), "meera", "Resize images on the client before upload", {
        "src/lib/resize.ts": "// Client-side image resizing before upload.\nexport async function resize(file: File, maxPx = 1280) { return file; }\n"}),
    (T(9, 12), "dev", "Add pagination to listings", {"src/lib/paginate.ts": "export const pageSize = 20;\n"}),
    (T(9, 30), "aditi", "Retry verification email on failure", {
        "src/lib/mailer.ts": MAILER + "\nexport async function sendWithRetry(to: string, link: string) {\n  for (let i = 0; i < 3; i++) { try { return await sendVerification(to, link); } catch {} }\n}\n"}),
    (T(10, 2, 14), "dev", "chore: add vercel.json and configure the Vercel project for the frontend deploy", {
        "vercel.json": VERCEL_JSON}),
    (T(10, 3, 11), "dev", "Switch deploy script to Vercel", {"package.json": pkg_json("vercel --prod")}),
    (T(10, 21), "rohan", "Add order status badge", {"src/components/PaidBadge.tsx": comp("PaidBadge", "paid badge on order status")}),
]

# Numbered items: (number, kind, datetime, spec)
FEATURE_PRS = {6: ("cart", "Add shopping cart", "Cart"), 19: ("listings", "Add item listings page", "Listings"),
               33: ("search", "Add basic search", "Search"), 47: ("uploads", "Add image upload to listings", "ImageUpload"),
               62: ("profile", "Add user profile page", "Profile"), 75: ("orders", "Add order history", "Orders")}

ISSUE_A = ["Cart", "Listing page", "Search bar", "Profile page", "Login form", "Checkout", "Order history", "Image upload",
           "Navbar", "Footer", "Category filter", "Price filter", "Seller page", "Item card", "Notifications", "Settings page",
           "Sign-up form", "Wishlist", "Reviews", "Chat widget"]
ISSUE_B = ["layout breaks on small screens", "needs loading state", "wrong spacing", "typo in label", "missing alt text",
           "button not clickable on mobile", "should show an empty state", "text overflows card", "add keyboard focus style",
           "colour contrast too low"]
TAIL_ISSUES = {
    88: ("UPI deep link behaves inconsistently on iOS", "Opening the UPI link on iPhone sometimes does nothing. Needs testing on more devices.\n\nDate (simulated): 2026-08-20", "open"),
    89: ("Build fails on Windows (long path inside node_modules)", "npm run build fails on Windows machines with a path-too-long error. Works on Linux and macOS.\n\nDate (simulated): 2026-09-03", "open"),
    90: ("Search page is slow, needs a database index", "Search takes a few seconds with the seed data. We probably need an index on the title column.\n\nDate (simulated): 2026-09-20", "open"),
    92: ("Item images not loading on staging", "Images show broken on the staging site until a hard refresh. Probably caching.\n\nDate (simulated): 2026-10-12", "open"),
    93: ("Update onboarding docs for new members", "Onboarding doc is out of date (still mentions the card gateway). Someone should refresh it.\n\nDate (simulated): 2026-10-15", "open"),
}


def numbered_events():
    ev = []
    start, span = datetime(2026, 7, 20, 10), timedelta(days=24)
    for n in range(1, 87):
        when = start + span * ((n - 1) / 85) + timedelta(minutes=17 * (n % 7))
        ev.append((when, n, "pr" if n in FEATURE_PRS else "issue"))
    ev += [(T(8, 14, 12), 87, "pr87"), (T(8, 20, 9), 88, "tail"), (T(9, 3, 9), 89, "tail"), (T(9, 20, 9), 90, "tail"),
           (T(10, 9, 17), 91, "pr91"), (T(10, 12, 9), 92, "tail"), (T(10, 15, 9), 93, "tail"), (T(10, 18, 10), 94, "pr94")]
    return ev


def main():
    if api("GET", f"/repos/{OWNER}/{REPO}/commits") is not None:
        sys.exit("Repo is not empty; refusing to seed twice.")
    print("work dir:", WORK)
    git("init", "-b", "main")
    git("config", "core.autocrlf", "false")
    git("remote", "add", "origin", REMOTE)

    timeline = [(d, 0, "direct", i) for i, (d, *_rest) in enumerate(DIRECT)] + \
               [(d, n, kind, None) for d, n, kind in numbered_events()]
    timeline.sort(key=lambda x: (x[0], x[1]))
    first = True
    for when, n, kind, idx in timeline:
        if kind == "direct":
            d, author, msg, files = DIRECT[idx]
            commit(author, d, msg, files)
            push("main")
            print(f"{d:%Y-%m-%d} commit: {msg[:60]}")
            first = False
        elif kind == "issue":
            n_pos = n
            title = f"{ISSUE_A[n % len(ISSUE_A)]}: {ISSUE_B[(n * 3) % len(ISSUE_B)]}"
            res = api("POST", f"/repos/{OWNER}/{REPO}/issues",
                      {"title": title, "body": f"{title}.\n\nDate (simulated): {when:%Y-%m-%d}"})
            assert res["number"] == n_pos, f"numbering drift: expected {n_pos}, got {res['number']}"
            if n % 5 != 0:  # most small issues are closed
                api("PATCH", f"/repos/{OWNER}/{REPO}/issues/{n}", {"state": "closed", "state_reason": "completed"})
            time.sleep(1.3)
            print(f"#{n} issue: {title}")
        elif kind == "tail":
            title, body, _ = TAIL_ISSUES[n]
            res = api("POST", f"/repos/{OWNER}/{REPO}/issues", {"title": title, "body": body})
            assert res["number"] == n, f"numbering drift: expected {n}, got {res['number']}"
            print(f"#{n} issue: {title}")
        else:  # PRs
            if kind == "pr":
                branch, title, cname = FEATURE_PRS[n]
                author = ["aditi", "rohan", "meera", "dev"][n % 4]
                files = {f"src/components/{cname}.tsx": comp(cname)}
                body = f"{title}.\n\nDate (simulated): {when:%Y-%m-%d}"
                merge = True
            elif kind == "pr87":
                branch, title, author, merge = "feat/upi-payments", "Move payments from card gateway to UPI deep links", "aditi", True
                files = {"src/payments/upi.ts": UPI}
                body = ("Move payments from the card gateway to UPI deep links.\n\nThe card gateway needs merchant KYC, "
                        "which we cannot get as a student club. UPI deep links work without a merchant account.\n\n"
                        "Tested on two Android phones. Removes the gateway call from checkout.\n\nDate (simulated): 2026-08-14")
            elif kind == "pr91":
                branch, title, author, merge = "fix/login-loop", "temporary fix for login loop", "aditi", True
                files = {"auth/session.ts": SESSION_V2}
                body = ("Temporary fix for the login loop: clears the session cookie when a redirect loops.\n\n"
                        "This is a hack. TODO in `auth/session.ts` to remove it once refresh token rotation is "
                        "implemented.\n\nDate (simulated): 2026-10-09")
            else:  # pr94, stays open
                branch, title, author, merge = "feat/seller-dashboard", "Add seller dashboard", "rohan", False
                files = {"src/components/SellerDashboard.tsx": comp("SellerDashboard", "seller dashboard (listings, orders)")}
                body = "Adds a seller dashboard showing the seller's listings and incoming orders.\n\nDate (simulated): 2026-10-18"
            git("checkout", "-b", branch)
            commit(author, when, title, files)
            push(branch)
            pr = api("POST", f"/repos/{OWNER}/{REPO}/pulls", {"title": title, "head": branch, "base": "main", "body": body})
            assert pr["number"] == n, f"numbering drift: expected PR {n}, got {pr['number']}"
            git("checkout", "main")
            if merge:
                git("merge", "--no-ff", branch, "-m", f"Merge pull request #{n} from {OWNER}/{branch}\n\n{title}",
                    author=author, date=when + timedelta(hours=2))
                push("main")
            if kind == "pr94":
                api("POST", f"/repos/{OWNER}/{REPO}/issues/94/comments", {"body":
                    "Changes requested (review by Aditi): validation is missing on the price field and the empty "
                    "state needs a design. Please update and re-request review.\n\nDate (simulated): 2026-10-19"})
            time.sleep(1.5)
            print(f"#{n} PR ({'merged' if merge else 'open'}): {title}")
    shutil.rmtree(WORK, ignore_errors=True)
    print("done")


if __name__ == "__main__":
    main()
