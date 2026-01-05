/**
 * AI Editor 2.0 - Airtable Newsletter Selects API
 *
 * GET /api/airtable/newsletter-selects
 *   Returns newsletter selects from the Selected Slots table.
 *
 * Query Parameters:
 *   - limit: Maximum number of records (default: 50)
 *   - refresh: Set to 'true' to skip cache
 *
 * Returns:
 * {
 *   "selects": [
 *     {
 *       "id": "recXXX-slot-1",
 *       "issueId": "issue-2025-01-05",
 *       "issueDate": "2025-01-05",
 *       "slot": 1,
 *       "headline": "Article title...",
 *       "storyId": "story-xxx",
 *       "pivotId": "pivot-xxx"
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getNewsletterSelectsList } from "@/lib/airtable";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const refresh = searchParams.get("refresh") === "true";

  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  try {
    const selects = await getNewsletterSelectsList(limit, refresh);

    return NextResponse.json({ selects });
  } catch (error) {
    console.error("[Airtable Newsletter Selects API] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for configuration errors
    if (errorMessage.includes("not configured")) {
      return NextResponse.json({
        selects: [],
        message: "Airtable not configured. Set AI_EDITOR_BASE_ID and AI_EDITOR_SELECTED_SLOTS_TABLE.",
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch newsletter selects", details: errorMessage },
      { status: 500 }
    );
  }
}
