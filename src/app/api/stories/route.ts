import { NextResponse } from "next/server";
import { getStories, getPreFilterLog } from "@/lib/airtable";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "stories";
    const refresh = searchParams.get("refresh") === "true";

    if (type === "prefilter") {
      const prefilterLog = await getPreFilterLog(refresh);
      return NextResponse.json({
        stories: prefilterLog,
        cached: !refresh,
        timestamp: new Date().toISOString()
      });
    }

    const stories = await getStories();
    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Error fetching stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}
