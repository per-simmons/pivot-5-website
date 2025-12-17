# Pivot Media Infrastructure — Outstanding To-Dos (Dec 16, 2025)

## Tools Available for This Project

### n8n MCP Server (Connected)
Claude Code has direct API access to the n8n instance via MCP tools:
- **API URL:** `https://pulsetrade.app.n8n.cloud/api/v1`
- **n8n Version:** 1.115.4
- **MCP Server Version:** 2.30.0

**Key MCP Tools:**
| Tool | Use For |
|------|---------|
| `mcp__n8n-mcp__n8n_list_workflows` | List all workflows |
| `mcp__n8n-mcp__n8n_get_workflow` | Get workflow details (modes: full/details/structure/minimal) |
| `mcp__n8n-mcp__n8n_update_partial_workflow` | Incremental workflow updates |
| `mcp__n8n-mcp__n8n_validate_workflow` | Validate workflow by ID |
| `mcp__n8n-mcp__n8n_autofix_workflow` | Auto-fix common issues |
| `mcp__n8n-mcp__n8n_test_workflow` | Test/trigger workflows |
| `mcp__n8n-mcp__search_nodes` | Find nodes by keyword |
| `mcp__n8n-mcp__get_node` | Get node configuration schema |
| `mcp__n8n-mcp__validate_node` | Validate node config |

### n8n-automation Skill
Use the `/skill n8n-automation` command to invoke the n8n automation skill for:
- Managing workflows for Pivot 5 AND Media.co.uk
- Creating/modifying workflows
- Checking execution status

### Standard Workflow for n8n Changes
1. **Find node:** `search_nodes({query: "slack"})`
2. **Get config:** `get_node({nodeType: "nodes-base.slack", detail: "standard"})` — ALWAYS start with standard detail
3. **Validate before deploy:** `validate_workflow({workflow: {...}})`
4. **Test:** `n8n_test_workflow` to trigger and verify

---

## Workflow Execution Status (Verified Dec 16, 2025)

All 4 main workflows are **running and succeeding**:

| Workflow | Last Run (UTC) | Mode | Status | Notes |
|----------|---------------|------|--------|-------|
| **Ingestion Engine** | 17:00 | scheduled | ✅ success | Runs hourly, 7-12 min per run |
| **AI Decoration** | 23:25 | scheduled | ✅ success | Runs every ~5 min, polls for "needs AI" |
| **Assemble Issues + Stories** | 20:03 | manual | ✅ success | ~30 sec per run |
| **Compile HTML and Send** | 19:59 | manual | ✅ success | Multiple triggers for different newsletters |

**Observation:** Steps 3 and 4 are currently triggered manually (not on automatic schedule).

**API Note:** When retrieving execution details via n8n MCP, use `mode="preview"` first to avoid 503 errors on large executions. See `CLAUDE.md` for details.

---

## Phase 1: Critical Path (Must Work Daily)

### 1. Mautic API Integration

**Status: ALREADY INTEGRATED** (verified 2025-12-16)

The Mautic integration exists in the **"Compile HTML and Send"** workflow (`yRWViCYx9ak463AM`).

**Flow (triggered by "8:30am EST Pivot 5 Trigger1"):**
```
List6 (Airtable)
  → Create Email (HTTP Request to Mautic API)
  → Attach Transport (HTTP Request - assigns to segment/campaign)
  → SEND (HTTP Request - triggers send)
  → Update Newsletter Issues Archive (Airtable)
  → Delete a record3 (Airtable)
```

**What sends where:**
- **Pivot 5 (PivotAI)** → Mautic (via HTTP Request nodes)
- **Pivot Invest** → Gmail nodes
- **Pivot Build** → Gmail nodes

**Remaining to-dos:**
- [ ] Verify HTTP Request nodes are targeting correct segment ("Warmup – all emails")
- [ ] Add error handling/retries to HTTP Request nodes
- [ ] Confirm API credentials are valid and not expired
- [ ] Test end-to-end with a manual trigger

### 1b. Mautic Send Verification & Error Tracking (per Langdon Dec 16 sync)

**Problem:** The Mautic API can return "success" even when emails fail to send. Per Langdon: *"Sometimes it'll say success but sent_count will be zero and failed_recipients will be 485... it'll run through and check all these boxes in Airtable like 'sent, good to go' but it didn't send."*

