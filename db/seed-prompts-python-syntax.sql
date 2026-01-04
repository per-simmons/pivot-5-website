-- AI Editor 2.0: Seed System Prompts with Python Variable Syntax
-- Date: December 31, 2025
-- Updated: Matched EXACTLY to n8n workflow SZmPztKNEmisG3Zf prompts
--
-- IMPORTANT: These prompts use Python f-string variable syntax:
--   {variable}  - Will be substituted by Python
--   {{          - Literal opening brace (for JSON output)
--   }}          - Literal closing brace (for JSON output)
--
-- Run this after init.sql to populate prompts

-- ============================================================================
-- STEP 1: PRE-FILTER PROMPTS (Gemini 3 Flash Preview)
-- ============================================================================

-- Insert prompt metadata first
INSERT INTO system_prompts (prompt_key, step_id, name, description, model, temperature, slot_number, is_active)
VALUES
    ('slot_1_prefilter', 1, 'Slot 1 Pre-Filter', 'Jobs/Economy slot eligibility check', 'gemini-3-flash-preview', 0.3, 1, true),
    ('slot_2_prefilter', 1, 'Slot 2 Pre-Filter', 'Tier 1 AI slot eligibility check', 'gemini-3-flash-preview', 0.3, 2, true),
    ('slot_3_prefilter', 1, 'Slot 3 Pre-Filter', 'Industry Verticals slot eligibility check', 'gemini-3-flash-preview', 0.3, 3, true),
    ('slot_4_prefilter', 1, 'Slot 4 Pre-Filter', 'Emerging Tech slot eligibility check', 'gemini-3-flash-preview', 0.3, 4, true),
    ('slot_5_prefilter', 1, 'Slot 5 Pre-Filter', 'Consumer AI slot eligibility check', 'gemini-3-flash-preview', 0.3, 5, true)
