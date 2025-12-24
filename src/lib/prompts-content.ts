// Static prompt content - migrated from n8n workflows
// These prompts are used by the Python workers in the pipeline

export interface PromptContent {
  promptKey: string;
  content: string;
  version: number;
  lastModified: string;
}

// Step 1: Pre-Filter Prompts (from n8n Node 13: Gemini Pre-Filter)
export const prefilterPrompt = `You are a newsletter editor for Pivot 5, a daily AI newsletter.

Analyze this article and determine which newsletter slots (1-5) it is eligible for:

HEADLINE: {{ headline }}
DEK: {{ dek }}
SOURCE: {{ source }} (credibility: {{ credibilityScore }}/5)
AGE: {{ hoursAgo }} hours ago
TOPIC: {{ topic }}

SLOT DEFINITIONS:
1. JOBS/ECONOMY: AI impact on employment, workforce, stock market, broad economic impact. Must be <24 hours old.
2. TIER 1 AI: News about OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI. Research breakthroughs. Can be 24-48 hours old.
3. INDUSTRY IMPACT: AI in Healthcare, Government, Education, Legal, Accounting, Retail, Cybersecurity, Transportation, Manufacturing, Real Estate, Agriculture, Energy. Can be up to 7 days old.
4. EMERGING COMPANIES: Startups, product launches, funding rounds, acquisitions, new AI tools. Must be <48 hours old.
5. CONSUMER AI: Ethics, entertainment, lifestyle, societal impact, fun/quirky uses. Can be up to 7 days old.

YESTERDAY'S HEADLINES (avoid similar topics):
{{ yesterdayHeadlines }}

Return JSON only:
{
  "eligible_slots": [1, 2, ...],
  "primary_slot": 1,
  "reasoning": "Brief explanation"
}`;

