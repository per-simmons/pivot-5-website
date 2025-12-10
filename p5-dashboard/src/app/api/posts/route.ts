import { NextResponse } from "next/server";

// New Airtable configuration for Pivot AI stories
const AIRTABLE_BASE_ID = "appwSozYTkrsQWUXB";
const AIRTABLE_TABLE_ID = "tblaHcFFG6Iw3w7lL";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN_NEW || process.env.AIRTABLE_TOKEN || "";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export async function GET() {
  try {
    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured" },
        { status: 500 }
      );
    }

    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined = undefined;

    // Filter for "Pivot AI" newsletter stories
    const filterFormula = encodeURIComponent(
      `FIND("Pivot AI", {issue_id}) > 0`
    );

    // Fetch all pages from Airtable (API returns max 100 records per page)
    do {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`
      );
      url.searchParams.set("filterByFormula", filterFormula);
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

    return NextResponse.json({
      records: allRecords,
      count: allRecords.length,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch posts" },
      { status: 500 }
    );
  }
}
