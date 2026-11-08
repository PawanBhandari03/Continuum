#!/usr/bin/env python3
"""Generate the synthetic CampusKart Slack-style export (deterministic; seed fixed).

Output (official Slack export shape): demo-data/chat-export/
  users.json, channels.json, <channel>/<YYYY-MM-DD>.json  (fields: user, text, ts, thread_ts, subtype, bot_id)

All people, keys and numbers are FAKE. Planted facts are scripted in PLANTED below and listed in
ANSWER_KEY.md. Filler chatter is generic and carries no facts.
Run:  python demo-data/generate_chat_export.py
"""
import json
import random
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(2611)
OUT = Path(__file__).parent / "chat-export"
IST = timezone(timedelta(hours=5, minutes=30))

USERS = {
    "U01ADITI": ("aditi", "Aditi Sharma"),
    "U02ROHAN": ("rohan", "Rohan Verma"),
    "U03MEERA": ("meera", "Meera Nair"),
    "U04DEV": ("dev", "Dev Patel"),
    "U05KARAN": ("karan", "Karan Singh"),
    "UBOT001": ("deploybot", "Deploy Bot"),
}
CHANNELS = {"general": "C01GENERAL", "dev": "C02DEV", "payments": "C03PAY"}
people = ["U01ADITI", "U02ROHAN", "U03MEERA", "U04DEV"]


def ts(day: str, hh: int, mm: int, ss: int = 0) -> float:
    d = datetime.fromisoformat(day).replace(hour=hh, minute=mm, second=ss, tzinfo=IST)
    return d.timestamp()


msgs = []  # (channel, user, text, ts, thread_ts|None, subtype|None)


def say(ch, user, text, day, hh, mm, thread=None, subtype=None, ss=0):
    msgs.append((ch, user, text, ts(day, hh, mm, ss), thread, subtype))


# ---------------- PLANTED FACTS (see ANSWER_KEY.md) ----------------
# 1. UPI decision (PR #87, 14 Aug), reason: merchant KYC
say("payments", "U02ROHAN", "gateway wale ne KYC maanga hai, merchant account ke bina live nahi jayega. Kya karein?", "2026-08-12", 16, 40)
say("payments", "U03MEERA", "college club ke naam pe merchant account milna mushkil hai, society registration chahiye unko", "2026-08-12", 16, 47)
say("payments", "U01ADITI", "bhai payment wala PR merge kar diya, UPI hi chalega abhi. KYC ke chakkar mein nahi padna.", "2026-08-12", 16, 55)
say("payments", "U01ADITI", "PR #87 hai: card gateway hata ke UPI deep links. Review kar dena guys", "2026-08-14", 10, 25)
say("payments", "U04DEV", "PR #87 looks good, tested on two phones. Approving.", "2026-08-14", 11, 5)
# 5. image bucket dependency, credential with Meera
say("dev", "U03MEERA", "image uploads ab third-party bucket pe ja rahe hain. Bucket ka credential sirf mere paas hai, kisi ko chahiye to mujhse lena.", "2026-08-25", 11, 5)
say("dev", "U01ADITI", "nice, thanks Meera. Resizing abhi bhi client side hai", "2026-08-25", 11, 9)
# 3. SMTP gap: mentions but no owner
say("dev", "U03MEERA", "verification emails college SMTP account se ja rahe hain. Password mere paas nahi hai, pata nahi kisne setup kiya tha.", "2026-09-02", 13, 15)
say("dev", "U04DEV", "haan SMTP wala toh pehle se tha, humne bas use kar liya", "2026-09-02", 13, 22)
say("dev", "U02ROHAN", "if it stops working we are stuck, no idea who to ask", "2026-09-30", 17, 3)
# 6. Windows path recurring (3 times)
say("dev", "U04DEV", "build fails on Windows path again (long path inside node_modules). Works on Linux.", "2026-09-05", 18, 20)
say("dev", "U02ROHAN", "same thing, build fails on Windows path. Someone please look at this?", "2026-09-19", 12, 10)
say("dev", "U01ADITI", "I'll look at it after midsem", "2026-09-19", 12, 31)
say("dev", "U03MEERA", "third time now, build fails on Windows path. Still no fix.", "2026-10-14", 19, 45)
# 4. login loop temp fix (PR #91, TODO in auth/session.ts)
say("dev", "U01ADITI", "login loop fix kar diya temporarily (PR #91), session cookie clear kar raha hu redirect pe. Proper fix baad mein, TODO daal diya hai auth/session.ts mein", "2026-10-09", 17, 30)
say("dev", "U04DEV", "ok but that hack will bite us when refresh tokens come in", "2026-10-09", 17, 41)
# 2. Render vs Vercel (neither authoritative): chat only mentions pieces
say("dev", "U04DEV", "pushed vercel.json, trying the frontend on Vercel preview", "2026-10-02", 14, 5)
say("general", "U02ROHAN", "README still says Render, will someone update it?", "2026-10-06", 9, 50)
# 8. PR #94 stale
say("dev", "U02ROHAN", "PR #94 (seller dashboard) is up, please review", "2026-10-18", 10, 2)
say("dev", "U01ADITI", "left comments on #94, changes requested, mostly the empty-state and the price validation", "2026-10-19", 20, 14)
# 7. COD open thread, no resolution
say("general", "U02ROHAN", "COD rakhein ya nahi? returns handle karna mushkil hai.", "2026-10-20", 15, 0)
say("general", "U03MEERA", "no decision yet. Let's discuss at the next meeting.", "2026-10-20", 15, 12)
say("general", "U04DEV", "students ko COD pasand hai tho, UPI pe bharosa kam hai kuch ka", "2026-10-20", 15, 20)
# permission-trap pointer (the sensitive content itself lives only in notes/mentor-notes.md)
say("general", "U01ADITI", "Prof. Iyer ne mentor notes shared sheet pe daale hain, lead ke liye", "2026-10-30", 9, 15)

