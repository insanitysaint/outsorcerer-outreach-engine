# Persona-based lead scraping: the prompt pack

The outreach engine is only as good as the leads you feed it. This pack gives you three things:

1. A **persona brief** template that forces you to say exactly who you are looking for.
2. **Prompt A**, a research prompt for Perplexity, Gemini or ChatGPT that returns leads in the exact table format the engine's intake understands. No coding.
3. **Prompt B**, a builder prompt you can give to Claude Code, Cursor, ChatGPT or any coding assistant to build your own **persona-driven lead scraping tool** that finds businesses, checks them against your persona, scores them 1 to 10, and posts them straight into the engine.

It works for any business that sells to other businesses: agencies, SaaS, clinics, logistics, accounting, recruiting. The worked example at the end is the original Outsorcerer persona, and a second example shows how to retarget it.

Everything below is built around **public business information and respectful crawling**. The guardrails in Part 5 are part of the prompt on purpose. Keep them.

---

## Part 1: how a lead flows into the engine

```
persona brief --> Prompt A (research)   --\
              \-> Prompt B (your tool)  ---+--> table or CSV --> cockpit "Upload leads" --> review --> send
```

The engine's intake accepts a markdown table, CSV or tab-separated text with a header row. Recognised columns (any order, many spellings):

| Column | Meaning |
|---|---|
| `Company` | Business name |
| `Website` | Home page URL |
| `Email` | A public business email. Leave blank if none found (the engine will try its own lookup) |
| `First Name` | Contact's first name if publicly shown on the site. Optional |
| `Location` | City, country. Drives the send time zone, so be specific ("Dubai, UAE") |
| `Notes` | One line on why they fit. Shown in the review page |
| `Score` | Persona-fit score 1 to 10. If present the engine keeps it |

Score bands the engine uses for its daily mix: **9 to 10 = high, 7 to 8 = medium, 6 or below = low**. A good scraper produces a spread, not a wall of 9s.

---

## Part 2: write the persona brief first

Copy this, fill every line, keep it to one page. Both prompts below take it as input. A vague persona gives you vague leads.

```text
PERSONA BRIEF
Name of this persona: {{e.g. "Capacity-squeezed boutique web agency"}}

WHAT I SELL
- Offer in one sentence: {{...}}
- Typical deal size and what the buyer gets: {{...}}
- Why a business would say yes (the pain I remove): {{...}}

WHO BUYS (the company)
- Business type / industry: {{...}}
- Size band (people or revenue): {{e.g. 3 to 30 staff}}
- Geographies to include: {{countries / cities}}
- Geographies to exclude: {{...}}
- Languages the website is likely in: {{...}}
- Stage or maturity signals: {{e.g. founded 2+ years ago, active in the last 6 months}}

WHO DECIDES (the person, from public pages only)
- Titles that decide: {{Founder, Managing Director, Head of Delivery}}
- Titles to avoid: {{HR, Recruiter, Intern}}

BUYING SIGNALS (things visible on their public site that raise the score)
1. {{e.g. lists web or app development as a service}}
2. {{e.g. portfolio shows they subcontract or "partner" work}}
3. {{e.g. recent job posts for developers, hinting capacity strain}}
4. {{...}}

DISQUALIFIERS (drop the lead completely)
- {{e.g. large networks or holding companies}}
- {{e.g. direct competitors that sell the same service white-label}}
- {{e.g. sites that are parked, dead, or under construction}}
- {{e.g. already a client, or already in my sent log}}

SCORING RUBRIC (total 10)
- Right geography: up to {{2}} points
- Right business type and services: up to {{3}}
- Size band fits: up to {{2}}
- Buying signals present: up to {{2}}
- Reachable via a public business email: {{1}}

VOLUME
- Leads wanted per run: {{50}}
- Minimum score to keep: {{5}}
```

---

## Part 3: Prompt A, the no-code research prompt

Paste into Perplexity (Pro search), Gemini Deep Research or ChatGPT with browsing. Replace `{{PERSONA_BRIEF}}` with your filled brief.

````text
You are a B2B lead researcher. Find businesses that match the persona below and return them as ONE markdown table, nothing else before or after it.

PERSONA BRIEF:
{{PERSONA_BRIEF}}

