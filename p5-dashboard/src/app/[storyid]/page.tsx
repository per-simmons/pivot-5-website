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

interface SocialPost {
  id: string;
  storyId: string;
  headline: string;
  dek?: string;
  raw?: string;
  generatedStory?: string;
  imageUrl?: string;
  bullets: string[];
  source?: string;
  url?: string;
  derivedSource?: string;
  createdTime: string;
  topic?: string;
  tags?: string[];
  sendDate?: string;
}

// New Airtable field names
const HEADLINE_FIELDS = ["ai_headline", "Headline", "headline"];
const DEK_FIELDS = ["ai_dek", "dek", "Summary"];
const RAW_FIELDS = ["markdown (from story_link)", "Raw", "raw"];
const GENERATED_STORY_FIELDS = ["blog_post_raw", "Blog Post Raw", "generated_story"];
const IMAGE_FIELDS = ["image_url"];
const URL_FIELDS = ["decorated_url", "URL", "url"];
const BULLET_FIELDS = ["bullet_1", "bullet_2", "bullet_3", "B1", "B2", "B3"];
const TOPIC_FIELDS = ["topic", "Topic", "label"];
const TAGS_FIELDS = ["tags", "Tags"];
const SEND_DATE_FIELDS = ["send_date", "Send Date", "Last Modified"];
const STORY_ID_FIELDS = ["StoryID", "storyid", "story_id"];

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

const ensureStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
};

const stripTags = (input: string): string => {
  // Remove HTML tags
  let result = input.replace(/<[^>]+>/g, "");
  // Remove markdown bold **text** and __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, "$1");
  result = result.replace(/__([^_]+)__/g, "$1");
  // Remove markdown italic *text* and _text_
  result = result.replace(/\*([^*]+)\*/g, "$1");
  result = result.replace(/_([^_]+)_/g, "$1");
  return result;
};

const normalizeRecord = (record: AirtableRecord): SocialPost => {
  const { fields } = record;

  const storyId = ensureString(findFieldValue(fields, STORY_ID_FIELDS)) || record.id;
  const headline = ensureString(findFieldValue(fields, HEADLINE_FIELDS)) || "Untitled Story";
  const dekRaw = ensureString(findFieldValue(fields, DEK_FIELDS));
  const dek = dekRaw ? stripTags(dekRaw) : undefined;
  const rawRaw = ensureString(findFieldValue(fields, RAW_FIELDS));
  const raw = rawRaw ? stripTags(rawRaw) : undefined;
  const generatedStoryRaw = ensureString(findFieldValue(fields, GENERATED_STORY_FIELDS));
  const generatedStory = generatedStoryRaw ? stripTags(generatedStoryRaw) : undefined;
  const imageUrl = ensureString(findFieldValue(fields, IMAGE_FIELDS));
  const url = ensureString(findFieldValue(fields, URL_FIELDS));
  const derivedSource = FALLBACK_SOURCE_FROM_URL(url);
  const topic = ensureString(findFieldValue(fields, TOPIC_FIELDS));
  const tags = ensureStringArray(findFieldValue(fields, TAGS_FIELDS));
  const sendDate = ensureString(findFieldValue(fields, SEND_DATE_FIELDS));

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
    storyId,
    createdTime: record.createdTime,
    headline,
    dek,
    raw,
    generatedStory,
    imageUrl,
    bullets: bullets.slice(0, 3),
    source: undefined,
    url,
    derivedSource,
    topic,
    tags,
    sendDate,
  };
};

export default function PostPage({ params }: { params: Promise<{ storyid: string }> }) {
  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { storyid } = await params;

        // Fetch from our server-side API by StoryID
        const response = await fetch(`/api/posts/${encodeURIComponent(storyid)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError("Post not found");
            return;
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API responded with ${response.status}`);
        }

        const data = await response.json();
        const foundPost = normalizeRecord(data.record);
        setPost(foundPost);
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

  const displayDate = post.sendDate || post.createdTime;
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

            {post.dek && (
              <p className="text-xl text-slate-600">{post.dek}</p>
            )}

            <div className="space-y-2 text-sm text-slate-600">
              <p>{formattedDate}</p>
              {post.topic && (
                <span className="inline-flex h-7 items-center rounded-full bg-orange-100 px-3 text-[11px] font-semibold uppercase text-orange-700">
                  {post.topic}
                </span>
              )}
              {post.derivedSource && post.url ? (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 ml-2"
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
