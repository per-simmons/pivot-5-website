# Pivot 5 / Pivot Media — Claude Code Handoff (Dec 2025\)

## 0\) What this doc is for

You (Claude Code) are being onboarded to **Pivot Media’s automated newsletter system** so you can help us make **surgical, production-safe updates** to:

* **n8n workflows** (hardening \+ “workflow resilience”)  
* **Mautic API integration** (create/send campaigns automatically; plus manual fallback)  
* **Content selection/editor logic** (improve reliability and quality over time)  
* **Deliverability optimizations** (reduce Gmail clipping, image weight, headers, etc.)

This system currently supports **three newsletters**, assembled automatically, with **two sent via Gmail nodes** and **one sent via Mautic**.

---

## 1\) Success criteria (what “done” looks like)

### Phase 1 — Critical path (must work every day)

1. Daily newsletter can be **compiled and delivered into Mautic** reliably (no hard-fail runs).  
2. Team can **send daily even if automation breaks** (manual fallback path).  
3. Warm-up can proceed using Mautic segmentation (Mailsoar is migrating contacts daily).  
4. If images fail, the workflow **still completes** (fallback image / skip image / safe default) — “workflow resilience” is required.

### Phase 2 — Optimizations

1. Improve selection quality (human override \+ better AI editor logic).  
2. Reduce cost \+ improve efficiency (dedupe earlier, reduce unnecessary LLM/image calls).  
3. Deliverability polish (HTML size, tracking URLs, headers).

---

## 2\) System map: components and responsibilities

### People / teams

* **Pat (project owner / operator):** taking over from Langdon; owns day-to-day execution.  
* **Langdon (builder):** built the current n8n \+ Airtable system; recorded Loom walkthroughs.  
* **Kunal (founder):** priorities are (a) start warmup via Mautic, (b) make workflows resilient, (c) improve editor quality later.  
* **Mailsoar team (Pierre, Vikas, Virginie):** email ops \+ warm-up execution; they migrate contacts into Mautic and guide deliverability (HTML size, images, List-ID, etc.). *(See email thread provided by Pat.)*

### Platforms / software

* **Airtable (PivotMediaMaster):** core content database \+ state machine for the 3 newsletters. Langdon describes flow: **Articles → NewsletterStories → NewsletterIssuesStories → NewsletterIssues → NewsletterIssuesArchive**.  
* **n8n:** orchestration layer. There are **six workflows**; **four are main flows** and **agnostic across newsletters**.  
* **AI editor architecture:** Kunal frames the end-to-end as **Research → Editor → Send infrastructure (HTML construction) → Delivery to Mautic**.  
* **LLM/Image providers:** Gemini \+ OpenAI are used in the image pipeline; sensitive-word failures can block the flow.  
* **Cloudflare Images:** images are named by **Story ID**; image URL is formulaic and includes a **`/newsletter` transformation variant**.  
* **Mautic:** warmup \+ sending UI; must support API-driven campaign creation/sending and a manual fallback.  
* **GreenArrow:** underlying MTA (legacy infra) described by Kunal; historically required complex n8n integration and hit scaling issues.  
* **Postmastery:** GreenArrow experts Kunal hired (legacy infra).  
* **Warmy.io:** seedlist warmup monitoring (Gmail/Outlook seed inbox engagement). *(See email thread provided by Pat.)*  
* **Supabase:** subscriber source-of-truth; Mailsoar migrates contacts into Mautic and wants to mark records as `migrated`. *(See email thread provided by Pat.)*
* **pivotnews.com:** public-facing website that displays newsletter content. Pulls directly from the **Newsletter Issue Stories** table in Airtable.

### pivotnews.com — Website Details

