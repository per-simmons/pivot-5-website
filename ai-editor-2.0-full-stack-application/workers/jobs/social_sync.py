"""
Step 5: Social Syndication

Syndicates decorated stories to social media posting queue.

Replaces n8n workflow: I8U8LgJVDsO8PeBJ
"""

import os
from datetime import datetime
from typing import Dict, Any, List
from ..utils.airtable import AirtableClient


def sync_to_social(job_id: str = None) -> Dict[str, Any]:
    """
    Sync decorated stories to P5 Social Posts table.

    Args:
        job_id: Optional job ID for tracking

    Returns:
        Dict with sync results
    """
    print(f"[Step 5] Syncing to social posts")

    airtable = AirtableClient()

    results = {
        "job_id": job_id,
        "started_at": datetime.now().isoformat(),
        "synced": [],
        "skipped": [],
        "errors": [],
    }

    # Get decorated stories that need social sync
    stories = airtable.get_stories_for_social_sync()

    for story in stories:
        story_id = story.get('storyID')

        try:
            # Check if already exists in social posts
            if airtable.social_post_exists(story_id):
                results["skipped"].append({
                    "story_id": story_id,
                    "reason": "already_exists",
                })
                continue

            # Create social post record
            social_post = {
                "source_record_id": story_id,
                "headline": story.get('ai_headline', ''),
                "label": _get_label_for_slot(story.get('slot_order', 1)),
                "b1": _clean_html(story.get('ai_bullet_1', '')),
                "b2": _clean_html(story.get('ai_bullet_2', '')),
                "b3": _clean_html(story.get('ai_bullet_3', '')),
                "image_raw_url": story.get('image_url', ''),
                "publish_status": "ready",
                "order": story.get('slot_order', 99),
                "created_at": datetime.now().isoformat(),
            }

            airtable.create_social_post(social_post)

            # Mark story as synced
            airtable.update_story_social_status(story_id, "synced")

            results["synced"].append({
                "story_id": story_id,
                "headline": story.get('ai_headline', '')[:50],
            })

        except Exception as e:
            results["errors"].append({
                "story_id": story_id,
                "error": str(e),
            })

    results.update({
        "synced_count": len(results["synced"]),
        "skipped_count": len(results["skipped"]),
        "error_count": len(results["errors"]),
        "completed_at": datetime.now().isoformat(),
    })

    print(f"[Step 5] Social sync complete: {len(results['synced'])} synced, {len(results['skipped'])} skipped")

    return results


def _get_label_for_slot(slot_order: int) -> str:
    """Get topic label for a slot number."""
    labels = {
        1: "Impact",
        2: "Big Tech",
        3: "Industry",
        4: "Emerging",
        5: "Human Interest",
    }
    return labels.get(slot_order, "News")


def _clean_html(text: str) -> str:
    """Remove HTML tags from text for social posts."""
    import re
    # Remove markdown bold
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    # Remove any HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()