**Solution:** Capture Mautic response data and only mark as sent if actually successful.

**Implementation Steps:**
1. **Capture Mautic API response fields** after the SEND HTTP Request node:
   - `sent_count` — number of emails actually delivered
   - `failed_recipients` — number of emails that failed
   - `read_count` — opens (for later analytics)

2. **Add conditional logic** before updating Airtable Archive:
   - Only mark as `sent=true` if `failed_recipients == 0`
   - If `failed_recipients > 0`, mark as `send_failed` with error count
   - Log the failure reason for debugging

3. **Create new Airtable fields** in Newsletter Issues Archive table:
   - `mautic_sent_count` (Number)
   - `mautic_failed_recipients` (Number)
   - `mautic_send_status` (Single Select: success, partial_failure, failed)
   - `mautic_response_raw` (Long Text - for debugging)

4. **Add alert/notification** when `failed_recipients > 0`:
   - Slack notification or email alert
   - Include issue ID and failure count

**n8n Implementation:**
- After the "SEND" HTTP Request node, add an IF node:
  - Condition: `{{ $json.failed_recipients }} == 0`
  - True branch → Update Archive as "sent"
  - False branch → Update Archive as "send_failed" + alert

**Why this matters:** Without this, you could think newsletters are sending successfully when they're actually failing silently. This was discovered during warm-up testing on Dec 16, 2025.

### 2. Manual Fallback Send
- [ ] Document the manual process: copy HTML from Airtable → paste into Mautic
- [ ] Identify where compiled HTML lives in Airtable (which table/field)
- [ ] Test manual send to warm-up segment
- [ ] Create step-by-step runbook for daily manual fallback

### 3. Workflow Resilience
- [ ] **Image failure handling:**
  - [ ] Add fallback image (newsletter default) when generation fails
  - [ ] Mark story as `image_failed` with reason instead of hard-stopping
  - [ ] Ensure compile continues even with missing images
