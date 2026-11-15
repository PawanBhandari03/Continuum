"""Source evidence for the extra synthetic demo projects (everything here is fictional: people, repos, keys, numbers).
`api/build_project_fixtures.py` turns this into demo-data/projects/<key>.json by running the real pipeline in rules mode.
Evidence helpers produce one unit each; GitHub-style locators use the github:// scheme because the repos do not exist."""
from datetime import datetime, timezone


def ts(d: str, hm: str = "10:30") -> str:
    return datetime.fromisoformat(f"{d}T{hm}:00").replace(tzinfo=timezone.utc).isoformat()


class Builder:
    def __init__(self, key: str, repo: str):
        self.key, self.repo, self.n = key, repo, 0
        self.units: list[dict] = []

    def _add(self, source: str, author: str, when: str, text: str, locator: str, label: str = "contributor") -> None:
        self.n += 1
        self.units.append({"id": f"ev_{source}_{self.n:03d}", "source": source, "author": author, "ts": when,
                           "text": text.strip(), "locator": locator, "label": label})

    def readme(self, d: str, author: str, text: str):
        self._add("github", author, ts(d), "README.md:\n" + text, f"github://{self.repo}/blob/main/README.md", "public")

    def commit(self, d: str, author: str, sha: str, msg: str):
        self._add("github", author, ts(d, "14:05"), f"Commit {sha}: {msg}", f"github://{self.repo}/commit/{sha}", "public")

    def pr(self, d: str, author: str, n: int, state: str, title: str, body: str = ""):
        self._add("github", author, ts(d, "16:20"), f"PR #{n} ({state}): {title}\n{body}", f"github://{self.repo}/pull/{n}", "public")

    def issue(self, d: str, author: str, n: int, state: str, title: str, body: str = ""):
        self._add("github", author, ts(d, "11:10"), f"Issue #{n} ({state}): {title}\n{body}", f"github://{self.repo}/issues/{n}", "public")

    def todo(self, d: str, path: str, line: int, text: str):
        self._add("github", "repo", ts(d), f"{path} line {line}: {text}", f"github://{self.repo}/blob/main/{path}#L{line}", "public")

    def chat(self, channel: str, d: str, hm: str, author: str, text: str):
        self._add("chat", author, ts(d, hm), text, f"slack://{channel}/{d}#{hm.replace(':', '')}")

    def note(self, name: str, d: str, author: str, text: str, label: str = "contributor"):
        self._add(f"note_{name}", author, ts(d, "09:00"), text, f"notes://{name}#p{self.n + 1}", label)


