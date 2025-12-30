"""
PivotID Generation Utilities

Generates unique hash-based identifiers for article deduplication.
Uses DJB2 algorithm to match JavaScript implementation from n8n workflow.
"""

from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from typing import Optional


def hash_string(s: str) -> str:
    """
    DJB2 hash algorithm - matches JavaScript implementation.

    Args:
        s: String to hash

    Returns:
        Base36 encoded hash string
    """
    if not isinstance(s, str):
        s = str(s) if s else ''

    hash_value = 5381
    for char in s:
        hash_value = ((hash_value << 5) + hash_value) + ord(char)
        hash_value = hash_value & 0xFFFFFFFF  # Keep as 32-bit unsigned

    return _base36_encode(hash_value)


def _base36_encode(num: int) -> str:
    """Convert number to base36 string."""
    chars = '0123456789abcdefghijklmnopqrstuvwxyz'
    if num == 0:
        return '0'
    result = ''
    while num:
        result = chars[num % 36] + result
        num //= 36
    return result


def normalize_url(url: str) -> Optional[str]:
    """
    Normalize URL for consistent hashing.

    Removes tracking parameters (UTM, etc.) and normalizes format.

    Args:
        url: URL to normalize

    Returns:
        Normalized URL string or None if invalid
    """
    if not url:
        return None

    try:
        parsed = urlparse(url.lower())

        # Remove tracking parameters
        tracking_params = {
            'utm_source', 'utm_medium', 'utm_campaign',
            'utm_term', 'utm_content', 'ref', 'source'
        }
        query_params = parse_qs(parsed.query)
        filtered_params = {
            k: v for k, v in query_params.items()
            if k not in tracking_params
        }

        # Rebuild URL without tracking params
        cleaned = parsed._replace(
            query=urlencode(filtered_params, doseq=True),
            path=parsed.path.rstrip('/'),
            fragment=''  # Remove anchors
        )
        return urlunparse(cleaned)
    except Exception:
        return url.lower().rstrip('/')


def generate_pivot_id(url: str = None, title: str = None) -> Optional[str]:
    """
    Generate pivotId from URL or title.

    Uses normalized URL if available, falls back to title.
    Returns None if neither is provided.

    Args:
        url: Article URL (preferred)
        title: Article title (fallback)

    Returns:
        pivotId string (format: "p_<hash>") or None
    """
    normalized_url = normalize_url(url)
    pivot_base = normalized_url or title

    if not pivot_base:
        return None

    return f"p_{hash_string(pivot_base)}"


def generate_story_id(pivot_id: str) -> Optional[str]:
    """
    Generate storyId from pivotId.

    Args:
        pivot_id: The pivotId (format: "p_<hash>")

    Returns:
        storyId string (format: "s_<hash>") or None
    """
    if not pivot_id:
        return None

    return pivot_id.replace("p_", "s_")


import re

# Common stop words to remove from SEO slugs
STOP_WORDS = {
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'it', 'its', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
    'whom', 'how', 'when', 'where', 'why'
}


def generate_seo_slug(headline: str, max_length: int = 60) -> Optional[str]:
    """
    Generate SEO-friendly slug from headline.

    Best practices (per Google/Backlinko/industry standards):
    - Lowercase, hyphen-separated
    - Remove stop words (the, and, for, etc.)
    - 5-7 words max, under 60 characters
    - No unique IDs or hashes (those hurt SEO)

    Format: keyword-rich-descriptive-slug
    Example: "openai-announces-gpt-5-enterprise"

    Args:
        headline: Article headline
        max_length: Maximum total length (default 60)

    Returns:
        SEO-friendly slug or None if invalid
    """
    if not headline:
        return None

    # Slugify headline
    slug = headline.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special chars except hyphens
    slug = re.sub(r'[\s_]+', '-', slug)   # Replace spaces/underscores with hyphens
    slug = re.sub(r'-+', '-', slug)       # Collapse multiple hyphens
    slug = slug.strip('-')                 # Remove leading/trailing hyphens

    # Remove stop words
    words = slug.split('-')
    words = [w for w in words if w and w not in STOP_WORDS]
    slug = '-'.join(words)

    # Truncate to max_length at word boundary
    if len(slug) > max_length:
        slug = slug[:max_length].rsplit('-', 1)[0]

    return slug


def generate_unique_seo_slug(
    headline: str,
    existing_slugs: set,
    max_length: int = 60
) -> Optional[str]:
    """
    Generate unique SEO-friendly slug, appending -2, -3, etc. if duplicates exist.

    Args:
        headline: Article headline
        existing_slugs: Set of existing storyId slugs to check against
        max_length: Maximum total length (default 60)

    Returns:
        Unique SEO-friendly slug or None if invalid
    """
    base_slug = generate_seo_slug(headline, max_length)
    if not base_slug:
        return None

    # If no duplicate, return as-is
    if base_slug not in existing_slugs:
        return base_slug

    # Find next available number suffix
    counter = 2
    while True:
        numbered_slug = f"{base_slug}-{counter}"
        # Ensure we don't exceed max_length
        if len(numbered_slug) > max_length:
            # Trim base slug to make room for suffix
            trim_amount = len(numbered_slug) - max_length
            trimmed_base = base_slug[:-(trim_amount)].rsplit('-', 1)[0]
            numbered_slug = f"{trimmed_base}-{counter}"

        if numbered_slug not in existing_slugs:
            return numbered_slug
        counter += 1

        # Safety limit
        if counter > 1000:
            return f"{base_slug[:40]}-{counter}"
