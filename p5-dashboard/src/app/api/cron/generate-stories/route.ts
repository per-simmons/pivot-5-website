import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";
const GENERATED_STORY_FIELD = "Blog Post Raw";
const CRON_SECRET = process.env.CRON_SECRET || "";

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
    // Actual field names from Airtable (case-sensitive!)
    headline?: string;
    Headline?: string; // Backup in case
    Raw?: string;
    "Raw Text"?: string; // Backup in case
    b1?: string;
    b2?: string;
    b3?: string;
    "Blog Post Raw"?: string;
    Status?: string;
    publish_status?: string; // Backup in case
  };
}

async function fetchPendingRecords(): Promise<AirtableRecord[]> {
  // Fetch records where Status is "Published" and Blog Post Raw is empty
  // Note: Field name is "Status" not "publish_status" based on actual Airtable schema
  const filterFormula = encodeURIComponent(
    `AND({Status}="Published",OR({Blog Post Raw}="",{Blog Post Raw}=BLANK()))`
  );

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${filterFormula}&maxRecords=5`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable fetch error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.records || [];
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

async function saveToAirtable(recordId: string, generatedStory: string): Promise<{ success: boolean; error?: string }> {
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
    console.error(`Airtable save error: ${response.status} - ${errorText}`);

    // Parse error for more details
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.type === "UNKNOWN_FIELD_NAME") {
        return {
          success: false,
          error: `Field "${GENERATED_STORY_FIELD}" does not exist in Airtable. Please create this column in your "${AIRTABLE_TABLE_NAME}" table.`
        };
      }
      return { success: false, error: errorData.error?.message || errorText };
    } catch {
      return { success: false, error: `Airtable ${response.status}: ${errorText}` };
    }
  }

  return { success: true };
}

export async function GET(request: NextRequest) {
  try {
    // Skip auth check - Vercel cron runs internally, and we want external cron services to work
    // The endpoint is idempotent and only processes records that need processing

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

    if (!AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: "AIRTABLE_BASE_ID not configured" },
        { status: 500 }
      );
    }

    // Fetch pending records
    const pendingRecords = await fetchPendingRecords();

    if (pendingRecords.length === 0) {
      return NextResponse.json({
        message: "No pending records to process",
        processed: 0,
      });
    }

    const results: { recordId: string; success: boolean; wordCount?: number; error?: string }[] = [];

    // Process each record
    for (const record of pendingRecords) {
      // Handle both capitalized and lowercase field names
      const headline = record.fields.headline || record.fields.Headline;
      const rawText = record.fields.Raw || record.fields["Raw Text"];

      // Combine bullet points from b1, b2, b3
      const bulletParts: string[] = [];
      if (record.fields.b1) bulletParts.push(record.fields.b1);
      if (record.fields.b2) bulletParts.push(record.fields.b2);
      if (record.fields.b3) bulletParts.push(record.fields.b3);
      const bullets = bulletParts.length > 0 ? bulletParts.join("\n") : null;

      if (!headline || !rawText) {
        results.push({
          recordId: record.id,
          success: false,
          error: `Missing headline (${!!headline}) or rawText (${!!rawText})`,
        });
        continue;
      }

      try {
        // Build the prompt
        const bulletText = bullets ? `\n\nKey points:\n${bullets}` : "";
        const prompt = `Headline: ${headline}${bulletText}

Source material:
${rawText}`;

        // Generate story
        const generatedStory = await callGemini(prompt);
        const wordCount = generatedStory.split(/\s+/).length;

        // Save to Airtable
        const saveResult = await saveToAirtable(record.id, generatedStory);

        results.push({
          recordId: record.id,
          success: saveResult.success,
          wordCount,
          error: saveResult.error,
        });

        console.log(`Generated story for ${record.id}: ${wordCount} words, saved: ${saveResult.success}`);

        // Small delay between API calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          recordId: record.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Processed ${successCount}/${pendingRecords.length} records`,
      processed: successCount,
      total: pendingRecords.length,
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
