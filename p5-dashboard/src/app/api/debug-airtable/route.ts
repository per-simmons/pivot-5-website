import { NextResponse } from "next/server";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";

export async function GET() {
  try {
    // Debug: Show what env vars are being used (masked for security)
    const envDebug = {
      AIRTABLE_BASE_ID: AIRTABLE_BASE_ID ? `${AIRTABLE_BASE_ID.substring(0, 6)}...` : "NOT SET",
      AIRTABLE_TABLE: AIRTABLE_TABLE_NAME,
      AIRTABLE_TOKEN: AIRTABLE_TOKEN ? `${AIRTABLE_TOKEN.substring(0, 8)}...` : "NOT SET",
    };

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      return NextResponse.json({
        error: "Missing env vars",
        envDebug,
      }, { status: 500 });
    }

    // Fetch first 3 records to inspect fields
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`
    );
    url.searchParams.set("maxRecords", "10");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: `Airtable API error: ${response.status}`,
        errorDetails: errorText,
        envDebug,
      }, { status: response.status });
    }

    const data = await response.json();
    const records = data.records || [];

    // Get all unique field names across all records
    const allFieldNames = new Set<string>();
    records.forEach((record: { fields: Record<string, unknown> }) => {
      Object.keys(record.fields).forEach(key => allFieldNames.add(key));
    });

    // Check specifically for Blog Post Raw variations
    const blogPostRawVariations = [
      "Blog Post Raw",
      "blog post raw",
      "Blog_Post_Raw",
      "blog_post_raw",
      "BlogPostRaw",
      "blogpostraw",
      "Generated Story",
      "generated_story",
    ];

    const foundVariations: Record<string, number> = {};
    blogPostRawVariations.forEach(variation => {
      let count = 0;
      records.forEach((record: { fields: Record<string, unknown> }) => {
        if (record.fields[variation] !== undefined && record.fields[variation] !== null && record.fields[variation] !== "") {
          count++;
        }
      });
      if (count > 0) {
        foundVariations[variation] = count;
      }
    });

    // Count records with any field containing "blog" or "post" or "raw" in name
    const fieldsContainingKeywords = Array.from(allFieldNames).filter(name =>
      name.toLowerCase().includes("blog") ||
      name.toLowerCase().includes("post") ||
      (name.toLowerCase().includes("raw") && name.toLowerCase() !== "raw")
    );

    return NextResponse.json({
      envDebug,
      totalRecords: records.length,
      allFieldNames: Array.from(allFieldNames).sort(),
      blogPostRawCheck: {
        variations: foundVariations,
        noMatchesFound: Object.keys(foundVariations).length === 0,
        fieldsContainingKeywords,
      },
      sampleRecords: records.slice(0, 3).map((r: { id: string; fields: Record<string, unknown> }) => ({
        id: r.id,
        fieldNames: Object.keys(r.fields),
        // Show first 100 chars of each field value
        fieldPreviews: Object.fromEntries(
          Object.entries(r.fields).map(([k, v]) => [
            k,
            typeof v === "string" ? v.substring(0, 100) + (v.length > 100 ? "..." : "") : v
          ])
        ),
      })),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