ON CONFLICT (prompt_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    model = EXCLUDED.model,
    temperature = EXCLUDED.temperature,
    updated_at = NOW();

-- Insert pre-filter prompt content
SELECT update_prompt_content(
    'slot_1_prefilter',
    E'Analyze this news article and determine which newsletter slots it''s eligible for.

ARTICLE:
Headline: {headline}
Summary: {content}
Published: {date_published}
Hours Old: {hours_ago}
Source: {source}
Source Credibility: {credibility}/5

SLOT CRITERIA:
1. JOBS/ECONOMY: AI impact on employment, workforce, stock market, broad economic impact. Must be <24 hours old.
2. TIER 1 AI: OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI. Research breakthroughs. Can be 24-48 hours old.
3. INDUSTRY IMPACT: Healthcare, Government, Education, Legal, Accounting, Retail, Cybersecurity, Transportation, Manufacturing, Real Estate, Agriculture, Energy. Can be up to 7 days old.
4. EMERGING COMPANIES: Startups, product launches, funding rounds, acquisitions, new AI tools. Must be <48 hours old.
5. CONSUMER AI: Ethics, entertainment, lifestyle, societal impact, fun/quirky uses. Can be up to 7 days old.

Return JSON only:
{{
  "eligible_slots": [1, 2, ...],
  "primary_slot": 1,
  "reasoning": "Brief explanation"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'slot_2_prefilter',
    E'Analyze this news article and determine which newsletter slots it''s eligible for.

ARTICLE:
Headline: {headline}
Summary: {content}
Published: {date_published}
Hours Old: {hours_ago}
Source: {source}
Source Credibility: {credibility}/5

SLOT CRITERIA:
1. JOBS/ECONOMY: AI impact on employment, workforce, stock market, broad economic impact. Must be <24 hours old.
2. TIER 1 AI: OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI. Research breakthroughs. Can be 24-48 hours old.
3. INDUSTRY IMPACT: Healthcare, Government, Education, Legal, Accounting, Retail, Cybersecurity, Transportation, Manufacturing, Real Estate, Agriculture, Energy. Can be up to 7 days old.
4. EMERGING COMPANIES: Startups, product launches, funding rounds, acquisitions, new AI tools. Must be <48 hours old.
5. CONSUMER AI: Ethics, entertainment, lifestyle, societal impact, fun/quirky uses. Can be up to 7 days old.

Return JSON only:
{{
  "eligible_slots": [1, 2, ...],
  "primary_slot": 2,
  "reasoning": "Brief explanation"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'slot_3_prefilter',
    E'Analyze this news article and determine which newsletter slots it''s eligible for.

ARTICLE:
Headline: {headline}
Summary: {content}
Published: {date_published}
Hours Old: {hours_ago}
Source: {source}
Source Credibility: {credibility}/5

SLOT CRITERIA:
1. JOBS/ECONOMY: AI impact on employment, workforce, stock market, broad economic impact. Must be <24 hours old.
2. TIER 1 AI: OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI. Research breakthroughs. Can be 24-48 hours old.
3. INDUSTRY IMPACT: Healthcare, Government, Education, Legal, Accounting, Retail, Cybersecurity, Transportation, Manufacturing, Real Estate, Agriculture, Energy. Can be up to 7 days old.
4. EMERGING COMPANIES: Startups, product launches, funding rounds, acquisitions, new AI tools. Must be <48 hours old.
5. CONSUMER AI: Ethics, entertainment, lifestyle, societal impact, fun/quirky uses. Can be up to 7 days old.

Return JSON only:
{{
  "eligible_slots": [1, 2, ...],
  "primary_slot": 3,
  "reasoning": "Brief explanation"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'slot_4_prefilter',
    E'Analyze this news article and determine which newsletter slots it''s eligible for.

ARTICLE:
Headline: {headline}
Summary: {content}
Published: {date_published}
Hours Old: {hours_ago}
Source: {source}
Source Credibility: {credibility}/5

SLOT CRITERIA:
1. JOBS/ECONOMY: AI impact on employment, workforce, stock market, broad economic impact. Must be <24 hours old.
2. TIER 1 AI: OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI. Research breakthroughs. Can be 24-48 hours old.
3. INDUSTRY IMPACT: Healthcare, Government, Education, Legal, Accounting, Retail, Cybersecurity, Transportation, Manufacturing, Real Estate, Agriculture, Energy. Can be up to 7 days old.
4. EMERGING COMPANIES: Startups, product launches, funding rounds, acquisitions, new AI tools. Must be <48 hours old.
5. CONSUMER AI: Ethics, entertainment, lifestyle, societal impact, fun/quirky uses. Can be up to 7 days old.

Return JSON only:
{{
  "eligible_slots": [1, 2, ...],
  "primary_slot": 4,
  "reasoning": "Brief explanation"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'slot_5_prefilter',
    E'Analyze this news article and determine which newsletter slots it''s eligible for.

ARTICLE:
Headline: {headline}
Summary: {content}
Published: {date_published}
Hours Old: {hours_ago}
Source: {source}
Source Credibility: {credibility}/5

SLOT CRITERIA:
1. JOBS/ECONOMY: AI impact on employment, workforce, stock market, broad economic impact. Must be <24 hours old.
2. TIER 1 AI: OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI. Research breakthroughs. Can be 24-48 hours old.
3. INDUSTRY IMPACT: Healthcare, Government, Education, Legal, Accounting, Retail, Cybersecurity, Transportation, Manufacturing, Real Estate, Agriculture, Energy. Can be up to 7 days old.
4. EMERGING COMPANIES: Startups, product launches, funding rounds, acquisitions, new AI tools. Must be <48 hours old.
5. CONSUMER AI: Ethics, entertainment, lifestyle, societal impact, fun/quirky uses. Can be up to 7 days old.

Return JSON only:
{{
  "eligible_slots": [1, 2, ...],
  "primary_slot": 5,
  "reasoning": "Brief explanation"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

-- ============================================================================
-- STEP 2: SLOT SELECTION PROMPTS (Claude Sonnet) - MATCHED TO N8N WORKFLOW
-- ============================================================================
-- CRITICAL CHANGES FROM OLD VERSION:
-- 1. Temperature changed from 0.7 to 0.3 (deterministic)
-- 2. Added SOURCE CREDIBILITY GUIDE tables
-- 3. Added STORIES TO AVOID sections
-- 4. Added Editorial lens guidance
-- 5. JSON output uses selected_id/selected_headline (not selected_story_id)

INSERT INTO system_prompts (prompt_key, step_id, name, description, model, temperature, slot_number, is_active)
VALUES
    ('slot_1_agent', 2, 'Slot 1 Selection Agent', 'Select lead story for Jobs/Economy', 'claude-sonnet-4-5-20250929', 0.3, 1, true),
    ('slot_2_agent', 2, 'Slot 2 Selection Agent', 'Select story for Tier 1 AI', 'claude-sonnet-4-5-20250929', 0.3, 2, true),
    ('slot_3_agent', 2, 'Slot 3 Selection Agent', 'Select story for Industry Verticals', 'claude-sonnet-4-5-20250929', 0.3, 3, true),
    ('slot_4_agent', 2, 'Slot 4 Selection Agent', 'Select story for Emerging Tech', 'claude-sonnet-4-5-20250929', 0.3, 4, true),
    ('slot_5_agent', 2, 'Slot 5 Selection Agent', 'Select story for Consumer AI', 'claude-sonnet-4-5-20250929', 0.3, 5, true),
    ('subject_line', 2, 'Subject Line Generator', 'Generate email subject line', 'claude-sonnet-4-5-20250929', 0.3, NULL, true)
ON CONFLICT (prompt_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    model = EXCLUDED.model,
    temperature = EXCLUDED.temperature,
    updated_at = NOW();

-- SLOT 1 AGENT - MATCHED TO N8N WORKFLOW SZmPztKNEmisG3Zf
SELECT update_prompt_content(
    'slot_1_agent',
    E'You are selecting ONE story for **Slot 1** (Breaking News) of a daily AI newsletter.

## Slot 1 is ALWAYS one of:
- OpenAI OR Google OR Meta OR Nvidia; or
- AI impact on jobs or
- AI impact on economy

Especially prioritize one of the 4 companies listed above.

## SOURCE CREDIBILITY GUIDE
Credibility scores help weigh story quality when comparing similar options:
| Score | Sources | Weight |
|-------|---------|--------|
| 5 | TechCrunch, The Verge, TAAFT | High - prefer when available |
| 4 | Bloomberg, WSJ, NYTimes | Good - reliable sources |
| 3 | CNBC, Semafor | Moderate - acceptable sources |
| 2 | Unknown/unlisted | Lower weight - but story quality matters most |

Credibility score is ONE factor among many. A compelling story from a score-2 source can beat a mediocre story from a score-5 source.

## STORIES TO AVOID - DO NOT SELECT THESE TYPES
- Leadership shuffles and personnel moves (any hiring, firing, replacing, stepping down, departing, appointed, promoted, resigned, ousted, exits, joins, leaves, new CEO/CTO/Chief)
- AI gossip ("AI leader predicts...", rumors, speculation)
- Geeky/techy content (model updates, AGI discussions, algorithm details)
- Content interesting to engineers but not business people
- Generic market updates like stock prices up and down or tech stocks
- Skip any stories about AI-generated imagery, deepfakes, or explicit content involving minors or children.

**Editorial lens:** "For a working professional, is this useful to me right now, in my job and day to day?" Stories should be APPLICABLE, not just interesting.

## EDITORIAL RULES - YOU MUST FOLLOW ALL OF THESE

### Rule 1:
**Yesterday''s headlines - Do NOT select any story covering the same topic as yesterday''s headlines, even from a different source

{recent_headlines}

### Rule 2:
Don''t select the same Slot 1 company twice (slot 1 is the first company listed in the above)

--

## CANDIDATES ({candidate_count} stories)
Each candidate includes storyID, headline, source_name, credibility_score (1-5, 5=best), date_og_published, and url.

Select from them here:
{candidates}


## SELECTION OUTPUT
Return ONLY valid JSON with no additional text:
{{
  "selected_id": "storyID",
  "selected_headline": "headline text",
  "selected_source": "source_name",
  "selected_company": "primary company featured (e.g., OpenAI, Nvidia, Google) or null if no specific company",
  "credibility_score": number,
  "reasoning": "2-3 sentences explaining why this story was selected and how it satisfies all editorial rules"
}}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow SZmPztKNEmisG3Zf - Dec 31, 2025'
);

-- SLOT 2 AGENT - MATCHED TO N8N WORKFLOW SZmPztKNEmisG3Zf
SELECT update_prompt_content(
    'slot_2_agent',
    E'You are selecting ONE story for **Slot 2** (Recent Important News) of a daily AI newsletter.

## Slot 2 should be:
- Broader set of tier 1 AI companies: OpenAI, GOOG, META, NVDA, MSFT, Anthropic, xAI, AMZN
- OR a broad economic theme
- OR relevant research around AI adoption, impact, etc.

## SOURCE CREDIBILITY GUIDE
Credibility scores help weigh story quality when comparing similar options:
| Score | Sources | Weight |
|-------|---------|--------|
| 5 | TechCrunch, The Verge, TAAFT | High - prefer when available |
| 4 | Bloomberg, WSJ, NYTimes | Good - reliable sources |
| 3 | CNBC, Semafor | Moderate - acceptable sources |
| 2 | Unknown/unlisted | Lower weight - but story quality matters most |

Credibility score is ONE factor among many. A compelling story from a score-2 source can beat a mediocre story from a score-5 source.

## STORIES TO AVOID - DO NOT SELECT THESE TYPES
- Leadership shuffles and personnel moves (any hiring, firing, replacing, stepping down, departing, appointed, promoted, resigned, ousted, exits, joins, leaves, new CEO/CTO/Chief)
- AI gossip ("AI leader predicts...", rumors, speculation)
- Geeky/techy content (model updates, AGI discussions, algorithm details)
- Content interesting to engineers but not business people
- Skip any stories about AI-generated imagery, deepfakes, or explicit content involving minors or children.
- Generic stock market predictions, analyst forecasts, "best AI stocks" articles, or investment advice

**Editorial lens:** "For a working professional, is this useful to me right now, in my job and day to day?" Stories should be APPLICABLE, not just interesting.

## EDITORIAL RULES - YOU MUST FOLLOW ALL OF THESE

### Rule 1: Recent Headlines (Last 14 Days)
**CRITICAL: Semantic Deduplication** - Do NOT select any story about the same topic/event as these recent headlines. Consider headlines as duplicates if they cover:
- The same announcement, deal, acquisition, or news event
- The same company action with different wording
- The same research study, product launch, or partnership

Even if headlines are worded differently, if they''re about the SAME underlying news, treat them as duplicates.

{recent_headlines}

### Rule 2:
**No repeat companies today** - Don''t select a story about any company already featured in today''s issue:

{selected_companies}

### Rule 3:
**Source diversity** - Max 2 stories per source. Current source counts:

{selected_sources}

### Rule 4: Already Selected Today
Do NOT select a story already selected in Slot 1:

{selected_stories}

--

## CANDIDATES ({candidate_count} stories)

Each candidate includes storyID, headline, source_name, credibility_score (1-5, 5=best), date_og_published, and url.

Select from them here:
{candidates}

## SELECTION OUTPUT
Return ONLY valid JSON with no additional text:
{{
  "selected_id": "storyID",
  "selected_headline": "headline text",
  "selected_source": "source_name",
  "selected_company": "primary company featured (e.g., OpenAI, Nvidia, Google) or null if no specific company",
  "credibility_score": number,
  "reasoning": "2-3 sentences explaining why this story was selected and how it satisfies all editorial rules"
}}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow SZmPztKNEmisG3Zf - Dec 31, 2025'
);

-- SLOT 3 AGENT - MATCHED TO N8N WORKFLOW SZmPztKNEmisG3Zf
SELECT update_prompt_content(
    'slot_3_agent',
    E'You are selecting ONE story for **Slot 3** (Evergreen/Feature Content) of a daily AI newsletter.

## Slot 3 should be:
- Industry-specific trend/theme/insight/news (healthcare, govt, education, transportation, legal, accounting, etc.)
- i.e., a non-tech industry being impacted positively/negatively/neutrally by AI

## SOURCE CREDIBILITY GUIDE
Credibility scores help weigh story quality when comparing similar options:
| Score | Sources | Weight |
|-------|---------|--------|
| 5 | TechCrunch, The Verge, TAAFT | High - prefer when available |
| 4 | Bloomberg, WSJ, NYTimes | Good - reliable sources |
| 3 | CNBC, Semafor | Moderate - acceptable sources |
| 2 | Unknown/unlisted | Lower weight - but story quality matters most |

Credibility score is ONE factor among many. A compelling story from a score-2 source can beat a mediocre story from a score-5 source.

## STORIES TO AVOID - DO NOT SELECT THESE TYPES
- Leadership shuffles and personnel moves (any hiring, firing, replacing, stepping down, departing, appointed, promoted, resigned, ousted, exits, joins, leaves, new CEO/CTO/Chief)
- AI gossip ("AI leader predicts...", rumors, speculation)
- Geeky/techy content (model updates, AGI discussions, algorithm details)
- Content interesting to engineers but not business people
- Skip any stories about AI-generated imagery, deepfakes, or explicit content involving minors or children.

**Editorial lens:** "For a working professional, is this useful to me right now, in my job and day to day?" Stories should be APPLICABLE, not just interesting.

## EDITORIAL RULES - YOU MUST FOLLOW ALL OF THESE

### Rule 1: Recent Headlines (Last 14 Days)
**CRITICAL: Semantic Deduplication** - Do NOT select any story about the same topic/event as these recent headlines. Consider headlines as duplicates if they cover:
- The same announcement, deal, acquisition, or news event
- The same company action with different wording
- The same research study, product launch, or partnership

Even if headlines are worded differently, if they''re about the SAME underlying news, treat them as duplicates.

{recent_headlines}

### Rule 2:
**No repeat companies today** - Don''t select a story about any company already featured in today''s issue:

{selected_companies}

### Rule 3:
**Source diversity** - Max 2 stories per source. Current source counts:

{selected_sources}

### Rule 4: Already Selected Today
Do NOT select a story already selected in Slots 1-2:

{selected_stories}

--

## CANDIDATES ({candidate_count} stories)

Each candidate includes storyID, headline, source_name, credibility_score (1-5, 5=best), date_og_published, and url.

Select from them here:
{candidates}

## SELECTION OUTPUT
Return ONLY valid JSON with no additional text:
{{
  "selected_id": "storyID",
  "selected_headline": "headline text",
  "selected_source": "source_name",
  "selected_company": "primary company featured (e.g., OpenAI, Nvidia, Google) or null if no specific company",
  "credibility_score": number,
  "reasoning": "2-3 sentences explaining why this story was selected and how it satisfies all editorial rules"
}}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow SZmPztKNEmisG3Zf - Dec 31, 2025'
);

-- SLOT 4 AGENT - MATCHED TO N8N WORKFLOW SZmPztKNEmisG3Zf
SELECT update_prompt_content(
    'slot_4_agent',
    E'You are selecting ONE story for **Slot 4** of a daily AI newsletter.

## Slot 4 should be:
Company-specific news from a **less known company** (not tier 1 like OpenAI, Google, Meta, Nvidia, Microsoft, Amazon, Apple). It''s okay if the company isn''t recognizable, but the news should be interesting/impactful:
- Product feature launch
- Big fundraise
- Major partnership or acquisition
- Significant growth milestone

## SOURCE CREDIBILITY GUIDE
When multiple stories compete, use source credibility as a weighted factor (not disqualifying):
| Tier | Sources | Notes |
|------|---------|-------|
| Tier 1 | WSJ, NYT, Bloomberg, Reuters, Financial Times, The Information, Wired, MIT Tech Review, Harvard Business Review | Most authoritative |
| Tier 2 | TechCrunch, The Verge, Ars Technica, VentureBeat, CNBC, Business Insider, Forbes, Fortune | Strong tech coverage |
| Tier 3 | Axios, Semafor, Quartz, Fast Company, Inc., Entrepreneur | Good business context |
| Tier 4 | ZDNet, CIO, InfoWorld, eWeek, SDxCentral | IT/enterprise focus |
| Tier 5 | Company blogs, press releases, niche outlets | Use when story is exclusive |

## STORIES TO AVOID - DO NOT SELECT THESE TYPES
- Leadership shuffles / executive moves (unless major strategic shift)
- Gossip / rumors / speculation
- Overly technical content without business relevance
- Stories already widely covered by tier 1 sources (look for the emerging story)
- Skip any stories about AI-generated imagery, deepfakes, or explicit content involving minors or children.

## EDITORIAL RULES - YOU MUST FOLLOW ALL OF THESE

### Rule 1: Recent Headlines (Last 14 Days)
**CRITICAL: Semantic Deduplication** - Do NOT select any story about the same topic/event as these recent headlines. Consider headlines as duplicates if they cover:
- The same announcement, deal, acquisition, or news event
- The same company action with different wording
- The same research study, product launch, or partnership

Even if headlines are worded differently, if they''re about the SAME underlying news, treat them as duplicates.

{recent_headlines}

### Rule 2: No Repeat Companies
Do NOT select a story about a company already selected in today''s issue:

{selected_companies}

### Rule 3: Source Diversity
Max 2 stories per source per day. Current source counts:

{selected_sources}

### Rule 4: Already Selected Today
Do NOT select a story already selected in Slots 1-3:

{selected_stories}

---

## CANDIDATES ({candidate_count} stories)

{candidates}

## SELECTION OUTPUT
Return ONLY valid JSON (no markdown, no explanation):
{{
  "slot": 4,
  "selected_id": "<storyId of chosen story>",
  "selected_headline": "<headline>",
  "selected_source": "<source name>",
  "selected_company": "<primary company mentioned, or null>",
  "selection_reasoning": "<1-2 sentences explaining why this story fits Slot 4>"
}}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow SZmPztKNEmisG3Zf - Dec 31, 2025'
);

-- SLOT 5 AGENT - MATCHED TO N8N WORKFLOW SZmPztKNEmisG3Zf
SELECT update_prompt_content(
    'slot_5_agent',
    E'You are selecting ONE story for **Slot 5** of a daily AI newsletter.

## Slot 5 should be:
- A **consumer AI interest piece**
- something that''s "nice to know" vs "need to know." NOT business, finance, or tech-focused.
- Instead, focus on:
  - AI''s impact on humanity
  - AI in everyday life (health, creativity, relationships, entertainment)
  - Human interest stories about AI
  - Cultural/societal implications of AI
  - AI helping solve real-world problems for regular people

This is the "feel good" or "thought-provoking" story that resonates beyond the business audience.

## SOURCE CREDIBILITY GUIDE
When multiple stories compete, use source credibility as a weighted factor (not disqualifying):
| Tier | Sources | Notes |
|------|---------|-------|
| Tier 1 | WSJ, NYT, Bloomberg, Reuters, Financial Times, The Information, Wired, MIT Tech Review, Harvard Business Review | Most authoritative |
| Tier 2 | TechCrunch, The Verge, Ars Technica, VentureBeat, CNBC, Business Insider, Forbes, Fortune | Strong tech coverage |
| Tier 3 | Axios, Semafor, Quartz, Fast Company, Inc., Entrepreneur | Good business context |
| Tier 4 | ZDNet, CIO, InfoWorld, eWeek, SDxCentral | IT/enterprise focus |
| Tier 5 | Company blogs, press releases, niche outlets | Use when story is exclusive |

## STORIES TO AVOID - DO NOT SELECT THESE TYPES
- Leadership shuffles / executive moves
- Business deals, fundraises, acquisitions (that''s Slot 4 territory)
- Overly technical content (model updates, benchmarks, algorithms)
- Enterprise/B2B focused stories
- Stock market / financial news
- Skip any stories about AI-generated imagery, deepfakes, or explicit content involving minors or children.

## EDITORIAL RULES - YOU MUST FOLLOW ALL OF THESE

### Rule 1: Recent Headlines (Last 14 Days)
**CRITICAL: Semantic Deduplication** - Do NOT select any story about the same topic/event as these recent headlines. Consider headlines as duplicates if they cover:
- The same announcement, deal, acquisition, or news event
- The same company action with different wording
- The same research study, product launch, or partnership

Even if headlines are worded differently, if they''re about the SAME underlying news, treat them as duplicates.

{recent_headlines}

### Rule 2: No Repeat Companies
Do NOT select a story about a company already selected in today''s issue:

{selected_companies}

### Rule 3: Source Diversity
Max 2 stories per source per day. Current source counts:

{selected_sources}

### Rule 4: Already Selected Today
Do NOT select a story already selected in Slots 1-4:

{selected_stories}

---

## CANDIDATES ({candidate_count} stories)

{candidates}

## SELECTION OUTPUT
Return ONLY valid JSON (no markdown, no explanation):
{{
  "slot": 5,
  "selected_id": "<storyId of chosen story>",
  "selected_headline": "<headline>",
  "selected_source": "<source name>",
  "selected_company": "<primary company mentioned, or null>",
  "selection_reasoning": "<1-2 sentences explaining why this story fits Slot 5>"
}}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow SZmPztKNEmisG3Zf - Dec 31, 2025'
);

-- SUBJECT LINE GENERATOR - MATCHED TO N8N WORKFLOW SZmPztKNEmisG3Zf
SELECT update_prompt_content(
    'subject_line',
    E'PIVOT 5 EMAIL COPY PROMPT — DELIVERABILITY-SAFE VERSION
Generate a subject line for a high-performing daily AI newsletter sent via Beehiiv, with explicit anti-spam and inbox placement guardrails.

---

CONTEXT
Pivot 5 is a premium AI newsletter written by a CEO for CEOs. Each edition includes 5 editorial stories formatted in HTML with a clear structure:

* Headline
* Image
* Three editorial bullet points (each with bolded key message)

The newsletter''s goal is to distill high-signal AI developments and present them in a bold, relevant, and engaging format for business leaders.

You''re writing:

* 1 subject line using the Top Story Hook strategy

---

DELIVERABILITY & ANTI-SPAM GUARDRAILS
Follow these rules to reduce spam-folder risk while keeping a strong editorial voice:

* No spam trigger language: avoid terms like free, act now, last chance, urgent, limited time, sale, discount, offer, exclusive deal, guaranteed, risk-free, click here, open now, congratulations, winner, verify your account.
* No deceptive prefixes or reply bait: do not use Re:, Fwd:/FW:, or "Regarding."
* No excessive punctuation or symbols: no exclamation marks; no multiple punctuation (??, !!, ?!); no emojis, hashtags, or ASCII art; no ellipses at start/end.
* Neutral, factual tone: no hype, no all caps, no over-promising, no calls to action that sound promotional.
* Character hygiene: standard punctuation; avoid unusual Unicode symbols; no leading/trailing spaces; no double spaces.
* Currency & numbers: prefer spelling out large amounts ("billion," "million") and keep numerals factual (no % off claims). If mentioning money, avoid currency symbols unless essential to the story.
* No dates, IDs, or tracking language: do not include specific dates, edition numbers, UTM-style strings, or "view in browser/unsubscribe" phrasing in copy.
* Company/product names only: reference real entities and features; avoid generic "newsletter," "issue," or "digest" phrasing.
* Self-audit before finalizing: if any line violates the above, rewrite it while preserving the editorial angle.

---

EMAIL SUBJECT LINE — FINALIZED WITH TITLE CASE
Write 1 subject line using the Top Story Hook strategy. The line must follow these rules:

STYLE & STRUCTURE RULES
✅ Use Title Case: Capitalize the first letter of every major word; lowercase short connector words (like "and," "or," "to," "with," "in") unless they start the line
❌ Do not use colons, semi-colons, dashes, or prefixes (e.g., avoid "Breaking", "Today''s Top Story", etc.)
❌ Do not include newsletter cliches like "AI Roundup", "Top Headlines", "AI Summary", "This Week in AI", etc.
❌ Do not include dates, edition numbers, or episode references

✅ Do not exceed 90 characters
✅ The subject line must be a clean, standalone sentence — no list formatting, no quotation marks
✅ No emojis, no exclamation marks, no deceptive reply/forward prefixes, no hype words (per guardrails)
✅ Keep stakes and outcomes clear and business-relevant; maintain a neutral, authoritative tone

TOP STORY HOOK STRATEGY
→ Focus on the lead story (Slot 1). Make it bold, crisp, and attention-grabbing without hype.

Examples:
Netflix Turns Browsing Into a Chatbot
OpenAI Expands Its Reach Into Enterprise Software
Perplexity Replaces Google on Samsung Phones

✅ Use active language and clear stakes
✅ The line must reference at least one real company, product, or named feature/tool
✅ No abstraction — this is editorial copy, not clickbait
✅ Deliverability check: no spam-trigger terms, no promotional tone, no excessive punctuation

---

OUTPUT FORMAT

Return ONLY the subject line as plain text. No JSON, no quotes, no explanation, no markdown.

Example output:
Netflix Turns Browsing Into a Chatbot

---

THE 5 STORIES FOR TODAY''S NEWSLETTER:

{all_headlines}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow SZmPztKNEmisG3Zf - Dec 31, 2025'
);

-- ============================================================================
-- STEP 3: DECORATION PROMPTS (Claude + Gemini)
-- ============================================================================

INSERT INTO system_prompts (prompt_key, step_id, name, description, model, temperature, slot_number, is_active)
VALUES
    ('content_cleaner', 3, 'Content Cleaner', 'Clean article content', 'gemini-2.0-flash-exp', 0.2, NULL, true),
    ('headline_generator', 3, 'Headline Generator', 'Generate newsletter headline', 'claude-sonnet-4-5-20250929', 0.7, NULL, true),
    ('bullet_generator', 3, 'Bullet Point Generator', 'Generate 3 bullet points', 'claude-sonnet-4-5-20250929', 0.7, NULL, true),
    ('bold_formatter', 3, 'Bold Formatter', 'Apply bold formatting', 'claude-sonnet-4-5-20250929', 0.3, NULL, true),
    ('image_prompt', 3, 'Image Prompt Generator', 'Generate image prompt', 'claude-sonnet-4-5-20250929', 0.8, NULL, true),
    ('image_generator', 3, 'Image Generator', 'Generate newsletter image', 'gemini-imagen', 0.7, NULL, true)
ON CONFLICT (prompt_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    model = EXCLUDED.model,
    temperature = EXCLUDED.temperature,
    updated_at = NOW();

SELECT update_prompt_content(
    'content_cleaner',
    E'Clean this article content by removing:
- Advertisements and promotional content
- Navigation elements and menu items
- Social media buttons and sharing links
- Cookie notices and popups
- Subscription prompts
- Author bios (keep byline only)
- Related article links
- Comments sections

ORIGINAL CONTENT:
{raw_content}

Return the cleaned article text only, preserving:
- Headline
- Byline
- Publication date
- Main article body
- Relevant quotes
- Key statistics',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'headline_generator',
    E'Generate a punchy, engaging headline for this newsletter story.

ORIGINAL HEADLINE: {original_headline}
ARTICLE SUMMARY: {summary}
SLOT: {slot_number} ({slot_focus})

GUIDELINES:
- Use Title Case
- Maximum 10 words
- Be specific and concrete
- Create interest without clickbait
- Match the tone of Pivot 5 (professional but accessible)

Return JSON only:
{{
  "headline": "Your Headline Here",
  "reasoning": "Why this headline works"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'bullet_generator',
    E'Generate 3 informative bullet points summarizing this article for the newsletter.

HEADLINE: {headline}
ARTICLE CONTENT: {content}

GUIDELINES:
- Each bullet should be 1-2 sentences
- Start with action verbs or key facts
- Cover the most important information
- Be specific with numbers and names
- Third bullet can include context or implications

Return JSON only:
{{
  "bullets": [
    "First bullet point...",
    "Second bullet point...",
    "Third bullet point..."
  ]
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'bold_formatter',
    E'Apply markdown bold formatting to key phrases in these bullet points.

BULLETS:
{bullets}

GUIDELINES:
- Bold 1-2 key phrases per bullet (not full sentences)
- Bold: company names, numbers/statistics, key terms
- Don''t bold: common words, entire sentences
- Use **text** markdown syntax

Return JSON only:
{{
  "formatted_bullets": [
    "Bullet with **key phrase** bolded...",
    "Another bullet with **important stat** highlighted...",
    "Third bullet with **company name** emphasized..."
  ]
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'image_prompt',
    E'Generate an image prompt for this newsletter story.

HEADLINE: {headline}
SUMMARY: {summary}
SLOT: {slot_number}

STYLE GUIDELINES:
- Professional, modern aesthetic
- Clean composition with single focal point
- Avoid text in the image
- Abstract or conceptual representations work well
- Blue, purple, and teal color palette preferred
- Suitable for business newsletter

Return JSON only:
{{
  "image_prompt": "Detailed description for image generation...",
  "style_notes": "Additional style guidance"
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

SELECT update_prompt_content(
    'image_generator',
    E'{image_prompt}

Style: Professional newsletter illustration, clean modern design, suitable for business audience.',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

-- ============================================================================
-- STEP 4: HTML COMPILE PROMPTS
-- ============================================================================

INSERT INTO system_prompts (prompt_key, step_id, name, description, model, temperature, slot_number, is_active)
VALUES
    ('summary_generator', 4, 'Summary Generator', 'Generate 15-word newsletter summary', 'claude-sonnet-4-5-20250929', 0.7, NULL, true)
ON CONFLICT (prompt_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    model = EXCLUDED.model,
    temperature = EXCLUDED.temperature,
    updated_at = NOW();

SELECT update_prompt_content(
    'summary_generator',
    E'Generate a 15-word summary of today''s newsletter for the email preview text.

TODAY''S STORIES:
1. {slot1_headline}
2. {slot2_headline}
3. {slot3_headline}
4. {slot4_headline}
5. {slot5_headline}

GUIDELINES:
- Exactly 15 words
- Mention 1-2 key stories
- Create interest to open the email
- Professional tone

Return JSON only:
{{
  "summary": "Your 15-word summary here..."
}}',
    NULL,
    'system@aieeditor.com',
    'Initial seed with Python variable syntax'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all prompts are present
SELECT
    prompt_key,
    step_id,
    name,
    model,
    temperature,
    (SELECT version FROM system_prompt_versions WHERE prompt_id = sp.id AND is_current = true) as version
FROM system_prompts sp
WHERE is_active = true
ORDER BY step_id, slot_number NULLS LAST;
