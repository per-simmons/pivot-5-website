import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Helper to create slug from headline (must match the client-side implementation)
function createSlug(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

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

    // Fetch all records and find the matching one
    // (Airtable doesn't support searching by computed slug)
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined = undefined;

    do {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
          AIRTABLE_TABLE_NAME
        )}`
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
        const errorText = await response.text();
        console.error(`Airtable API error: ${response.status} - ${errorText}`);
        return NextResponse.json(
          { error: `Airtable API error: ${response.status}` },
          { status: response.status }
        );
      }

      const data: AirtableResponse = await response.json();
      allRecords.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    // Find the record with matching slug
    const HEADLINE_FIELDS = ["Headline", "Title", "headline"];

    const matchingRecord = allRecords.find((record) => {
      for (const field of HEADLINE_FIELDS) {
        const headline = record.fields[field];
        if (typeof headline === "string" && headline.trim()) {
          if (createSlug(headline) === slug) {
            return true;
          }
        }
      }
      return false;
    });

    if (!matchingRecord) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      record: matchingRecord,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch post" },
      { status: 500 }
    );
  }
}
