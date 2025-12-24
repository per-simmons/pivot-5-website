"use client";

import { useState, Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromptConfig } from "@/lib/step-config";

// Lazy load Monaco editor to avoid SSR issues
const PromptEditor = lazy(() =>
  import("@/components/ui/prompt-editor").then((mod) => ({ default: mod.PromptEditor }))
);

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)}>
      {name}
    </span>
  );
}

interface SystemPromptsProps {
  stepId: number;
  prompts: PromptConfig[];
}

// Mock prompt content - in production this would come from PostgreSQL
// These prompts match what's actually running in n8n workflows
const mockPromptContent: Record<string, string> = {
  // ========== STEP 1: PRE-FILTER PROMPTS (Gemini 3 Flash) ==========
  slot_1_prefilter: `You are a pre-filter for an AI newsletter's lead story slot.

Review these candidates and identify ONLY stories about:
1. AI impact on JOBS (layoffs, hiring, workforce changes, labor market)
2. AI impact on ECONOMY (GDP, productivity, economic shifts, industry-wide effects)
3. AI STOCK MARKET / VALUATIONS (market moves, IPOs, funding rounds, earnings)
4. BROAD AI IMPACT (societal, regulatory, not company-specific product launches)

Return the story_id value for each matching article.
Return ONLY valid JSON:
{
  "matches": [
    { "story_id": "rec123ABC", "headline": "headline text" }
  ]
}`,

  slot_2_prefilter: `You are a pre-filter for Slot 2 (Tier 1 / Insight) of an AI newsletter.

Review these candidates and identify stories that fit ANY of these criteria:

1. TIER 1 AI COMPANIES: OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon
   - But NOT just a passing mention - the story should be PRIMARILY about the company
   - The list above is not exhaustive - use judgment for other major AI players

2. BROAD ECONOMIC THEMES related to AI, including but not limited to:
   - Industry-wide AI adoption
   - AI's impact on productivity, business operations
   - Economic shifts driven by AI

3. AI RESEARCH / INSIGHT PIECES, including but not limited to:
   - Studies, reports, analysis about AI trends
   - Not breaking news - thoughtful analysis
   - Adoption patterns, usage statistics, benchmarks

Return ONLY valid JSON with matches array.`,

  slot_3_prefilter: `You are a pre-filter for Slot 3 (Industry Impact) of an AI newsletter.

Slot 3 focuses on how AI is impacting NON-TECH industries. Identify stories that fit:

**ELIGIBLE INDUSTRIES:** Healthcare, Government, Education, Legal, Accounting, Retail, Security, Transportation, Manufacturing, Real Estate, Agriculture, Energy

**WHAT TO LOOK FOR:**
- AI adoption in these industries
- AI impact on industry operations
- Regulatory changes affecting AI in these sectors
- Case studies of AI implementation

**Do NOT include:**
- Stories primarily about tech companies (those go to Slots 1-2)
- Stories about small/emerging AI startups (those go to Slot 4)
- Human interest / consumer AI stories (those go to Slot 5)
- Leadership shuffles

Return ONLY valid JSON with matches array.`,

  slot_4_prefilter: `You are a pre-filter for Slot 4 (Emerging Companies) of an AI newsletter.

Slot 4 focuses on smaller/emerging AI companies (NOT Tier 1 giants like OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon).

**WHAT TO LOOK FOR:**
- Product launches from emerging AI companies
- Big fundraising rounds (Series A, B, C, etc.)
- Acquisition news involving smaller players
- New AI tool/service launches
- Startup milestones and achievements

**Do NOT include:**
- Stories primarily about Tier 1 companies
- Industry-specific AI impact (those go to Slot 3)
- Human interest / consumer AI stories (those go to Slot 5)
- Leadership shuffles

Return ONLY valid JSON with matches array.`,

  slot_5_prefilter: `You are a pre-filter for Slot 5 (Consumer AI / Human Interest) of an AI newsletter.

Slot 5 focuses on consumer-friendly AI stories - the "nice to know" pieces about AI's impact on everyday life.

**WHAT TO LOOK FOR:**
- AI's impact on humanity and society
- Consumer AI products and experiences
- AI in arts, entertainment, creativity
- AI ethics and philosophical questions
- Heartwarming or thought-provoking AI stories
- Fun, quirky, or surprising AI use cases

**Do NOT include:**
- Business/enterprise AI news (those go to Slots 1-4)
- Technical/developer focused stories
- Fundraising, acquisitions, corporate news
- Industry-specific B2B applications
- Leadership changes

**TONE:** "Nice to know" not "need to know"

Return ONLY valid JSON with matches array.`,

  // ========== STEP 2: SLOT AGENT PROMPTS (Claude Sonnet) ==========
  slot_1_agent: `You are selecting ONE story for **Slot 1** (Breaking News) of a daily AI newsletter.

## Slot 1 is ALWAYS one of:
- OpenAI OR Google OR Meta OR Nvidia; or
- AI impact on jobs or
- AI impact on economy or
- AI stock market / valuations

## SOURCE CREDIBILITY GUIDE
| Score | Sources | Weight |
|-------|---------|--------|
| 5 | TechCrunch, The Verge, TAAFT | High - prefer when available |
| 4 | Bloomberg, WSJ, NYTimes | Good - reliable sources |
| 3 | CNBC, Semafor | Moderate - acceptable sources |
| 2 | Unknown/unlisted | Lower weight - but story quality matters most |

## STORIES TO AVOID - DO NOT SELECT THESE TYPES
- Leadership shuffles and personnel moves
- AI gossip ("AI leader predicts...", rumors, speculation)
- Geeky/techy content (model updates, AGI discussions, algorithm details)
- Content interesting to engineers but not business people

**Editorial lens:** "For a working professional, is this useful to me right now, in my job and day to day?"

## EDITORIAL RULES
1. Yesterday's headlines - Do NOT select same topic as yesterday
2. Don't select the same Slot 1 company twice

Return ONLY valid JSON with selected_id, selected_headline, selected_source, selected_company, credibility_score, reasoning.`,

  slot_2_agent: `You are selecting ONE story for **Slot 2** (Recent Important News) of a daily AI newsletter.

## Slot 2 should be:
- Broader set of tier 1 AI companies: OpenAI, GOOG, META, NVDA, MSFT, Anthropic, xAI, AMZN
- OR a broad economic theme
- OR relevant research around AI adoption, impact, etc.

## STORIES TO AVOID
- Leadership shuffles and personnel moves
- AI gossip ("AI leader predicts...", rumors, speculation)
- Geeky/techy content (model updates, AGI discussions)
- Content interesting to engineers but not business people

## EDITORIAL RULES
1. Yesterday's headlines - Do NOT select same topic as yesterday
2. No repeat companies today - Don't select company already featured
3. Source diversity - Max 2 stories per source
4. Already Selected Today - Do NOT select story from Slot 1

Return ONLY valid JSON with selection details.`,

  slot_3_agent: `You are selecting ONE story for **Slot 3** (Evergreen/Feature Content) of a daily AI newsletter.

## Slot 3 should be:
- Industry-specific trend/theme/insight/news (healthcare, govt, education, transportation, legal, accounting, etc.)
- i.e., a non-tech industry being impacted positively/negatively/neutrally by AI

## STORIES TO AVOID
- Leadership shuffles and personnel moves
- AI gossip
- Geeky/techy content
- Content interesting to engineers but not business people

## EDITORIAL RULES
1. Yesterday's headlines - Do NOT select same topic as yesterday
2. No repeat companies today
3. Source diversity - Max 2 stories per source
4. Already Selected Today - Do NOT select story from Slots 1-2

Return ONLY valid JSON with selection details.`,

  slot_4_agent: `You are selecting ONE story for **Slot 4** of a daily AI newsletter.

## Slot 4 should be:
Company-specific news from a **less known company** (not tier 1 like OpenAI, Google, Meta, Nvidia, Microsoft, Amazon, Apple). It's okay if the company isn't recognizable, but the news should be interesting/impactful:
- Product feature launch
- Big fundraise
- Major partnership or acquisition
- Significant growth milestone

## STORIES TO AVOID
- Leadership shuffles / executive moves (unless major strategic shift)
- Gossip / rumors / speculation
- Overly technical content without business relevance
- Stories already widely covered by tier 1 sources

## EDITORIAL RULES
1. Yesterday's Headlines - Do NOT select same topic
2. No Repeat Companies - Don't select company already in today's issue
3. Source Diversity - Max 2 stories per source per day
4. Already Selected Today - Do NOT select from Slots 1-3

Return ONLY valid JSON with slot, selected_id, selected_headline, selected_source, selected_company, selection_reasoning.`,

  slot_5_agent: `You are selecting ONE story for **Slot 5** of a daily AI newsletter.

## Slot 5 should be:
- A **consumer AI interest piece**
- Something that's "nice to know" vs "need to know." NOT business, finance, or tech-focused.
- Instead, focus on:
  - AI's impact on humanity
  - AI in everyday life (health, creativity, relationships, entertainment)
  - Human interest stories about AI
  - Cultural/societal implications of AI
  - AI helping solve real-world problems for regular people

This is the "feel good" or "thought-provoking" story that resonates beyond the business audience.

## STORIES TO AVOID
- Leadership shuffles / executive moves
- Business deals, fundraises, acquisitions (that's Slot 4 territory)
- Overly technical content (model updates, benchmarks, algorithms)
- Enterprise/B2B focused stories
- Stock market / financial news

## EDITORIAL RULES
1. Yesterday's Headlines - Do NOT select same topic
2. No Repeat Companies
3. Source Diversity - Max 2 per source
4. Already Selected Today - Do NOT select from Slots 1-4

Return ONLY valid JSON with selection details.`,

  // ========== STEP 2: SUBJECT LINE GENERATOR ==========
  subject_line: `Generate a compelling email subject line for today's AI newsletter issue.

The subject line should:
- Be based on the Slot 1 (lead) story
- Maximum 60 characters
- Create curiosity without being clickbait
- Be professional but engaging
- Avoid ALL CAPS or excessive punctuation

Return ONLY the subject line text, no quotes or explanation.`,

  // ========== STEP 3: DECORATION PROMPTS ==========
  content_cleaner: `Clean this article content by removing:
- Ads, navigation, and UI elements
- Formatting artifacts and HTML remnants
- Author bios and social media links
- Related article sections

Return ONLY the cleaned article body text.`,

  headline_generator: `Generate a punchy, engaging headline for this newsletter story.

REQUIREMENTS:
- Title Case formatting
- Maximum 80 characters
- Punchy and attention-grabbing
- Avoid clickbait or sensationalism
- Accurately represent the story content

Return ONLY the headline text, no quotes or explanation.`,

  bullet_generator: `Generate 3 informative bullet points for this newsletter story.

REQUIREMENTS:
- Each bullet is exactly 2 sentences
- Maximum 260 characters per bullet
- First bullet: Main announcement or news
- Second bullet: Key details and context
- Third bullet: Business impact or implications

Format:
• [Bullet 1]
• [Bullet 2]
• [Bullet 3]`,

  bold_formatter: `Apply markdown bold formatting to key phrases in these bullet points.

REQUIREMENTS:
- Bold 1-2 key phrases per bullet (not entire sentences)
- Focus on: company names, numbers/statistics, action words
- Use **double asterisks** for bold

Return the bullets with bold formatting applied.`,

  image_prompt: `Generate an image prompt for this newsletter story.

The image should:
- Be professional and editorial in style
- Represent the story's key theme visually
- Avoid text or logos
- Work well at small newsletter thumbnail size

Return a 1-2 sentence image generation prompt.`,

  // ========== STEP 4: SUMMARY GENERATOR ==========
  summary_generator: `Generate a 15-word summary of today's newsletter for the email preview text.

The summary should:
- Highlight the most compelling stories
- Create curiosity to open the email
- Be conversational but professional

Return ONLY the 15-word summary.`,
};

