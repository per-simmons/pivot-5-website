"""
Step 0: RSS Ingestion Job

Fetches articles from RSS feeds and creates records in Airtable.
This is Step 0 of the newsletter pipeline - raw ingestion to Articles table.

ARCHITECTURE:
  Step 0 (Ingest) → Articles table (raw RSS data)
  Step 1 (Pre-Filter) → Reads from Articles, AI scores → Pre-Filter Log
  Step 2 (Slot Selection) → Selects best articles → Newsletter Issue Stories

Target Table: Articles (tblGumae8KDpsrWvh) in Pivot Media Master base
"""

import asyncio
import aiohttp
import feedparser
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from pyairtable import Api

# Import local utilities
from utils.pivot_id import generate_pivot_id
from config.rss_feeds import get_feeds


# Airtable configuration
AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "appwSozYTkrsQWUXB")  # Pivot Media Master
ARTICLES_TABLE = os.environ.get(
    "AIRTABLE_ARTICLES_TABLE",
    "tblGumae8KDpsrWvh"  # Articles table - raw ingestion target
)


async def fetch_feed(
    session: aiohttp.ClientSession,
    feed: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Fetch and parse a single RSS feed.

    Args:
        session: aiohttp client session
        feed: Feed configuration dict with name, url, source_id

    Returns:
        List of parsed article dicts
    """
    try:
        async with session.get(
            feed["url"],
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "Pivot5-NewsBot/1.0"}
        ) as response:
            if response.status != 200:
                print(f"[Ingest] Error fetching {feed['name']}: HTTP {response.status}")
                return []

            content = await response.text()
            parsed = feedparser.parse(content)

            articles = []
            for entry in parsed.entries:
                # Extract image URL from various RSS formats
                image_url = None
                if hasattr(entry, 'media_content') and entry.media_content:
                    image_url = entry.media_content[0].get('url')
                elif hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
                    image_url = entry.media_thumbnail[0].get('url')
                elif hasattr(entry, 'enclosures') and entry.enclosures:
                    for enc in entry.enclosures:
                        if enc.get('type', '').startswith('image/'):
                            image_url = enc.get('href') or enc.get('url')
                            break

                # Extract categories/tags
                categories = []
                if hasattr(entry, 'tags'):
                    categories = [tag.term for tag in entry.tags if hasattr(tag, 'term')]

                articles.append({
                    "title": entry.get("title", "").strip(),
                    "link": entry.get("link", "").strip(),
                    "pubDate": entry.get("published", ""),
                    "categories": ", ".join(categories) if categories else None,
                    "image_url": image_url,
                    "source_id": feed["source_id"],
                    "feed_name": feed["name"]
                })

            print(f"[Ingest] Fetched {len(articles)} articles from {feed['name']}")
            return articles

    except asyncio.TimeoutError:
        print(f"[Ingest] Timeout fetching {feed['name']}")
        return []
    except Exception as e:
        print(f"[Ingest] Error fetching {feed['name']}: {e}")
        return []


async def fetch_all_feeds(feeds: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    Fetch all RSS feeds in parallel.

    Args:
        feeds: List of feed configs

    Returns:
        Flattened list of all articles from all feeds
    """
    print(f"[Ingest] Fetching {len(feeds)} RSS feeds in parallel...")

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_feed(session, feed) for feed in feeds]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Flatten results, filtering out exceptions
        all_articles = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"[Ingest] Feed {feeds[i]['name']} failed: {result}")
            elif isinstance(result, list):
                all_articles.extend(result)

        return all_articles


