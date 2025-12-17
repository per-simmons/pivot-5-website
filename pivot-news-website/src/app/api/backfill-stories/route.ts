import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appRUgK44hQnXH1PM";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";
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
  fields: {
    Headline?: string;
    headline?: string;
    Raw?: string;
    "Raw Text"?: string;
    b1?: string;
    b2?: string;
    b3?: string;
    "Blog Post Raw"?: string;
  };
}

async function fetchRecordsWithoutStory(): Promise<AirtableRecord[]> {
  // Fetch all records where Blog Post Raw is empty
  const filterFormula = encodeURIComponent(
    `OR({Blog Post Raw}="",{Blog Post Raw}=BLANK())`
  );

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${filterFormula}&maxRecords=100`,
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
    return { success: false, error: `Airtable ${response.status}: ${errorText}` };
  }

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 10; // Default to 10 at a time
    const dryRun = body.dryRun || false;

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return NextResponse.json({ error: "Airtable credentials not configured" }, { status: 500 });
    }

    // Fetch records without stories
    const records = await fetchRecordsWithoutStory();
    const recordsToProcess = records.slice(0, limit);

    if (recordsToProcess.length === 0) {
      return NextResponse.json({
        message: "No records need story generation",
        processed: 0,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        message: `Dry run: Would process ${recordsToProcess.length} records`,
        dryRun: true,
        recordsFound: records.length,
        wouldProcess: recordsToProcess.map(r => ({
          id: r.id,
          headline: r.fields.Headline || r.fields.headline,
        })),
      });
    }

    const results: { recordId: string; headline: string; success: boolean; wordCount?: number; error?: string }[] = [];

    for (const record of recordsToProcess) {
      const headline = record.fields.Headline || record.fields.headline;
      const rawText = record.fields.Raw || record.fields["Raw Text"];

      if (!headline || !rawText) {
        results.push({
          recordId: record.id,
          headline: headline || "Unknown",
          success: false,
          error: `Missing headline (${!!headline}) or rawText (${!!rawText})`,
        });
        continue;
      }

      try {
        // Build the prompt
        const bulletParts: string[] = [];
        if (record.fields.b1) bulletParts.push(record.fields.b1);
        if (record.fields.b2) bulletParts.push(record.fields.b2);
        if (record.fields.b3) bulletParts.push(record.fields.b3);
        const bulletText = bulletParts.length > 0 ? `\n\nKey points:\n${bulletParts.join("\n")}` : "";

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
          headline,
          success: saveResult.success,
          wordCount,
          error: saveResult.error,
        });

        console.log(`Generated story for "${headline}": ${wordCount} words, saved: ${saveResult.success}`);

        // 2 second delay between API calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        results.push({
          recordId: record.id,
          headline,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Generated stories for ${successCount}/${recordsToProcess.length} records`,
      processed: successCount,
      total: recordsToProcess.length,
      remaining: records.length - recordsToProcess.length,
      results,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // GET endpoint to check status
  try {
    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return NextResponse.json({ error: "Airtable credentials not configured" }, { status: 500 });
    }

    const records = await fetchRecordsWithoutStory();

    return NextResponse.json({
      recordsNeedingStories: records.length,
      sampleRecords: records.slice(0, 5).map(r => ({
        id: r.id,
        headline: r.fields.Headline || r.fields.headline,
        hasRaw: !!(r.fields.Raw || r.fields["Raw Text"]),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    );
  }
}
