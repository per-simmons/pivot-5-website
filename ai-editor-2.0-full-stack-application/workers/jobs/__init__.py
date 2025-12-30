"""AI Editor 2.0 Background Jobs

PRODUCTION JOBS:
Step 0: ingest_articles - Fetch articles from RSS.app feeds
Step 0b: ai_scoring - Score articles with Claude for newsletter fit
Step 1: prefilter_stories - Pre-filter candidates by slot eligibility
Step 2: select_slots - Claude agents select 5 stories for newsletter
Step 3: decorate_stories - Generate headlines, deks, bullets
Step 3b: generate_images - Gemini Imagen 3 + Cloudinary + Cloudflare
Step 4: compile_html - Build email HTML template
Step 4b: send_via_mautic - Send newsletter via Mautic
Step 5: sync_social_posts - Syndicate to P5 Social Posts

SANDBOX JOBS (FreshRSS Migration):
Step 0: ingest_articles_sandbox - Fetch articles from FreshRSS (AI Editor 2.0 base)
Step 0b: run_ai_scoring_sandbox - Simplified single-newsletter scoring (pivot_ai only)

Sandbox Target: AI Editor 2.0 Base (appglKSJZxmA9iHpl)
  - Articles - All Ingested
  - Newsletter Selects

Note: Jobs are imported lazily by trigger.py to avoid circular import issues.
"""

# No auto-imports - trigger.py uses lazy loading

# Sandbox job exports for direct import if needed
__all__ = [
    # Production jobs (lazy loaded)
    "ingest_articles",
    "run_ai_scoring",
    # Sandbox jobs
    "ingest_articles_sandbox",
    "run_ai_scoring_sandbox",
]
