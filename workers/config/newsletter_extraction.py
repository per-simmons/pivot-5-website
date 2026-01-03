"""
Newsletter Link Extraction Configuration

This module defines extraction rules for each newsletter that arrives via
Kill The Newsletter (FreshRSS feed/17). The rules specify which sections
to extract links from and which to ignore.

Created: January 2, 2026
Documentation: docs/ai-ingestion-engine-step-0/Newsletter-Logic-Extraction-1-2-26.md
"""

from typing import TypedDict, List, Optional


class NewsletterConfig(TypedDict):
    """Configuration for a single newsletter's link extraction."""
    name: str                          # Display name
    extract_sections: List[str]        # Only extract from these sections (if specified)
    ignore_sections: List[str]         # Skip these sections
    extract_all: bool                  # If True, extract all external links


# Newsletter extraction configurations
# Key is the domain found in Kill The Newsletter content
NEWSLETTER_EXTRACTION_CONFIG: dict[str, NewsletterConfig] = {
    # =========================================================================
    # NEWSLETTERS WITH SPECIFIC SECTION EXTRACTION
    # =========================================================================

    "thedeepview.co": {
        "name": "The Deep View",
        "extract_sections": ["From around the web"],
        "ignore_sections": [],  # Original content at top is implicitly ignored
        "extract_all": False
    },

    "theaivalley.com": {
        "name": "AI Valley",
        "extract_sections": ["Through the Valley"],
        "ignore_sections": [],
        "extract_all": False
    },

    "theresanaiforthat.com": {
        "name": "There's an AI For That",
        "extract_sections": ["Breaking News", "The Latest AI Developments"],
        "ignore_sections": [],
        "extract_all": False
    },

    "joinsuperhuman.ai": {
        "name": "Superhuman",
        "extract_sections": [],
        "ignore_sections": ["Memes", "Productivity", "In The Know"],
        "extract_all": True  # Extract all external links
    },

    "superhuman.ai": {
        "name": "Superhuman",
        "extract_sections": [],
        "ignore_sections": ["Memes", "Productivity", "In The Know"],
        "extract_all": True  # Extract all external links
    },

    # =========================================================================
    # NEWSLETTERS WITH FULL EXTRACTION (all external links)
    # =========================================================================

    "tldr.tech": {
        "name": "TLDR AI",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True  # All links are news
    },

    "therundown.ai": {
        "name": "The Rundown",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "forwardfuture.ai": {
        "name": "Forward Future",
        "extract_sections": [],
        "ignore_sections": ["From the Live Show", "Toolbox", "Job Board"],
        "extract_all": True
    },

    "aibreakfast.beehiiv.com": {
        "name": "AI Breakfast",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "mail.beehiiv.com": {
        # Fallback for beehiiv newsletters - check content for specific newsletter
        "name": "Beehiiv Newsletter",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "futuretools.beehiiv.com": {
        "name": "Future Tools",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "mindstream.news": {
        "name": "Mindstream",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True  # Review needed - may be tips not news
    },

    # =========================================================================
    # EXISTING NEWSLETTERS (already in freshrss_client.py)
    # =========================================================================

    "bensbites.co": {
        "name": "Ben's Bites",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "bensbites.beehiiv.com": {
        "name": "Ben's Bites",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "theaireport.ai": {
        "name": "The AI Report",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },

    "readwrite.com": {
        "name": "ReadWrite AI",
        "extract_sections": [],
        "ignore_sections": [],
        "extract_all": True
    },
}


# Newsletters to SKIP entirely (don't extract links, don't process as articles)
SKIP_NEWSLETTERS = [
    "theneurondaily.com",  # REMOVED - low quality
]


# Domains that should NEVER be extracted as news links
# (These are newsletter infrastructure, sponsors, etc.)
BLOCKED_LINK_DOMAINS = [
    # Newsletter platforms
    "beehiiv.com",
    "substack.com",
    "mailchimp.com",
    "convertkit.com",
    "buttondown.email",
    "revue.co",

    # Social media profiles (not articles)
    "twitter.com/home",
    "x.com/home",
    "linkedin.com/in/",
    "linkedin.com/company/",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "youtube.com/@",
    "youtube.com/channel/",

    # Common sponsor/ad domains
    "bit.ly",
    "tinyurl.com",
    "ow.ly",
    "geni.us",
    "amzn.to",

    # Unsubscribe/manage
    "unsubscribe",
    "manage-preferences",
    "email-preferences",

    # Newsletter's own domains (they link to their own content)
    "thedeepview.co",
    "theaivalley.com",
    "tldr.tech",
    "therundown.ai",
    "theresanaiforthat.com",
    "joinsuperhuman.ai",
    "superhuman.ai",
    "forwardfuture.ai",
    "mindstream.news",
    "bensbites.co",
    "theaireport.ai",
    "theneurondaily.com",
]


# Link patterns that indicate NOT a news article
# (AI models, tools, product pages, etc.)
NON_NEWS_PATTERNS = [
    # AI model pages
    "/models/",
    "huggingface.co/",
    "openai.com/api",
    "anthropic.com/api",
    "github.com/",

    # Product/tool pages
    "/pricing",
    "/signup",
    "/login",
    "/register",
    "/download",
    "/install",

    # Documentation
    "/docs/",
    "/documentation/",
    "/api-reference",

    # Job postings
    "/careers",
    "/jobs/",
    "greenhouse.io",
    "lever.co",
    "workday.com",
]


def get_newsletter_config(domain: str) -> Optional[NewsletterConfig]:
    """
    Get extraction config for a newsletter domain.

    Args:
        domain: Newsletter domain (e.g., "thedeepview.co")

    Returns:
        NewsletterConfig if found, None otherwise
    """
    # Direct match
    if domain in NEWSLETTER_EXTRACTION_CONFIG:
        return NEWSLETTER_EXTRACTION_CONFIG[domain]

    # Try without subdomain
    parts = domain.split(".")
    if len(parts) > 2:
        root_domain = ".".join(parts[-2:])
        if root_domain in NEWSLETTER_EXTRACTION_CONFIG:
            return NEWSLETTER_EXTRACTION_CONFIG[root_domain]

    return None


def should_skip_newsletter(domain: str) -> bool:
    """
    Check if a newsletter should be skipped entirely.

    Args:
        domain: Newsletter domain

    Returns:
        True if newsletter should be skipped
    """
    return domain in SKIP_NEWSLETTERS


def is_blocked_domain(url: str) -> bool:
    """
    Check if a URL is from a blocked domain.

    Args:
        url: Full URL to check

    Returns:
        True if URL should be blocked
    """
    url_lower = url.lower()
    for blocked in BLOCKED_LINK_DOMAINS:
        if blocked in url_lower:
            return True
    return False


def is_non_news_url(url: str) -> bool:
    """
    Check if a URL matches non-news patterns.

    Args:
        url: Full URL to check

    Returns:
        True if URL is likely not a news article
    """
    url_lower = url.lower()
    for pattern in NON_NEWS_PATTERNS:
        if pattern in url_lower:
            return True
    return False
