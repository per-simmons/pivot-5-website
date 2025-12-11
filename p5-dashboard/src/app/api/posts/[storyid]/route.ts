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
  const _v = "v4-debug";

  try {
    const { storyid } = await params;

    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured", _version: _v },
        { status: 500 }
      );
    }

    // Strategy 1: If it looks like a record ID, try direct lookup first
    const isRecordId = storyid.startsWith("rec") && storyid.length >= 14;

    if (isRecordId) {
      const directUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${storyid}`;
      const directResponse = await fetch(directUrl, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
        cache: "no-store",
      });

      if (directResponse.ok) {
        const record = await directResponse.json();
        return NextResponse.json({ record, _version: _v, _strategy: "direct" });
      }
      // Log what happened with direct lookup
      console.log(`Direct lookup for ${storyid} returned ${directResponse.status}`);
    }

    // Strategy 2: Fetch all records and filter client-side
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
    console.log(`Fetching all records from: ${airtableUrl}`);

    const response = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Airtable API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Airtable API error: ${response.status}`, _version: _v, _url: airtableUrl, _errorDetail: errorText.slice(0, 200) },
        { status: response.status }
      );
    }

    const data: AirtableResponse = await response.json();
    console.log(`Fetched ${data.records.length} records`);

    // Find record by StoryID field or record ID
    const record = data.records.find((r) => {
      const recordStoryId = r.fields.StoryID as string | undefined;
      return r.id === storyid || recordStoryId === storyid;
    });

    if (!record) {
      return NextResponse.json(
        { error: "Post not found", _version: _v, _searchedFor: storyid, _totalRecords: data.records.length },
        { status: 404 }
      );
    }

    return NextResponse.json({ record, _version: _v, _strategy: "filtered" });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch post", _version: _v },
      { status: 500 }
    );
  }
}