def ingest_articles(debug: bool = False) -> Dict[str, Any]:
    """
    Main ingestion job function.

    Fetches all RSS feeds, deduplicates against existing records,
    and creates new records in Airtable.

    Args:
        debug: If True, only fetch from DEBUG_FEEDS (single feed for testing)

    Returns:
        Results dict with counts and timing
    """
    print(f"[Ingest] Starting ingestion job at {datetime.utcnow().isoformat()}")
    print(f"[Ingest] Debug mode: {debug}")
    started_at = datetime.now(timezone.utc)

    results = {
        "started_at": started_at.isoformat(),
        "feeds_count": 0,
        "articles_found": 0,
        "articles_ingested": 0,
        "articles_skipped_duplicate": 0,
        "articles_skipped_invalid": 0,
        "errors": []
    }

    try:
        # Initialize Airtable
        if not AIRTABLE_API_KEY:
            raise ValueError("AIRTABLE_API_KEY environment variable not set")

        api = Api(AIRTABLE_API_KEY)
        table = api.table(AIRTABLE_BASE_ID, ARTICLES_TABLE)

        # Select feeds based on debug mode
        feeds = get_feeds(debug=debug)
        results["feeds_count"] = len(feeds)
        print(f"[Ingest] Using {len(feeds)} feeds")

        # Fetch all articles from RSS feeds
        articles = asyncio.run(fetch_all_feeds(feeds))
        results["articles_found"] = len(articles)
        print(f"[Ingest] Found {len(articles)} total articles")

        if not articles:
            print("[Ingest] No articles found, exiting")
            results["completed_at"] = datetime.now(timezone.utc).isoformat()
            return results

        # Get existing pivot_Ids from Airtable for deduplication
        # Note: Articles table uses "pivot_Id" (with underscore) as the key
        print("[Ingest] Fetching existing pivot_Ids for deduplication...")
        try:
            existing_records = table.all(fields=["pivot_Id"])
            existing_pivot_ids = {
                r["fields"].get("pivot_Id")
                for r in existing_records
                if r["fields"].get("pivot_Id")
            }
            print(f"[Ingest] Found {len(existing_pivot_ids)} existing records")
        except Exception as e:
            print(f"[Ingest] Warning: Could not fetch existing records: {e}")
            existing_pivot_ids = set()

        # Process and create new records
        for article in articles:
            # Skip if no URL and no title
            if not article["link"] and not article["title"]:
                results["articles_skipped_invalid"] += 1
                continue

            # Generate pivotId
            pivot_id = generate_pivot_id(article["link"], article["title"])
            if not pivot_id:
                results["articles_skipped_invalid"] += 1
                continue

            # Check for duplicates
            if pivot_id in existing_pivot_ids:
                results["articles_skipped_duplicate"] += 1
                continue

            # Prepare Airtable record
            # Fields based on Articles table schema (matching n8n Ingestion Engine)
            # Note: We don't have markdown since we're RSS-only (no Firecrawl)
            record = {
                "pivot_Id": pivot_id,  # Primary deduplication key
                "original_url": article["link"],  # Source URL
                "source_id": article["source_id"],  # Publication name
                "date_ingested": datetime.now(timezone.utc).isoformat(),  # When we ingested
            }

            # Add optional fields if present
            if article["pubDate"]:
                record["date_published"] = article["pubDate"]

            # Note: We don't have markdown content since we're RSS-only
            # The n8n workflow uses Firecrawl to get markdown, but we're
            # deliberately skipping that step for this implementation.
            # Pre-Filter (Step 1) will need to work with minimal data.

            # Remove None values (Airtable doesn't like them)
            record = {k: v for k, v in record.items() if v is not None}

            try:
                table.create(record)
                existing_pivot_ids.add(pivot_id)  # Prevent duplicates within batch
                results["articles_ingested"] += 1
            except Exception as e:
                error_msg = f"Error creating record for {pivot_id}: {str(e)}"
                print(f"[Ingest] {error_msg}")
                results["errors"].append(error_msg)

        print(f"[Ingest] Ingestion complete:")
        print(f"  - Feeds fetched: {results['feeds_count']}")
        print(f"  - Articles found: {results['articles_found']}")
        print(f"  - Articles ingested: {results['articles_ingested']}")
        print(f"  - Duplicates skipped: {results['articles_skipped_duplicate']}")
        print(f"  - Invalid skipped: {results['articles_skipped_invalid']}")
        print(f"  - Errors: {len(results['errors'])}")

    except Exception as e:
        error_msg = f"Ingestion job failed: {str(e)}"
        print(f"[Ingest] {error_msg}")
        results["errors"].append(error_msg)
        import traceback
        traceback.print_exc()

    results["completed_at"] = datetime.now(timezone.utc).isoformat()
    return results


# Job configuration for RQ scheduler (if we want to schedule this)
JOB_CONFIG = {
    "func": ingest_articles,
    "trigger": "cron",
    "hour": 20,  # 8 PM UTC = 3 PM EST
    "minute": 0,
    "id": "step0_ingest",
    "replace_existing": True
}
