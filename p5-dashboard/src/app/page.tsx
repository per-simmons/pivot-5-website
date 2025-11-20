'use client';

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";

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

export default function Home() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SocialPost | null>(null);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 12; // 3 rows * 4 cols

  const fetchPosts = useCallback(async () => {
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
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Airtable API responded with ${response.status} ${response.statusText}`
        );
      }

      const data: AirtableResponse = await response.json();
      const normalized = normalizeRecords(data.records || []);
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

  const filteredPosts = useMemo(() => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const sortedAll = [...posts].sort((a, b) => {
      const aTime = new Date(a.updatedTime || a.createdTime).getTime();
      const bTime = new Date(b.updatedTime || b.createdTime).getTime();
      return bTime - aTime;
    });
    const recent = sortedAll.filter((post) => {
      const ts = new Date(post.updatedTime || post.createdTime).getTime();
      return !Number.isNaN(ts) && ts >= threeDaysAgo;
    });
    return recent;
  }, [posts]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPosts = filteredPosts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-8 bg-white px-4 py-8 lg:px-6">
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
          <article
            key={post.id}
            onClick={() => setSelected(post)}
            className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]"
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
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                  No image provided
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col space-y-3 p-5">
              {post.label && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 items-center rounded-full bg-orange-100 px-3 text-[11px] font-semibold uppercase text-orange-700">
                    {post.label}
                  </span>
                </div>
              )}
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
              <div className="mt-auto">
                {post.derivedSource && post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex h-10 w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800 transition hover:bg-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.derivedSource}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                )}
                {post.derivedSource && !post.url && (
                  <div className="mt-3 flex h-10 w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-800">
                    {post.derivedSource}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {!loading && !filteredPosts.length && !error && (
        <p className="text-center text-sm text-slate-500">
          No Airtable records yet. Add a row to &quot;{AIRTABLE_TABLE_NAME}&quot; to see it here.
        </p>
      )}

      {filteredPosts.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`min-w-[36px] rounded-full px-3 py-1 text-sm font-semibold transition ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : "border border-orange-300 text-orange-700 hover:bg-orange-50"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/10 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="mt-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-3">
              <button
                onClick={() => setSelected(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col">
              <div className="h-56 w-full bg-slate-100">
                {selected.imageUrl ? (
                  <Image
                    src={selected.imageUrl}
                    alt={selected.headline}
                    width={450}
                    height={450}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                    No image
                  </div>
                )}
              </div>

              <div className="space-y-3 px-5 py-4">
                {selected.label && (
                  <span className="inline-flex h-7 items-center rounded-full bg-orange-100 px-3 text-[11px] font-semibold uppercase text-orange-700">
                    {selected.label}
                  </span>
                )}
                <h3 className="text-lg font-semibold leading-tight text-slate-900">{selected.headline}</h3>
                {selected.bullets.length === 0 && selected.summary && (
                  <p className="text-sm text-slate-700">{selected.summary}</p>
                )}
                {!!selected.bullets.length && (
                  <ul className="space-y-2">
                    {selected.bullets.map((bullet, idx) => (
                      <li key={`${selected.id}-modal-${idx}`} className="flex gap-3 text-sm text-slate-800">
                        <span className="mt-2 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {selected.derivedSource && selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-slate-800 transition hover:underline"
                  >
                    {selected.derivedSource}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {selected.derivedSource && !selected.url && (
                  <p className="mt-2 text-[13px] font-semibold text-slate-800">{selected.derivedSource}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