- [ ] **Poison pill prevention:**
  - [ ] Cap retries on sensitive-word failures (don't infinite loop)
  - [ ] Skip malformed records safely + log (don't block batch)
- [ ] **OpenAI fallback already exists** (per Langdon Step 3) — verify it's working

### 4. Gemini API Reliability
- [ ] Identify which Gemini account/project is used by n8n nodes
- [ ] Set up `pat@pivotstudio.ai` for API access (avoid geo-blocking)
- [ ] Confirm billing tier + quotas + regional constraints
- [ ] Investigate batching (batch 10 requests to avoid rate limits)
- [ ] Implement graceful degradation: Gemini fails → OpenAI fallback → default image

### 5. Signup Form → Mautic
- [ ] Connect pivotnews site signup box to Mautic API
- [ ] Danny working on website — coordinate with him on form implementation
- [ ] Ensure new signups go directly into Mautic (not just Supabase)

---

## Phase 1.5: Warm-up Mechanics (Mailsoar Requirements)

### 6. Segment Targeting
- [ ] Confirm daily send targets "Warmup – all emails" segment
- [ ] Understand warm-up schedule: starts at ~100 people/day, scales gradually
- [ ] Seed list: 1000 fake inboxes for engagement signals (opens/clicks)

### 7. Cohort Tracking (Optional)
- [ ] Support `Lot Import` field (e.g., `warmup_YYYY-MM-DD`) if Mailsoar requests
- [ ] Allows targeting specific cohorts by import date

### 8. Supabase Migration Status
- [ ] Update Supabase schema: add `status='migrated'` option
- [ ] Prevents re-migration of already-migrated contacts
- [ ] SQL constraint provided by Pierre in email thread

---

## Phase 2: Deliverability Optimizations

### 9. Image Compression
- [ ] Compress newsletter images (reduce total weight)
- [ ] Convert to WebP format where possible
- [ ] Ensure fast load times

### 10. HTML Size Reduction
- [ ] Current HTML may trigger Gmail clipping (>102KB)
- [ ] Audit HTML output from compile step
- [ ] Remove unnecessary whitespace, comments, inline styles
- [ ] Consider minification

### 11. List-ID Header
- [ ] Add List-ID header in Mautic (recommended by Pierre)
- [ ] Helps with deliverability/categorization

### 12. Tracking URL Optimization
- [ ] Audit tracking URLs for length/bloat
- [ ] Shorten/streamline if they're adding significant HTML weight
- [ ] Check if custom tracking domain is set up properly

### 13. Advanced (Later)
- [ ] BIMI setup
- [ ] Feedback-ID header
- [ ] Tracking domain hygiene checks

---

## Phase 3: Quality Improvements

### 14. Story Selection Quality
- [ ] Current quality: ~3.5/5 per Kunal
- [ ] Kunal walked through selection hierarchy with Langdon
- [ ] Update AI editor rules in n8n for better story picks
- [ ] Add criteria hierarchy for each of 5 story slots

### 15. Manual Editor Step
- [ ] Add human intervention/override step before send
- [ ] Not built yet — Kunal wants this eventually

### 16. Multi-Newsletter Fit (Major Quality Improvement - per Langdon)

**Current Problem:**
The AI decoration flow forces each article to belong to exactly ONE newsletter, even when it could fit multiple. Per Langdon: *"The fact that we are forcing it to choose one newsletter is a key problem... a human wouldn't be able to do that."*

**How it works now (in AI Decoration workflow):**
1. `Compute Interest Score` node asks AI to score the article and assign newsletter(s)
2. AI returns `fit_score` for potentially multiple newsletters (e.g., Pivot AI: 0.85, Pivot Build: 0.72)
3. **BUT** a downstream node strips this to just the highest-scoring newsletter
4. Result: Article only creates ONE story, even if it fits multiple newsletters

**Example from Langdon:**
> "Gemini Live now live on Vertex AI - this could be interesting for Pivot AI, but it natively belongs... the fit score is probably highest for Pivot Build. But actually it put this into Pivot AI... These articles fit Build AND Pivot AI. It just depends how you write the story."

**Why this matters:**
- Position 1 stories (big macro) come from Bloomberg, FT, WSJ — these often fit BOTH Pivot Invest AND Pivot 5
- Position 5 stories (softer) come from TechCrunch, The Verge — these fit BOTH Pivot Build AND Pivot 5
- By forcing binary choice, we're limiting the selection pool and overweighting certain story types

**Proposed Solution:**
1. **Remove the "pick one" filter node** that strips multiple newsletters
2. **Allow articles to spawn multiple story candidates** in Newsletter Stories table:
   - Same article → Story for Pivot AI (fit: 0.85)
   - Same article → Story for Pivot Build (fit: 0.72)
3. **Store fit scores** so selection can use them later
4. **Let the Assemble step** pick from a richer pool of candidates

**Implementation Options:**
- **Option A:** Add fields to Articles table: `newsletter_1`, `newsletter_2`, `fit_score_1`, `fit_score_2`
- **Option B:** Create multiple rows in Newsletter Stories for each article (cleaner but more records)
- **Option C:** Store as JSON array in single field: `[{newsletter: "pivot_ai", fit: 0.85}, {newsletter: "pivot_build", fit: 0.72}]`

**n8n Changes Required:**
- Locate the node that does "pick highest fit score" and remove/modify it
- Update the "Create Newsletter Story" node to create multiple records when multiple newsletters are assigned
- Ensure downstream nodes handle multiple stories per article

**Impact:** Langdon believes this is the single most impactful change for improving newsletter quality. *"If you allow the newsletter to pick multiple... you would get a much richer selection when you actually hammer down later in the flow."*

### 17. Compile Flow Agnosticity
- [ ] Current: 3 separate branches per newsletter
- [ ] Goal: Parameterize by newsletter type, use shared compile logic
- [ ] Adding new newsletter shouldn't require new branch

---

## Phase 4: Cost/Efficiency Optimizations

### 18. Firecrawl Credit Reduction
- [ ] Move Pivot ID deduplication EARLIER in flow (before crawling)
- [ ] Compute Pivot ID from URL before Firecrawl, check for dupes first
- [ ] Only crawl unique URLs
- [ ] Currently: ingestion runs every 12 hours (changed from hourly)
- [ ] Consider: once daily at 5-6pm ET (after markets, before 9:30pm compile)

### 19. Image Generation Efficiency
- [ ] Currently: generates images for ALL stories (95% never used)
- [ ] Better: run story selection FIRST, then generate images only for selected 5
- [ ] Requires reordering Step 3 + Step 4 logic

### 20. LLM Call Reduction
- [ ] Audit decoration flow for unnecessary AI calls
- [ ] Batch where possible
- [ ] Cache results where appropriate

### 21. Article Cleanup Flow (per Langdon Step 1)
- [ ] Add scheduled flow to remove articles older than 2 days based on `Date Published`
- [ ] Currently: 4,500+ articles accumulating in Articles table
- [ ] Run once daily or weekly to keep table clean
- [ ] Reduces processing overhead and keeps Airtable performant

---

## Open Questions (Quick Wins Once in Workflows)

1. Where exactly does Step 4 hand off to Mautic? (API endpoint, objects created)
2. What Airtable fields define "ready to compile" vs "skip" vs "failed"?
3. What's the fastest path to implement fallback image without changing template structure?
4. What's the `image_status` field workflow? (only `complete` can be compiled)

---

## Reference: Key System Details

| Component | Detail |
|-----------|--------|
| **Newsletters** | 3 total: PivotInvest, Pivot5/PivotAI, PivotBuild |
| **Sending** | 2 via Gmail nodes, 1 via Mautic |
| **n8n Workflows** | 6 total, 4 main flows (newsletter-agnostic) |
| **Airtable Flow** | Articles → NewsletterStories → NewsletterIssuesStories → NewsletterIssues → Archive |
| **Compile Schedule** | Mon-Fri 9:30pm Eastern |
| **Image URL Format** | `base_url/account_id/story_id/newsletter` (Cloudflare variant) |
| **Decoration Interval** | Every 20 minutes, pulls by "needs AI" |
| **Interest Threshold** | Score ≥15 (out of 25) to proceed |
| **Warm-up Timeline** | ~2 months, managed by Mailsoar |
| **Public Website** | [pivotnews.com](https://pivotnews.com) — displays Newsletter Issue Stories |

---

## Known Issues & Bugs

### Image URL Field Bug (Fixed Dec 16, but may recur)

**What happened:** Pivot Invest and Pivot Build newsletters were showing literal text "JSON image URL" instead of actual images in Airtable and on pivotnews.com.

**Root cause:** In the Assemble workflow, the field reference was hardcoded to `image_prompt` instead of the correct `image_url` field. This caused the literal string "JSON image URL" to be written instead of the actual Cloudflare image URL.

**Fix applied:** Langdon corrected the field reference during the Dec 16 sync call.

**Why it may recur:**
- The image flow has multiple failure modes (Gemini sensitive word blocks, rate limits, etc.)
- Different newsletters may have slightly different field mappings
- If someone duplicates a workflow branch, they may copy the wrong field reference

**How to diagnose:**
1. Check Newsletter Issue Stories table in Airtable
2. Look at the `image` or `image_url` field
3. If it shows "JSON image URL" text instead of a URL, the field mapping is wrong
4. Check the Assemble workflow for incorrect field references

---

## Phase 5: Future Enhancements

### 22. Migrate Pivot Build & Pivot Invest to Mautic

**Current State:**
- **Pivot 5 (PivotAI)** → Sends via Mautic (warm-up in progress)
- **Pivot Build** → Sends via Gmail nodes (internal only)
- **Pivot Invest** → Sends via Gmail nodes (internal only)

**Why migrate:**
Per Langdon: *"Pivot Build and Pivot Invest are like 95% done. They're already being automatically compiled. It's like free advertising inventory at this point. He's already paid me to make them. He should use them and sell to Fisher Investments and whoever."*

**When to do this:**
- After Pivot 5 warm-up is complete (~2 months)
- When Kunal wants to monetize these newsletters with ads
- When subscriber lists are ready for these verticals

**Implementation:**
1. Create new segments in Mautic for Pivot Build and Pivot Invest audiences
2. Set up separate warm-up campaigns for each
3. Duplicate the Pivot 5 Mautic flow in n8n for each newsletter
4. Update the transport IDs (already documented in workflow):
   - Pivot 5: Transport ID in "Set Transport" node
   - Pivot Build: Different transport ID
   - Pivot Invest: Different transport ID
5. Configure separate triggers (different send times per newsletter)

**n8n Location:**
- Workflow: "Compile HTML and Send" (`yRWViCYx9ak463AM`)
- Currently: Pivot Build/Invest branches end at Gmail nodes
- Change: Replace Gmail nodes with Mautic HTTP Request nodes (same pattern as Pivot 5)

**Priority:** Low — not on critical path for warm-up. Focus on Pivot 5 first.