RULES
1. Use only publicly available business information from the company's own website, official directories or reputable public listings. Do not use paywalled databases, leaked data, or social-media scraping.
2. Email: include an address only if you SAW it published on the company's own public website or a public business listing. Prefer role addresses (info@, hello@, contact@) or a decision-maker's published business address. NEVER guess, construct or pattern-match an address. If you did not see one, leave the cell empty.
3. First Name: only if the site names a decision-maker. Otherwise empty.
4. Every row must pass the disqualifiers. If unsure, leave the business out.
5. Check each company is real and active (site loads, recent activity). Do not include duplicates, or two offices of the same company.
6. Do not invent anything. If you cannot find 50 good leads, return fewer.
7. Score each lead 1 to 10 using the scoring rubric. Use the full range honestly. A lead that is only a partial fit should score 5 or 6, not 9.
8. Notes: one short sentence, evidence-based ("Lists web development and app development; team of about 12; Dubai office").

OUTPUT FORMAT (exactly these columns, in this order):

| Company | Website | Email | First Name | Location | Notes | Score |
|---|---|---|---|---|---|---|

After the table, on a new line, write: "Sources used:" followed by the domains you relied on. Do not add citation markers inside the table cells.
````

**What to do with the result:** open the cockpit, **Upload leads**, paste the table (or save it as CSV and drop it), set Source to *Perplexity* or *Gemini*, pick a campaign and add. Review in **Pipeline** before approving anything.

---

## Part 4: Prompt B, build the persona scraping tool

Give this whole block to a coding assistant (Claude Code works well) in an empty folder. It is written as a spec with acceptance tests so the assistant knows when it is done.

````text
Build a command-line tool called "persona-scout": a persona-driven B2B lead finder and scorer. It reads a persona file, finds candidate businesses from lawful public sources, visits each candidate's own public website, extracts only public business facts, scores fit against the persona, and outputs a CSV the "Outreach Engine" can ingest. Use Python 3.11+, standard packages (httpx, selectolax or BeautifulSoup, pydantic, typer, tldextract, pyyaml, tenacity), SQLite for caching, and pytest. No browser automation unless a site truly needs it.

## 1. Inputs
persona.yaml with this schema (validate with pydantic, fail with a readable message):
  name, offer, target: {industries[], include_geos[], exclude_geos[], size_band: {min_people, max_people}, languages[]},
  deciders: {titles_include[], titles_exclude[]},
  signals: [{id, description, keywords[] or regex, weight}],
  disqualifiers: [{id, description, keywords[] or regex or domains[]}],
  rubric: {geography, business_type, size, signals, reachable}   # integer points summing to 10
  volume: {max_leads, min_score}
  sources: list of enabled source adapters with their settings
  contact_policy: {allow_role_emails: true, allow_named_emails: true, never_guess: true}
Also accept --suppress path/to/sent_log.csv and --inbox path/to/lead_inbox.csv: anything whose email or company domain appears there is dropped before any crawling.

## 2. Source adapters (pluggable, each in its own module, each respecting the provider's terms)
Implement a common interface `discover(persona) -> Iterator[Candidate{name, website, location_hint, source}]` and ship these adapters:
 a) `search`: queries a search API you are licensed to use (Brave Search API, or Google Programmable Search, or a self-hosted SearXNG). Generate queries from the persona: "{industry} agency in {city}", "{service} studio {country}", etc. Read the API key from an environment variable. Never scrape a search engine's HTML results page.
 b) `osm`: OpenStreetMap Overpass API for businesses by category and bounding box (free, open data).
 c) `places`: Google Places API (official, needs a key) as an optional adapter.
 d) `csv_seed`: load candidates from a CSV a human compiled.
 e) `directory`: a generic adapter that reads a directory's public listing pages ONLY where the site's robots.txt and terms allow automated access; ship it disabled by default with a clear comment, and never implement login-walled or anti-bot-protected sources.
Do NOT build adapters for LinkedIn, Facebook, Instagram or X, and do not use any scraping service that bypasses blocks or paywalls.

## 3. Polite crawler
 - Fetch robots.txt per host, cache it, obey Disallow and Crawl-delay. If robots.txt forbids a path, skip it.
 - Identify honestly: User-Agent "persona-scout/1.0 (+contact: {{YOUR_EMAIL}})".
 - Max 1 request per second per host, global concurrency 4, timeout 8s, retries with exponential backoff, stop on 403/429 for that host.
 - Visit only: "/", "/contact", "/contact-us", "/about", "/about-us", "/team", "/services" (plus the first same-host links whose text matches those words). Max 6 pages per site, 300 KB per page.
 - Cache every response in SQLite for 14 days to avoid repeat hits. Add --refresh to bypass.
 - Never submit forms, log in, solve CAPTCHAs, or follow links off the candidate's own domain.

