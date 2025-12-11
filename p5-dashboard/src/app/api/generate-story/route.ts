import { NextRequest, NextResponse } from "next/server";

// Extend timeout to 300 seconds (Vercel Pro limit)
export const maxDuration = 300;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";

// NEW Airtable configuration for Pivot AI stories
const AIRTABLE_BASE_ID = "appwSozYTkrsQWUXB";
const AIRTABLE_TABLE_ID = "tblaHcFFG6Iw3w7lL";
const GENERATED_STORY_FIELD = "blog_post_raw";

interface AirtableRecord {
  id: string;
  fields: {
    ai_headline?: string;
    ai_dek?: string;
    // Lookup fields return arrays in Airtable API
    "markdown (from story_link)"?: string | string[];
    bullet_1?: string;
    bullet_2?: string;
    bullet_3?: string;
    blog_post_raw?: string;
  };
}

// Helper to extract value from Airtable field (handles both string and array)
function extractFieldValue(field: string | string[] | undefined): string {
  if (!field) return "";
  if (Array.isArray(field)) return field[0] || "";
  return field;
}

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

async function fetchRecord(recordId: string): Promise<AirtableRecord | null> {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch record ${recordId}: ${response.status}`);
    return null;
  }

  return response.json();
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
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`,
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
    console.error(`Airtable save error: ${response.status} - ${errorText}`);
    // Parse the error for better reporting
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.type === "UNKNOWN_FIELD_NAME") {
        return {
          ok: false,
          error: `Field "${GENERATED_STORY_FIELD}" does not exist in Airtable. Please create this column in your table.`
        };
      }
      return { ok: false, error: errorData.error?.message || errorText };
    } catch {
      return { ok: false, error: errorText };
    }
  }

  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const recordId = body.recordId || body.record_id || body.id;

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId is required" },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured" },
        { status: 500 }
      );
    }

    let headline: string;
    let rawText: string;
    let bullets: string[] = [];

    // Check if headline/rawText provided directly, or fetch from Airtable
    if (body.headline && body.rawText) {
      // Direct mode - use provided data
      headline = body.headline;
      rawText = body.rawText;
      bullets = body.bullets || [];
    } else {
      // Fetch mode - get data from Airtable (for Airtable automation)
      const record = await fetchRecord(recordId);
      if (!record) {
        return NextResponse.json(
          { error: "Record not found" },
          { status: 404 }
        );
      }

      // Check if story already exists (skip unless force=true)
      const force = body.force === true;
      if (record.fields.blog_post_raw && !force) {
        return NextResponse.json(
          { message: "Story already exists", skipped: true },
          { status: 200 }
        );
      }

      headline = record.fields.ai_headline || "";
      // Handle lookup field which may be an array
      rawText = extractFieldValue(record.fields["markdown (from story_link)"]);

      if (!headline || !rawText) {
        return NextResponse.json(
          { error: "Missing headline or source text in Airtable record", skipped: true },
          { status: 200 }
        );
      }

      // Build bullets from Airtable
      if (record.fields.bullet_1) bullets.push(record.fields.bullet_1);
      if (record.fields.bullet_2) bullets.push(record.fields.bullet_2);
      if (record.fields.bullet_3) bullets.push(record.fields.bullet_3);
    }

    // Build the prompt with content
    const bulletText = bullets.length
      ? `\n\nKey points:\n${bullets.map((b) => `- ${b}`).join("\n")}`
      : "";

    const prompt = `Headline: ${headline}${bulletText}

Source material:
${rawText}`;

    // Call Gemini API
    const generatedStory = await callGemini(prompt);
    const wordCount = generatedStory.split(/\s+/).length;

    // Save to Airtable
    const saveResult = await saveToAirtable(recordId, generatedStory);

    console.log(`Generate-story: ${recordId}: ${wordCount} words, saved: ${saveResult.ok}`);

    return NextResponse.json({
      success: true,
      story: generatedStory,
      saved: saveResult.ok,
      saveError: saveResult.error,
      recordId,
      headline,
      wordCount,
    });
  } catch (error) {
    console.error("Generate story error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate story" },
      { status: 500 }
    );
  }
}
