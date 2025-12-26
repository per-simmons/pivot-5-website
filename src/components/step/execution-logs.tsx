"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)}>
      {name}
    </span>
  );
}

interface ExecutionLogsProps {
  stepId: number;
  stepName: string;
}

// Execution logs will be loaded from the worker logs API in a future update
// For now, show an empty state

export function ExecutionLogs({ stepId, stepName }: ExecutionLogsProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">
          Execution Logs
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[300px] rounded-md border bg-muted/30 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MaterialIcon name="description" className="text-4xl mb-2" />
            <p className="text-sm">Execution logs will be available in a future update.</p>
            <p className="text-xs mt-1">View worker logs in the Render dashboard for now.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
