# Copy-and-paste prompts for finding leads

Use these in **Perplexity** or **Gemini**. Replace the CAPITAL words, then paste the answer into the
"Add leads to the inbox" form (see the README, Step 4).

## Prompt 1 – find new leads

```
Find 25 small-to-mid-size digital, web or marketing agencies that match this profile:
- Region: YOUR REGIONS (for example UAE, Saudi Arabia, UK)
- Size: 5 to 30 people
- They likely need outside help with: YOUR SERVICES (for example web development, SEO, UI/UX, apps)
- They do NOT already have a large in-house development team

Return ONLY a markdown table with exactly these columns:
Company | Website | Public Email | Location | Notes
Rules:
- Use only emails that are published on the agency's own website.
- If you cannot find a public email, leave that cell empty. Do not guess or invent emails.
- Put the agency's real website address in the Website column.
- In Notes, write one short line on why they fit.
- Do not repeat any agency from this list: PASTE A FEW NAMES YOU ALREADY HAVE (optional).
```

## Prompt 2 – check a batch you already have (Gemini Deep Research)

```
For each agency below, check their website and tell me: (1) what services they sell, (2) who runs
the agency (first name only), (3) one fact I can mention in a friendly opening line.
Return a markdown table: Company | Website | Public Email | Location | Notes.
Agencies: PASTE NAMES AND WEBSITES
```

## Tips

- Always ask for the **Website** column. The engine uses it to avoid duplicates and to find emails.
- Run the same prompt in both Perplexity and Gemini. When both tools find the same agency, the
  engine tags it "both" - those are usually your best leads.
- Never invent or guess emails. A bounced email hurts your sender reputation.
