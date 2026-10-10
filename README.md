# Outreach Engine

A free, self-hosted cold-outreach "agent" that runs inside [n8n](https://n8n.io) on your own computer.
It does five jobs for you:

1. **Takes in leads** you paste from Perplexity or Gemini (and skips duplicates).
2. **Finds contact emails** on each agency's own website and scores how well they fit.
3. **Stops and waits for you** on a Review page. Nothing is emailed until you click **Approve**.
4. **Sends up to 10 emails a day** (weekdays) to approved leads only.
5. **Watches your inbox** for replies and bounces, and sends a polite follow-up to people who stayed quiet.

Everything lives in **one workflow** with six labelled sections. No paid tools are needed.

> Not legal advice: only email real businesses, keep the opt-out line in every email, and respect
> the laws where you and your leads live (CAN-SPAM, GDPR/PECR, etc.).

---

## Part 1 - One-time setup (about 30 minutes)

### Step 1. Install Docker Desktop
Docker is a free app that runs n8n in a safe box on your computer.
1. Go to <https://www.docker.com/products/docker-desktop> and download it for your computer.
2. Install it, open it, and wait until it says **Engine running** (bottom-left, green).

### Step 2. Get this project
1. On this GitHub page click the green **Code** button, then **Download ZIP**.
2. Unzip it somewhere easy, for example `Documents\outreach-engine`.
   You should see the files `docker-compose.yml`, `README.md` and the folders `workflows`, `starter-files`.

### Step 3. Put the two starter files in place
1. Open the folder `starter-files`.
2. **Copy** `lead_inbox.csv` and `sent_log.csv`.
3. **Paste** them into the folder called `n8n-files` (it is next to `docker-compose.yml`).

These two files are the engine's memory: `lead_inbox.csv` is your list of leads and where each one
stands, `sent_log.csv` is who has been emailed. They stay on your computer only.

### Step 4. Start n8n
1. Open the project folder. In the address bar at the top of the window type `cmd` and press **Enter**
   (a black window opens already inside the folder).
2. Type this and press **Enter**:
   ```
   docker compose up -d
   ```
3. Wait about a minute, then open <http://localhost:5678> in your browser.
4. The first time, n8n asks you to create an owner account. Make one and **write the password down**.

> Tip: the timezone is set at the top of `docker-compose.yml` (`TZ=`). Change `UTC` to yours
> (for example `Asia/Calcutta` or `Europe/London`) **before** step 4 so "11:00" means your 11:00.

### Step 5. Load the agent into n8n
1. In n8n click **Workflows** (left side), then **Create workflow**.
2. Click the **three dots `...`** at the top, then **Import from file**.
3. Choose `workflows/outreach-engine.json` from this project.
4. You will see six boxes of nodes, each with a green note on top: **1 Intake, 2 Enrich,
   3 Review, 4 Sender, 5 Replies, 6 Follow-up**. Press **Ctrl+S** to save.

### Step 6. Connect your email (so it can send and read replies)
You need two "credentials" in n8n. Nodes with a red warning triangle are the ones that need them.

**Sending (SMTP).** Click the red node called **Send Email (SMTP)** in section 4, then
**Credential to connect with > Create new credential**:

| Field | Zoho Mail (India) | Zoho Mail (global) | Other provider |
|---|---|---|---|
| Host | `smtppro.zoho.in` | `smtp.zoho.com` | ask your provider |
| Port | `587` | `587` | usually 587 |
| SSL/TLS switch | **off** | **off** | off for 587, on for 465 |
| User | your full email address | same | same |
| Password | an **app password** (see below) | same | same |

**Reading (IMAP).** Click the red node **On New Email (IMAP)** in section 5, then create a credential:

| Field | Zoho Mail (India) | Zoho Mail (global) |
|---|---|---|
| Host | `imappro.zoho.in` | `imap.zoho.com` |
| Port | `993` | `993` |
| SSL/TLS switch | **on** | **on** |
| User / Password | same as above | same as above |

**What is an app password?** A special one-time password for apps, safer than your real one.
In Zoho: *My Account > Security > App Passwords > Generate*. Paste that, not your normal password.
Never share it and never put it in this project's files.

Last, in **section 4** (node *Send Email*) and **section 6** (node *Send Follow-up Email*), set
**From Email** to your own sending address (they currently say `you@your-domain.com`).

### Step 7. Fill in who you are
1. In section **4 Sender**, double-click the node named **Pick Todays Batch (EDIT SETTINGS)**.
2. At the very top you will see lines like these. Change what is inside the quotes:
   ```
   const TEST_MODE = true;       // leave TRUE for now
   const TEST_ADDRESS = '';      // put YOUR OWN email here, e.g. 'me@gmail.com'
   const SENDER_NAME = '[YOUR NAME]';
   const SENDER_ROLE = '[YOUR ROLE]';
   const SENDER_COMPANY = '[YOUR COMPANY]';
   const SERVICE_LINE = '[ONE SENTENCE: what your team does...]';
   const OFFER = '[ONE-SENTENCE OFFER: ...]';
   ```
3. Click **Save**. The engine **refuses to email real leads** while any `[BRACKETS]` are left
   or while `TEST_MODE` is true, so you cannot send a half-finished email by accident.

### Step 8. Publish the workflow
Click **Publish** (older n8n versions: the **Active** switch) at the top right.
This turns on the schedules and the Review page. It does **not** send anything yet, because
`TEST_MODE` is on and nothing has been approved.

> Heads-up: once published, section 5 reads your inbox and marks new mail as read.

---

## Part 2 - Every day (like brushing your teeth)

### Step 1. Get leads
Open Perplexity or Gemini and use a prompt from [`docs/prompts.md`](docs/prompts.md). Copy the table it gives you.

### Step 2. Paste them in
1. In n8n, double-click the first node of section 1 (**Lead Intake Form**) and copy its **Production URL**.
2. Open that link in your browser. Choose where the leads came from, paste the table, press **Submit**.
3. Try it first with the sample in `starter-files/example-paste.txt`.

The engine reads the table, throws away duplicates, and saves new leads. (Leads that two tools both
found are tagged **both**, the best ones.)

### Step 3. Let it look up emails
Section 2 runs by itself every morning at 09:00. It visits each new lead's website, finds a public
contact email and gives a fit score from 1 to 10. Want it now? Click **Run Manually** in section 2.

### Step 4. YOU decide who gets emailed (the safety checkpoint)
1. Open <http://localhost:5678/webhook/lead-review>
2. You see leads with the best fit first. Click **Approve** or **Reject** on each one,
   or use the bulk buttons such as **Approve all score 8+**.
3. Approved leads join the sending line. Nothing else will ever be emailed.

### Step 5. Emails go out by themselves
Section 4 runs on weekdays at 11:00 and sends **at most 10** emails per day to approved leads,
best score first, and writes each one into `sent_log.csv`.

### Step 6. Replies and follow-ups
- A reply stops follow-ups to that person. A reply of "no" means: never contact them again.
- A bounce (bad address) is marked so it is never emailed again.
- Follow-ups are **off** until you turn them on (see "Going live", step 4).

---

## Going live (do this once, carefully)

1. **Test email.** Keep `TEST_MODE = true` and your own address in `TEST_ADDRESS`. Approve 2 leads on the
   Review page. In section 4 hover over the **Weekdays 11:00** node and click the little **play** button.
   Check your inbox: you should get 2 emails marked `[TEST for ...]`. Nothing was sent to the real leads.
2. **Read them.** Fix the wording until you would be happy to receive it.
3. **Turn on real sending.** In the same node set `TEST_MODE = false`. Save. Start with a small
   number of approvals so the first days are small (new sending addresses need a gentle start).
4. **Turn on follow-ups.** In section 6 open **Select Follow-up Candidates**, set
   `FOLLOW_UPS_ENABLED = true`, then open **Send Follow-up Email** and write your own follow-up text.
5. Check `sent_log.csv` and your inbox each morning for the first week.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Page `localhost:5678` will not open | Docker/n8n is off | Open Docker Desktop, wait for "Engine running", try again |
| Review page says it is not registered | Workflow not published | Click **Publish** (Step 8) |
| Red triangle on an email node | Credential missing | Step 6 |
| Error "TEST_MODE is on: set TEST_ADDRESS" | You have not typed your test address | Step 7 |
| Error "Fill in SENDER_NAME..." | Brackets are still in the settings | Step 7 |
| "Could not find a table" when pasting | The first line must be column names | Ask for the table format in `docs/prompts.md` |
| n8n logged you out | Normal after a restart | Sign in again; your workflow is still there |
| Nothing is sent | No approved leads, weekend, or already sent 10 today | Approve more leads on the Review page |

Stop everything: `docker compose down` in the project folder. Start again: `docker compose up -d`.

---

## Part 3 - Share it with your peers through GitHub

GitHub is a free website where you keep a project and let other people download it.

### What is safe and what is NOT
- **Safe to share:** everything in this folder as you downloaded it (workflow, starter files, guide).
- **Never share:** the folder `n8n-data` (it holds your passwords and encryption key) and any real
  `.csv` inside `n8n-files` (your leads and who you emailed). The included `.gitignore` file blocks
  these automatically if you use Option A below.

### Option A - GitHub Desktop (recommended, protects you from mistakes)
1. Make a free account at <https://github.com>.
2. Install **GitHub Desktop** from <https://desktop.github.com> and sign in.
3. In GitHub Desktop: **File > Add local repository** and choose the project folder. If it says
   "not a git repository", click **create a repository** there instead.
4. Look at the list of changed files on the left. You must **not** see `n8n-data` or any real CSV
   from `n8n-files`. (Seeing `starter-files/*.csv` is fine, they are empty.)
5. Type `First version` in the box, click **Commit to main**, then **Publish repository**.
6. In the pop-up **tick "Keep this code private"** if you only want certain people to see it.

### Option B - Upload on the GitHub website
1. On github.com click **+ > New repository**. Name it, choose **Private** (or Public), click **Create**.
2. Click **uploading an existing file**.
3. Drag in only: `docker-compose.yml`, `README.md`, `.gitignore` and the folders `workflows`,
   `starter-files`, `docs`. **Do not drag `n8n-data` or `n8n-files`.**
4. Click **Commit changes**.

### Let your peers in
- **Private repository:** *Settings > Collaborators > Add people*, type their GitHub username or email.
- **Public repository:** just send them the link. Anyone can download it.

### What your peer does
1. Opens your repository link, clicks **Code > Download ZIP**, unzips it.
2. Follows **Part 1** of this guide with **their own** email, name and offer. They get their own
   private copy; they never see your leads or passwords.
3. They should use their own sending address and a prompt written for their own services.

### Updating the shared version later
In n8n open the workflow, click **... > Download**, replace `workflows/outreach-engine.json`
(before sharing, search it for your own email address and website and replace them with the
placeholders), then in GitHub Desktop commit and click **Push origin**. Tell your peers to download the new ZIP
and re-import the workflow (Part 1, Step 5).
