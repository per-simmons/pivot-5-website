import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, any>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface SocialPost {
  id: string;
  headline: string;
  summary: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  status?: string;
  platform?: string;
  createdTime: string;
}

const HEADLINE_FIELDS = ["Headline", "Title", "headline"];
const SUMMARY_FIELDS = ["Raw Text", "Summary", "Body", "raw text"];
const IMAGE_FIELDS = [
  "Image Raw URL",
  "image raw url",
  "Image URL",
  "image",
  "Image",
];
const CTA_LABEL_FIELDS = ["CTA", "CTA Label", "cta_label", "Call To Action"];
const CTA_URL_FIELDS = ["CTA URL", "CTA Link", "cta_url", "Link"];
const STATUS_FIELDS = ["Status", "status", "Workflow Stage"];
const PLATFORM_FIELDS = ["Platform", "Channel", "platform"];

const AIRTABLE_BASE_ID = "appRUgK44hQnXH1PM"; // P5 Social Posts base
const AIRTABLE_TABLE_NAME = "Social Post Input";
const AIRTABLE_TOKEN = process.env.NEXT_PUBLIC_AIRTABLE_TOKEN || "";

const findFieldValue = (
  fields: Record<string, any>,
  candidates: string[]
): any => {
  const normalizedKeys = Object.fromEntries(
    Object.keys(fields).map((key) => [key.toLowerCase(), key])
  );

  for (const candidate of candidates) {
    const directMatch = fields[candidate];
    if (directMatch !== undefined && directMatch !== null && directMatch !== "") {
      return directMatch;
    }

    const fuzzyKey = normalizedKeys[candidate.toLowerCase()];
    if (fuzzyKey && fields[fuzzyKey] !== undefined && fields[fuzzyKey] !== null) {
      return fields[fuzzyKey];
    }
  }

  return undefined;
};

const ensureString = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0];
    if (typeof firstItem === "string") return firstItem;
    if (firstItem && typeof firstItem.url === "string") return firstItem.url;
  }
  if (typeof value === "object" && typeof value.url === "string") {
    return value.url;
  }
  return undefined;
};

const normalizeRecords = (records: AirtableRecord[]): SocialPost[] => {
  return records.map((record) => {
    const { fields } = record;

    const headline =
      ensureString(findFieldValue(fields, HEADLINE_FIELDS)) ||
      "Untitled Story";
    const summary = ensureString(findFieldValue(fields, SUMMARY_FIELDS)) ||
      "Add a summary in Airtable to see it here.";
    const imageUrl = ensureString(findFieldValue(fields, IMAGE_FIELDS));
    const ctaLabel = ensureString(findFieldValue(fields, CTA_LABEL_FIELDS));
    const ctaUrl = ensureString(findFieldValue(fields, CTA_URL_FIELDS));
    const status = ensureString(findFieldValue(fields, STATUS_FIELDS));
    const platform = ensureString(findFieldValue(fields, PLATFORM_FIELDS));

    return {
      id: record.id,
      createdTime: record.createdTime,
      headline,
      summary,
      imageUrl,
      ctaLabel,
      ctaUrl,
      status,
      platform,
    };
  });
};

const Dashboard: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const fetchPosts = useCallback(async () => {
    if (!AIRTABLE_TOKEN) {
      setError("Missing Airtable token. Add NEXT_PUBLIC_AIRTABLE_TOKEN to your env.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API responded with ${response.status}`);
      }

      const data: AirtableResponse = await response.json();
      const normalized = normalizeRecords(data.records);
      setPosts(normalized);
      setLastSynced(new Date());
    } catch (apiError: any) {
      const message =
        apiError?.message || "Unable to fetch the Airtable stories right now.";
      setError(message);
      console.error("Dashboard Airtable error", apiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const statusSummary = useMemo(() => {
    const counts = posts.reduce<Record<string, number>>((acc, post) => {
      if (!post.status) return acc;
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [posts]);

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">P5 Social Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Airtable → Dashboard sync for Social Post Input table.
          </p>
          {lastSynced && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last synced {lastSynced.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={fetchPosts} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!!statusSummary.length && (
        <div className="flex flex-wrap gap-3">
          {statusSummary.map(({ status, count }) => (
            <Badge key={status} variant="secondary" className="text-xs">
              {status}: {count}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((post, index) => (
          <article key={post.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="h-48 w-full bg-muted">
              {post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt={post.headline}
                  className="h-full w-full object-cover"
                  loading={index < 6 ? "eager" : "lazy"}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  No image provided
                </div>
              )}
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {post.platform || "Unassigned channel"}
                </p>
                {post.status && <Badge variant="outline">{post.status}</Badge>}
              </div>
              <h3 className="text-lg font-semibold leading-tight">{post.headline}</h3>
              <p className="text-sm text-muted-foreground">
                {post.summary.length > 220
                  ? `${post.summary.slice(0, 220)}…`
                  : post.summary}
              </p>
              {post.ctaLabel && post.ctaUrl && (
                <a href={post.ctaUrl} target="_blank" rel="noreferrer">
                  <Button className="w-full justify-between" variant="secondary">
                    <span>{post.ctaLabel}</span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {!loading && !posts.length && !error && (
        <p className="text-center text-sm text-muted-foreground">
          No Airtable records yet. Add a row to "{AIRTABLE_TABLE_NAME}" to see it here.
        </p>
      )}
    </section>
  );
};

export default Dashboard;