def clubsite() -> dict:
    b = Builder("clubsite", "binary-coders/clubsite")
    b.readme("2026-07-28", "Neha Rao", """# ClubSite

Website of the Binary Coders Club: events, member directory and the club blog.

## Deployment

The site is deployed on Netlify. Pushes to `main` redeploy automatically.

## Data

Events and members are stored in Firestore.

## Local setup

Copy `.env.example` to `.env.local`, run `npm install` and `npm run dev`.""")
    # --- commits and PRs
    b.commit("2026-08-04", "Neha Rao", "3fa91c2", "Scaffold Next.js app with events list and member directory")
    b.commit("2026-08-11", "Sana Iyer", "9b7e1d4", "Add club logo, colour tokens and responsive navbar")
    b.pr("2026-08-18", "Vikram S.", 38, "merged", "Add membership fee page with a Razorpay payment link",
         "Members pay the yearly fee of Rs 200 through a Razorpay payment link. Vikram owns the Razorpay dashboard.")
    b.commit("2026-08-25", "Neha Rao", "c41d0aa", "Add Google sign-in with NextAuth")
    b.commit("2026-09-02", "Arjun Mehta", "e18ab55", "Add events calendar component (read only)")
    b.commit("2026-09-09", "Sana Iyer", "71d2f30", "Upload event photos to Cloudinary instead of the repo")
    b.pr("2026-09-15", "Neha Rao", 41, "merged", "Migrate events data from Firestore to Postgres on Supabase",
         "We moved the events data to Postgres on Supabase because Firestore costs were unpredictable and calendar reads were slow.")
    b.commit("2026-09-20", "Neha Rao", "5d3c9b8", "Migrate events reads to the Postgres client")
    b.commit("2026-10-05", "Neha Rao", "a1b2c3d", "chore: add vercel.json and configure the Vercel project for the web app")
    b.commit("2026-10-06", "Neha Rao", "b7c8d9e", "Switch deploy script from Netlify to Vercel")
    b.commit("2026-10-12", "Vikram S.", "f0e1d2c", "Send event reminder emails through SendGrid")
    b.pr("2026-10-20", "Neha Rao", 44, "merged", "Fix login loop with a temporary cookie workaround",
         "Temporary fix: clear the stale session cookie on redirect. Proper fix needs NextAuth session refresh changes.")
    b.commit("2026-10-21", "Neha Rao", "9a8b7c6", "temporary fix for login loop in auth session handling")
    b.todo("2026-10-21", "src/lib/auth.ts", 22, "// TODO: remove this hack once NextAuth session refresh is fixed")
    b.pr("2026-11-04", "Arjun Mehta", 52, "open", "Events calendar view with month and list modes",
         "Review requested. Neha asked for changes on 5 Nov: keyboard navigation and empty states.")
    b.issue("2026-10-14", "Sana Iyer", 47, "open", "Image optimisation fails during the build",
            "Build fails on image optimisation (sharp) for large event photos. Works locally.")
    b.issue("2026-10-25", "Arjun Mehta", 49, "open", "Dark mode", "Nobody has decided whether dark mode is in scope for this term.")
    b.issue("2026-11-02", "Arjun Mehta", 50, "open", "Update README: deployment and database sections are out of date")
    # --- chat
    C = b.chat
    C("general", "2026-08-03", "17:20", "Neha Rao", "Welcome to the ClubSite channel! Repo is in the club GitHub org, ping me for access.")
    C("dev", "2026-08-05", "11:02", "Neha Rao", "We decided to use Next.js with Tailwind for the club website. Final.")
    C("dev", "2026-08-18", "15:40", "Vikram S.", "We decided membership fee payments go through a Razorpay payment link. Final.")
    C("dev", "2026-08-18", "15:45", "Vikram S.", "Vikram owns the Razorpay dashboard, ask him for payout reports.")
    C("dev", "2026-08-26", "12:15", "Neha Rao", "Google sign-in is working in production. Users must use their college Google account.")
    C("dev", "2026-09-09", "19:05", "Sana Iyer", "We decided event photos go to Cloudinary storage instead of the repo. Final.")
    C("dev", "2026-09-09", "19:10", "Sana Iyer", "The Cloudinary credentials are only with Sana, ask Sana before changing upload settings.")
    C("general", "2026-09-12", "10:11", "Arjun Mehta", "Can someone share the design file for the events page?")
    C("dev", "2026-09-14", "21:30", "Neha Rao", "Firestore bill is surprising again. We decided to move events to Supabase Postgres. Final.")
    C("dev", "2026-09-16", "13:45", "Arjun Mehta", "Neha ne kaha tha migration PR #41 merge ho gaya? Staging pe events dikh rahe hain.")
    C("dev", "2026-09-18", "09:55", "Sana Iyer", "build fails again on image optimisation (sharp) for the big hackathon photos")
    C("dev", "2026-09-30", "18:20", "Sana Iyer", "build fails again on image optimisation (sharp), resized photos by hand for now")
    C("dev", "2026-10-05", "16:10", "Neha Rao", "Netlify build minutes are over. I am moving the web app to Vercel and will delete the netlify config next week.")
    C("dev", "2026-10-06", "12:00", "Neha Rao", "Vercel pe deploy ho gaya, production is live on Vercel now.")
    C("general", "2026-10-08", "14:30", "Vikram S.", "We decided reminder emails go through SendGrid. Final.")
    C("general", "2026-10-08", "14:35", "Vikram S.", "The SendGrid API key is kept in the shared sheet, but I set the account up on a laptop I no longer have.")
    C("dev", "2026-10-14", "20:05", "Sana Iyer", "build fails again on image optimisation (sharp), third time this month")
    C("dev", "2026-10-19", "11:25", "Arjun Mehta", "Login loop is back for some students after Google sign-in. Is anyone looking at it?")
    C("dev", "2026-10-20", "22:10", "Neha Rao", "Pushed a temporary fix for the login loop (clearing the stale cookie). Proper fix after the exams.")
    C("dev", "2026-10-22", "10:40", "Neha Rao", "That hack will bite us when NextAuth v5 lands, leaving a TODO in auth.ts.")
    C("general", "2026-10-25", "15:15", "Arjun Mehta", "Dark mode: should we add it this term? Still undecided.")
    C("general", "2026-10-26", "15:20", "Sana Iyer", "Dark mode is nice to have but not decided.")
    C("dev", "2026-10-30", "17:00", "Neha Rao", "I am leaving the club web team after this sprint. Arjun takes over ClubSite.")
    C("dev", "2026-10-30", "17:05", "Arjun Mehta", "Got it. Please write down the deploy steps and who owns what before you go.")
    C("dev", "2026-11-02", "12:30", "Neha Rao", "Vercel access is only with me, Neha, because the project sits under my personal account.")
    C("dev", "2026-11-05", "10:10", "Neha Rao", "Review of PR #52: please add keyboard navigation and empty states.")
    C("general", "2026-11-07", "09:45", "Vikram S.", "Event reminder for the Rust workshop went out fine today.")
    # --- notes
    b.note("architecture.md", "2026-10-15", "notes", """# Architecture notes (synthetic)

- **Web:** Next.js app, see the README for the deployment target.
- **Data:** events and members live in a Postgres database.
- **Images:** event photos go to a third-party image service.
- **Email:** reminder emails are sent through SendGrid.""")
    b.note("meeting-2026-10-30.md", "2026-10-30", "notes", """# Web team meeting, 30 Oct 2026 (synthetic)

Attendees: Neha, Arjun, Sana, Vikram.

- Events calendar PR #52 needs another review pass.
- Dark mode: discussed briefly, not decided. Parked for next term.
- Action: Neha to document the deploy steps before leaving.
- Treasurer Vikram receives the Razorpay payouts in the club bank account.""")
    b.note("treasurer-notes.md", "2026-10-28", "Vikram S.", """# Treasurer notes (synthetic)

Fee refunds are paid by UPI from treasurer.club@okaxis. The club PAN for receipts is ABCPE1234F.

Sana has been unreliable about answering design requests this month, so Neha is covering the events page for now.""")
    b.note("mentor-notes.md", "2026-11-03", "Prof. Rao", """# Mentor notes, Prof. Rao (LEAD ONLY, synthetic)

Candid feedback for the lead only: Sana often misses deadlines and needs closer supervision.
Test key sk_test_FAKE_88xyzABC0123456789 is in the shared sheet. Call me on +91-00000-11111.

(All values above are fake and must never appear in the successor view.)""", "lead_only")
    sources = [("github", "ClubSite repo (README, commits, PRs, issues, TODOs)", "ok", "public"),
               ("chat", "Team chat export (#general, #dev)", "ok", "contributor"),
               ("note_architecture.md", "Notes: architecture.md", "ok", "contributor"),
               ("note_meeting-2026-10-30.md", "Notes: meeting-2026-10-30.md", "ok", "contributor"),
               ("note_treasurer-notes.md", "Notes: treasurer-notes.md", "ok", "contributor"),
               ("note_mentor-notes.md", "Notes: mentor-notes.md — lead only", "ok", "lead_only")]
    return {
        "key": "clubsite", "title": "ClubSite", "leaver": "neha", "successor": "arjun", "target_date": "2026-11-20",
        "description": "Website of a college coding club: events calendar, member directory, membership payments.",
        "team": [{"name": "Neha Rao", "role": "Web lead (leaving)"}, {"name": "Arjun Mehta", "role": "Successor"},
                 {"name": "Sana Iyer", "role": "Design"}, {"name": "Vikram S.", "role": "Treasurer"},
                 {"name": "Prof. Rao", "role": "Mentor"}],
        "stack": ["Next.js", "Vercel", "Supabase Postgres", "Cloudinary", "SendGrid", "Razorpay"],
        "repo": "binary-coders/clubsite", "builder": b, "sources": sources,
        "demo_task": ("dependencies", "Who can give me the SendGrid login and access to the Vercel project?",
                      "Vikram set SendGrid up and lost the laptop, so create a new API key in the club SendGrid account (treasurer has it). Neha moves the Vercel project to the club account before 20 Nov."),
    }


