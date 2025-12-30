# FreshRSS Google Reader API Reference

This skill provides documentation for working with the FreshRSS Google Reader compatible API used by the Pivot 5 ingestion pipeline.

## Quick Reference

**Production Instance:** `https://pivot-media-rss-feed.onrender.com`
**API Endpoint:** `https://pivot-media-rss-feed.onrender.com/api/greader.php`
**Context7 Library ID:** `/websites/freshrss_github_io_freshrss_en`

## Authentication

FreshRSS uses a GoogleLogin-style auth token in the format `username/token`.

### Auth Header Format
```
Authorization: GoogleLogin auth=admin/d13c712f15c87f1d9aee574372ed7dffe7e5e880
```

### Login Endpoint
```bash
curl 'https://freshrss.example.net/api/greader.php/accounts/ClientLogin?Email=alice&Passwd=Abcdef123456'
```

**Response:**
```json
{
  "SID": "alice/8e6845e089457af25303abc6f53356eb60bdb5f8",
  "Auth": "alice/8e6845e089457af25303abc6f53356eb60bdb5f8"
}
```

## Key API Endpoints

### List Subscriptions
```bash
curl -s -H "Authorization:GoogleLogin auth=admin/TOKEN" \
  'https://pivot-media-rss-feed.onrender.com/api/greader.php/reader/api/0/subscription/list?output=json'
```

### Unread Count
```bash
curl -s -H "Authorization:GoogleLogin auth=admin/TOKEN" \
  'https://pivot-media-rss-feed.onrender.com/api/greader.php/reader/api/0/unread-count?output=json'
```

### Stream Contents (Articles)
```bash
curl -s -H "Authorization:GoogleLogin auth=admin/TOKEN" \
  'https://pivot-media-rss-feed.onrender.com/api/greader.php/reader/api/0/stream/contents/reading-list?n=100&output=json'
```

### Stream Contents Parameters
| Parameter | Description |
|-----------|-------------|
| `n` | Number of items to return (default varies) |
| `ot` | Oldest timestamp - only return items newer than this Unix timestamp |
| `nt` | Newest timestamp - only return items older than this Unix timestamp |
| `c` | Continuation token for pagination |
| `r` | Ranking/sort order |
| `output` | Response format (`json`) |

### Specific Feed
```bash
curl -s -H "Authorization:GoogleLogin auth=admin/TOKEN" \
  'https://pivot-media-rss-feed.onrender.com/api/greader.php/reader/api/0/stream/contents/feed/3?n=50&output=json'
```

## Article Response Fields

Each article item in the response contains:

```json
{
  "id": "tag:google.com,2005:reader/item/...",
  "title": "Article headline",
  "published": 1735488000,        // Unix timestamp when PUBLISHED (article date)
  "crawlTimeMsec": "1735520400000", // When FreshRSS DISCOVERED it (ms)
  "alternate": [{"href": "https://..."}],
  "origin": {
    "streamId": "feed/3",
    "title": "Bloomberg Technology"
  },
  "summary": {"content": "..."},
  "content": {"content": "..."}
}
```

## CRITICAL: Timestamp Fields

**Two different timestamps - know the difference:**

| Field | Format | Meaning | Use Case |
|-------|--------|---------|----------|
| `published` | Unix seconds | When article was **originally published** | Filter for news recency |
| `crawlTimeMsec` | Unix milliseconds | When FreshRSS **discovered** the article | Filter to avoid reprocessing |

### Common Issue
An article published 7 days ago can be crawled today (e.g., Reuters article published Dec 23, crawled Dec 29). Filtering only by `published` would miss this article.

**Best Practice:** Filter by BOTH timestamps:
1. `crawlTimeMsec` - Ensure we're not re-ingesting old crawls
2. `published` - Ensure news is actually recent

```python
# Filter by BOTH timestamps
if article.get("crawl_dt"):
    if article["crawl_dt"] < cutoff:
        continue
if article.get("published_dt"):
    if article["published_dt"] < cutoff:
        continue
```

## Feed IDs (Pivot 5 Production)

| Feed ID | Source |
|---------|--------|
| `feed/3` | Bloomberg Technology |
| `feed/8` | The Verge |
| `feed/9` | TechCrunch |
| `feed/10` | CNBC Tech |
| `feed/11` | The Atlantic |
| `feed/16` | Google News AI |
| `feed/17` | AI Newsletters (Kill The Newsletter) |
| `feed/18` | Reuters |
| `feed/19` | TechRepublic |
| `feed/21` | WSJ Tech (Google News) |
| `feed/22` | WSJ Business AI (Google News) |
| `feed/23` | Reuters AI (Google News) |
| `feed/26` | NYT Technology (Google News) |
| `feed/27` | Semafor |
| `feed/28` | VentureBeat |

## Using Context7 for Documentation

To look up FreshRSS documentation:

```
mcp__context7__query-docs:
  libraryId: /websites/freshrss_github_io_freshrss_en
  query: "your search query here"
```

**Example queries:**
- `"Google Reader API stream contents parameters"`
- `"authentication login endpoint"`
- `"subscription list endpoint"`
- `"mark items read edit-tag"`

## Codebase Integration

### Python Client Location
`workers/config/freshrss_client.py`

### Key Functions
- `FreshRSSClient.get_articles(limit, feed_id, since_hours)` - Fetch articles
- `FreshRSSClient.list_feeds()` - List subscriptions
- `FreshRSSClient.health_check()` - Verify API connectivity

### Environment Variables
```
FRESHRSS_URL=https://pivot-media-rss-feed.onrender.com
FRESHRSS_AUTH=admin/d13c712f15c87f1d9aee574372ed7dffe7e5e880
```

## Troubleshooting

### "Only getting Google News articles"
- **Cause:** Limit too low, Google News feeds fill quota first
- **Fix:** Increase `limit` parameter (e.g., 1000) then filter by recency

### "Articles missing from certain feeds"
- **Cause:** Filtering by `published` only misses recently-crawled older articles
- **Fix:** Filter by both `crawlTimeMsec` AND `published`

### "403 Forbidden"
- **Cause:** Auth token invalid or expired
- **Fix:** Regenerate API token in FreshRSS settings