# ---------------- NOISE (should be filtered) ----------------
for d, h, m in [("2026-08-14", 11, 30), ("2026-08-27", 9, 0), ("2026-09-11", 15, 2), ("2026-09-26", 10, 44), ("2026-10-03", 12, 1), ("2026-10-10", 18, 3), ("2026-10-22", 16, 30), ("2026-11-02", 11, 11)]:
    say("dev", "UBOT001", "Deploy succeeded: campuskart-web (production)", d, h, m, subtype="bot_message")
for i in range(6):
    say("general", random.choice(people), random.choice(["ok", "👍", "k", "haan", "done", "🙏", "lol", "same"]), f"2026-09-{10+i:02d}", 10 + i, 5)
say("general", "U05KARAN", "has joined the channel", "2026-11-03", 10, 0, subtype="channel_join")
say("general", "U04DEV", "has joined the channel", "2026-08-02", 9, 0, subtype="channel_join")
say("dev", "U02ROHAN", "has left the channel", "2026-09-27", 9, 0, subtype="channel_leave")

# ---------------- FILLER (generic, fact-free) ----------------
FILLER = {
    "general": [
        "standup 5 min mein, link pinned hai", "meeting kal 6 baje library ke paas", "anyone free to test on an iPhone?",
        "mid-sem ke baad speed badhate hain", "logo ka naya version drive pe hai", "chai break?", "demo day ki date confirm hui?",
        "bhai thoda busy hu aaj, kal dekhta hu", "posters printed, kal lagayenge", "who has the club room key?",
        "feedback form ke 12 responses aaye hain", "let's keep PRs small please", "onboarding doc update kar dena jab time mile",
        "good job on the demo everyone", "weekend pe hackathon prep karenge kya", "sprint board refresh kar diya",
    ],
    "dev": [
        "rebased on main, conflicts fixed", "linter is failing on unused import", "can someone review my small PR?",
        "search page slow lag raha hai, index add karna padega", "typo in the listing form label, fixing", "tests green now",
        "bhai staging pe item images load nahi ho rahe, hard refresh karo", "pushed a fix for the sort order", "migration naming consistent rakho",
        "dark mode ka toggle add kiya", "pagination off by one tha, fixed", "adding loading skeletons to the feed",
        "api response 200ms ke andar aa raha hai ab", "reminder: update .env.example when adding vars", "lint-staged hook add kar diya",
        "cart total rounding fix kar diya", "profile page avatar crop issue hai", "will write tests tomorrow", "merged main into my branch",
    ],
    "payments": [
        "UPI intent open ho raha hai Android pe", "iOS pe deep link thoda alag behave kar raha", "order status page pe paid badge add kiya",
        "refund flow ka doc likh raha hu", "test payment 1 rupee wala successful", "amount rounding paise mein karo, floats nahi",
        "payment failed ka message friendly bana diya",
    ],
}

start = datetime(2026, 8, 1, tzinfo=IST)
days = (datetime(2026, 11, 5, tzinfo=IST) - start).days
target_filler = 320
for _ in range(target_filler):
    d = start + timedelta(days=random.randrange(days))
    if d.weekday() == 6 and random.random() < 0.6:
        continue
    ch = random.choices(["general", "dev", "payments"], weights=[4, 6, 1])[0]
    say(ch, random.choice(people), random.choice(FILLER[ch]), d.strftime("%Y-%m-%d"), random.randint(9, 22), random.randint(0, 59), ss=random.randint(0, 59))

# ---------------- write Slack export ----------------
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
(OUT / "users.json").write_text(json.dumps([{"id": uid, "name": n, "real_name": rn, "is_bot": uid.startswith("UBOT")} for uid, (n, rn) in USERS.items()], indent=2), encoding="utf-8")
(OUT / "channels.json").write_text(json.dumps([{"id": cid, "name": name, "created": int(ts("2026-07-15", 9, 0))} for name, cid in CHANNELS.items()], indent=2), encoding="utf-8")

by = {}
for ch, user, text, t, thread, st in sorted(msgs, key=lambda m: m[3]):
    day = datetime.fromtimestamp(t, IST).strftime("%Y-%m-%d")
    by.setdefault((ch, day), []).append((user, text, t, thread, st))

count = 0
for (ch, day), items in by.items():
    (OUT / ch).mkdir(exist_ok=True)
    rows = []
    for user, text, t, thread, st in items:
        row = {"type": "message", "user": user, "text": text, "ts": f"{t:.6f}"}
        if thread:
            row["thread_ts"] = f"{thread:.6f}"
        if st:
            row["subtype"] = st
        if st == "bot_message":
            row["bot_id"] = "B01DEPLOY"
        rows.append(row)
        count += 1
    (OUT / ch / f"{day}.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {count} messages across {len(by)} day files in {OUT}")
