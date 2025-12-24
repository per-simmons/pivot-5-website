"use client";

import { useState, useEffect, Suspense, lazy, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromptConfig } from "@/lib/step-config";
import { getPromptContent, type PromptContent } from "@/lib/prompts-content";

// Lazy load Monaco editor to avoid SSR issues
const PromptEditor = lazy(() =>
  import("@/components/ui/prompt-editor").then((mod) => ({ default: mod.PromptEditor }))
);

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined", className)}>
      {name}
    </span>
  );
}

interface SystemPromptsProps {
  stepId: number;
  prompts: PromptConfig[];
}

export function SystemPrompts({ stepId, prompts }: SystemPromptsProps) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    new Set([prompts[0]?.id])
  );
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);

  // Track original content from static file
  const [originalContent, setOriginalContent] = useState<Record<string, string>>({});
  // Track current edited content
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  // Track which prompts have unsaved changes
  const [hasChanges, setHasChanges] = useState<Set<string>>(new Set());

  // Metadata from static file
  const [promptMeta, setPromptMeta] = useState<Record<string, { version: number; lastModified: string }>>({});

  // Load prompts from static file on mount
  useEffect(() => {
    const contentMap: Record<string, string> = {};
    const metaMap: Record<string, { version: number; lastModified: string }> = {};

    prompts.forEach((p) => {
      const promptData = getPromptContent(p.id);
      if (promptData) {
        contentMap[p.id] = promptData.content;
        metaMap[p.id] = {
          version: promptData.version,
          lastModified: promptData.lastModified,
        };
      } else {
        // Fallback for prompts not in static file
        contentMap[p.id] = `You are an AI assistant for the Pivot 5 newsletter pipeline.

Task: ${p.description}

Model: ${p.model}
Temperature: ${p.temperature}`;
        metaMap[p.id] = {
          version: 1,
          lastModified: new Date().toISOString().split('T')[0],
        };
      }
    });

    setOriginalContent(contentMap);
    setEditedContent(contentMap);
    setPromptMeta(metaMap);
  }, [prompts]);

  const toggleExpand = (promptId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) {
        next.delete(promptId);
      } else {
        next.add(promptId);
      }
      return next;
    });
  };

  const handleEdit = (promptId: string) => {
    setEditingPrompt(promptId);
    if (!expandedPrompts.has(promptId)) {
      setExpandedPrompts((prev) => new Set([...prev, promptId]));
    }
  };

  const handleTextChange = useCallback((promptId: string, text: string) => {
    setEditedContent((prev) => ({ ...prev, [promptId]: text }));

    // Compare with original to track changes
    const original = originalContent[promptId] || "";
    if (text !== original) {
      setHasChanges((prev) => new Set([...prev, promptId]));
    } else {
      setHasChanges((prev) => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });
    }
  }, [originalContent]);

  const handleRevert = (promptId: string) => {
    // Restore to original content
    setEditedContent((prev) => ({
      ...prev,
      [promptId]: originalContent[promptId] || "",
    }));
    setHasChanges((prev) => {
      const next = new Set(prev);
      next.delete(promptId);
      return next;
    });
    setEditingPrompt(null);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-blue-800 text-sm flex items-center gap-2">
        <MaterialIcon name="info" className="text-blue-600" />
        <div>
          Prompts are loaded from <code className="bg-blue-100 px-1 rounded">src/lib/prompts-content.ts</code>.
          Edit this file to update the prompts used by the pipeline.
        </div>
      </div>

      {/* Prompt Cards */}
      {prompts.map((prompt) => {
        const isExpanded = expandedPrompts.has(prompt.id);
        const isEditing = editingPrompt === prompt.id;
        const promptHasChanges = hasChanges.has(prompt.id);
        const content = editedContent[prompt.id] ?? "";
        const meta = promptMeta[prompt.id];

        return (
          <Card key={prompt.id}>
            <CardHeader className="pb-4 cursor-pointer" onClick={() => !isEditing && toggleExpand(prompt.id)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon
                    name={isExpanded ? "expand_less" : "expand_more"}
                    className="text-muted-foreground"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{prompt.name}</CardTitle>
                      {prompt.slotNumber && (
                        <Badge variant="outline" className="font-mono text-xs">
                          Slot {prompt.slotNumber}
                        </Badge>
                      )}
                      {promptHasChanges && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          Modified
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{prompt.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {prompt.model}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    temp: {prompt.temperature}
                  </Badge>
                  {isExpanded && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(prompt.id)}
                    >
                      <MaterialIcon name="edit" className="text-base" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {isEditing ? (
                  <div className="space-y-4">
                    <Suspense
                      fallback={
                        <div className="w-full h-64 rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                          Loading editor...
                        </div>
                      }
                    >
                      <PromptEditor
                        value={content}
                        onChange={(value) => handleTextChange(prompt.id, value)}
                        minHeight={256}
                        maxHeight={400}
                      />
                    </Suspense>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {meta ? `v${meta.version} • Last modified: ${formatDate(meta.lastModified)}` : ""}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(prompt.id)}
                        >
                          Revert
                        </Button>
                        <Button
                          size="sm"
                          disabled={true}
                          className="bg-muted text-muted-foreground cursor-not-allowed"
                          title="Edit prompts-content.ts to save changes"
                        >
                          <MaterialIcon name="code" className="text-base mr-1" />
                          Edit in Code
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Suspense
                      fallback={
                        <div className="w-full h-64 rounded-md border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm">
                          Loading...
                        </div>
                      }
                    >
                      <PromptEditor
                        value={content || "(No prompt content)"}
                        onChange={() => {}}
                        readOnly
                        minHeight={200}
                        maxHeight={256}
                      />
                    </Suspense>
                    <span className="text-xs text-muted-foreground">
                      {meta ? `v${meta.version} • Last modified: ${formatDate(meta.lastModified)}` : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