## 4. Extraction (deterministic first)
From the pages collected, extract with plain parsing:
 - company_name (from <title>, og:site_name, schema.org Organization), website (canonical origin), location (schema.org address, footer address, or the location hint), languages (html lang).
 - emails: only addresses that literally appear on the page or in a mailto: link. De-obfuscate common patterns ("name [at] domain"). Drop image filenames, tracking domains and obviously fake addresses. Classify each as role (info@, hello@, contact@, sales@...) or named. Keep at most 2 per company, same-domain first. NEVER guess, derive, or SMTP-probe addresses. Check syntax and that the domain has MX records, nothing more.
 - first_name: only if a person with a title in titles_include is named on the page in a clear "Name, Title" pattern, and the title is not in titles_exclude. Otherwise empty.
 - signals: for each signal in the persona, record whether it was found and the exact evidence snippet (max 120 chars) and the URL.
 - size hint: parse "team of N", team page headcount, or leave unknown.
 - disqualifier hits: any match drops the candidate and logs the reason.
Optional LLM step (behind --llm flag, provider and key from env): send ONLY the extracted text snippets and the persona to a language model and ask it to (a) confirm the business type, (b) judge signals that keywords cannot, (c) write the one-line Notes. The model must return JSON that you validate; it may not add facts that are not in the snippets. The tool must run fully without --llm.

## 5. Scoring
Compute the score deterministically from the persona rubric:
 geography points + business_type points + size points + signals points + reachable points = score out of 10, rounded.
Store a "score_breakdown" JSON per lead and print it with --explain. Calibrate so scores spread across 4 to 10; add a unit test that fails if more than 40% of a sample set scores 9 or above. Drop anything below volume.min_score and cap output at volume.max_leads, highest score first, but never more than 3 per city per run to avoid clumping.

## 6. Outputs
 - leads.csv with EXACTLY these columns in this order: Company,Website,Email,First Name,Location,Notes,Score
 - leads.md: the same data as a markdown table (the engine accepts either).
 - report.json: counts per stage (discovered, suppressed, crawled, disqualified with reasons, scored, kept), time taken, hosts blocked by robots.txt.
 - Notes is one sentence of evidence, e.g. "Lists web and app development; team page shows about 12 people; Dubai office".
 - Command `persona-scout post leads.csv --engine http://localhost:5678 --source Directory` that POSTs JSON {"source":"Directory","text":"<contents of leads.md or csv>"} to {engine}/webhook/ck-upload. This lands the leads in the review list; it never approves or sends anything. Add --dry-run.

## 7. CLI
 persona-scout run persona.yaml --out out/ [--suppress sent_log.csv --inbox lead_inbox.csv] [--llm] [--explain] [--limit N]
 persona-scout validate persona.yaml
 persona-scout post out/leads.csv --engine URL --source Directory [--dry-run]

## 8. Compliance guardrails (hard requirements, put them in the README too)
 - Public business information only. No personal social profiles, no scraping behind logins, no purchased or leaked data.
 - Respect robots.txt and each site's terms. No evasion of rate limits, blocks or CAPTCHAs, no rotating proxies or fake user agents.
 - Never guess or verify email addresses by probing mail servers.
 - Do not collect anything about private individuals beyond a business contact name and title that the company itself publishes.
 - Keep a local audit log (hosts visited, timestamps) and a delete command that removes a company by domain from all caches and outputs.
 - Print a reminder at the end of every run that the user must follow CAN-SPAM, GDPR/PECR, CASL and local rules when emailing, include an opt-out, and honour it.

## 9. Quality bar and tests
 - pytest suite with recorded HTML fixtures (no live network in tests): robots.txt obeyed, email de-obfuscation, no guessed emails, role vs named classification, disqualifier drop, score spread test, CSV column order test, suppression-list test, ck-upload payload shape test.
 - A `demo` command that runs end to end against bundled fixtures and prints a small result table.
 - Type hints, ruff clean, a README with install, persona authoring guide, and a worked example persona.
 - Stop and ask me before adding any new data source I did not list.

Deliver: the repository, a short architecture note, and the output of `pytest` and `persona-scout demo`.
````

### How to use the tool you build

1. Write `persona.yaml` from your brief (Part 2). Start with 20 hand-picked companies you *know* are good and bad fits, run `--explain`, and adjust weights until the good ones score 8+ and the bad ones fall below 6.
2. Run `persona-scout run persona.yaml --out out/ --suppress n8n-files/sent_log.csv --inbox n8n-files/lead_inbox.csv`.
3. Look at `leads.md` yourself. Delete anything you would not email.
4. `persona-scout post out/leads.csv --engine http://localhost:5678 --source Directory`, or upload the CSV in the cockpit and assign a campaign.
5. Review in the cockpit's **Pipeline** and approve. Start with `TEST_MODE=true`.