The public website at [pivotnews.com](https://pivotnews.com) displays newsletter stories to the public.

**Data Source:**
- Pulls from: **Newsletter Issue Stories** table (`tblaHcFFG6Iw3w7lL`)
- Airtable View: [View in Airtable](https://airtable.com/appwSozYTkrsQWUXB/tblaHcFFG6Iw3w7lL/viwMY55gZ1AnmbdV4?blocks=hide)

**What displays:**
- Story headlines and summaries
- AI-generated images (from Cloudflare Images)
- Links to original sources

**Known issue:** If images show "JSON image URL" text instead of actual images, there's a field mapping bug in the Assemble workflow. See Known Issues section in the outstanding to-dos doc.

**Relationship to email:**
- The same stories that appear on pivotnews.com are compiled into the daily newsletters
- Website serves as a public archive/preview of newsletter content
- Useful for sharing individual stories on social media

---

## 3\) Source index (what to read)

### Loom transcript files (attached)

* **Langdon Step 1 — Overview:** `Langdon Step 1 - Overview of the Pivot 5 Newsletter Workflow.txt` Key details: 3 newsletters; 6 workflows; two sent via Gmail nodes \+ one via Mautic.  
* **Langdon Step 2 — Decoration/selection:** `Langdon Step 2 - Optimizing Newsletter Article Selection and Decoration Process.txt` Key details: decoration subflows \+ runs every \~20 mins, pulls by “needs AI”.  
* **Langdon Step 3 — Images:** `Langdon Step 3 - Optimizing Image Flow for Newsletter Efficiency.txt` Key details: image failures, sensitive words, fallback behavior, Cloudflare naming/URL scheme.  
* **Langdon Step 4 — Compile newsletter:** `Langdon Step 4 - Compiling the Daily Newsletter_ A Step-by-Step Guide 📧.txt` Key details: compile schedule; “make compile flow agnostic” recommendation.

### Kunal context (attached)

* **Email infra overview:** `Kunal sync to discuss Pivot Media Email infra_12.16.25.txt` Key details: critical path items (Mautic API integration, manual fallback, signup form → Mautic, warm-up timeline).  
* **Resilience \+ Gemini limits:** `Kunal sync 12.16.25.txt` Key details: “workflow resilience” and Gemini API credits/rate limits investigation.

### Email threads (provided in chat)

* Mailsoar warm-up instructions (segment, Lot Import field, Supabase `migrated` constraint SQL)  
* Pierre deliverability checklist (compress images, reduce HTML size, List-ID in Mautic)  
* Warmy.io seedlist setup \+ project responsibilities

---

## 4\) Concrete assets (links) Claude should use

**Note:** links are included as code so they can be copy/pasted.

### n8n workflows (Step 1–4)

* Step 1 (Ingestion): `pulsetrade.app.n8n.cloud/workflow/ddobfIOQeOykMUq6`  
* Step 2 (Decoration): `pulsetrade.app.n8n.cloud/workflow/mgluocpwH9kXvPjM`  
* Step 3 (Assemble Media/Stories): `https://pulsetrade.app.n8n.cloud/workflow/KZ2HofsdGQiK0RL7`  
* Step 4 (Compile HTML \+ Send): `https://pulsetrade.app.n8n.cloud/workflow/yRWViCYx9ak463AM`

### Airtable

**Base:** Pivot Media Master (`appwSozYTkrsQWUXB`)

| Table | Table ID | URL |
|-------|----------|-----|
| Articles | `tblGumae8KDpsrWvh` | [View](https://airtable.com/appwSozYTkrsQWUXB/tblGumae8KDpsrWvh) |
| Newsletter Stories | `tblY78ziWp5yhiGXp` | [View](https://airtable.com/appwSozYTkrsQWUXB/tblY78ziWp5yhiGXp) |
| Newsletter Issue Stories | `tblaHcFFG6Iw3w7lL` | [View](https://airtable.com/appwSozYTkrsQWUXB/tblaHcFFG6Iw3w7lL) |
| Newsletter Issues | `tbl7mcCCGbjEfli25` | [View](https://airtable.com/appwSozYTkrsQWUXB/tbl7mcCCGbjEfli25) |
| Newsletter Issues Archive | `tblHo0xNj8nbzMHNI` | [View](https://airtable.com/appwSozYTkrsQWUXB/tblHo0xNj8nbzMHNI) |

**API Query Pattern** (via curl):
```bash
curl -s "https://api.airtable.com/v0/appwSozYTkrsQWUXB/{TABLE_ID}?maxRecords=5" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY"
```

### Accounts

* **Gemini API account:** `pat@pivotstudio.ai` (use this for API tier upgrades to avoid Portugal geo-blocking issues)

---

## 4.5\) Pipeline Verification Status (Dec 16, 2025)

**Full pipeline confirmed working.** All 5 Airtable tables contain recent data and the n8n workflows are executing successfully.

### Airtable Data Flow Verification

| Table | Latest Data | Sample Record | Status |
|-------|-------------|---------------|--------|
| **Articles** | Dec 16, 2025 | News items from RSS/Firecrawl ingestion | ✅ Active |
| **Newsletter Stories** | Dec 15, 2025 | Decorated stories with interest scores, images | ✅ Active |
| **Newsletter Issue Stories** | Dec 16, 2025 | Selected stories linked to issues | ✅ Active |
| **Newsletter Issues** | Dec 16, 2025 | 2 issues compiled (pivot_invest, pivot_build) | ✅ Active |
| **Newsletter Issues Archive** | Dec 15, 2025 | Last sent newsletters archived | ✅ Active |

### n8n Workflow Execution Status

| Workflow | ID | Last Run | Status |
|----------|----|----------|--------|
| Ingestion Engine | `ddobfIOQeOykMUq6` | Dec 16, 17:00 UTC | ✅ Success |
| AI Decoration | `mgIuocpwH9kXvPjM` | Dec 16, 23:25 UTC | ✅ Success |
| Assemble Issues + Stories | `KZ2HofsdGQiK0RL7` | Dec 16, 20:03 UTC | ✅ Success |
| Compile HTML and Send | `yRWViCYx9ak463AM` | Dec 16, 19:59 UTC | ✅ Success |

**Note:** Steps 3 and 4 are currently triggered manually (not on automatic schedule).

### n8n API Best Practices

When retrieving execution details via n8n MCP tools, use `mode="preview"` first to avoid 503 memory errors on large executions:
```
mcp__n8n-mcp__n8n_executions({action: "get", id: "...", mode: "preview"})
```
Only fetch full data if `recommendation.canFetchFull` is true.

---

## 5\) Architecture walkthrough (what each step does)

### Visual Summary

```
RSS/Firecrawl
     ↓
[Step 1: Ingestion Engine]
     ↓
AIRTABLE: Articles
     ↓
[Step 2: AI Decoration] ← runs every 20 min, pulls "needs AI"
     ↓
AIRTABLE: NewsletterStories (+ images to Cloudflare)
     ↓
[Step 3: Assemble Issues + Stories]
     ↓
AIRTABLE: NewsletterIssueStories + NewsletterIssues
     ↓
[Step 4: Compile HTML and Send] ← 10pm compile, 6am/8:30am send
     ↓
AIRTABLE: NewsletterIssuesArchive
     ↓
EMAIL OUT (Mautic or Gmail)
```

---

### Step 1 — Ingestion Engine

**n8n Workflow:** `Ingestion Engine` (`ddobfIOQeOykMUq6`)

| Direction | What |
|-----------|------|
| **IN** | RSS feeds (via rss.app) + Firecrawl (premium sources: WSJ, Bloomberg, FT) |
| **OUT → Airtable** | **Articles** table (`tblGumae8KDpsrWvh`) |

**Key fields created:** Pivot ID (URL hash for deduplication), markdown content (sliced to 10k chars)

**Schedule:** Every 12 hours (changed from hourly to reduce Firecrawl credits)

**Resilience notes:**
* Ensure ingestion is idempotent (no duplicates; safe reruns)
* Ensure failures don't poison future runs (bad record doesn't block queue)

---

### Step 2 — AI Decoration

**n8n Workflow:** `Pivot Media AI Decoration` (`mgIuocpwH9kXvPjM`)

| Direction | What |
|-----------|------|
| **IN ← Airtable** | **Articles** table (filtered by "needs AI" field) |
| **Process** | Anthropic: scoring, categorization, headline, bullets, image prompts |
| **OUT → Airtable** | **NewsletterStories** table (`tblY78ziWp5yhiGXp`) |

**Key fields created:** Interest score (≥15 to proceed), fit score, newsletter assignment, Story ID

**Schedule:** Every 20 minutes

**Image generation (runs here or in parallel):**
* Gemini first → OpenAI fallback → Cloudflare Images
* Images named by Story ID, URL format: `base_url/account_id/story_id/newsletter`
* Only stories with `image_status = complete` can be compiled

**Known improvement:** Multi-newsletter fit logic exists but isn't fully used yet.

---

### Step 3 — Assemble Issues + Stories

**n8n Workflow:** `Assemble Issues + Stories` (`KZ2HofsdGQiK0RL7`)

| Direction | What |
|-----------|------|
| **IN ← Airtable** | **NewsletterStories** table (`tblY78ziWp5yhiGXp`) — filtered by image_status = complete, ≤36 hours old |
| **Process** | Anthropic picks top 5 stories from top 20 candidates, creates subject line |
| **OUT → Airtable** | **NewsletterIssueStories** (`tblaHcFFG6Iw3w7lL`) + **NewsletterIssues** (`tbl7mcCCGbjEfli25`) |

**Key fields created:** Which stories go into which issue, story order, subject line

**Optimization suggestion:** Run this BEFORE image generation to only generate images for selected stories (currently generates for ALL stories, 95% never used).

---

### Step 4 — Compile HTML and Send

**n8n Workflow:** `Compile HTML and Send` (`yRWViCYx9ak463AM`)

| Direction | What |
|-----------|------|
| **IN ← Airtable** | **NewsletterIssues** table (`tbl7mcCCGbjEfli25`) — filtered for ready to compile |
| **Process** | Compile HTML email, send via Gmail or Mautic |
| **OUT → Airtable** | **NewsletterIssuesArchive** (`tblHo0xNj8nbzMHNI`) — after send |

**Schedule:**
* 10pm EST — Compile (Mon-Fri)
* 6am / 8:30am EST — Send triggers

**What sends where:**
* **Pivot 5 (PivotAI)** → Mautic (via HTTP Request nodes: Create Email → Attach Transport → SEND)
* **Pivot Invest** → Gmail nodes
* **Pivot Build** → Gmail nodes

**Current architecture:** 3 separate branches per newsletter (Langdon recommends making it agnostic)

---

## 6\) Email infrastructure context (why Mautic \+ warmup matters)

Kunal’s “stack” framing:

* Beehiv was UI; delivery is layered; you can go down to MTAs (e.g., GreenArrow).  
* Past infra (n8n → Supabase → GreenArrow) hit scaling constraints (Supabase limits, n8n memory).  
* New infra focuses on warm-up: **send slowly from new domain to build trust**, mainly with Google/Microsoft.  
* Critical path for Pat: the key workflow is **Mautic API integration**, plus manual send fallback, plus signup form that goes into Mautic.

---

## 7\) Action items Claude should help execute (grouped)

### A) Critical path: “send daily no matter what”

1. **Verify and harden Mautic API integration** (create email/template, associate campaign/segment, trigger/schedule send).  
2. **Implement manual fallback send**: copy HTML out of Airtable/n8n and send directly in Mautic if API breaks.  
3. **Workflow resilience:** if an image is missing or a step fails, do not hard-stop; use backup image/defaults and continue.  
4. **Gemini API reliability:** investigate tier/credits/rate limits; consider batching; ensure we’re on the correct paid setup.  
5. **Signup box → Mautic:** pivotnews site signup form should write into Mautic because that’s where the audience is tracked.

### B) Warm-up mechanics (Mailsoar thread items)

6. Ensure daily send targets the **Mailsoar-managed warmup segment** (“Warmup – all emails”). *(From email thread provided by Pat.)*  
7. Support cohort targeting via a custom field like **Lot Import** (e.g., `warmup_YYYY-MM-DD`) if needed. *(From email thread provided by Pat.)*  
8. Update Supabase schema to allow `status='migrated'` so contacts aren’t re-migrated. *(From email thread provided by Pat.)*

### C) Deliverability optimizations (Pierre \+ ChatGPT analysis items)

9. **Compress images** (reduce total weight; ensure fast load). *(From email thread provided by Pat.)*  
10. **Reduce HTML size** (required to avoid Gmail clipping). *(From email thread provided by Pat.)*  
11. Add **List-ID header** in Mautic (recommended, not mandatory). *(From email thread provided by Pat.)*  
12. Shorten/streamline tracking URLs if they bloat HTML (helps size \+ trust). *(From ChatGPT analysis Kunal pasted to Pierre.)*  
13. (Later) BIMI / Feedback-ID / tracking domain hygiene checks. *(From ChatGPT analysis Kunal pasted to Pierre.)*

### D) Quality improvements (post-critical-path)

14. Add a **manual editor / human intervention step** (Kunal wants this; not built yet).  
15. Improve multi-fit selection so one article can spawn multiple story candidates (Langdon rationale for improving fidelity).  
16. Refactor compile/send so it’s newsletter-agnostic and doesn’t require new branches for each new newsletter.

---

## 8\) “Workflow resilience” spec (what we mean)

Kunal explicitly wants: if we can’t get an image, the workflow should not “throw a fit and do nothing”; it should use a backup image or otherwise keep going.

Concrete expectations:

* If image generation fails:  
    
  * mark story as “image\_failed” (with reason)  
  * use a fallback image (newsletter default) OR omit image gracefully  
  * continue compile \+ send


* If one record is malformed:  
    
  * skip safely \+ log; do not block the whole batch


* Retry logic must avoid infinite loops on “poison pill” stories (sensitive-word failures can repeatedly retry the same story).

---

## 9\) Gemini API limits: what to investigate

Kunal suspects failures last week came from **Gemini rate limits/credits/account tier**, and wants this investigated (including batching).

Concrete checklist:

* Identify which Gemini account/project is used by n8n nodes.  
* Confirm billing tier \+ quotas \+ regional constraints.  
* If batching is supported, implement batching strategy to reduce rate-limit hits.  
* Add graceful degradation: if Gemini fails, fallback to alternate provider or default image.

---

## 10\) Change-management rules (how to modify safely)

1. **No breaking changes in-place.** Duplicate workflows first; change \+ test the duplicate; then swap.  
2. Add **structured logging** at workflow boundaries (inputs/outputs, record IDs, counts).  
3. Validate data contracts between steps (Airtable fields expected, types, defaults).  
4. Ensure runs are **idempotent** (safe rerun after failure; no duplicate sends).  
5. Add “preview” outputs (HTML \+ plaintext) for quick QA before send.

---

## 11\) Notes about newsletter count / naming

* There are **three newsletters** in the current automation.  
* Langdon refers to “Pivot5” as “PivotAI” in his internal system naming.  
* Compile flow currently has separate branches per newsletter; recommended improvement is to make it agnostic.

---

## 12\) Open questions Claude can answer quickly (once inside the workflows)

1. Where exactly does **Step 4** hand off into Mautic today (API call details, endpoint used, objects created)?  
2. What fields in Airtable define “ready to compile” vs “skip” vs “failed”?  
3. What’s the fastest path to implement **fallback image** without changing the email template structure?

---

### Appendix: quick reference quotes (high signal)

* “There are three newsletters… two sent via Gmail nodes… the other sent automatically via Mautic.”  
* “There are six workflows in n8n… four… are main flows… agnostic.”  
* Airtable flow: “NewsletterStories, NewsletterIssuesStories, NewsletterIssues, and then NewsletterIssuesArchive.”  
* “This runs every 20 minutes… pulls by needs AI.”  
* Image failures: “sensitive words… Gemini nor OpenAI will process… spits out an error… retries the same story.”  
* Image hosting: “names… are the story IDs… image URL is formulaic… `/newsletter` transformation.”  
* Compile schedule: “runs at 9:30pm… Monday through Friday… Eastern… recommend moving it up…”  
* Critical path: “key workflow… is the API integration… learn how to send an email manually… copy HTML out of Airtable or n8n…”  
* Priority work: “workflow resilience… Gemini API credits / rate limit.”

