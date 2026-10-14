# Outsorcerer Outreach Engine: Docker starter kit

A self-hosted cold-outreach engine you run on your own computer. You paste in a list of businesses, review and approve the ones you like, and the engine emails them a few a day, **only while their office is open**, follows up twice, and stops the moment someone replies. A browser **cockpit** on top shows everything at a glance and lets you upload lead sheets, group leads into campaigns, pause them and keep notes.

It runs on [n8n](https://n8n.io) inside Docker. Nothing is sent to us or anyone else: your leads, your sent log and your mailbox password stay on your machine.

> **Safe by default.** The kit starts in `TEST_MODE=true`. In test mode every email goes only to *your own* test address, and nothing is recorded as sent. You must change one line in `.env` before it can email a real person.

What's inside, in one paragraph each:

- **Engine** (`workflows/01-engine.json`): six stages, from intake to follow-ups. See [docs/PRODUCT.md](docs/PRODUCT.md).
- **Cockpit** (`workflows/03-cockpit-api.json` plus `seed/cockpit_ui.html`): the front end at `http://localhost:5678/webhook/cockpit`.
- **Reply reader** (`workflows/04-reply-reader.json`): optional, read-only mailbox reader so replies show up in the cockpit.
- **Persona lead-scraper prompt** ([docs/PERSONA_SCRAPER_PROMPT.md](docs/PERSONA_SCRAPER_PROMPT.md)): a ready-made prompt to build (or have an AI build) a tool that finds leads matching a persona and hands them to this engine.

---

## 1. What you need

1. **Docker Desktop** (Windows, Mac or Linux): <https://www.docker.com/products/docker-desktop/>. Open it once and wait until it says it is running.
2. **A mailbox that can send by SMTP**, ideally on a domain you own (Zoho Mail, Google Workspace, Microsoft 365, Fastmail and similar all work). Gmail works with an *app password*.
3. About ten minutes.

You do **not** need to know n8n.

## 2. Start it (five steps)

```bash
# 1. Get the kit
git clone https://github.com/insanitysaint/outsorcerer-outreach-engine.git
cd outsorcerer-outreach-engine

# 2. Create your settings file
cp .env.example .env            # Windows PowerShell:  Copy-Item .env.example .env

# 3. Edit .env in any text editor (see the table below, five minutes)

# 4. Start
docker compose up -d

# 5. Open the cockpit
#    http://localhost:5678/webhook/cockpit
```

The first start takes a minute or two while Docker downloads n8n. Watch it come up with `docker compose logs -f` (look for `[kit] ready`).

You will also see n8n itself at <http://localhost:5678>. The first time you open it, n8n asks you to create an owner account. That account is local to your machine; use any email and password. You only need n8n's editor if you want to look inside the workflows. The cockpit works without it.

### The `.env` values that matter

| Setting | What to put |
|---|---|
| `TEST_MODE` | Leave `true` until you have tested. `false` means real emails to real leads. |
| `TEST_ADDRESS` | Your own address. All test emails land here. |
| `SENDER_EMAIL`, `SENDER_NAME`, `SENDER_ROLE`, `SENDER_COMPANY`, `SENDER_WEBSITE` | How the email is signed. |
| `OFFER` | One or two sentences about who you are and what you sell. |
| `BOOKING_LINK` | Your Cal.com / Calendly link. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Your sending mailbox. |
| `IMAP_HOST` (optional) | Fill in to switch on reply detection. Leave blank to skip. |
| `DAILY_LIMIT` | Real emails per day. Start at 5. |
| `TZ` | Your timezone, e.g. `Asia/Kolkata`. |

After editing `.env` at any time: `docker compose up -d --force-recreate`.

## 3. Take the tour (10 minutes, still in test mode)

1. Open the **cockpit**. You will see eight made-up demo leads (all on `.example` addresses that cannot receive mail).
2. Go to **Pipeline**. Three demo leads are already approved. Approve or reject others.
3. Go to **Upload leads**. Drop a CSV, or paste a table like this one, pick a campaign, and click add:

   ```
   | Company | Website | Public Email | Location | Notes |
   |---|---|---|---|---|
   | Example Studio | https://example-studio.com | hello@example-studio.com | Dubai, UAE | Small web studio |
   ```

4. Make something send: open n8n at <http://localhost:5678>, open **Outsorcerer Outreach Engine**, click the node **4 Sender - Weekdays 11:00**, then **Execute workflow**. (On its own the sender wakes up every hour, on the hour, and sends only to leads whose office is open. Test mode skips the office-hours rule so you do not have to wait.)
5. Check your `TEST_ADDRESS` inbox. You should see an email marked `[TEST for ...]`. Nothing is logged as sent, so you can repeat this as often as you like.
6. Back in the cockpit, try **Campaigns** (create one, pause it), the **Notes** panel on the right, and **Settings**.

## 4. Going live

Only when you are happy with the test email and your DNS is set up (SPF, DKIM and DMARC for your sending domain):

1. In `.env` set `TEST_MODE=false`, keep `DAILY_LIMIT=5` for the first couple of weeks, and make sure `OFFER`, `BOOKING_LINK` and the `SENDER_*` lines are filled in (the engine refuses to send real emails while they contain `[placeholders]`).
2. `docker compose up -d --force-recreate`
3. Approve leads in the cockpit. Each weekday hour, the engine checks whose office is open and sends up to your daily limit. Email 2 follows after 5 days and Email 3 after 5 more, unless the person replied.

Read the compliance notes in [docs/PRODUCT.md](docs/PRODUCT.md#compliance-and-deliverability) first. This engine is for **B2B** outreach to business addresses, with a visible opt-out.

## 5. Where your data lives

Everything you create is in plain files in the `n8n-files/` folder next to `docker-compose.yml` (the start-up script fills it on first run; its contents are never uploaded to GitHub):

| File | Holds |
|---|---|
| `lead_inbox.csv` | Every lead and its status (review, approved, sent, rejected, no_email) |
| `sent_log.csv` | Who was emailed, when, follow-ups, replies |
| `cockpit.json` | Campaigns, notes, assignments, settings from the cockpit |
| `cockpit_replies.json` | Reply snippets from the optional reply reader |

n8n's own database (workflows and your SMTP/IMAP credentials, encrypted) lives in a Docker volume called `outsorcerer-outreach-engine_n8n_data`.

## 6. Everyday commands

```bash
docker compose up -d                    # start
docker compose stop                     # stop, keeps everything
docker compose logs -f                  # watch the log
docker compose up -d --force-recreate   # apply .env changes
git pull && docker compose up -d --force-recreate   # update the kit (see note)
```

**Updating:** when the kit's workflows change, they are re-imported on the next start, which replaces any edits you made to those workflows inside n8n. Your leads, sent log, cockpit data and credentials are never touched. Want to start completely clean? `docker compose down -v` and delete `n8n-files/` (this deletes your data).

## 7. If something does not work

| Symptom | Fix |
|---|---|
| Cockpit page says "cockpit_ui.html not found" | Run `docker compose logs` and look for `[kit]` lines. The start-up script copies it into `n8n-files/` on every start. |
| Test run fails with "set TEST_ADDRESS" | Put your address in `TEST_ADDRESS` in `.env`, then `docker compose up -d --force-recreate`. |
| Test run fails with an SMTP or authentication error | Check `SMTP_HOST`, `SMTP_PORT` (465 with `SMTP_SECURE=true`, or 587 with `false`) and the password. Gmail needs an app password. |
| "Access to the file is not allowed" | You moved the compose file or changed the volumes. Keep `./n8n-files:/home/node/.n8n-files`. |
| Replies never show up | Set `IMAP_HOST` (and IMAP user/password if different), recreate the container, then look at the cockpit's Replies tab. |
| Linux only: "permission denied" in `n8n-files/` | The container runs as user 1000. Run `sudo chown -R 1000:1000 n8n-files` once. |
| Port 5678 already in use | Set `N8N_PORT=5679` in `.env` and use that port in all the links. |
| Nothing sends in live mode | Leads must be **approved**, their office must be open (09:00–11:00 local, weekdays or Sun–Thu in the Gulf), and the daily limit must not be used up. The Overview tab's "Next up" list shows who is waiting. |

## 8. Safety rules baked in

- `TEST_MODE` defaults to **true**; flipping it is a deliberate act.
- The engine will not send real emails while the sender fields are still placeholders.
- Daily cap, per-tier quota (2 high / 2 medium / 1 low score) and office-hours window limit your volume.
- A reply, bounce or opt-out stops that lead's sequence.
- Passwords are read from `.env` once at start-up and stored encrypted inside n8n. `.env` and `n8n-files/` are git-ignored.

## 9. Credit

Built by Saurav Vyas (Insanitysaint). n8n is © n8n GmbH under its own [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md); this kit only configures it. You are responsible for how you use this tool and for the laws that apply to your outreach.
