"""
Step 3: Decoration Job
Workflow ID: HCbd2g852rkQgSqr
Schedule: 9:25 PM EST (0 2 25 * * 2-6 UTC)

Creates AI-generated headlines, deks, bullet points for each selected story.
Uses Gemini for content cleaning and Claude for decoration generation.

Updated Jan 1, 2026:
- Uses HTML <b> tags for bolding (not Markdown **)
- Field names match Airtable Newsletter Issue Stories table (tbla16LJCf5Z6cRn3):
  - headline (not ai_headline)
  - b1, b2, b3 (not ai_bullet_1/2/3)
  - story_id (not storyID)
  - issue_id (text, not record ID)
- Supports newsletter style variants (pivot_ai, pivot_build, pivot_invest)
- 18 label categories
"""

import os
from datetime import datetime
from typing import List, Dict, Optional, Any

from utils.airtable import AirtableClient
from utils.gemini import GeminiClient
from utils.claude import ClaudeClient


def decorate_stories(newsletter: str = 'pivot_ai') -> dict:
    """
    Step 3: Decoration Cron Job - Main entry point

    Flow (matching n8n workflow HCbd2g852rkQgSqr):
    1. Get pending issue from Selected Slots (status='pending')
    2. For each slot (1-5):
       a. Lookup article markdown by pivotId from Newsletter Selects
       b. Clean content using Gemini (content_cleaner prompt)
       c. Generate decoration using Claude (headline_generator MASTER PROMPT)
          - Outputs: ai_headline, ai_dek, ai_bullet_1/2/3, label, source, clean_url
       d. Apply HTML <b> bolding to bullets (bold_formatter prompt)
       e. Write to Newsletter Issue Stories table
    3. Update issue status to 'decorated'

    Args:
        newsletter: Style variant - 'pivot_ai', 'pivot_build', or 'pivot_invest'

    Returns:
        {decorated: int, issue_id: str, decoration_ids: list, errors: list}
    """
    print(f"[Step 3] Starting decoration at {datetime.utcnow().isoformat()}")
    print(f"[Step 3] Using newsletter style: {newsletter}")

    # Validate newsletter style
    valid_newsletters = ['pivot_ai', 'pivot_build', 'pivot_invest']
    if newsletter not in valid_newsletters:
        print(f"[Step 3] WARNING: Unknown newsletter '{newsletter}', defaulting to 'pivot_ai'")
        newsletter = 'pivot_ai'

    # Initialize clients
    airtable = AirtableClient()
    gemini = GeminiClient()
    claude = ClaudeClient()

    # Track results
    results = {
        "decorated": 0,
        "issue_id": "",
        "decoration_ids": [],
        "errors": []
    }

    try:
        # 1. Get pending issue from Selected Slots
        print("[Step 3] Fetching pending issue...")
        pending_issue = airtable.get_pending_issue()

        if not pending_issue:
            print("[Step 3] No pending issue found")
            return results

        issue_record_id = pending_issue.get('id', '')
        issue_fields = pending_issue.get('fields', {})
        results["issue_id"] = issue_record_id

        print(f"[Step 3] Processing issue: {issue_fields.get('issue_date', 'unknown')}")

        # 2. Process each slot
        for slot in range(1, 6):
            print(f"[Step 3] Decorating Slot {slot}...")

            try:
                # Extract slot data from issue
                pivot_id = issue_fields.get(f'slot_{slot}_pivotId', '')
                story_id = issue_fields.get(f'slot_{slot}_storyId', '')
                headline = issue_fields.get(f'slot_{slot}_headline', '')
                source_id = issue_fields.get(f'slot_{slot}_source', '')

                if not pivot_id:
                    print(f"[Step 3] Slot {slot}: No pivotId, skipping")
                    continue

                # 2a. Lookup article markdown
                print(f"[Step 3] Slot {slot}: Fetching article {pivot_id}...")
                article = airtable.get_article_by_pivot_id(pivot_id)

                if not article:
                    results["errors"].append({
                        "slot": slot,
                        "error": f"Article not found: {pivot_id}"
                    })
                    continue

                article_fields = article.get('fields', {})
                markdown = article_fields.get('markdown', '')
                original_url = article_fields.get('original_url', '')

                if not markdown:
                    results["errors"].append({
                        "slot": slot,
                        "error": f"No markdown content for {pivot_id}"
                    })
                    continue

                # 2b. Clean content using Gemini
                print(f"[Step 3] Slot {slot}: Cleaning content...")
                try:
                    cleaned_content = gemini.clean_content(markdown)
                except Exception as e:
                    print(f"[Step 3] Slot {slot}: Gemini cleaning failed, using raw: {e}")
                    cleaned_content = markdown[:8000]

                # 2c. Generate decoration using Claude MASTER PROMPT
                print(f"[Step 3] Slot {slot}: Generating decoration with {newsletter} style...")
                story_data = {
                    "headline": headline,
                    "source_id": source_id,
                    "core_url": original_url,
                    "date_published": issue_fields.get('issue_date', ''),
                    "newsletter": newsletter
                }

                # Pass newsletter style variant to Claude
                decoration = claude.decorate_story(story_data, cleaned_content, newsletter=newsletter)

                if "error" in decoration:
                    results["errors"].append({
                        "slot": slot,
                        "error": decoration.get("error")
                    })
                    continue

                # 2d. Apply HTML <b> bolding to bullets
                print(f"[Step 3] Slot {slot}: Applying HTML bolding...")
                try:
                    # apply_bolding now takes full decoration dict and returns dict with bolded bullets
                    bolded_decoration = claude.apply_bolding(decoration)
                    # Update decoration with bolded versions
                    decoration["ai_bullet_1"] = bolded_decoration.get("ai_bullet_1", decoration.get("ai_bullet_1", ""))
                    decoration["ai_bullet_2"] = bolded_decoration.get("ai_bullet_2", decoration.get("ai_bullet_2", ""))
                    decoration["ai_bullet_3"] = bolded_decoration.get("ai_bullet_3", decoration.get("ai_bullet_3", ""))
                except Exception as e:
                    print(f"[Step 3] Slot {slot}: Bolding failed, using original: {e}")

                # 2e. Write to Newsletter Issue Stories table
                # Field names from Airtable API query (table tbla16LJCf5Z6cRn3)
                print(f"[Step 3] Slot {slot}: Writing decoration record...")

                # Build issue_id from issue date (format: "Pivot 5 - Jan 02")
                issue_date_raw = issue_fields.get('issue_date', '')
                # Convert "2026-01-02" to "Jan 02" format
                if issue_date_raw and '-' in issue_date_raw:
                    try:
                        from datetime import datetime as dt
                        parsed = dt.strptime(issue_date_raw, '%Y-%m-%d')
                        issue_date_fmt = parsed.strftime('%b %d')  # "Jan 02"
                    except ValueError:
                        issue_date_fmt = issue_date_raw  # Fallback to raw
                else:
                    issue_date_fmt = issue_date_raw  # Already formatted or empty
                issue_id_text = f"Pivot 5 - {issue_date_fmt}" if issue_date_fmt else "Pivot 5"

                decoration_data = {
                    # Record identifiers (verified via Airtable API)
                    "story_id": story_id,           # singleLineText
                    "issue_id": issue_id_text,      # singleLineText (e.g., "Pivot 5 - Dec 31")
                    "slot_order": slot,             # number (1-5)
                    # AI-generated content (field names from Airtable schema)
                    "headline": decoration.get("ai_headline", headline),  # multilineText
                    "ai_dek": decoration.get("ai_dek", ""),                # multilineText
                    "b1": decoration.get("ai_bullet_1", ""),              # multilineText with <b> tags
                    "b2": decoration.get("ai_bullet_2", ""),              # multilineText with <b> tags
                    "b3": decoration.get("ai_bullet_3", ""),              # multilineText with <b> tags
                    # Metadata
                    "label": decoration.get("label", "ENTERPRISE"),       # singleLineText
                    "raw": cleaned_content[:10000] if cleaned_content else "",  # multilineText
                    # Image generation
                    "image_status": "needs_image",  # singleSelect
                }

                record_id = airtable.write_decoration(decoration_data)
                results["decoration_ids"].append(record_id)
                results["decorated"] += 1

                print(f"[Step 3] Slot {slot}: Created decoration {record_id}")

            except Exception as e:
                print(f"[Step 3] Error decorating Slot {slot}: {e}")
                results["errors"].append({
                    "slot": slot,
                    "error": str(e)
                })

        # 3. Update issue status to 'decorated' if any slots were processed
        if results["decorated"] > 0:
            print("[Step 3] Updating issue status to 'decorated'...")
            try:
                # Use the existing airtable client from line 56
                table = airtable._get_table(
                    airtable.ai_editor_base_id,
                    airtable.selected_slots_table_id
                )
                table.update(issue_record_id, {"status": "decorated"})
                print("[Step 3] Issue status updated")
            except Exception as e:
                print(f"[Step 3] Error updating issue status: {e}")
                results["errors"].append({
                    "step": "update_status",
                    "error": str(e)
                })

        print(f"[Step 3] Decoration complete: {results}")
        return results

    except Exception as e:
        print(f"[Step 3] Fatal error: {e}")
        results["errors"].append({"fatal": str(e)})
        raise


# Job configuration for RQ
# NOTE: Typically triggered via API endpoint, not cron
# API endpoint: POST /jobs/decoration with optional {"newsletter": "pivot_ai"}
JOB_CONFIG = {
    "func": decorate_stories,
    "id": "step3_decoration",
    "queue": "default",
    "timeout": "30m",
    # Default newsletter style - can be overridden via API params
    "default_params": {
        "newsletter": "pivot_ai"
    }
}
