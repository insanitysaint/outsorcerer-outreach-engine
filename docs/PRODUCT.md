# Outsorcerer Outreach Engine: what we built

This document explains the product end to end: the problem it solves, how it is put together, every feature, the settings, the limits you should know about, and the rules for sending responsibly. If you only want to run it, start with the [README](../README.md).

## 1. The problem

Outsorcerer is a white-label web, UI/UX, SaaS and e-commerce studio that builds for agencies under the agency's own name. The target client is a small or mid-size digital agency that keeps turning down projects because it lacks capacity. The business goal behind the engine is **$5,000 a month in recurring revenue from clients paying at least $1,500**, which is about four clients.

The difficulty is not finding agencies. It is contacting a few of them every day, consistently, at a sensible hour for each one's time zone, following up without nagging, never contacting someone twice, and keeping all of it visible without paying for a SaaS sales platform. The engine does that with free, self-hosted parts.

## 2. How it works, in plain words

You collect leads (by hand, with Perplexity or Gemini, or with a scraper built from the [persona prompt](PERSONA_SCRAPER_PROMPT.md)) and drop them in. The engine cleans them, removes duplicates, looks for a public business email on the company's own website, and gives each lead a **persona-fit score** from 1 to 10. You review the list and approve the leads you want. Every hour the engine asks: whose office is open right now, and how many emails are we still allowed to send today? It picks a balanced batch of high, medium and low scoring leads, sends the first email, waits a few seconds between sends, and writes down what it did. Five days later it sends a second email to anyone who has not replied, and five days after that a third. A reply, a bounce or an opt-out ends that lead's sequence.

The **cockpit** is a single web page that reads and controls all of this without modifying the engine.

## 3. Architecture

```
                 your browser
                      |
          http://localhost:5678/webhook/cockpit
                      |
   +------------------+--------------------------------------------+
   |  n8n 2.x in Docker (one container, SQLite inside a volume)     |
   |                                                                |
   |  03 Cockpit API ---- reads/writes ----> n8n-files/cockpit.json |
   |    UI page, ck-get, ck-op, ck-upload                           |
   |        |   ck-upload posts to the engine's own intake form     |
   |        v                                                       |
   |  01 Engine (6 stages) <---- reads/writes ---> lead_inbox.csv   |
   |    intake, enrich, review, sender,            sent_log.csv     |
   |    replies, follow-ups                                         |
   |        |                                                       |
   |  02 Dashboard (dash-state JSON + legacy page)                  |
   |  04 Reply reader (optional, IMAP, read only)                   |
   |        v                          ^                            |
   +--------|--------------------------|------------------------- --+
            v                          |
       your SMTP server           your IMAP mailbox
       (sends the emails)         (watches for replies)
```

Four workflows are imported, in this order:

| File | Workflow | Job |
|---|---|---|
| `01-engine.json` | Outsorcerer Outreach Engine | The six-stage engine. The only workflow that sends email. |
| `02-dashboard.json` | Outreach Dashboard | Serves `dash-state`, the JSON that the cockpit reads for lead and send statistics, plus the earlier single-page dashboard. |
| `03-cockpit-api.json` | Outsorcerer Cockpit API | Serves the cockpit page and its three endpoints. Stores cockpit data in `cockpit.json`. |
| `04-reply-reader.json` | Cockpit Reply Reader | Optional. Reads the inbox, never sends, never deletes, and saves reply snippets for the cockpit. |

**Design rules that shaped it**

1. **Flat files, no database.** Leads and the sent log are two CSV files you can open in Excel. Cockpit state is one JSON file. Backups are a folder copy.
2. **The cockpit never edits the engine.** It reads the same files the engine writes and, when it must act (approve a lead, pause a campaign), it calls the engine's own public endpoints. The engine does not know the cockpit exists.
3. **Everything optional is switched off safely.** No IMAP details means no reply reader, and the rest still works.
4. **Test mode first.** The default configuration cannot reach a real lead.

## 4. The engine, stage by stage

