import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.NEXT_PUBLIC_AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || "appRUgK44hQnXH1PM";
const AIRTABLE_TABLE_NAME = process.env.NEXT_PUBLIC_AIRTABLE_TABLE || "Social Post Input";
const GENERATED_STORY_FIELD = "Blog Post Raw";

const SYSTEM_PROMPT = `You are a skilled newsletter writer for "Pivot 5," a daily business and technology newsletter that delivers 5 headlines in 5 minutes, 5 days a week.

Transform the provided source material into an engaging blog-style story. Your story MUST be at least 500 words and can be up to 800 words. This is a firm requirement - do not write less than 500 words.

Structure your story with:
- A compelling opening paragraph that hooks the reader with the most important or surprising information
- 4-6 body paragraphs that explore different aspects of the story
- Context and background to help readers understand the significance
- Specific details, numbers, and quotes pulled directly from the source material
- Analysis of why this matters to busy professionals
- A forward-looking closing paragraph with insights or implications

Writing style:
- Conversational but professional tone
- Keep paragraphs short (2-3 sentences) for easy scanning
- Use transitions between paragraphs for smooth flow

IMPORTANT: Only use facts and information from the provided source material. Do not make up statistics, quotes, or details. If the source doesn't provide enough detail on a topic, focus on what IS provided rather than speculating.

Do NOT include:
- A headline (displayed separately)
- Bullet points (shown separately)
- Phrases like "In conclusion" or "To summarize"
- Promotional language or calls to action
- Information not found in the source material

Write as flowing prose paragraphs only. Remember: minimum 500 words.`;

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

const HEADLINE_FIELDS = ["Headline", "Title", "headline"];
const RAW_FIELDS = ["Raw", "raw", "Raw Text", "raw text"];
const BULLET_FIELDS = ["B1", "B2", "B3", "b1", "b2", "b3"];
const UPDATED_FIELDS = [
  "Last Modified",
  "last_modified",
  "last_updated",
  "Last Updated",
  "Modified",
  "Updated",
];

function findFieldValue(fields: Record<string, unknown>, candidates: string[]): unknown {
  const normalizedKeys = Object.fromEntries(
    Object.keys(fields).map((key) => [key.toLowerCase(), key])
  );

  for (const candidate of candidates) {
    const directMatch = fields[candidate];
    if (directMatch !== undefined && directMatch !== null && directMatch !== "") {
      return directMatch;
    }

    const fuzzyKey = normalizedKeys[candidate.toLowerCase()];
    if (fuzzyKey && fields[fuzzyKey] !== undefined && fields[fuzzyKey] !== null) {
      return fields[fuzzyKey];
    }
  }

  return undefined;
}

function ensureString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    if (typeof firstItem === "string") return firstItem;
  }
  return undefined;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined = undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`
    );
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data: AirtableResponse = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [
            {
              text: SYSTEM_PROMPT,
            },
          ],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error("No text generated from Gemini");
  }

  return generatedText.trim();
}

async function saveToAirtable(recordId: string, generatedStory: string): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          [GENERATED_STORY_FIELD]: generatedStory,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Airtable save error for ${recordId}: ${response.status} - ${errorText}`);
    return { ok: false, error: `Airtable ${response.status}: ${errorText}` };
  }

  return { ok: true };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date } = body; // Expected format: "2025-12-01"

    if (!date) {
      return NextResponse.json(
        { error: "Missing required field: date (format: YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Fetch all records from Airtable
    const allRecords = await fetchAllRecords();
    console.log(`Fetched ${allRecords.length} total records`);

    // Filter to published posts from the specified date without existing generated_story
    const targetDate = new Date(date);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    const eligibleRecords = allRecords.filter((record) => {
      const { fields } = record;

      // Must be published (check both Status and publish_status fields)
      const status = fields.Status || fields.publish_status;
      if (status !== "Published" && status !== "ready") return false;

      // Must not already have a generated story
      const existingStory = ensureString(fields[GENERATED_STORY_FIELD]);
      if (existingStory && existingStory.trim()) return false;

      // Must have headline and raw text
      const headline = ensureString(findFieldValue(fields, HEADLINE_FIELDS));
      const rawText = ensureString(findFieldValue(fields, RAW_FIELDS));
      if (!headline || !rawText) return false;

      // Check if updated/modified on target date
      const updatedTime = ensureString(findFieldValue(fields, UPDATED_FIELDS));
      const dateToCheck = updatedTime || record.createdTime;
      const recordDateStr = new Date(dateToCheck).toISOString().split("T")[0];

      return recordDateStr === targetDateStr;
    });

    console.log(`Found ${eligibleRecords.length} eligible records for ${targetDateStr}`);

    const results: Array<{
      id: string;
      headline: string;
      success: boolean;
      error?: string;
    }> = [];

    // Process each record with delay to respect rate limits
    for (let i = 0; i < eligibleRecords.length; i++) {
      const record = eligibleRecords[i];
      const { fields } = record;

      const headline = ensureString(findFieldValue(fields, HEADLINE_FIELDS)) || "";
      const rawTextRaw = ensureString(findFieldValue(fields, RAW_FIELDS)) || "";
      const rawText = stripTags(rawTextRaw);

      // Get bullets
      const bullets: string[] = [];
      BULLET_FIELDS.forEach((key) => {
        const bulletRaw = ensureString(fields[key]);
        const bullet = bulletRaw ? stripTags(bulletRaw) : undefined;
        if (bullet && bullet.trim() && !bullets.includes(bullet)) {
          bullets.push(bullet.trim());
        }
      });

      try {
        // Build prompt
        const bulletText = bullets.length
          ? `\n\nKey points:\n${bullets.map((b) => `- ${b}`).join("\n")}`
          : "";

        const prompt = `Headline: ${headline}${bulletText}

Source material:
${rawText}`;

        console.log(`Generating story for: ${headline.substring(0, 50)}...`);

        // Call Gemini
        const generatedStory = await callGemini(prompt);

        // Save to Airtable
        const saveResult = await saveToAirtable(record.id, generatedStory);

        results.push({
          id: record.id,
          headline,
          success: saveResult.ok,
          error: saveResult.error,
        });

        // Delay between requests to respect Gemini rate limits (15 req/min = 4s between)
        if (i < eligibleRecords.length - 1) {
          await delay(4500);
        }
      } catch (error) {
        results.push({
          id: record.id,
          headline,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      date: targetDateStr,
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (error) {
    console.error("Batch generate stories error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate stories" },
      { status: 500 }
    );
  }
}
