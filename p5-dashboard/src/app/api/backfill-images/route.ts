import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";

// Cloudinary unsigned upload
const CLOUDINARY_CLOUD_NAME = "dzocuy47k";
const CLOUDINARY_UPLOAD_PRESET = "MakeImage";

interface AirtableRecord {
  id: string;
  fields: {
    headline?: string;
    Headline?: string;
    Raw?: string;
    "Raw Text"?: string;
    b1?: string;
    b2?: string;
    b3?: string;
    "Blog Post Raw"?: string;
    publish_status?: string;
    website_image_url?: string;
  };
}

function buildImagePrompt(
  headline: string,
  rawSummary: string,
  b1?: string,
  b2?: string,
  b3?: string
): string {
  const keyPoints = [b1, b2, b3].filter(Boolean);
  const keyPointsText =
    keyPoints.length > 0
      ? `\n\nKey Points:\n${keyPoints.map((p) => `- ${p}`).join("\n")}`
      : "";

  return `Create a clean, minimal, informative infographic for this AI/tech news story.

DESIGN REQUIREMENTS:
- Aspect ratio: 16:9 (1920x1080 pixels)
- MINIMAL TEXT - prioritize icons and visuals over words
- Orange accent color: #ff6f00 for accents and highlights
- White or light gray background
- Plenty of white space
- Modern, premium aesthetic

Story Context:
Headline: ${headline}

Summary:
${rawSummary.slice(0, 500)}${keyPointsText}

Style: Soft watercolor aesthetic with orange (#ff6f00) accents. Clean typography. NO clutter. Professional news graphic suitable for a business newsletter website header.`;
}

async function fetchRecordsToRegenerate(limit: number = 5): Promise<AirtableRecord[]> {
  // Fetch records where:
  // - publish_status is "ready"
  // - Blog Post Raw exists (not empty)
  // - website_image_url EXISTS (we're regenerating, not creating new)
  const filterFormula = encodeURIComponent(
    `AND({publish_status}="ready",NOT(OR({Blog Post Raw}="",{Blog Post Raw}=BLANK())),NOT(OR({website_image_url}="",{website_image_url}=BLANK())))`
  );

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${filterFormula}&maxRecords=${limit}`,
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

async function callGeminiImageGeneration(prompt: string): Promise<string> {
  // Using Gemini 3 Pro Image Preview model
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini 3 Pro API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Find the image data in the response
  const imageBase64 = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string } }) => p.inlineData
  )?.inlineData?.data;

  if (!imageBase64) {
    throw new Error("No image generated from Gemini 3 Pro");
  }

  return imageBase64;
}

async function uploadToCloudinary(base64Image: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", `data:image/png;base64,${base64Image}`);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "pivot5-headers-v2");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.secure_url;
}

async function saveImageUrlToAirtable(
  recordId: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
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
          website_image_url: imageUrl,
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

// GET: Preview what records would be regenerated
export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: "Airtable credentials not configured" },
        { status: 500 }
      );
    }

    const records = await fetchRecordsToRegenerate(10);

    return NextResponse.json({
      message: "Records that would be regenerated (POST to actually regenerate)",
      count: records.length,
      records: records.map(r => ({
        id: r.id,
        headline: r.fields.headline || r.fields.Headline,
        currentImage: r.fields.website_image_url,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch records" },
      { status: 500 }
    );
  }
}

// POST: Actually regenerate images
export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: "Airtable credentials not configured" },
        { status: 500 }
      );
    }

    // Get limit from request body (default 3)
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 3, 10); // Max 10 at a time

    const records = await fetchRecordsToRegenerate(limit);

    if (records.length === 0) {
      return NextResponse.json({
        message: "No records found to regenerate",
        processed: 0,
      });
    }

    const results: {
      recordId: string;
      headline?: string;
      success: boolean;
      oldImage?: string;
      newImage?: string;
      error?: string;
    }[] = [];

    for (const record of records) {
      const headline = record.fields.headline || record.fields.Headline;
      const rawText = record.fields.Raw || record.fields["Raw Text"] || record.fields["Blog Post Raw"];
      const oldImage = record.fields.website_image_url;

      if (!headline || !rawText) {
        results.push({
          recordId: record.id,
          headline: headline || "Unknown",
          success: false,
          error: "Missing headline or rawText",
        });
        continue;
      }

      try {
        const imagePrompt = buildImagePrompt(
          headline,
          rawText,
          record.fields.b1,
          record.fields.b2,
          record.fields.b3
        );

        console.log(`Regenerating image for: ${headline}`);

        const base64Image = await callGeminiImageGeneration(imagePrompt);
        const imageUrl = await uploadToCloudinary(base64Image);
        const saveResult = await saveImageUrlToAirtable(record.id, imageUrl);

        results.push({
          recordId: record.id,
          headline,
          success: saveResult.success,
          oldImage,
          newImage: saveResult.success ? imageUrl : undefined,
          error: saveResult.error,
        });

        console.log(`Regenerated image for "${headline}": ${saveResult.success ? "saved" : "failed"}`);

        // 3 second delay between API calls
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        results.push({
          recordId: record.id,
          headline,
          success: false,
          oldImage,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`Error regenerating image for ${headline}:`, error);
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Regenerated images for ${successCount}/${records.length} records using Gemini 3 Pro`,
      processed: successCount,
      total: records.length,
      results,
    });
  } catch (error) {
    console.error("Image regeneration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Regeneration failed" },
      { status: 500 }
    );
  }
}