### Stage 1: Intake
A form at `/form/a79f5960-3a24-424b-8da7-efa7da58aa42` (the cockpit's upload screen posts to it too). Paste a markdown table, CSV or tab-separated text with a header row. The parser recognises many header names (Company, Agency, Website, URL, Email, Contact, Location, Country, Notes, Why fit, Score and others), strips citation marks such as `[1]` that Perplexity adds, extracts the website and email even when they are buried in a cell, and **dedupes** against the existing inbox and against the sent log (by email and by company domain, ignoring free providers such as Gmail). New leads get status `review` or, with no email, `new`.

### Stage 2: Enrich
Runs daily at 09:00 and on demand. For each lead without an email or score (up to 12 per run, politely paced), it loads the company's home, contact and about pages, picks a public business email (same-domain addresses first, named people before generic inboxes), and assigns a **persona score**:

| Signal | Points |
|---|---|
| Starts at | 3 |
| Location in a target market | +2 |
| Site mentions web, app, branding, SEO or similar services | +2 |
| Calls itself an agency, studio or consultancy | +1 |
| Looks like an established team (founder, "since 20xx") | +1 |
| Large network or holding company | -3 |

If your lead sheet already has a `Score` column, that value is used and this step leaves it alone. The rules live in the node **2 Enrich - Find Emails & Score** and are tuned for the original persona (digital agencies in the Gulf, UK, US and similar). To retarget the engine to another type of business, change those patterns, or feed in pre-scored leads from a scraper built from the persona prompt.

### Stage 3: Review
A human checkpoint at `/webhook/lead-review`. Nothing is emailed until you approve it. Each lead can be approved, rejected, set aside or undone, and you can bulk-approve everything at or above a minimum score. The cockpit's Pipeline tab does the same thing with a nicer table.

### Stage 4: Sender
Wakes every hour on the hour (the node name says "weekdays 11:00" for historical reasons; the real timing is the hourly cron plus the office-hours rules). On each wake-up it:

1. Counts what has already gone out today (UTC date) against `DAILY_LIMIT`.
2. Looks at approved leads that have not been emailed.
3. Keeps only leads whose **local office is open**: by default 09:00 to 11:00 local time, Monday to Friday, or Sunday to Thursday in Saudi Arabia, Oman, Qatar, Kuwait, Bahrain and Egypt. The lead's time zone comes from its location text, then its email domain's country code, then `DEFAULT_TZ`.
4. Fills a daily **mix by score**: 2 high (9 to 10), 2 medium (7 to 8), 1 low (6 or less). If a tier is empty its quota passes to the next best tier.
5. Sends one at a time with a few seconds' pause, writes each to `sent_log.csv` and marks the lead `sent`.

In **test mode** it ignores office hours, picks `TEST_COUNT` leads (default 1), redirects the email to `TEST_ADDRESS` with a `[TEST for ...]` subject prefix, and logs nothing.

### Stage 5: Replies
If IMAP is configured, a watcher reads incoming mail. When a message arrives from an address that is in the sent log, that lead is marked `replied` with today's date and its sequence stops. Delivery-failure notices (mailer-daemon, "undeliverable" and similar) that mention a lead's address mark it `bounced` the same way. A "no, please stop" reply counts as a reply, so the person is never emailed again. Replies from a different address than the one you wrote to are not matched by this stage.

### Stage 6: Follow-ups
Runs hourly at :30 and applies the same office-hours rule. Email 2 goes to anyone emailed at least `FOLLOW_UP_1_AFTER_DAYS` (5) ago, Email 3 `FOLLOW_UP_2_AFTER_DAYS` (5) after Email 2, capped at `MAX_FOLLOWUPS_PER_DAY` (10). While `TEST_MODE=true` follow-ups do nothing, so a demo can never email a real lead.

### The default email sequence
Email 1 asks whether the company turned down a project or stretched the team in the last 90 days, makes the point that capacity quietly becomes the ceiling, presents your `OFFER` and asks for a quick call at `BOOKING_LINK`. Email 2 follows up with the starting price and an offer to send a rate card. Email 3 is a polite last note. Each carries a one-line opt-out. The text lives in the two Code nodes **4 Sender - Pick Todays Batch** and **6 Follow-up - Select Follow-up Candidates**; the name, role, company, offer, price, subject and link come from `.env`.

## 5. The cockpit

Open `http://localhost:5678/webhook/cockpit`. It is a single page with a left icon rail, a main area and a notes panel on the right.

| Screen | What it does |
|---|---|
| **Overview** | Headline numbers (sent, sent today, follow-ups, reply rate, queue, awaiting review), a 14-day sends chart split into first emails and follow-ups, a pipeline funnel, a **Campaigns and mailboxes** panel showing which campaign runs on which email account, who is next up and whether their office is open, and a progress card toward the revenue goal. |
| **Pipeline** | A scrolling table (ten leads in view) with status filters, and for each lead the sequence progress: Email 1, 2 and 3 as sent, due or waiting. Approve, reject or undo in place. |
| **Campaigns** | Create, edit, colour, assign a mailbox, **pause and resume** a campaign. See leads, queued, sent and replies per campaign. |
| **Upload leads** | Drag and drop a CSV, TSV or Excel sheet, or paste a table. Map the columns (auto-detected), pick the source, **assign a campaign**, and send it to the engine's intake. Keeps an upload history. |
| **Replies** | Who replied and when, with a text snippet if the reply reader is on. Tag a lead's stage: interested, call, proposal, won, lost. |
| **Settings** | Mailboxes (add placeholder slots), goal in dollars, the pause-all control, a read-only view of the engine's rules, and an **email-copy editor** for drafting new wording. |
| **Notes panel** | Global notes and per-lead notes, with pinning. Stored in `cockpit.json`. Never sent in any email. |

### How campaigns work (read this)

A campaign in the cockpit is a **label plus a control**, not a separate engine. Leads are assigned to a campaign by email or by company domain, with a default rule that sends Gulf locations to one campaign and everything else to the other. The engine still has one sender and one pool, so:

- **Pause** moves that campaign's *queued, approved* leads back to `review` so nothing new goes out; **Resume** approves them again.
- Pausing does **not** stop follow-ups to people already emailed. Those are scheduled by the engine. To stop them, set `FOLLOW_UPS_ENABLED=false` in `.env` and recreate the container.
- "Which campaign is active on which mailbox" is a record in the cockpit. The engine sends from the one mailbox in `.env`. Extra mailbox slots are placeholders until you wire a second SMTP credential into the workflow.

### Why the cockpit is safe to experiment with
It writes only `cockpit.json` and uses the engine's public approve and intake endpoints. If you delete `cockpit.json`, the engine keeps running exactly as before.

## 6. Settings reference

All values come from `.env`. Change them and run `docker compose up -d --force-recreate`.

| Variable | Default | Meaning |
|---|---|---|
| `TEST_MODE` | `true` | `true` redirects every email to `TEST_ADDRESS` and logs nothing. |
| `TEST_ADDRESS` | none | Your own email(s), comma separated. |
| `TEST_COUNT` | 1 | Emails per run in test mode. |
| `SENDER_EMAIL` | none | The From address. Must be allowed by your SMTP account. |
| `SENDER_NAME`, `SENDER_ROLE`, `SENDER_COMPANY`, `SENDER_WEBSITE` | placeholders | Signature. Real sending refuses to start while any contain `[`. |
| `OFFER` | placeholder | Your pitch paragraph. |
| `BOOKING_LINK` | placeholder | Calendar link. |
| `SUBJECT` | The project you had to turn down | Subject for all three emails. |
| `BRAND_NAME`, `STARTING_PRICE` | company, `$150` | Used in Email 2. |
| `DAILY_LIMIT` | 5 | Real first emails per day. Raise slowly. |
| `FOLLOW_UP_1_AFTER_DAYS`, `FOLLOW_UP_2_AFTER_DAYS` | 5, 5 | Gaps. |
| `MAX_FOLLOWUPS_PER_DAY` | 10 | Follow-up cap. |
| `FOLLOW_UPS_ENABLED` | true | Master switch for follow-ups. |
| `RESPECT_OFFICE_HOURS`, `OPEN_HOUR`, `WINDOW_HOURS`, `DEFAULT_TZ` | true, 9, 2, Asia/Dubai | The office-hours window. |
| `SMTP_*`, `IMAP_*` | none | Mailbox connection. |
| `TZ` | UTC | Time zone for the schedules. |

The daily mix (2 high, 2 medium, 1 low) and the location-to-time-zone table are in the sender node's code. Edit them in n8n if you need to.

## 7. Files and ports

| Path | Purpose |
|---|---|
| `http://localhost:5678/webhook/cockpit` | The cockpit |
| `/webhook/lead-review`, `/webhook/lead-decide` | Review page and approve/reject endpoint |
| `/form/a79f5960-3a24-424b-8da7-efa7da58aa42` | Intake form |
| `/webhook/dash-state`, `/webhook/outsorcerer` | Dashboard data and the earlier dashboard page |
| `/webhook/ck-get`, `/webhook/ck-op`, `/webhook/ck-upload` | Cockpit API |
| `n8n-files/` on your machine | The CSV and JSON data files |

## 8. Limits and known behaviour

- **Reachability.** The cockpit and webhooks are open on your machine's port 5678 with no login. That is fine on a laptop. Do not expose the port to the internet. If you host it on a server, put it behind a VPN or an authenticating reverse proxy first.
- **One mailbox sends.** Multi-mailbox rotation is not built in yet.
- **UTC day.** "Today" for the daily limit is the UTC date.
- **Enrichment is polite, not magic.** It reads only public pages on the lead's own site, 12 leads per run. Sites that block bots or hide their email give `no_email`.
- **Persona rules are baked in.** The 1 to 10 scoring is tuned for digital agencies. Pre-score leads in your own tool for any other audience.
- **Replies.** The engine stops a sequence only when the reply comes from the exact address it emailed. The cockpit's reply reader is more forgiving (it also matches by company domain) and only shows a clipped snippet. Both need IMAP.
- **Soft pause.** Described above. It protects the queue, not the follow-ups.
- **Copy editor.** The cockpit can store drafts of new wording, but it does not push them into the engine. You paste the final text into the n8n Code node yourself.
- **Time zones.** The location table covers the Gulf, Egypt, UK, India, Germany, Poland, Pakistan and the US (assumed Eastern). Other places use the email domain's country code, then `DEFAULT_TZ`.
- **Scale.** Built for a handful of emails a day, not thousands.

## 9. Compliance and deliverability

This is a tool, and you are the sender. A few habits keep you out of trouble and out of spam folders.

- **B2B only.** Email business addresses of companies you have a legitimate reason to contact. Do not use it for consumers.
- **Know your rules.** CAN-SPAM (US) requires accurate sender details, a real postal address in the footer and an honoured opt-out. GDPR and PECR (UK and EU) treat addresses of identifiable individuals as personal data even at work, so rely on a documented legitimate interest, make opting out easy and keep records. Canada's CASL and other countries differ again. This is general information, not legal advice. Check the law where your recipients are.
- **Honour opt-outs fast.** Each email says to reply "no". When someone does, mark them replied or rejected in the cockpit so they are never contacted again.
- **Authenticate your domain.** Set up SPF, DKIM and DMARC before the first real send. Send from a mailbox on your own domain, not your main one if you can avoid it.
- **Warm up.** Start at 5 a day for two weeks and raise slowly. Keep sending hours human.
- **No purchased lists.** Use public business sources and your own research.

## 10. Roadmap ideas

- Mailbox rotation and per-campaign copy.
- A Test mode indicator in the cockpit header.
- Push edited email copy from the cockpit into the engine.
- Scraper output posted straight to `ck-upload` (see the persona prompt).
- A hosted version of the cockpit behind login.
