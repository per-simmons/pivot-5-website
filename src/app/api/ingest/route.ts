/**
 * AI Editor 2.0 - Ingestion API
 *
 * Endpoints:
 *   GET /api/ingest  - Get ingestion stats (recent articles count, feed health)
 *   POST /api/ingest - Trigger RSS ingestion job
 *
 * This is Step 0 of the newsletter pipeline - fetches articles from RSS feeds
 * and creates records in Airtable Newsletter Issue Stories table.
 */

import { NextRequest, NextResponse } from "next/server";
import Airtable from "airtable";

const TRIGGER_SERVICE_URL = process.env.TRIGGER_SERVICE_URL || "http://localhost:5001";
const TRIGGER_SECRET = process.env.TRIGGER_SECRET || "";
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appwSozYTkrsQWUXB";
const NEWSLETTER_ISSUE_STORIES_TABLE = process.env.AIRTABLE_NEWSLETTER_ISSUE_STORIES_TABLE || "tblaHcFFG6Iw3w7lL";

interface TriggerResponse {
  success: boolean;
  job_id?: string;
  step?: string;
  queue?: string;
  enqueued_at?: string;
  error?: string;
}

interface IngestStats {
  totalArticles: number;
  todayCount: number;
  lastIngested?: string;
  bySource: Record<string, number>;
}

/**
 * GET /api/ingest
 * Get ingestion statistics from Airtable
 */
export async function GET() {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "AIRTABLE_API_KEY not configured",
        },
        { status: 500 }
      );
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const table = base(NEWSLETTER_ISSUE_STORIES_TABLE);

    // Get all records to calculate stats
    const records = await table
      .select({
        fields: ["pivotId", "topic", "createdTime"],
        sort: [{ field: "createdTime", direction: "desc" }],
        maxRecords: 1000,
      })
      .all();

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().split("T")[0];

    let todayCount = 0;
    const bySource: Record<string, number> = {};
    let lastIngested: string | undefined;

    records.forEach((record, index) => {
      const createdTime = record.get("createdTime") as string | undefined;
      const topic = record.get("topic") as string | undefined;

      // Track last ingested time (first record is most recent)
      if (index === 0 && createdTime) {
        lastIngested = createdTime;
      }

      // Count today's articles
      if (createdTime && createdTime.startsWith(todayIso)) {
        todayCount++;
      }

      // Count by source
      if (topic) {
        bySource[topic] = (bySource[topic] || 0) + 1;
      }
    });

    const stats: IngestStats = {
      totalArticles: records.length,
      todayCount,
      lastIngested,
      bySource,
    };

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[Ingest API] Error getting stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get ingestion stats",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ingest
 * Trigger RSS ingestion job
 *
 * Request Body (optional):
 * {
 *   "debug": false  // If true, only fetch from DEBUG_FEEDS
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { debug = false } = body as { debug?: boolean };

    // Call Python trigger service
    const triggerUrl = `${TRIGGER_SERVICE_URL}/jobs/ingest`;
    console.log(`[Ingest API] Triggering ingest at ${triggerUrl}`);

    const response = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TRIGGER_SECRET && { Authorization: `Bearer ${TRIGGER_SECRET}` }),
      },
      body: JSON.stringify({ debug }),
    });

    const data: TriggerResponse = await response.json();

    if (!response.ok) {
      console.error(`[Ingest API] Trigger failed: ${JSON.stringify(data)}`);
      return NextResponse.json(data, { status: response.status });
    }

    console.log(`[Ingest API] Job ${data.job_id} enqueued`);
    return NextResponse.json({
      ...data,
      step: "ingest",
    });
  } catch (error) {
    console.error("[Ingest API] Error:", error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot connect to trigger service",
          details: "The Python trigger service may not be running",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
