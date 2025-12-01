import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_TOKEN = process.env.NEXT_PUBLIC_AIRTABLE_TOKEN || "";

// Source table (P5N8N) - read only
const SOURCE_BASE_ID = "appRXkjvqEavU8Znj";
const SOURCE_TABLE_NAME = "p5 n8n";

// Target table (Social Post Input) - write access
const TARGET_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || "appRUgK44hQnXH1PM";
const TARGET_TABLE_NAME = process.env.NEXT_PUBLIC_AIRTABLE_TABLE || "Social Post Input";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function fetchAllRecords(baseId: string, tableName: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined = undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
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
      throw new Error(`Airtable API error for ${tableName}: ${response.status} - ${errorText}`);
    }

    const data: AirtableResponse = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function normalizeHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function updateRecord(
  recordId: string,
  bullets: { b1?: string; b2?: string; b3?: string }
): Promise<{ ok: boolean; error?: string }> {
  const fields: Record<string, string> = {};
  if (bullets.b1) fields.b1 = bullets.b1;
  if (bullets.b2) fields.b2 = bullets.b2;
  if (bullets.b3) fields.b3 = bullets.b3;

  if (Object.keys(fields).length === 0) {
    return { ok: true }; // Nothing to update
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${TARGET_BASE_ID}/${encodeURIComponent(TARGET_TABLE_NAME)}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: `${response.status}: ${errorText}` };
  }

  return { ok: true };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    console.log(`Starting bullet backfill (dryRun: ${dryRun})...`);

    // Fetch records from both tables
    const [sourceRecords, targetRecords] = await Promise.all([
      fetchAllRecords(SOURCE_BASE_ID, SOURCE_TABLE_NAME),
      fetchAllRecords(TARGET_BASE_ID, TARGET_TABLE_NAME),
    ]);

    console.log(`Fetched ${sourceRecords.length} source records, ${targetRecords.length} target records`);

    // Build lookup map from source by normalized headline
    const sourceByHeadline = new Map<string, AirtableRecord>();
    for (const record of sourceRecords) {
      const headline = record.fields.headline as string;
      if (headline) {
        sourceByHeadline.set(normalizeHeadline(headline), record);
      }
    }

    // Find target records missing bullets and match with source
    const updates: Array<{
      targetId: string;
      targetHeadline: string;
      sourceId: string;
      b1?: string;
      b2?: string;
      b3?: string;
    }> = [];

    for (const targetRecord of targetRecords) {
      const headline = targetRecord.fields.headline as string;
      if (!headline) continue;

      // Check if bullets are missing
      const hasB1 = targetRecord.fields.b1 && (targetRecord.fields.b1 as string).trim();
      const hasB2 = targetRecord.fields.b2 && (targetRecord.fields.b2 as string).trim();
      const hasB3 = targetRecord.fields.b3 && (targetRecord.fields.b3 as string).trim();

      // Skip if all bullets present
      if (hasB1 && hasB2 && hasB3) continue;

      // Find matching source record
      const sourceRecord = sourceByHeadline.get(normalizeHeadline(headline));
      if (!sourceRecord) continue;

      // Get bullets from source
      const sourceB1 = sourceRecord.fields.b1 as string | undefined;
      const sourceB2 = sourceRecord.fields.b2 as string | undefined;
      const sourceB3 = sourceRecord.fields.b3 as string | undefined;

      // Only update missing bullets
      const update: typeof updates[0] = {
        targetId: targetRecord.id,
        targetHeadline: headline,
        sourceId: sourceRecord.id,
      };

      if (!hasB1 && sourceB1) update.b1 = sourceB1;
      if (!hasB2 && sourceB2) update.b2 = sourceB2;
      if (!hasB3 && sourceB3) update.b3 = sourceB3;

      // Only add if there's something to update
      if (update.b1 || update.b2 || update.b3) {
        updates.push(update);
      }
    }

    console.log(`Found ${updates.length} records to update`);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        toUpdate: updates.length,
        updates: updates.map((u) => ({
          targetId: u.targetId,
          headline: u.targetHeadline.substring(0, 60),
          willUpdate: {
            b1: !!u.b1,
            b2: !!u.b2,
            b3: !!u.b3,
          },
        })),
      });
    }

    // Apply updates with rate limiting
    const results: Array<{
      id: string;
      headline: string;
      success: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      try {
        const result = await updateRecord(update.targetId, {
          b1: update.b1,
          b2: update.b2,
          b3: update.b3,
        });

        results.push({
          id: update.targetId,
          headline: update.targetHeadline.substring(0, 60),
          success: result.ok,
          error: result.error,
        });

        // Respect Airtable rate limits (5 req/sec)
        if (i < updates.length - 1) {
          await delay(250);
        }
      } catch (error) {
        results.push({
          id: update.targetId,
          headline: update.targetHeadline.substring(0, 60),
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      processed: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (error) {
    console.error("Backfill bullets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to backfill bullets" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Bullet Backfill API",
    usage: "POST with optional { dryRun: true } to preview changes",
    source: `${SOURCE_BASE_ID}/${SOURCE_TABLE_NAME}`,
    target: `${TARGET_BASE_ID}/${TARGET_TABLE_NAME}`,
  });
}