def hackbot() -> dict:
    b = Builder("hackbot", "binary-coders/hackbot")
    b.readme("2026-08-06", "Dev Patel", """# HackBot

A Discord bot that announces hackathons, matches teammates and posts daily reminders for the club server.

## Deployment

The bot is hosted on Heroku. Pushes to `main` redeploy automatically.

## Data

The bot keeps its data in a local SQLite file.

## Local setup

Create a Discord application, copy `.env.example` to `.env`, run `pip install -r requirements.txt` and `python bot.py`.""")
    b.commit("2026-08-09", "Dev Patel", "11a22b3", "Scaffold discord.py bot with ping and help commands")
    b.commit("2026-08-16", "Ishaan V.", "44c55d6", "Add hackathon announcement command with embeds")
    b.commit("2026-08-23", "Dev Patel", "77e88f9", "Add team matching command using skills in the member profile")
    b.pr("2026-09-01", "Dev Patel", 23, "merged", "Switch from prefix commands to slash commands",
         "We moved to slash commands because Discord restricts the message content intent for bots in more than 100 servers.")
    b.commit("2026-09-08", "Tanvi Nair", "00a11b2", "Add daily reminder task with APScheduler")
    b.pr("2026-09-22", "Dev Patel", 27, "merged", "Move from SQLite to Postgres",
         "We moved the data to Postgres because the Railway disk is ephemeral and the SQLite file was wiped on every deploy.")
    b.commit("2026-09-24", "Dev Patel", "33c44d5", "Migrate bot storage to the Postgres client")
    b.commit("2026-10-01", "Dev Patel", "66e77f8", "chore: add railway.json and configure the Railway project for the bot")
    b.commit("2026-10-02", "Dev Patel", "99a00b1", "Switch deploy from Heroku to Railway")
    b.commit("2026-10-10", "Ishaan V.", "22c33d4", "Add retry with backoff for Discord rate limits")
    b.pr("2026-10-18", "Dev Patel", 31, "merged", "Temporary workaround for duplicate reminders",
         "Temporary fix: skip a reminder if the same one was sent within 5 minutes. Root cause is the scheduler restarting on deploy.")
    b.commit("2026-10-18", "Dev Patel", "55e66f7", "hack: skip duplicate reminders sent within 5 minutes")
    b.todo("2026-10-18", "bot/scheduler.py", 41, "# TODO: remove this hack once the scheduler job store is persistent")
    b.pr("2026-11-03", "Priya Sharma", 34, "open", "Team matching v2: match by timezone and skills",
         "Review requested. Dev asked for changes on 4 Nov: add tests for the empty-profile case.")
    b.issue("2026-10-12", "Tanvi Nair", 29, "open", "Bot hits Discord rate limits during big announcements",
            "429 errors when announcing to 30 channels at once.")
    b.issue("2026-10-27", "Priya Sharma", 32, "open", "Add a /help command listing all slash commands")
    b.issue("2026-11-01", "Priya Sharma", 33, "open", "Update README: hosting and database sections are out of date")
    C = b.chat
    C("general", "2026-08-06", "18:00", "Dev Patel", "HackBot repo is up. Anyone who wants to help, grab an issue.")
    C("dev", "2026-08-09", "10:15", "Dev Patel", "We decided to write the bot in Python with discord.py. Final.")
    C("dev", "2026-08-16", "20:40", "Ishaan V.", "Announcement command works. Embeds look good on mobile too.")
    C("dev", "2026-08-30", "11:55", "Dev Patel", "The Discord bot token and application access are only with me, Dev, because it is registered under my personal account.")
    C("dev", "2026-09-01", "14:20", "Dev Patel", "Slash commands are merged. We decided to drop prefix commands completely. Final.")
    C("dev", "2026-09-05", "16:05", "Tanvi Nair", "Reminders fire twice sometimes after a deploy, anyone else seeing this?")
    C("dev", "2026-09-22", "12:10", "Dev Patel", "SQLite file got wiped on deploy again. We decided to move to Postgres on Railway. Final.")
    C("dev", "2026-10-02", "09:30", "Dev Patel", "Heroku free hours are gone. Bot runs on Railway from today, Heroku app can be deleted.")
    C("dev", "2026-10-03", "10:05", "Ishaan V.", "Railway pe deploy ho gaya, logs are clean.")
    C("dev", "2026-10-09", "17:45", "Tanvi Nair", "bot hits Discord rate limit again (429) during the Smart India hackathon announcement")
    C("dev", "2026-10-16", "19:20", "Tanvi Nair", "bot hits Discord rate limit again (429) while announcing to all channels")
    C("dev", "2026-10-24", "13:10", "Ishaan V.", "bot hits Discord rate limit again (429) even with the retry, third time")
    C("dev", "2026-10-18", "21:35", "Dev Patel", "Pushed a temporary workaround for duplicate reminders. Proper fix once the scheduler store is persistent.")
    C("dev", "2026-10-19", "08:50", "Dev Patel", "That hack will bite us when we add more scheduled jobs, left a TODO in scheduler.py.")
    C("dev", "2026-10-21", "15:00", "Priya Sharma", "Is there a plan to monitor uptime? The bot went offline for 3 hours last Sunday.")
    C("dev", "2026-10-21", "15:10", "Dev Patel", "We decided to keep payments out of the bot. Sponsor credits stay with the club treasurer.")
    C("dev", "2026-10-21", "15:12", "Dev Patel", "We decided the bot sends no email. Announcements are Discord only.")
    C("dev", "2026-10-21", "15:15", "Dev Patel", "We decided not to store files in the bot. Attachments stay on Discord only, no storage needed.")
    C("general", "2026-10-28", "12:00", "Dev Patel", "I am graduating soon so I am handing HackBot over to Priya.")
    C("dev", "2026-10-28", "12:05", "Priya Sharma", "Happy to take it. Please list the accounts and tokens I will need.")
    C("dev", "2026-10-29", "18:30", "Dev Patel", "The Railway deploy token is stored in the shared Railway project settings, under my GitHub login.")
    C("dev", "2026-11-02", "11:00", "Dev Patel", "The uptime monitor API key is kept in the shared sheet, and nobody remembers creating that account.")
    C("dev", "2026-10-21", "15:20", "Dev Patel", "We decided the bot needs no user login; permissions come from Discord roles.")
    C("dev", "2026-11-04", "10:20", "Dev Patel", "Review of PR #34: please add tests for the empty-profile case.")
    C("general", "2026-11-06", "16:40", "Tanvi Nair", "Hackathon reminder for Friday posted correctly.")
    b.note("architecture.md", "2026-10-12", "notes", """# HackBot architecture (synthetic)

- **Bot:** Python with discord.py, slash commands only.
- **Hosting:** see the README for the hosting target.
- **Data:** members, teams and reminders are stored in a Postgres database.
- **Scheduler:** APScheduler runs the daily reminder job inside the bot process.""")
    b.note("handover-planning-2026-10-28.md", "2026-10-28", "notes", """# Handover planning, 28 Oct 2026 (synthetic)

Attendees: Dev, Priya, Ishaan, Tanvi.

- Team matching v2 (PR #34) needs another review pass.
- Rate limits during big announcements are still not solved.
- Action: Dev to move the Discord application to the club account before graduating.
- Action: Priya to set up uptime monitoring under the club account.""")
    b.note("sponsor-notes.md", "2026-10-30", "Tanvi Nair", """# Sponsor notes (synthetic)

Sponsor invoices are paid from sponsors@club.example; the treasurer's PAN for the invoices is BCDPE2345G.

Ishaan has been unreliable about answering sponsor emails this month, so Tanvi is covering them for now.""")
    b.note("mentor-notes.md", "2026-11-03", "Prof. Iyer", """# Mentor notes, Prof. Iyer (LEAD ONLY, synthetic)

Candid feedback for the lead only: Ishaan often misses deadlines and needs closer supervision.
Test key sk_test_FAKE_77abcXYZ9876543210 is in the shared sheet. Call me on +91-00000-22222.

(All values above are fake and must never appear in the successor view.)""", "lead_only")
    sources = [("github", "HackBot repo (README, commits, PRs, issues, TODOs)", "ok", "public"),
               ("chat", "Team chat export (#general, #dev)", "ok", "contributor"),
               ("note_architecture.md", "Notes: architecture.md", "ok", "contributor"),
               ("note_handover-planning-2026-10-28.md", "Notes: handover-planning-2026-10-28.md", "ok", "contributor"),
               ("note_sponsor-notes.md", "Notes: sponsor-notes.md", "ok", "contributor"),
               ("note_mentor-notes.md", "Notes: mentor-notes.md — lead only", "ok", "lead_only")]
    return {
        "key": "hackbot", "title": "HackBot", "leaver": "dev", "successor": "priya", "target_date": "2026-11-22",
        "description": "Discord bot that announces hackathons, matches teammates and posts daily reminders for a club server.",
        "team": [{"name": "Dev Patel", "role": "Backend (leaving)"}, {"name": "Priya Sharma", "role": "Successor"},
                 {"name": "Ishaan V.", "role": "Developer"}, {"name": "Tanvi Nair", "role": "Community"},
                 {"name": "Prof. Iyer", "role": "Mentor"}],
        "stack": ["Python", "discord.py", "Railway", "Postgres", "APScheduler"],
        "repo": "binary-coders/hackbot", "builder": b, "sources": sources,
        "demo_task": ("dependencies", "Who owns the Discord application and the Railway project, and how do I take them over?",
                      "Dev owns both under his personal logins. He transfers the Discord application and the Railway project to the club account before 22 Nov; until then Priya has no access."),
    }


PROJECTS = {"clubsite": clubsite, "hackbot": hackbot}
