import { NextResponse } from "next/server";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE || "Social Post Input";
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";

// The base ID that was previously hardcoded in the cron job
const CRON_HARDCODED_BASE = "appRUgK44hQnXH1PM";

async function fetchFromBase(baseId: string, tableName: string) {
  const url = new URL(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
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
    return { error: `${response.status}: ${errorText}`, records: [] };
  }

  const data = await response.json();
  return { records: data.records || [], error: null };
}

function analyzeRecords(records: { id: string; fields: Record<string, unknown> }[]) {
  const allFieldNames = new Set<string>();
  let blogPostRawCount = 0;

  records.forEach((record) => {
    Object.keys(record.fields).forEach(key => allFieldNames.add(key));
    if (record.fields["Blog Post Raw"]) {
      blogPostRawCount++;
    }
  });

  return {
    totalRecords: records.length,
    allFieldNames: Array.from(allFieldNames).sort(),
    blogPostRawCount,
    hasBlogPostRaw: blogPostRawCount > 0,
    sampleRecordIds: records.slice(0, 3).map(r => r.id),
  };
}

export async function GET() {
  try {
    if (!AIRTABLE_TOKEN) {
      return NextResponse.json({
        error: "AIRTABLE_TOKEN not configured",
      }, { status: 500 });
    }

    const results: Record<string, unknown> = {
      envVarBaseId: AIRTABLE_BASE_ID ? `${AIRTABLE_BASE_ID.substring(0, 8)}...` : "NOT SET",
      cronHardcodedBase: `${CRON_HARDCODED_BASE.substring(0, 8)}...`,
      baseIdsMatch: AIRTABLE_BASE_ID === CRON_HARDCODED_BASE,
      tableName: AIRTABLE_TABLE_NAME,
    };

    // Fetch from env var base (current production)
    if (AIRTABLE_BASE_ID) {
      const envVarResult = await fetchFromBase(AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME);
      if (envVarResult.error) {
        results.envVarBase = { error: envVarResult.error };
      } else {
        results.envVarBase = analyzeRecords(envVarResult.records);
      }
    } else {
      results.envVarBase = { error: "AIRTABLE_BASE_ID not set" };
    }

    // Fetch from hardcoded base (cron job was using this)
    const hardcodedResult = await fetchFromBase(CRON_HARDCODED_BASE, AIRTABLE_TABLE_NAME);
    if (hardcodedResult.error) {
      results.hardcodedBase = { error: hardcodedResult.error };
    } else {
      results.hardcodedBase = analyzeRecords(hardcodedResult.records);
    }

    // Check if record IDs overlap
    const envRecordIds = new Set((results.envVarBase as { sampleRecordIds?: string[] })?.sampleRecordIds || []);
    const hardcodedRecordIds = (results.hardcodedBase as { sampleRecordIds?: string[] })?.sampleRecordIds || [];
    const overlappingIds = hardcodedRecordIds.filter(id => envRecordIds.has(id));

    results.comparison = {
      sameRecords: overlappingIds.length === hardcodedRecordIds.length && hardcodedRecordIds.length > 0,
      overlappingRecordIds: overlappingIds.length,
      recommendation: "",
    };

    // Generate recommendation
    const envHasBlogPostRaw = (results.envVarBase as { hasBlogPostRaw?: boolean })?.hasBlogPostRaw;
    const hardcodedHasBlogPostRaw = (results.hardcodedBase as { hasBlogPostRaw?: boolean })?.hasBlogPostRaw;

    if (envHasBlogPostRaw) {
      (results.comparison as Record<string, unknown>).recommendation =
        "ENV VAR base has Blog Post Raw data. Current setup should work.";
    } else if (hardcodedHasBlogPostRaw) {
      (results.comparison as Record<string, unknown>).recommendation =
        `ISSUE FOUND: Hardcoded base (${CRON_HARDCODED_BASE}) has Blog Post Raw data, but ENV VAR base does not. Update AIRTABLE_BASE_ID in Vercel to: ${CRON_HARDCODED_BASE}`;
    } else {
      (results.comparison as Record<string, unknown>).recommendation =
        "Neither base has Blog Post Raw data in the sampled records. The field may exist but all cells are empty, or the field doesn't exist yet.";
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
