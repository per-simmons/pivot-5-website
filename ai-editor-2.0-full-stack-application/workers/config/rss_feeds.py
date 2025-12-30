"""
RSS Feed Configuration for Ingestion Engine

All feeds are fetched in parallel during ingestion.
No slicing - we fetch all available articles from each feed.
"""

RSS_FEEDS = [
    # Reuters
    {"name": "Reuters AI", "url": "https://rss.app/feeds/MXiuPVkXDT8HqezK.xml", "source_id": "Reuters"},
    {"name": "Reuters Business", "url": "https://rss.app/feeds/C3YLADfGxE5e57eT.xml", "source_id": "Reuters"},

    # AI Newsletters
    {"name": "The Neuron", "url": "https://rss.app/feeds/1iWmVmkwOR9FvPtW.xml", "source_id": "The Neuron"},
    {"name": "AI Valley", "url": "https://rss.app/feeds/el3M8L2iqw3VrU3A.xml", "source_id": "AI Valley"},
    {"name": "There's an AI For That", "url": "https://rss.app/feeds/9SVrxNsg7y419Fke.xml", "source_id": "There's an AI For That"},
    {"name": "The Deep View", "url": "https://rss.app/feeds/NY8oNua0ZxWUYR3Z.xml", "source_id": "The Deep View"},
    {"name": "The AI Report", "url": "https://rss.app/feeds/kRbnlccEQPpl1f6M.xml", "source_id": "The AI Report"},
    {"name": "SuperHuman", "url": "https://rss.app/feeds/QymucjzuFkzvxvkg.xml", "source_id": "SuperHuman"},

    # Tech News
    {"name": "The Verge", "url": "https://rss.app/feeds/08AqYC4pZsuLfMKv.xml", "source_id": "The Verge"},
    {"name": "TechCrunch", "url": "https://rss.app/feeds/YaCBpvEvBDczG9zT.xml", "source_id": "TechCrunch"},
    {"name": "Tech Republic", "url": "https://rss.app/feeds/mC6cK6lSVgJjRTgO.xml", "source_id": "Tech Republic"},
    {"name": "The Atlantic Technology", "url": "https://rss.app/feeds/L83urFREcjBOcQ5z.xml", "source_id": "The Atlantic"},

    # Finance
    {"name": "CNBC Finance", "url": "https://rss.app/feeds/yD81szEq5uTWg5I5.xml", "source_id": "CNBC"},
    {"name": "Yahoo Finance", "url": "https://news.yahoo.com/rss/finance", "source_id": "Yahoo Finance"},

    # Semafor
    {"name": "Semafor Business", "url": "https://rss.app/feeds/ZbdBsJTYo3gDOWmI.xml", "source_id": "Semafor"},
    {"name": "Semafor Technology", "url": "https://rss.app/feeds/6GwMn0gNjbWxUjPN.xml", "source_id": "Semafor"},
    {"name": "Semafor CEO", "url": "https://rss.app/feeds/jSkbNDntFNSdShkz.xml", "source_id": "Semafor"},

    # Google News Aggregators
    {"name": "Google News AI", "url": "https://news.google.com/rss/search?q=AI+OR+%22artificial+intelligence%22+when:12h&hl=en-US&gl=US&ceid=US:en", "source_id": "Google News"},
    {"name": "Google News Finance", "url": "https://news.google.com/rss/search?q=markets+OR+%22S%26P+500%22+OR+stocks+OR+earnings+when:12h&hl=en-US&gl=US&ceid=US:en", "source_id": "Google News"},
]

# For debugging - can limit to specific feeds
DEBUG_FEEDS = [
    {"name": "Yahoo Finance", "url": "https://news.yahoo.com/rss/finance", "source_id": "Yahoo Finance"},
]


def get_feeds(debug: bool = False):
    """Get the appropriate feed list based on debug mode."""
    return DEBUG_FEEDS if debug else RSS_FEEDS
