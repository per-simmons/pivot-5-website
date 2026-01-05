/**
 * AI Editor 2.0 - Execution Logs API
 *
 * GET /api/execution-logs
 *   Returns execution logs from the execution_logs database table.
 *
 * Query Parameters:
 *   - step_id: Filter by pipeline step (0-5)
 *   - job_type: Filter by job type ('ingest', 'ai_scoring', 'newsletter_links', 'pre_filter')
 *   - slot_number: Filter by slot (1-5, for pre_filter)
 *   - limit: Maximum number of records (default: 10)
 *
 * Returns:
 * {
 *   "logs": [
 *     {
 *       "id": "uuid",
 *       "step_id": 0,
 *       "job_type": "ingest",
 *       "slot_number": null,
 *       "run_id": "uuid",
 *       "started_at": "2025-01-05T14:30:00Z",
 *       "completed_at": "2025-01-05T14:31:42Z",
 *       "duration_ms": 102000,
 *       "status": "success",
 *       "summary": {"articles_extracted": 150},
 *       "log_entries": [{"timestamp": "...", "level": "info", "message": "..."}],
 *       "error_message": null
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface ExecutionLog {
  id: string;
  step_id: number;
  job_type: string;
  slot_number: number | null;
  run_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  summary: Record<string, unknown>;
  log_entries: Array<{
    timestamp: string;
    level: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
  error_message: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stepIdParam = searchParams.get("step_id");
  const jobType = searchParams.get("job_type");
  const slotNumberParam = searchParams.get("slot_number");
  const limitParam = searchParams.get("limit");

  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  try {
    // Build query dynamically based on filters
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (stepIdParam !== null) {
      conditions.push(`step_id = $${paramIndex++}`);
      params.push(parseInt(stepIdParam, 10));
    }

    if (jobType) {
      conditions.push(`job_type = $${paramIndex++}`);
      params.push(jobType);
    }

    if (slotNumberParam !== null) {
      conditions.push(`slot_number = $${paramIndex++}`);
      params.push(parseInt(slotNumberParam, 10));
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    params.push(limit);

    const sql = `
      SELECT id, step_id, job_type, slot_number, run_id,
             started_at, completed_at, duration_ms, status,
             summary, log_entries, error_message, created_at
      FROM execution_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `;

    const logs = await query<ExecutionLog>(sql, params);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[Execution Logs API] Error:", error);

    // Check if table doesn't exist yet
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
      return NextResponse.json({
        logs: [],
        message: "Execution logs table not yet created. Run migration first.",
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch execution logs", details: errorMessage },
      { status: 500 }
    );
  }
}
