"""
Step 1: Pre-Filter Stories

Filters candidate articles into 5 newsletter slots based on freshness,
source credibility, and content relevance using Google Gemini AI.

Replaces n8n workflow: VoSZu0MIJAw1IuLL
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Any
import google.generativeai as genai
from ..utils.airtable import AirtableClient

# Slot eligibility criteria
SLOT_CRITERIA = {
    1: {
        "focus": "AI impact on jobs/economy/stock market/broad impact",
        "freshness_hours": 24,
    },
    2: {
        "focus": "Tier 1 AI companies (OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon) + economic themes + research",
        "freshness_hours": 48,
    },
    3: {
        "focus": "Industry impact (Healthcare, Government, Education, Legal, Accounting, Retail, Security, Transportation, Manufacturing, Real Estate, Agriculture, Energy)",
        "freshness_days": 7,
    },
    4: {
        "focus": "Emerging companies (product launches, fundraising, acquisitions, new AI tools)",
        "freshness_hours": 48,
    },
    5: {
        "focus": "Consumer AI / human interest (ethics, entertainment, societal impact, fun/quirky uses)",
        "freshness_days": 7,
    },
}


def prefilter_stories(job_id: str = None) -> Dict[str, Any]:
    """
    Pre-filter stories for newsletter slot eligibility.

    Args:
        job_id: Optional job ID for tracking

    Returns:
        Dict with results including count of stories processed per slot
    """
    print(f"[Step 1] Starting pre-filter job {job_id or 'manual'}")

    # Initialize clients
    airtable = AirtableClient()
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-3-flash-preview')

    # Get fresh stories from Newsletter Selects table (last 7 days)
    # Migrated from Newsletter Stories (Pivot Media Master) to Newsletter Selects (AI Editor 2.0)
    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    stories = airtable.get_newsletter_selects(since_date=seven_days_ago)
    print(f"[Step 1] Fetched {len(stories)} stories from Newsletter Selects")

    # Get source credibility scores
    source_scores = airtable.get_source_scores()

    # Get yesterday's issue to avoid repeats
    yesterday_stories = airtable.get_yesterday_selected_stories()
    yesterday_ids = {s.get('storyID') for s in yesterday_stories}

    results = {
        "job_id": job_id,
        "started_at": datetime.now().isoformat(),
        "stories_processed": 0,
        "slots": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        "errors": [],
    }

    for story in stories:
        story_id = story.get('storyID')

        # Skip if in yesterday's issue
        if story_id in yesterday_ids:
            continue

        # Get source credibility
        source = story.get('source_id', 'unknown')
        credibility = source_scores.get(source, 3)  # Default to 3

        # Determine eligible slots using Gemini
        try:
            eligible_slots = _evaluate_slot_eligibility(
                model=model,
                story=story,
                credibility=credibility,
            )

            # Write to Pre-Filter Log
            for slot in eligible_slots:
                airtable.create_prefilter_log({
                    "article_id": story_id,
                    "storyID": story_id,
                    "pivotId": story.get('pivotId'),
                    "headline": story.get('ai_headline', story.get('headline', '')),
                    "date_og_published": story.get('date_og_published'),
                    "date_prefiltered": datetime.now().isoformat(),
                    "slot": slot,
                })
                results["slots"][slot] += 1

            results["stories_processed"] += 1

        except Exception as e:
            results["errors"].append({
                "story_id": story_id,
                "error": str(e),
            })

    results["completed_at"] = datetime.now().isoformat()
    print(f"[Step 1] Pre-filter complete: {results['stories_processed']} stories, {sum(results['slots'].values())} slot entries")

    return results


def _evaluate_slot_eligibility(
    model: Any,
    story: Dict[str, Any],
    credibility: int,
) -> List[int]:
    """
    Use Gemini to evaluate which slots a story is eligible for.

    Args:
        model: Gemini model instance
        story: Story data from Airtable
        credibility: Source credibility score (1-5)

    Returns:
        List of eligible slot numbers (1-5)
    """
    headline = story.get('ai_headline', story.get('headline', ''))
    # Use raw field (truncated) for content, with ai_dek fallback for compatibility
    raw_content = story.get('raw', '')
    content = story.get('ai_dek', raw_content[:500] if raw_content else '')
    date_published = story.get('date_og_published', '')

    prompt = f"""Analyze this news article and determine which newsletter slots it's eligible for.

ARTICLE:
Headline: {headline}
Summary: {content}
Published: {date_published}
Source Credibility: {credibility}/5

SLOT CRITERIA:
1. AI impact on jobs/economy/stock market (must be <24 hours old)
2. Tier 1 AI companies - OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon (must be <48 hours old)
3. Industry impact - Healthcare, Government, Education, Legal, Manufacturing, etc. (can be up to 7 days old)
4. Emerging companies - product launches, fundraising, acquisitions (must be <48 hours old)
5. Consumer AI / human interest - ethics, entertainment, quirky uses (can be up to 7 days old)

Return ONLY a comma-separated list of eligible slot numbers (e.g., "1,3,5" or "2" or "none").
Consider both content relevance AND freshness requirements."""

    response = model.generate_content(prompt)
    result = response.text.strip().lower()

    if result == 'none':
        return []

    # Parse slot numbers
    slots = []
    for part in result.replace(' ', '').split(','):
        try:
            slot = int(part)
            if 1 <= slot <= 5:
                slots.append(slot)
        except ValueError:
            continue

    return slots
