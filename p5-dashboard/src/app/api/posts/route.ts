import { NextResponse } from "next/server";

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

export async function GET() {
  try {
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

    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined = undefined;

    // Fetch all pages from Airtable (API returns max 100 records per page)
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
