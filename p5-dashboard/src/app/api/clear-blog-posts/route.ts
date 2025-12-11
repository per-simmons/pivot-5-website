import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE_ID = "appwSozYTkrsQWUXB";
const AIRTABLE_TABLE_ID = "tblaHcFFG6Iw3w7lL";

interface AirtableRecord {
  id: string;
  fields: {
    blog_post_raw?: string;
    issue_id?: string;
  };
}

async function fetchRecordsWithBlogPosts(): Promise<AirtableRecord[]> {
  // Fetch Pivot AI records that have blog_post_raw populated
  const filterFormula = encodeURIComponent(
    `AND(FIND("Pivot AI", {issue_id}) > 0, {blog_post_raw} != "")`
  );

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${filterFormula}&maxRecords=100`,
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

async function clearBlogPostRaw(recordId: string): Promise<boolean> {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          blog_post_raw: "",
        },
      }),
    }
  );

  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    if (!AIRTABLE_TOKEN) {
      return NextResponse.json(
        { error: "AIRTABLE_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Fetch records with existing blog posts
    const records = await fetchRecordsWithBlogPosts();

    if (records.length === 0) {
      return NextResponse.json({
        message: "No records with blog_post_raw to clear",
        cleared: 0,
      });
    }

    let cleared = 0;
    const errors: string[] = [];

    // Clear each record
    for (const record of records) {
      const success = await clearBlogPostRaw(record.id);
      if (success) {
        cleared++;
      } else {
        errors.push(record.id);
      }
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      message: `Cleared ${cleared}/${records.length} records`,
      cleared,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Clear blog posts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear blog posts" },
      { status: 500 }
    );
  }
}
