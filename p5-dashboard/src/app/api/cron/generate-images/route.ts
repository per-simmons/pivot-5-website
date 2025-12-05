import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

async function fetchPendingRecords(): Promise<AirtableRecord[]> {
  // Fetch records where:
  // - publish_status is "ready"
  // - Blog Post Raw exists (not empty)
  // - website_image_url is empty
  const filterFormula = encodeURIComponent(
    `AND({publish_status}="ready",NOT(OR({Blog Post Raw}="",{Blog Post Raw}=BLANK())),OR({website_image_url}="",{website_image_url}=BLANK()))`
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

async function callGeminiImageGeneration(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["image", "text"],
          responseMimeType: "image/png",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Find the image data in the response
  const imageBase64 = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data: string } }) => p.inlineData
  )?.inlineData?.data;

  if (!imageBase64) {
    throw new Error("No image generated from Gemini");
  }

  return imageBase64;
}

async function uploadToCloudinary(base64Image: string): Promise<string> {
  const result = await cloudinary.uploader.upload(
    `data:image/png;base64,${base64Image}`,
    {
      folder: "pivot5-headers",
      transformation: [{ width: 1920, height: 1080, crop: "fill" }],
    }
  );
  return result.secure_url;
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
    console.error(`Airtable save error: ${response.status} - ${errorText}`);

    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error?.type === "UNKNOWN_FIELD_NAME") {
        return {
          success: false,
          error: `Field "website_image_url" does not exist in Airtable. Please create this column in your "${AIRTABLE_TABLE_NAME}" table.`,
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
    // Check required environment variables
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

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json(
        { error: "Cloudinary credentials not configured" },
        { status: 500 }
      );
    }

    // Fetch pending records
    const pendingRecords = await fetchPendingRecords();

    if (pendingRecords.length === 0) {
      return NextResponse.json({
        message: "No pending records to process for image generation",
        processed: 0,
      });
    }

    const results: {
      recordId: string;
      headline?: string;
      success: boolean;
      imageUrl?: string;
      error?: string;
    }[] = [];

    // Process each record
    for (const record of pendingRecords) {
      const headline = record.fields.headline || record.fields.Headline;
      const rawText = record.fields.Raw || record.fields["Raw Text"] || record.fields["Blog Post Raw"];

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
        // Build the image prompt
        const imagePrompt = buildImagePrompt(
          headline,
          rawText,
          record.fields.b1,
          record.fields.b2,
          record.fields.b3
        );

        console.log(`Generating image for: ${headline}`);

        // Generate image with Gemini
        const base64Image = await callGeminiImageGeneration(imagePrompt);

        console.log(`Uploading to Cloudinary...`);

        // Upload to Cloudinary
        const imageUrl = await uploadToCloudinary(base64Image);

        console.log(`Saving URL to Airtable: ${imageUrl}`);

        // Save URL to Airtable
        const saveResult = await saveImageUrlToAirtable(record.id, imageUrl);

        results.push({
          recordId: record.id,
          headline,
          success: saveResult.success,
          imageUrl: saveResult.success ? imageUrl : undefined,
          error: saveResult.error,
        });

        console.log(
          `Generated image for "${headline}": ${saveResult.success ? "saved" : "failed"}`
        );

        // 2 second delay between API calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        results.push({
          recordId: record.id,
          headline,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        console.error(`Error generating image for ${headline}:`, error);
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Generated images for ${successCount}/${pendingRecords.length} records`,
      processed: successCount,
      total: pendingRecords.length,
      results,
    });
  } catch (error) {
    console.error("Image generation cron job error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}