export function SystemPrompts({ stepId, prompts }: SystemPromptsProps) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    new Set([prompts[0]?.id])
  );
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>(mockPromptContent);
  const [hasChanges, setHasChanges] = useState<Set<string>>(new Set());

  const toggleExpand = (promptId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  };

  const handleEdit = (promptId: string) => {
    setEditingPrompt(promptId);
    if (!expandedPrompts.has(promptId)) {
      setExpandedPrompts((prev) => new Set([...prev, promptId]));
    }
  };

  const handleSave = (promptId: string) => {
    setEditingPrompt(null);
    setHasChanges((prev) => {
      const next = new Set(prev);
      next.delete(promptId);
      return next;
    });
    // In production, this would call an API to save to PostgreSQL
  };

  const handleRevert = (promptId: string) => {
    setPromptTexts((prev) => ({
      ...prev,
      [promptId]: mockPromptContent[promptId] ?? "",
    }));
    setHasChanges((prev) => {
      const next = new Set(prev);
      next.delete(promptId);
      return next;
    });
    setEditingPrompt(null);
  };

  const handleTextChange = (promptId: string, text: string) => {
    setPromptTexts((prev) => ({ ...prev, [promptId]: text }));
    if (text !== mockPromptContent[promptId]) {
      setHasChanges((prev) => new Set([...prev, promptId]));
    } else {
      setHasChanges((prev) => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Prompt Cards */}
      {prompts.map((prompt) => {
        const isExpanded = expandedPrompts.has(prompt.id);
        const isEditing = editingPrompt === prompt.id;
        const promptHasChanges = hasChanges.has(prompt.id);
        const content = promptTexts[prompt.id] ?? "";

        return (
          <Card key={prompt.id}>
            <CardHeader className="pb-4 cursor-pointer" onClick={() => !isEditing && toggleExpand(prompt.id)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon
                    name={isExpanded ? "expand_less" : "expand_more"}
                    className="text-muted-foreground"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{prompt.name}</CardTitle>
                      {prompt.slotNumber && (
                        <Badge variant="outline" className="font-mono text-xs">
                          Slot {prompt.slotNumber}
                        </Badge>
                      )}
                      {promptHasChanges && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          Unsaved
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{prompt.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {prompt.model}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    temp: {prompt.temperature}
                  </Badge>
                  {isExpanded && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(prompt.id)}
                    >
                      <MaterialIcon name="edit" className="text-base" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {isEditing ? (
                  <div className="space-y-4">
                    <Suspense
                      fallback={
                        <div className="w-full h-64 rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                          Loading editor...
                        </div>
                      }
                    >
                      <PromptEditor
                        value={content}
                        onChange={(value) => handleTextChange(prompt.id, value)}
                        minHeight={256}
                        maxHeight={400}
                      />
                    </Suspense>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Last modified: Dec 20, 2025 by pat@pivotstudio.ai
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(prompt.id)}
                        >
                          Revert
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(prompt.id)}
                          disabled={!promptHasChanges}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <MaterialIcon name="save" className="text-base mr-1" />
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Suspense
                      fallback={
                        <div className="w-full h-64 rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                          Loading...
                        </div>
                      }
                    >
                      <PromptEditor
                        value={content || "(No prompt content)"}
                        onChange={() => {}}
                        readOnly
                        minHeight={200}
                        maxHeight={256}
                      />
                    </Suspense>
                    <span className="text-xs text-muted-foreground">
                      Last modified: Dec 20, 2025 by pat@pivotstudio.ai
                    </span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
