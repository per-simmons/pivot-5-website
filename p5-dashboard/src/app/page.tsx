'use client';

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

type AirtableFields = Record<string, unknown>;

interface SocialPost {
  id: string;
  headline: string;
  summary: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  status?: string;
  platform?: string;
  label?: string;
  bullets: string[];
  source?: string;
  url?: string;
  derivedSource?: string;
  createdTime: string;
  updatedTime?: string;
}

const HEADLINE_FIELDS = ["Headline", "Title", "headline"];
const SUMMARY_FIELDS = ["Raw Text", "Summary", "Body", "raw text", "Raw"];
const IMAGE_FIELDS = [
  "cld_img",
  "Image Raw URL",
  "image raw url",
  "Image URL",
  "image",
  "Image",
  "image_raw_url",
];
const CTA_LABEL_FIELDS = ["CTA", "CTA Label", "cta_label", "Call To Action"];
const CTA_URL_FIELDS = ["CTA URL", "CTA Link", "cta_url", "Link"];
const STATUS_FIELDS = ["Status", "status", "Workflow Stage", "publish_status"];
const PLATFORM_FIELDS = ["Platform", "Channel", "platform"];
const LABEL_FIELDS = ["Label", "label", "Topic", "tag"];
const SOURCE_FIELDS = ["Source", "source", "Publisher", "publisher"];
const URL_FIELDS = ["URL", "Url", "url", "URL_clean", "url_clean", "url_cleaned"];
const UPDATED_FIELDS = [
  "Last Modified",
  "last_modified",
  "last_updated",
  "Last Updated",
  "last_updated_time",
  "Modified",
  "Updated",
  "updated_at",
  "Updated At"
];
const BULLET_FIELDS = ["B1", "B2", "B3", "b1", "b2", "b3"];
const CARD_BULLET_CHAR_LIMIT = 140;
const FALLBACK_SOURCE_FROM_URL = (url?: string) => {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return undefined;
  }
};

const AIRTABLE_BASE_ID =
  process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || "appRUgK44hQnXH1PM"; // P5 Social Posts base
const AIRTABLE_TABLE_NAME =
  process.env.NEXT_PUBLIC_AIRTABLE_TABLE || "Social Post Input";
const AIRTABLE_TOKEN =
  process.env.NEXT_PUBLIC_AIRTABLE_TOKEN || "";

const findFieldValue = (
  fields: AirtableFields,
  candidates: string[]
): unknown => {
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

const ensureString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const firstItem = value[0] as unknown;
    if (typeof firstItem === "string") return firstItem;
    if (
      firstItem &&
      typeof firstItem === "object" &&
      "url" in firstItem &&
      typeof (firstItem as { url?: unknown }).url === "string"
    ) {
      return (firstItem as { url: string }).url;
    }
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof (value as { url?: unknown }).url === "string"
  ) {
    return (value as { url: string }).url;
  }
  return undefined;
};

const normalizeRecords = (records: AirtableRecord[]): SocialPost[] => {
  return records.map((record) => {
    const { fields } = record;

    const headline =
      ensureString(findFieldValue(fields, HEADLINE_FIELDS)) ||
      "Untitled Story";
    const summaryRaw = ensureString(findFieldValue(fields, SUMMARY_FIELDS));
    const summary = summaryRaw ? stripTags(summaryRaw) : "";
    const imageUrl = ensureString(findFieldValue(fields, IMAGE_FIELDS));
    const ctaLabel = ensureString(findFieldValue(fields, CTA_LABEL_FIELDS));
    const ctaUrl = ensureString(findFieldValue(fields, CTA_URL_FIELDS));
    const status = ensureString(findFieldValue(fields, STATUS_FIELDS));
    const platform = ensureString(findFieldValue(fields, PLATFORM_FIELDS));
    const label = ensureString(findFieldValue(fields, LABEL_FIELDS));
    const source = ensureString(findFieldValue(fields, SOURCE_FIELDS));
    const url = ensureString(findFieldValue(fields, URL_FIELDS));
    const derivedSource = source || FALLBACK_SOURCE_FROM_URL(url);
    const updatedTime = ensureString(findFieldValue(fields, UPDATED_FIELDS));

    const bullets: string[] = [];
    BULLET_FIELDS.forEach((key) => {
      const bulletRaw = ensureString(fields[key]);
      const bullet = bulletRaw ? stripTags(bulletRaw) : undefined;
      if (bullet && bullet.trim() && !bullets.includes(bullet)) {
        bullets.push(bullet.trim());
      }
    });

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
      label,
      bullets: bullets.slice(0, 3),
      source,
      url,
      derivedSource,
      updatedTime,
    };
  });
};

const stripTags = (input: string): string => input.replace(/<[^>]+>/g, "");
const truncate = (input: string, max: number) =>
  input.length > max ? `${input.slice(0, max)}…` : input;