// Map of all prompt content by prompt_key
export const promptsContent: Record<string, PromptContent> = {
  // Step 1: Pre-Filter (all 5 slots use same base prompt)
  slot_1_prefilter: {
    promptKey: "slot_1_prefilter",
    content: prefilterPrompt,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_2_prefilter: {
    promptKey: "slot_2_prefilter",
    content: prefilterPrompt,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_3_prefilter: {
    promptKey: "slot_3_prefilter",
    content: prefilterPrompt,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_4_prefilter: {
    promptKey: "slot_4_prefilter",
    content: prefilterPrompt,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_5_prefilter: {
    promptKey: "slot_5_prefilter",
    content: prefilterPrompt,
    version: 1,
    lastModified: "2024-12-23",
  },

  // Step 2: Slot Selection Agents
  slot_1_agent: {
    promptKey: "slot_1_agent",
    content: `You are selecting the lead story for Slot 1 of the Pivot 5 AI newsletter.

SLOT 1 FOCUS: AI impact on JOBS, ECONOMY, and MARKETS
- Employment disruption or creation
- Stock market movements related to AI
- Economic policy and AI
- Workforce transformation
- Broad societal/economic impact

CANDIDATES:
{{ candidates }}

YESTERDAY'S SLOT 1: {{ yesterdaySlot1 }}
(Avoid similar topics or sources)

Select the BEST story for Slot 1. Consider:
1. Freshness (must be <24 hours old)
2. Source credibility score
3. Headline impact and reader interest
4. Differentiation from yesterday

Return JSON:
{
  "selected_story_id": "...",
  "reasoning": "Brief explanation of why this story was selected"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_2_agent: {
    promptKey: "slot_2_agent",
    content: `You are selecting the story for Slot 2 of the Pivot 5 AI newsletter.

SLOT 2 FOCUS: TIER 1 AI COMPANIES + RESEARCH
- OpenAI, Google/DeepMind, Meta AI, NVIDIA, Microsoft, Anthropic, xAI, Amazon AWS AI
- Major research breakthroughs
- Product announcements from major players

CANDIDATES:
{{ candidates }}

ALREADY SELECTED: {{ selectedStories }}
(Cannot reuse these stories)

YESTERDAY'S SLOT 2: {{ yesterdaySlot2 }}
(Avoid similar topics or sources)

Select the BEST story for Slot 2. Consider:
1. Tier 1 company relevance
2. Freshness (can be 24-48 hours old)
3. Source credibility
4. Differentiation from selected stories and yesterday

Return JSON:
{
  "selected_story_id": "...",
  "reasoning": "Brief explanation"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_3_agent: {
    promptKey: "slot_3_agent",
    content: `You are selecting the story for Slot 3 of the Pivot 5 AI newsletter.

SLOT 3 FOCUS: INDUSTRY-SPECIFIC AI APPLICATIONS
- Healthcare, Government, Education, Legal
- Accounting, Retail, Cybersecurity
- Transportation, Manufacturing, Real Estate
- Agriculture, Energy

CANDIDATES:
{{ candidates }}

ALREADY SELECTED: {{ selectedStories }}
(Cannot reuse these stories)

YESTERDAY'S SLOT 3: {{ yesterdaySlot3 }}
(Avoid similar industries or sources)

Select the BEST story for Slot 3. Consider:
1. Clear industry application
2. Can be up to 7 days old
3. Source credibility
4. Different industry than yesterday if possible

Return JSON:
{
  "selected_story_id": "...",
  "reasoning": "Brief explanation"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_4_agent: {
    promptKey: "slot_4_agent",
    content: `You are selecting the story for Slot 4 of the Pivot 5 AI newsletter.

SLOT 4 FOCUS: EMERGING COMPANIES
- Startups and new entrants
- Product launches
- Funding rounds and acquisitions
- New AI tools and applications

CANDIDATES:
{{ candidates }}

ALREADY SELECTED: {{ selectedStories }}
(Cannot reuse these stories)

YESTERDAY'S SLOT 4: {{ yesterdaySlot4 }}
(Avoid similar companies or themes)

Select the BEST story for Slot 4. Consider:
1. Fresh, exciting company news
2. Must be <48 hours old
3. Source credibility
4. Interesting angle for readers

Return JSON:
{
  "selected_story_id": "...",
  "reasoning": "Brief explanation"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  slot_5_agent: {
    promptKey: "slot_5_agent",
    content: `You are selecting the story for Slot 5 of the Pivot 5 AI newsletter.

SLOT 5 FOCUS: CONSUMER AI / HUMAN INTEREST
- AI ethics and societal debates
- Entertainment and lifestyle applications
- Fun, quirky, or surprising AI uses
- Human interest stories about AI

CANDIDATES:
{{ candidates }}

ALREADY SELECTED: {{ selectedStories }}
(Cannot reuse these stories)

YESTERDAY'S SLOT 5: {{ yesterdaySlot5 }}
(Avoid similar themes)

Select the BEST story for Slot 5. Consider:
1. Reader engagement potential
2. Can be up to 7 days old
3. Unique or surprising angle
4. Good "end of newsletter" feel

Return JSON:
{
  "selected_story_id": "...",
  "reasoning": "Brief explanation"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  subject_line: {
    promptKey: "subject_line",
    content: `Generate a compelling email subject line for today's Pivot 5 AI newsletter.

TODAY'S STORIES:
Slot 1 (Lead): {{ slot1Headline }}
Slot 2 (Tier 1): {{ slot2Headline }}
Slot 3 (Industry): {{ slot3Headline }}
Slot 4 (Emerging): {{ slot4Headline }}
Slot 5 (Consumer): {{ slot5Headline }}

GUIDELINES:
- Maximum 50 characters
- Create urgency or curiosity
- Reference the most impactful story
- Avoid clickbait but be compelling
- Use title case

RECENT SUBJECT LINES (avoid similar patterns):
{{ recentSubjectLines }}

Return JSON:
{
  "subject_line": "Your Subject Line Here",
  "reasoning": "Why this subject line works"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },

  // Step 3: Decoration Prompts
  content_cleaner: {
    promptKey: "content_cleaner",
    content: `Clean this article content by removing:
- Advertisements and promotional content
- Navigation elements and menu items
- Social media buttons and sharing links
- Cookie notices and popups
- Subscription prompts
- Author bios (keep byline only)
- Related article links
- Comments sections

ORIGINAL CONTENT:
{{ rawContent }}

Return the cleaned article text only, preserving:
- Headline
- Byline
- Publication date
- Main article body
- Relevant quotes
- Key statistics`,
    version: 1,
    lastModified: "2024-12-23",
  },
  headline_generator: {
    promptKey: "headline_generator",
    content: `Generate a punchy, engaging headline for this newsletter story.

ORIGINAL HEADLINE: {{ originalHeadline }}
ARTICLE SUMMARY: {{ summary }}
SLOT: {{ slotNumber }} ({{ slotFocus }})

GUIDELINES:
- Use Title Case
- Maximum 10 words
- Be specific and concrete
- Create interest without clickbait
- Match the tone of Pivot 5 (professional but accessible)

Return JSON:
{
  "headline": "Your Headline Here",
  "reasoning": "Why this headline works"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  bullet_generator: {
    promptKey: "bullet_generator",
    content: `Generate 3 informative bullet points summarizing this article for the newsletter.

HEADLINE: {{ headline }}
ARTICLE CONTENT: {{ content }}

GUIDELINES:
- Each bullet should be 1-2 sentences
- Start with action verbs or key facts
- Cover the most important information
- Be specific with numbers and names
- Third bullet can include context or implications

Return JSON:
{
  "bullets": [
    "First bullet point...",
    "Second bullet point...",
    "Third bullet point..."
  ]
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  bold_formatter: {
    promptKey: "bold_formatter",
    content: `Apply markdown bold formatting to key phrases in these bullet points.

BULLETS:
{{ bullets }}

GUIDELINES:
- Bold 1-2 key phrases per bullet (not full sentences)
- Bold: company names, numbers/statistics, key terms
- Don't bold: common words, entire sentences
- Use **text** markdown syntax

Return JSON:
{
  "formatted_bullets": [
    "Bullet with **key phrase** bolded...",
    "Another bullet with **important stat** highlighted...",
    "Third bullet with **company name** emphasized..."
  ]
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  image_prompt: {
    promptKey: "image_prompt",
    content: `Generate an image prompt for this newsletter story.

HEADLINE: {{ headline }}
SUMMARY: {{ summary }}
SLOT: {{ slotNumber }}

STYLE GUIDELINES:
- Professional, modern aesthetic
- Clean composition with single focal point
- Avoid text in the image
- Abstract or conceptual representations work well
- Blue, purple, and teal color palette preferred
- Suitable for business newsletter

Return JSON:
{
  "image_prompt": "Detailed description for image generation...",
  "style_notes": "Additional style guidance"
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
  image_generator: {
    promptKey: "image_generator",
    content: `{{ imagePrompt }}

Style: Professional newsletter illustration, clean modern design, suitable for business audience.`,
    version: 1,
    lastModified: "2024-12-23",
  },

  // Step 4: HTML Compile
  summary_generator: {
    promptKey: "summary_generator",
    content: `Generate a 15-word summary of today's newsletter for the email preview text.

TODAY'S STORIES:
1. {{ slot1Headline }}
2. {{ slot2Headline }}
3. {{ slot3Headline }}
4. {{ slot4Headline }}
5. {{ slot5Headline }}

GUIDELINES:
- Exactly 15 words
- Mention 1-2 key stories
- Create interest to open the email
- Professional tone

Return JSON:
{
  "summary": "Your 15-word summary here..."
}`,
    version: 1,
    lastModified: "2024-12-23",
  },
};

// Helper function to get prompt content by key
export function getPromptContent(promptKey: string): PromptContent | null {
  return promptsContent[promptKey] || null;
}

// Helper function to get all prompts for a step
export function getPromptsForStep(stepId: number): PromptContent[] {
  const stepPromptKeys: Record<number, string[]> = {
    1: ["slot_1_prefilter", "slot_2_prefilter", "slot_3_prefilter", "slot_4_prefilter", "slot_5_prefilter"],
    2: ["slot_1_agent", "slot_2_agent", "slot_3_agent", "slot_4_agent", "slot_5_agent", "subject_line"],
    3: ["content_cleaner", "headline_generator", "bullet_generator", "bold_formatter", "image_prompt", "image_generator"],
    4: ["summary_generator"],
    5: [],
  };

  const keys = stepPromptKeys[stepId] || [];
  return keys.map(key => promptsContent[key]).filter(Boolean);
}
