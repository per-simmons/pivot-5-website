-- AI Editor 2.0: Update STEP 3 Decoration Prompts
-- Date: January 1, 2026
-- Source: Extracted from n8n workflow HCbd2g852rkQgSqr
--
-- CRITICAL CHANGES FROM OLD VERSION:
-- 1. Bolding uses HTML <b> tags instead of Markdown **
-- 2. Field names: ai_bullet_1/2/3 instead of b1/b2/b3
-- 3. Added 18 label categories from n8n
-- 4. Added CEO audience context
-- 5. Added "EXACTLY 2 sentences" rule
-- 6. Uses gemini-3-flash-preview for content cleaner

-- ============================================================================
-- UPDATE STEP 3 PROMPT METADATA
-- ============================================================================

-- Fix content_cleaner model (was gemini-2.0-flash-exp, should be gemini-3-flash-preview)
UPDATE system_prompts
SET model = 'gemini-3-flash-preview',
    temperature = 0.1,
    updated_at = NOW()
WHERE prompt_key = 'content_cleaner';

-- Update headline_generator (combines headline, dek, bullets, label)
UPDATE system_prompts
SET model = 'claude-sonnet-4-5-20250929',
    temperature = 0.5,
    name = 'Content Creator',
    description = 'Generate headline, dek, bullets, and label for newsletter story',
    updated_at = NOW()
WHERE prompt_key = 'headline_generator';

-- Update bold_formatter
UPDATE system_prompts
SET model = 'claude-sonnet-4-5-20250929',
    temperature = 0.3,
    name = 'Bolding Pass',
    description = 'Add HTML <b> tags to highlight key phrases in bullets',
    updated_at = NOW()
WHERE prompt_key = 'bold_formatter';

-- ============================================================================
-- UPDATE CONTENT CLEANER PROMPT (Gemini 3 Flash)
-- ============================================================================

SELECT update_prompt_content(
    'content_cleaner',
    E'You are a content extraction assistant. Extract ONLY the main article body text from the following scraped web content.

Remove ALL of the following:
- Navigation menus and links
- Skip to content / accessibility links
- Share buttons (Share on Facebook, Copy link, etc.)
- Ad placeholders and sponsored content
- Footer links and related articles
- Author bios and newsletter signup prompts
- Sidebar widgets and table of contents
- Cookie notices and privacy banners
- Comments sections
- Return ONLY the clean article prose.

Do not add any commentary or headers

SCRAPED CONTENT:
{raw_content}',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - Jan 1, 2026'
);

-- ============================================================================
-- UPDATE HEADLINE GENERATOR → CONTENT CREATOR PROMPT (Claude Sonnet 4.5)
-- This is the MASTER PROMPT from n8n
-- ============================================================================

SELECT update_prompt_content(
    'headline_generator',
    E'MASTER PROMPT — PIVOT 5 AI NEWSLETTER CONTENT CREATION

## YOUR ROLE
You are an expert newsletter editor creating content for Pivot 5''s AI-focused newsletter.

## AUDIENCE
- CEOs, founders, general managers, and senior business leaders
- They are busy, strategic thinkers who want actionable insights
- They care about business impact, competitive dynamics, and what matters for decision-making

## VOICE & STYLE
- Confident, clear, informed — like a trusted advisor briefing an executive
- Present tense, active voice
- No jargon, no hedging (avoid "could/might/possibly")
- Avoid vague terms like "impact" or "transformation" — stick to concrete business consequences
- Professional but not stiff

## OUTPUT FORMAT
Return ONLY valid JSON with these exact fields:

{{
  "label": "CATEGORY from list below",
  "ai_headline": "Title Case headline, one sentence, NO colons or semi-colons",
  "ai_dek": "One sentence hook/subtitle",
  "ai_bullet_1": "EXACTLY 2 sentences - the main announcement or news",
  "ai_bullet_2": "EXACTLY 2 sentences - additional context or details",
  "ai_bullet_3": "EXACTLY 2 sentences - key insight, implication, or what happens next",
  "source": "Publication name (e.g., TechCrunch, The Information)",
  "clean_url": "Original URL without tracking parameters",
  "image_prompt": "Brief visual description for an illustrative image"
}}

## LABEL OPTIONS (choose exactly one):
WORK, EDUCATION, INFRASTRUCTURE, POLICY, TALENT, HEALTH, RETAIL, ENTERPRISE, COMPETITION, FUNDING, SECURITY, TOOLS, SEARCH, INVESTORS, CHINA, REGULATION, ETHICS, LAWSUITS

## CRITICAL RULES FOR BULLETS
1. Each bullet MUST be EXACTLY 2 sentences. Not 1. Not 3. Exactly 2.
2. Bullet 1: Lead with the news — what happened, who did it, what changed
3. Bullet 2: Context — why this matters, what it means, relevant background
4. Bullet 3: Forward-looking — implications, what to watch, competitive dynamics
5. Keep each bullet concise but complete — typically 25-45 words per bullet

## HEADLINE RULES
- Title Case (capitalize major words)
- One complete sentence
- NO colons, semi-colons, or em-dashes
- Focus on the most newsworthy element
- Make it scannable and specific

=== NEWSLETTER STYLE ===
{newsletter_style}

=== ARTICLE METADATA ===
URL: {core_url}
Headline: {headline}
Source: {source_id}
Published: {date_published}
Newsletter: {newsletter}

=== ARTICLE CONTENT ===
{cleaned_content}

Return ONLY the JSON object. No commentary, no code fences, no explanation.',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - MASTER PROMPT - Jan 1, 2026'
);

