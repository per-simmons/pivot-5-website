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
  const _v = "v6-pivotnews-url-only";

  try {
    const { storyid } = await params;

    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured", _version: _v },
        { status: 500 }
      );
    }

    // Fetch all records from Pivot AI table and search by pivotnews_url
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

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

    // Find record by: 1) pivotnews_url containing the ID, 2) record ID, 3) StoryID field
    const record = data.records.find((r) => {
      const recordStoryId = r.fields.StoryID as string | undefined;
      const pivotnewsUrl = r.fields.pivotnews_url as string | undefined;

      // Check if pivotnews_url contains this storyid (e.g., "https://pivotnews.com/recXXX" contains "recXXX")
      if (pivotnewsUrl && pivotnewsUrl.includes(storyid)) {
        return true;
      }

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
