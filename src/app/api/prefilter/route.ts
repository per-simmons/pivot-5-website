import { NextResponse } from "next/server";
import { getPreFilterLog } from "@/lib/airtable";

export async function GET() {
  try {
    const entries = await getPreFilterLog();

    // Group by slot for easy verification
    const bySlot: Record<string, number> = {};
    entries.forEach((entry) => {
      const slot = String(entry.slot);
      bySlot[slot] = (bySlot[slot] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      total: entries.length,
      bySlot,
      // Return first 10 entries as sample
      sample: entries.slice(0, 10),
    });
  } catch (error) {
    console.error("Error fetching pre-filter log:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch pre-filter log"
      },
      { status: 500 }
    );
  }
}