-- ============================================================================
-- UPDATE BOLD FORMATTER PROMPT (Claude Sonnet 4.5)
-- Uses HTML <b> tags, NOT Markdown **
-- ============================================================================

SELECT update_prompt_content(
    'bold_formatter',
    E'You are a formatting assistant. Your task is to add HTML bold tags to highlight the most important phrase in each bullet point.

## INSTRUCTIONS

For each bullet field (ai_bullet_1, ai_bullet_2, ai_bullet_3):
1. Identify the SINGLE most important phrase (5-15 words) that captures the key information
2. Wrap that phrase in HTML bold tags: <b>phrase here</b>
3. Only bold ONE phrase per bullet
4. Do NOT bold entire sentences
5. Do NOT change any wording, punctuation, or content

## INPUT JSON
{{
  "label": "{label}",
  "ai_headline": "{ai_headline}",
  "ai_dek": "{ai_dek}",
  "ai_bullet_1": "{ai_bullet_1}",
  "ai_bullet_2": "{ai_bullet_2}",
  "ai_bullet_3": "{ai_bullet_3}",
  "source": "{source}",
  "clean_url": "{clean_url}"
}}

## OUTPUT FORMAT
Return the COMPLETE JSON object with only the bullet fields modified to include <b></b> tags.

## EXAMPLE
Input bullet: "Netflix launched a new AI-powered recommendation engine. The feature uses machine learning to predict viewing preferences."
Output bullet: "Netflix <b>launched a new AI-powered recommendation engine</b>. The feature uses machine learning to predict viewing preferences."

Return ONLY the JSON object. No code fences, no commentary.',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - HTML <b> tags - Jan 1, 2026'
);

-- ============================================================================
-- ADD NEWSLETTER STYLE PROMPTS (3 variants)
-- ============================================================================

-- First add the prompt metadata for newsletter styles
INSERT INTO system_prompts (prompt_key, step_id, name, description, model, temperature, slot_number, is_active)
VALUES
    ('pivot_ai_style', 3, 'Pivot AI Newsletter Style', 'Style variant for pivot_ai newsletter', 'claude-sonnet-4-5-20250929', 0.5, NULL, true),
    ('pivot_build_style', 3, 'Pivot Build Newsletter Style', 'Style variant for pivot_build newsletter', 'claude-sonnet-4-5-20250929', 0.5, NULL, true),
    ('pivot_invest_style', 3, 'Pivot Invest Newsletter Style', 'Style variant for pivot_invest newsletter', 'claude-sonnet-4-5-20250929', 0.5, NULL, true)
