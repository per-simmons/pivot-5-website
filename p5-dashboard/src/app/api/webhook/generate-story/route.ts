import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN_NEW || process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = "appwSozYTkrsQWUXB";
const AIRTABLE_TABLE_ID = "tblaHcFFG6Iw3w7lL";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

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
  fields: {
    ai_headline?: string;
    ai_dek?: string;
    "markdown (from story_link)"?: string;
    bullet_1?: string;
    bullet_2?: string;
    bullet_3?: string;
    blog_post_raw?: string;
    issue_id?: string;
  };
}

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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

async function saveToAirtable(recordId: string, generatedStory: string): Promise<boolean> {
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
          blog_post_raw: generatedStory,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Airtable save error: ${response.status} - ${errorText}`);
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get("authorization");
      const providedSecret = authHeader?.replace("Bearer ", "") ||
                            request.headers.get("x-webhook-secret");

      if (providedSecret !== WEBHOOK_SECRET) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
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

    const body = await request.json();
    const recordId = body.recordId || body.record_id || body.id;

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId is required" },
        { status: 400 }
      );
    }

    // Fetch the record from Airtable
    const record = await fetchRecord(recordId);
    if (!record) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    // Check if it's a Pivot AI record
    const issueId = record.fields.issue_id || "";
    if (!issueId.includes("Pivot AI")) {
      return NextResponse.json(
        { error: "Record is not a Pivot AI story", skipped: true },
        { status: 200 }
      );
    }

    // Check if story already exists
    if (record.fields.blog_post_raw) {
      return NextResponse.json(
        { message: "Story already exists", skipped: true },
        { status: 200 }
      );
    }

    // Get required fields
    const headline = record.fields.ai_headline;
    const rawText = record.fields["markdown (from story_link)"];

    if (!headline || !rawText) {
      return NextResponse.json(
        { error: "Missing headline or source text", skipped: true },
        { status: 200 }
      );
    }

    // Build bullet points
    const bulletParts: string[] = [];
    if (record.fields.bullet_1) bulletParts.push(record.fields.bullet_1);
    if (record.fields.bullet_2) bulletParts.push(record.fields.bullet_2);
    if (record.fields.bullet_3) bulletParts.push(record.fields.bullet_3);
    const bullets = bulletParts.length > 0 ? bulletParts.join("\n") : null;

    // Build prompt
    const bulletText = bullets ? `\n\nKey points:\n${bullets}` : "";
    const prompt = `Headline: ${headline}${bulletText}

Source material:
${rawText}`;

    // Generate story
    const generatedStory = await callGemini(prompt);
    const wordCount = generatedStory.split(/\s+/).length;

    // Save to Airtable
    const saved = await saveToAirtable(recordId, generatedStory);

    console.log(`Webhook: Generated story for ${recordId}: ${wordCount} words, saved: ${saved}`);

    return NextResponse.json({
      success: true,
      recordId,
      headline,
      wordCount,
      saved,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
