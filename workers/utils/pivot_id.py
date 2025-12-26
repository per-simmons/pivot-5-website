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
