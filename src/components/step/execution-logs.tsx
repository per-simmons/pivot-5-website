"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, FileText, ExternalLink } from "lucide-react";
import { formatDateET, formatDuration } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, unknown>;
}

interface ExecutionLog {
  id: string;
  step_id: number;
  job_type: string;
  slot_number: number | null;
  run_id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: "running" | "success" | "error";
  summary: Record<string, unknown>;
  log_entries: LogEntry[];
  error_message: string | null;
  created_at: string;
}

interface ExecutionLogsProps {
  stepId: number;
  stepName: string;
  jobType?: string;
  slotNumber?: number;
}

// Format summary keys for display
function formatSummaryKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Get status badge variant
function getStatusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge className="bg-green-100 text-green-800">Success</Badge>;
    case "error":
      return <Badge className="bg-red-100 text-red-800">Error</Badge>;
    case "running":
      return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// Format time portion for log entries
function formatLogTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function ExecutionLogs({ stepId, stepName, jobType, slotNumber }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("step_id", String(stepId));
      params.append("limit", "5");
      if (jobType) params.append("job_type", jobType);
      if (slotNumber !== undefined) params.append("slot_number", String(slotNumber));

      const response = await fetch(`/api/execution-logs?${params}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Error fetching execution logs:", err);
      setError("Failed to fetch execution logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // Poll every 30 seconds for updates
    const interval = setInterval(() => fetchLogs(true), 30000);
    return () => clearInterval(interval);
  }, [stepId, jobType, slotNumber]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="ml-2 text-zinc-500">Loading execution logs...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-zinc-500">
            <p className="text-red-500 mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs()}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestLog = logs[0];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Execution Logs</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {logs.length === 0 ? (
          <div className="h-[300px] rounded-md border bg-muted/30 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2" />
              <p className="text-sm">No execution logs found for this step.</p>
              <p className="text-xs mt-1">Logs will appear after running the job.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Latest execution header */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{latestLog.job_type}</span>
                {latestLog.slot_number && (
                  <Badge variant="outline">Slot {latestLog.slot_number}</Badge>
                )}
                {getStatusBadge(latestLog.status)}
              </div>
              <span className="text-muted-foreground">
                {formatDateET(latestLog.started_at)}
                {latestLog.duration_ms && (
                  <span className="ml-2">
                    ({formatDuration(Math.floor(latestLog.duration_ms / 1000))})
                  </span>
                )}
              </span>
            </div>

            {/* Summary section */}
            {latestLog.summary && Object.keys(latestLog.summary).length > 0 && (
              <div className="p-3 bg-muted/30 rounded-md">
                <h4 className="font-medium text-sm mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(latestLog.summary).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{formatSummaryKey(key)}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error message */}
            {latestLog.error_message && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{latestLog.error_message}</p>
              </div>
            )}

            {/* Log entries */}
            {latestLog.log_entries && latestLog.log_entries.length > 0 ? (
              <div className="h-[200px] overflow-y-auto font-mono text-xs border rounded-md">
                {latestLog.log_entries.map((entry, i) => (
                  <div
                    key={i}
                    className={cn(
                      "py-1 px-2 border-b last:border-b-0",
                      entry.level === "error" && "text-red-600 bg-red-50",
                      entry.level === "warn" && "text-amber-600 bg-amber-50"
                    )}
                  >
                    <span className="text-muted-foreground">
                      [{formatLogTime(entry.timestamp)}]
                    </span>
                    <span className="ml-2">{entry.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] border rounded-md flex items-center justify-center text-sm text-muted-foreground">
                No detailed log entries available
              </div>
            )}

            {/* Previous executions */}
            {logs.length > 1 && (
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium mb-2">Previous Executions</h4>
                <div className="space-y-1">
                  {logs.slice(1).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <span>{log.job_type}</span>
                        {getStatusBadge(log.status)}
                      </div>
                      <span>{formatDateET(log.started_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link to Render logs */}
            <div className="text-center pt-2">
              <a
                href="https://dashboard.render.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors inline-flex items-center gap-1"
              >
                View full logs in Render Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