const createSlug = (headline: string): string => {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function Home() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const allRecords: AirtableRecord[] = [];
      let offset: string | undefined = undefined;

      // Fetch all pages from Airtable (API returns max 100 records per page)
      do {
        const url = new URL(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
            AIRTABLE_TABLE_NAME
          )}`
        );
        if (offset) {
          url.searchParams.set("offset", offset);
        }

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Airtable API responded with ${response.status} ${response.statusText}`
          );
        }

        const data: AirtableResponse = await response.json();
        allRecords.push(...(data.records || []));
        offset = data.offset;
      } while (offset);

      console.log(`Fetched ${allRecords.length} total records from Airtable`);
      const normalized = normalizeRecords(allRecords);
      console.log(`Normalized ${normalized.length} posts, ${normalized.filter(p => p.status === "Published").length} are Published`);
      setPosts(normalized);
    } catch (apiError: unknown) {
      const message =
        apiError instanceof Error
          ? apiError.message
          : "Unable to fetch the Airtable stories right now.";
      setError(message);
      console.error("Dashboard Airtable error", apiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const PAGE_SIZE = 20; // 4 cols x 5 rows = 20 posts per page (covers ~4 newsletter days)

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    // Filter valid published posts (accept both "Published" and "ready" statuses)
    const valid = posts.filter((post) => {
      if (post.status !== "Published" && post.status !== "ready") {
        return false;
      }
      if (!post.headline || !post.headline.trim() || post.headline === "Untitled Story") {
        return false;
      }
      // Skip corrupted records where headline contains raw article text (> 200 chars)
      if (post.headline.length > 200) {
        return false;
      }
      return true;
    });

    // Sort by updated time (newest first)
    return [...valid].sort((a, b) => {
      const aTime = new Date(a.updatedTime || a.createdTime).getTime();
      const bTime = new Date(b.updatedTime || b.createdTime).getTime();
      return bTime - aTime;
    });
  }, [posts]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPosts = filteredPosts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Format date for card display
  const formatCardDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <main className="mx-auto min-h-screen w-full space-y-8 bg-white px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-lg font-semibold text-slate-900">
        <div className="flex items-center gap-2">
          <Image src="/pivot5-logo.svg" alt="Pivot 5" width={100} height={40} className="h-10 w-auto" />
        </div>
        <span className="text-[15px] font-semibold text-slate-700">5 headlines. 5 minutes. 5 days a week.</span>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pagedPosts.map((post, index) => (
          <Link
            key={post.id}
            href={`/post/${createSlug(post.headline)}`}
            className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]"
          >
            <div className="h-56 w-full bg-slate-100">
              {post.imageUrl ? (
                <Image
                  src={post.imageUrl}
                  alt={post.headline}
                  width={450}
                  height={450}
                  className="h-full w-full object-cover"
                  priority={index < 6}
                  unoptimized
                />
              ) : (
                <div className="h-full w-full bg-slate-100" />
              )}
            </div>
            <div className="flex flex-1 flex-col space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                {post.label && (
                  <span className="inline-flex h-7 items-center rounded-full bg-orange-100 px-3 text-[11px] font-semibold uppercase text-orange-700">
                    {post.label}
                  </span>
                )}
                <span className="text-[12px] text-slate-500 ml-auto">
                  {formatCardDate(post.updatedTime || post.createdTime)}
                </span>
              </div>
              <h3 className="text-[17px] font-semibold leading-snug text-slate-900">
                {post.headline}
              </h3>
              {post.bullets.length === 0 && post.summary && (
                <p className="text-sm text-slate-600 line-clamp-2">
                  {post.summary.length > 220
                    ? `${post.summary.slice(0, 220)}…`
                    : post.summary}
                </p>
              )}
              {!!post.bullets.length && (
                <ul className="space-y-2">
                  {post.bullets.map((bullet, idx) => (
                    <li key={`${post.id}-bullet-${idx}`} className="flex gap-3 text-sm text-slate-700 line-clamp-2">
                      <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
                      <span>{truncate(bullet, CARD_BULLET_CHAR_LIMIT)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex items-center justify-center pt-2">
                {post.derivedSource && (
                  <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-[13px] font-medium text-slate-700">
                    {post.derivedSource}
                    {post.url && <ExternalLink className="h-3.5 w-3.5" />}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && !filteredPosts.length && !error && (
        <div className="text-center text-sm text-slate-500 py-12">
          No published newsletter posts found.
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="cursor-pointer rounded-full px-3 py-1 text-sm font-semibold transition border border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>

          {(() => {
            const pages: (number | string)[] = [];

            if (totalPages <= 7) {
              // Show all pages if 7 or fewer
              for (let i = 1; i <= totalPages; i++) pages.push(i);
            } else {
              // Always show first page
              pages.push(1);

              if (currentPage > 3) {
                pages.push("...");
              }

              // Pages around current
              const start = Math.max(2, currentPage - 1);
              const end = Math.min(totalPages - 1, currentPage + 1);

              for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
              }

              if (currentPage < totalPages - 2) {
                pages.push("...");
              }

              // Always show last page
              if (!pages.includes(totalPages)) pages.push(totalPages);
            }

            return pages.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                    ...
                  </span>
                );
              }
              const pageNum = p as number;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`cursor-pointer min-w-[36px] rounded-full px-3 py-1 text-sm font-semibold transition ${
                    isActive
                      ? "bg-orange-500 text-white"
                      : "border border-orange-300 text-orange-700 hover:bg-orange-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            });
          })()}

          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="cursor-pointer rounded-full px-3 py-1 text-sm font-semibold transition border border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
