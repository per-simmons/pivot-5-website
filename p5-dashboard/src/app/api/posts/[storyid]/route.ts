import { NextRequest, NextResponse } from "next/server";

// New Airtable configuration for Pivot AI stories
const AIRTABLE_BASE_ID = "appwSozYTkrsQWUXB";
const AIRTABLE_TABLE_ID = "tblaHcFFG6Iw3w7lL";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyid: string }> }
) {
  try {
    const { storyid } = await params;

    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Try multiple lookup strategies:
    // 1. If it looks like a record ID, try direct record lookup first
    // 2. Otherwise search by StoryID or story_link field
    const isRecordId = storyid.startsWith("rec") && storyid.length >= 14;

    if (isRecordId) {
      // Try direct record lookup first (most reliable)
      const directUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${storyid}`;
      const directResponse = await fetch(directUrl, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        cache: "no-store",
      });

      if (directResponse.ok) {
        const record = await directResponse.json();
        return NextResponse.json({ record });
      }

      // If direct lookup fails, try searching by StoryID field using FIND
      // This handles cases where storyid is stored in a formula/rollup field
    }

    // Search using FIND() which is more tolerant of field types
    const filterFormula = `OR(FIND("${storyid}",{StoryID})>0,FIND("${storyid}",ARRAYJOIN({story_link}))>0)`;

    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`
    );
    url.searchParams.set("filterByFormula", filterFormula);
    url.searchParams.set("maxRecords", "1");

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

    if (!data.records || data.records.length === 0) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      record: data.records[0],
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch post" },
      { status: 500 }
    );
  }
}
