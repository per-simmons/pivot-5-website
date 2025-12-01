'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, ArrowLeft } from "lucide-react";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface SocialPost {
  id: string;
  headline: string;
  summary: string;
  raw?: string;
  generatedStory?: string;
  imageUrl?: string;
  bullets: string[];
  source?: string;
  url?: string;
  derivedSource?: string;
  createdTime: string;
  updatedTime?: string;
}

const HEADLINE_FIELDS = ["Headline", "Title", "headline"];
const SUMMARY_FIELDS = ["Summary", "Body", "summary"];
const RAW_FIELDS = ["Raw", "raw", "Raw Text", "raw text"];
const GENERATED_STORY_FIELDS = ["Blog Post Raw", "generated_story", "Generated Story"];
const IMAGE_FIELDS = [
  "cld_img",
  "Image Raw URL",
  "image raw url",
  "Image URL",
  "image",
  "Image",
  "image_raw_url",
];
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

const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || "appRUgK44hQnXH1PM";
const AIRTABLE_TABLE_NAME = process.env.NEXT_PUBLIC_AIRTABLE_TABLE || "Social Post Input";
const AIRTABLE_TOKEN = process.env.NEXT_PUBLIC_AIRTABLE_TOKEN || "";

const FALLBACK_SOURCE_FROM_URL = (url?: string) => {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return undefined;
  }
};

const findFieldValue = (fields: Record<string, unknown>, candidates: string[]): unknown => {
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

const stripTags = (input: string): string => input.replace(/<[^>]+>/g, "");

const createSlug = (headline: string): string => {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const normalizeRecord = (record: AirtableRecord): SocialPost => {
  const { fields } = record;

  const headline = ensureString(findFieldValue(fields, HEADLINE_FIELDS)) || "Untitled Story";
  const summaryRaw = ensureString(findFieldValue(fields, SUMMARY_FIELDS));
  const summary = summaryRaw ? stripTags(summaryRaw) : "";
  const rawRaw = ensureString(findFieldValue(fields, RAW_FIELDS));
  const raw = rawRaw ? stripTags(rawRaw) : undefined;
  const generatedStoryRaw = ensureString(findFieldValue(fields, GENERATED_STORY_FIELDS));
  const generatedStory = generatedStoryRaw ? stripTags(generatedStoryRaw) : undefined;
  const imageUrl = ensureString(findFieldValue(fields, IMAGE_FIELDS));
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
    raw,
    generatedStory,
    imageUrl,
    bullets: bullets.slice(0, 3),
    source,
    url,
    derivedSource,
    updatedTime,
  };
};

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { slug } = await params;

        // Fetch all pages from Airtable
        const allRecords: AirtableRecord[] = [];
        let offset: string | undefined = undefined;

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
            throw new Error(`Airtable API responded with ${response.status}`);
          }

          const data: AirtableResponse = await response.json();
          allRecords.push(...(data.records || []));
          offset = data.offset;
        } while (offset);

        const normalized = allRecords.map(normalizeRecord);

        const foundPost = normalized.find(
          (p) => createSlug(p.headline) === slug
        );

        if (!foundPost) {
          setError("Post not found");
        } else {
          setPost(foundPost);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load post");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
          <div className="text-center text-slate-500">Loading...</div>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="text-center text-red-600">{error || "Post not found"}</div>
        </div>
      </main>
    );
  }

  const displayDate = post.updatedTime || post.createdTime;
  const formattedDate = new Date(displayDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-screen w-full bg-white">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <article className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight text-slate-900">
              {post.headline}
            </h1>

            <div className="space-y-2 text-sm text-slate-600">
              <p>{formattedDate}</p>
              {post.derivedSource && post.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900"
                >
                  Source: {post.derivedSource}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : post.derivedSource ? (
                <p>Source: {post.derivedSource}</p>
              ) : null}
            </div>
          </div>

          <div className="relative w-full lg:w-[640px] aspect-video overflow-hidden rounded-lg bg-slate-100">
            {post.imageUrl ? (
              <Image
                src={post.imageUrl}
                alt={post.headline}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="h-full w-full bg-slate-100" />
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8 space-y-8">
          {post.bullets.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">5-Second Bullets</h2>
              <ul className="space-y-3">
                {post.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex gap-3 text-slate-700">
                    <span className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(post.generatedStory || post.raw) && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Here's the Full Story</h2>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {post.generatedStory || post.raw}
              </p>
            </div>
          )}
        </div>
        </article>
      </div>
    </main>
  );
}
