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
  const _v = "v7-airtable-filter";

  try {
    const { storyid } = await params;

    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured", _version: _v },
        { status: 500 }
      );
    }

    // Use Airtable filter formula to search directly instead of fetching all records
    // This avoids the 100-record pagination limit
    const filterFormula = `OR(SEARCH("${storyid}",{pivotnews_url}),{StoryID}="${storyid}",RECORD_ID()="${storyid}")`;
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}`;

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
        { error: `Airtable API error: ${response.status}`, _version: _v, _errorDetail: errorText.slice(0, 200) },
        { status: response.status }
      );
    }

    const data: AirtableResponse = await response.json();
    console.log(`Filtered query returned ${data.records.length} records`);

    const record = data.records[0];

    if (!record) {
      return NextResponse.json(
        { error: "Post not found", _version: _v, _searchedFor: storyid },
        { status: 404 }
      );
    }

    return NextResponse.json({ record, _version: _v, _strategy: "airtable-filter" });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch post", _version: _v },
      { status: 500 }
    );
  }
}
