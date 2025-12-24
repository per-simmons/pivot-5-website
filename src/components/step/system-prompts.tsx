"use client";

import { useState, useEffect, Suspense, lazy, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromptConfig } from "@/lib/step-config";

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

interface PromptData {
  id: string;
  prompt_key: string;
  content: string;
  version: number;
  updated_at: string;
  updated_by: string;
}

export function SystemPrompts({ stepId, prompts }: SystemPromptsProps) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    new Set([prompts[0]?.id])
  );
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);

  // Track original content from API
  const [originalContent, setOriginalContent] = useState<Record<string, string>>({});
  // Track current edited content
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  // Track which prompts have unsaved changes
  const [hasChanges, setHasChanges] = useState<Set<string>>(new Set());

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Metadata from API
  const [promptMeta, setPromptMeta] = useState<Record<string, { version: number; updatedAt: string; updatedBy: string }>>({});

  // Fetch prompts from API on mount
  useEffect(() => {
    const fetchPrompts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/prompts?stepId=${stepId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch prompts");
        }
        const data = await response.json();
        const promptsData: PromptData[] = data.prompts || [];

        const contentMap: Record<string, string> = {};
        const metaMap: Record<string, { version: number; updatedAt: string; updatedBy: string }> = {};

        promptsData.forEach((p) => {
          contentMap[p.prompt_key] = p.content || "";
          metaMap[p.prompt_key] = {
            version: p.version,
            updatedAt: p.updated_at,
            updatedBy: p.updated_by || "system",
          };
        });

        setOriginalContent(contentMap);
        setEditedContent(contentMap);
        setPromptMeta(metaMap);
      } catch (err) {
        console.error("Error fetching prompts:", err);
        setError("Failed to load prompts from database");
      } finally {
        setLoading(false);
      }
    };

    fetchPrompts();
  }, [stepId]);

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

  const handleSave = async (promptId: string) => {
    setSaving(promptId);
    setError(null);

    try {
      const content = editedContent[promptId] || "";

      const response = await fetch("/api/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptKey: promptId,
          content,
          userEmail: "dashboard@pivotstudio.ai",
          changeSummary: "Updated via AI Editor dashboard",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save prompt");
      }

      const data = await response.json();

      // Update original content to match saved content
      setOriginalContent((prev) => ({ ...prev, [promptId]: content }));

      // Update metadata
      if (data.prompt) {
        setPromptMeta((prev) => ({
          ...prev,
          [promptId]: {
            version: data.prompt.version,
            updatedAt: new Date().toISOString(),
            updatedBy: "dashboard@pivotstudio.ai",
          },
        }));
      }

      // Clear changes flag
      setHasChanges((prev) => {
        const next = new Set(prev);
        next.delete(promptId);
        return next;
      });

      // Exit editing mode
      setEditingPrompt(null);
    } catch (err) {
      console.error("Error saving prompt:", err);
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setSaving(null);
    }
  };

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
      return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {prompts.map((prompt) => (
          <Card key={prompt.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Prompt Cards */}
      {prompts.map((prompt) => {
        const isExpanded = expandedPrompts.has(prompt.id);
        const isEditing = editingPrompt === prompt.id;
        const promptHasChanges = hasChanges.has(prompt.id);
        const isSaving = saving === prompt.id;
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
                          Unsaved
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
                        {meta ? `v${meta.version} • Last modified: ${formatDate(meta.updatedAt)} by ${meta.updatedBy}` : "Loading..."}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(prompt.id)}
                          disabled={isSaving}
                        >
                          Revert
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(prompt.id)}
                          disabled={!promptHasChanges || isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50"
                        >
                          {isSaving ? (
                            <>
                              <MaterialIcon name="sync" className="text-base mr-1 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <MaterialIcon name="save" className="text-base mr-1" />
                              Save Changes
                            </>
                          )}
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
                        value={content || "(No prompt content - click Edit to add)"}
                        onChange={() => {}}
                        readOnly
                        minHeight={200}
                        maxHeight={256}
                      />
                    </Suspense>
                    <span className="text-xs text-muted-foreground">
                      {meta ? `v${meta.version} • Last modified: ${formatDate(meta.updatedAt)} by ${meta.updatedBy}` : ""}
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