ON CONFLICT (prompt_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    model = EXCLUDED.model,
    temperature = EXCLUDED.temperature,
    updated_at = NOW();

-- Pivot AI Style (default)
SELECT update_prompt_content(
    'pivot_ai_style',
    E'Audience: professionals following the AI field, not just technology broadly.
Focus: capabilities, limitations, ecosystem dynamics, and real-world impact.
Tone: sharp, skeptical of hype, but accessible to a broad tech/business audience.

Global Writing Rules:
- Write for busy CEOs - clear, confident, direct.
- Present tense, active voice.
- No jargon, no "could/might/possibly".
- Avoid vague terms like "impact" or "transformation".
- Stick to business consequences.
- EXACTLY 2 sentences per bullet.
- Headline: Title Case, one sentence, NO colons or semi-colons.',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - Jan 1, 2026'
);

-- Pivot Build Style
SELECT update_prompt_content(
    'pivot_build_style',
    E'Audience: builders, product managers, and operators.
Focus: execution, experiments, roadmaps, concrete takeaways they can apply.
Tone: practical, direct, builder-focused. Avoid fluff; highlight what matters for shipping and strategy.

Global Writing Rules:
- Write for busy CEOs - clear, confident, direct.
- Present tense, active voice.
- No jargon, no "could/might/possibly".
- Avoid vague terms like "impact" or "transformation".
- Stick to business consequences.
- EXACTLY 2 sentences per bullet.
- Headline: Title Case, one sentence, NO colons or semi-colons.',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - Jan 1, 2026'
);

-- Pivot Invest Style
SELECT update_prompt_content(
    'pivot_invest_style',
    E'Audience: investors and markets-focused readers.
Focus: capital flows, business models, risk/reward, unit economics, competition, and macro context.
Tone: analytical, concise, focused on what moves valuations or changes an investment thesis.

Global Writing Rules:
- Write for busy CEOs - clear, confident, direct.
- Present tense, active voice.
- No jargon, no "could/might/possibly".
- Avoid vague terms like "impact" or "transformation".
- Stick to business consequences.
- EXACTLY 2 sentences per bullet.
- Headline: Title Case, one sentence, NO colons or semi-colons.',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - Jan 1, 2026'
);

-- ============================================================================
-- ADD SENSITIVE WORDS FILTER PROMPT
-- ============================================================================

INSERT INTO system_prompts (prompt_key, step_id, name, description, model, temperature, slot_number, is_active)
VALUES
    ('sensitive_words_filter', 3, 'Sensitive Words Filter', 'Filter stories with sensitive content before image generation', 'regex', 0.0, NULL, true)
ON CONFLICT (prompt_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Store the regex pattern for sensitive content
SELECT update_prompt_content(
    'sensitive_words_filter',
    E'\\bsex\\b|sexual|porn|pornographic|adult content|xxx|nsfw|fetish|escort|prostitute|nude|nudity|orgy|incest|bestiality|masturb|hardcore|softcore|explicit|graphic sexual|erotic|sensual|onlyfans|strip club|cam girl|camgirl|cam-boy|sex worker|sexualized|underage|minor.*sexual',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - Jan 1, 2026'
);

-- ============================================================================
-- UPDATE IMAGE GENERATOR PROMPT (Gemini 3 Pro Image)
-- ============================================================================

UPDATE system_prompts
SET model = 'gemini-3-pro-image-preview',
    temperature = 0.7,
    updated_at = NOW()
WHERE prompt_key = 'image_generator';

SELECT update_prompt_content(
    'image_generator',
    E'Create a clean, minimal, informative landscape infographic based on this AI news story.

DESIGN REQUIREMENTS:
- Aspect ratio: 16:9
- MINIMAL TEXT - prioritize icons and visuals over words
- Orange accent color: #ff6f00 for accents and highlights
- White or light gray background
- Plenty of white space
- Modern, premium aesthetic

Story Context:
Headline: {ai_headline}

Key Points (if available):
- {ai_bullet_1}
- {ai_bullet_2}
- {ai_bullet_3}

Style: Soft watercolor aesthetic with orange (#ff6f00) accents. Clean typography. NO clutter.',
    NULL,
    'system@aieeditor.com',
    'Matched to n8n workflow HCbd2g852rkQgSqr - Jan 1, 2026'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify Step 3 prompts are updated
SELECT
    prompt_key,
    step_id,
    name,
    model,
    temperature,
    (SELECT version FROM system_prompt_versions WHERE prompt_id = sp.id AND is_current = true) as version,
    updated_at
FROM system_prompts sp
WHERE step_id = 3 AND is_active = true
ORDER BY prompt_key;