---

## Part 5: the guardrails, in one page

| Do | Do not |
|---|---|
| Use the company's own public pages and open data (OpenStreetMap, official APIs) | Scrape LinkedIn, Facebook, Instagram or X, or sites behind a login |
| Obey robots.txt, crawl delays and site terms | Rotate proxies, fake user agents or defeat CAPTCHAs |
| Keep emails you actually saw published | Guess addresses (first.last@) or probe mail servers to "verify" them |
| Target business roles and business addresses | Collect personal or consumer data |
| Suppress anyone already contacted or who opted out | Re-add opted-out people because a new scrape found them again |
| Say who you are and offer an easy opt-out in every email | Hide the sender or use misleading subjects |

Laws differ by country (CAN-SPAM in the US, GDPR and PECR in the UK and EU, CASL in Canada and others). This pack is general information, not legal advice.

---

## Part 6: worked example, the original Outsorcerer persona

Filled brief you can paste straight into Prompt A or turn into `persona.yaml` for Prompt B:

```text
PERSONA BRIEF
Name of this persona: Capacity-squeezed boutique digital agency

WHAT I SELL
- Offer in one sentence: White-label web, UI/UX, branding, SaaS and e-commerce builds delivered under the agency's own name.
- Typical deal size and what the buyer gets: Small tasks from $150 up to $1,500+ per client; the agency resells at its own margin.
- Why a business would say yes: They are turning down projects or stretching the team, and cannot justify a new hire yet.

WHO BUYS (the company)
- Business type / industry: Digital, web design, branding, marketing and creative agencies and studios.
- Size band: 3 to 30 people.
- Geographies to include: UAE, Saudi Arabia, Qatar, Oman, Kuwait, Bahrain, UK, USA, Canada, Australia, Singapore, India.
- Geographies to exclude: Countries where I cannot lawfully email business contacts without consent.
- Languages: English.
- Stage or maturity signals: Active site, portfolio with recent work, founded at least two years ago.

WHO DECIDES
- Titles that decide: Founder, Co-founder, Managing Director, Creative Director, Head of Delivery.
- Titles to avoid: HR, Recruiter, Intern, Assistant.

BUYING SIGNALS
1. Lists web design, web development, app development, Shopify or WordPress as a service.
2. Portfolio shows many projects but the team page shows few developers.
3. Mentions partners, "we collaborate with", or freelancers.
4. Recent job post for a developer or designer (capacity strain).

DISQUALIFIERS
- Large networks and holding companies (WPP, Ogilvy, Publicis, Omnicom, Dentsu, Havas and similar).
- Other white-label or outsourcing providers (direct competitors).
- Parked, dead or "under construction" sites.
- Already in my sent log or inbox.

SCORING RUBRIC (total 10)
- Right geography: up to 2
- Right business type and services: up to 3
- Size band fits: up to 2
- Buying signals present: up to 2
- Reachable via a public business email: 1

VOLUME
- Leads wanted per run: 50
- Minimum score to keep: 5
```

## Part 7: retargeting example, a different business

Say you sell scheduling software to independent dental clinics. Change only the persona, not the tool:

```text
Name: Independent multi-chair dental clinics
Offer: Online booking and automated reminders that cut no-shows.
Business type: Dental clinics with 2 to 8 chairs, not part of a large chain.
Geographies: {{your city and surrounding area}}
Signals: phone-only booking, no online booking widget on the site, "call us to book", mentions no-show or cancellation policy, Google Business profile shows many reviews.
Disqualifiers: chains and DSOs, clinics already showing a booking widget (Calendly, Cliniko, NexHealth), closed or "moved" clinics.
Deciders: Practice owner, Practice manager.
Rubric: geography 2, business type 3, size 2, signals 2, reachable 1.
```

The same prompts produce a completely different, equally targeted lead list. The engine does not care what you sell; only the email copy (`OFFER`, `SUBJECT`, the sequence text) and the enrichment patterns in the engine's **2 Enrich** node are specific to the original persona. Pre-scoring leads with your tool means the engine's own scoring step never needs to be touched.

---

## Part 8: tuning checklist

- Run on 20 leads first and read every one.
- If everything scores 9 or 10, your rubric is too generous. Tighten signals or add disqualifiers.
- If good leads score 5, you are missing a signal that is obvious to a human. Add it.
- Prefer fewer, better leads. Five well-matched emails a day beat fifty vague ones.
- Re-run monthly with the suppress files so you never contact the same business twice.
