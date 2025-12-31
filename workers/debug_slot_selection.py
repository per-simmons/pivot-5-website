#!/usr/bin/env python3
"""
Debug script for slot selection - runs locally to diagnose issues.

Usage:
    cd /Users/patsimmons/client-coding/pivot-5-website_11.19.25/ai-editor-2.0-full-stack-application/app/workers
    source ../../.env.local.sh  # or export env vars manually
    python debug_slot_selection.py
"""

import os
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment from parent .env.local
env_path = os.path.join(os.path.dirname(__file__), '../../.env.local')
load_dotenv(env_path)

# Add workers directory to path
sys.path.insert(0, os.path.dirname(__file__))

from utils.airtable import AirtableClient

# Configuration
DUPLICATE_LOOKBACK_DAYS = 14
BASE_SLOT_FRESHNESS = {
    1: 1, 2: 2, 3: 7, 4: 2, 5: 7,
}

def get_slot_freshness(slot: int) -> int:
    """Get freshness window for a slot, extended on weekends."""
    base_freshness = BASE_SLOT_FRESHNESS.get(slot, 7)
    weekday = datetime.utcnow().weekday()
    is_weekend_run = weekday in (6, 0)
    if is_weekend_run and base_freshness <= 2:
        return 3
    return base_freshness


def debug_prefilter_candidates():
    """Debug: Check what candidates exist in Pre-Filter Log for each slot."""
    print("\n" + "="*80)
    print("DEBUG: Checking Pre-Filter Log candidates for each slot")
    print("="*80)

    airtable = AirtableClient()

    for slot in range(1, 6):
        freshness_days = get_slot_freshness(slot)
        print(f"\n--- Slot {slot} (freshness: {freshness_days} days) ---")

        try:
            candidates = airtable.get_prefilter_candidates(slot, freshness_days)
            print(f"Total candidates: {len(candidates)}")

            if candidates:
                # Show first 3 candidates with details
                for i, c in enumerate(candidates[:3]):
                    fields = c.get('fields', {})
                    story_id = fields.get('storyID', 'MISSING')
                    pivot_id = fields.get('pivotId', 'MISSING')
                    headline = fields.get('headline', 'MISSING')[:60]
                    source = fields.get('source_id', 'MISSING')

                    print(f"  [{i+1}] storyID: {story_id}")
                    print(f"      pivotId: {pivot_id}")
                    print(f"      headline: {headline}...")
                    print(f"      source: {source}")

                if len(candidates) > 3:
                    print(f"  ... and {len(candidates) - 3} more")
            else:
                print("  NO CANDIDATES FOUND")

        except Exception as e:
            print(f"  ERROR: {e}")


def debug_recent_issues():
    """Debug: Check recent issues and what storyIds were already used."""
    print("\n" + "="*80)
    print(f"DEBUG: Checking recent issues ({DUPLICATE_LOOKBACK_DAYS}-day lookback)")
    print("="*80)

    airtable = AirtableClient()

    try:
        recent_issues = airtable.get_recent_sent_issues(DUPLICATE_LOOKBACK_DAYS)
        print(f"\nFound {len(recent_issues)} recent issues")

        all_story_ids = []
        for idx, issue in enumerate(recent_issues[:3]):
            fields = issue.get('fields', {})
            issue_id = fields.get('issue_id', 'Unknown')
            status = fields.get('status', 'Unknown')
            print(f"\n  Issue {idx+1}: {issue_id} (status: {status})")

            for slot in range(1, 6):
                story_id = fields.get(f'slot_{slot}_storyId', '')
                headline = fields.get(f'slot_{slot}_headline', '')[:40] if fields.get(f'slot_{slot}_headline') else ''
                if story_id:
                    all_story_ids.append(story_id)
                    print(f"    Slot {slot}: {story_id} | {headline}...")

        print(f"\n  Total storyIds in lookback: {len(all_story_ids)}")

    except Exception as e:
        print(f"  ERROR: {e}")


def debug_claude_selection():
    """Debug: Run Claude selection for Slot 1 and trace exactly what happens."""
    print("\n" + "="*80)
    print("DEBUG: Running Claude selection for Slot 1 with full tracing")
    print("="*80)

    from utils.claude import ClaudeClient

    airtable = AirtableClient()
    claude = ClaudeClient()

    slot = 1
    freshness_days = get_slot_freshness(slot)

    # Get candidates
    print(f"\n[1] Getting candidates for Slot {slot}...")
    candidates = airtable.get_prefilter_candidates(slot, freshness_days)
    print(f"    Got {len(candidates)} candidates")

    if not candidates:
        print("    ERROR: No candidates available")
        return

    # Build recent_data (simulated)
    print(f"\n[2] Getting recent issues for diversity rules...")
    recent_issues = airtable.get_recent_sent_issues(DUPLICATE_LOOKBACK_DAYS)
    recent_data = {
        "headlines": [],
        "storyIds": [],
        "pivotIds": [],
        "slot1Headline": None
    }
    for issue in recent_issues:
        fields = issue.get('fields', {})
        for i in range(1, 6):
            if fields.get(f'slot_{i}_storyId'):
                recent_data['storyIds'].append(fields.get(f'slot_{i}_storyId'))
            if fields.get(f'slot_{i}_headline'):
                recent_data['headlines'].append(fields.get(f'slot_{i}_headline'))
    print(f"    Found {len(recent_data['storyIds'])} recent storyIds to exclude")

    # Filter out already selected
    print(f"\n[3] Filtering candidates...")
    excluded_ids = set(recent_data.get('storyIds', []))
    available_candidates = [
        c for c in candidates
        if c.get('fields', {}).get('storyID') not in excluded_ids
    ]
    print(f"    {len(available_candidates)} candidates after filtering")

    if not available_candidates:
        print("    ERROR: All candidates already selected")
        return

    # Build source lookup
    print(f"\n[4] Building source lookup...")
    source_lookup = airtable.build_source_lookup()
    print(f"    Loaded {len(source_lookup)} source scores")

    # Initial cumulative state
    cumulative_state = {
        "selectedToday": [],
        "selectedCompanies": [],
        "selectedSources": {}
    }

    # Log what we're sending to Claude
    print(f"\n[5] Calling Claude for Slot {slot} selection...")
    print(f"    Candidates being sent: {len(available_candidates)}")
    print(f"    First 3 candidate storyIDs:")
    for c in available_candidates[:3]:
        story_id = c.get('fields', {}).get('storyID', 'MISSING')
        headline = c.get('fields', {}).get('headline', 'MISSING')[:50]
        print(f"      - {story_id}: {headline}...")

    # Actually call Claude
    try:
        selection = claude.select_slot(
            slot=slot,
            candidates=available_candidates,
            recent_data=recent_data,
            cumulative_state=cumulative_state,
            source_lookup=source_lookup
        )

        print(f"\n[6] Claude returned:")
        print(f"    Raw selection: {json.dumps(selection, indent=2)}")

        if "error" in selection:
            print(f"    ERROR: {selection.get('error')}")
            return

        selected_story_id = selection.get("selected_id", "")
        selected_headline = selection.get("selected_headline", "")

        print(f"\n[7] Checking if selected_id exists in candidates...")
        print(f"    selected_id: {selected_story_id}")

        # Look for the storyID in candidates
        found = False
        for c in available_candidates:
            if c.get('fields', {}).get('storyID') == selected_story_id:
                found = True
                pivot_id = c.get('fields', {}).get('pivotId', '')
                print(f"    FOUND! pivotId: {pivot_id}")
                break

        if not found:
            print(f"    NOT FOUND in candidates!")
            print(f"\n[8] CRITICAL: Claude returned a storyID that doesn't exist in candidates!")
            print(f"    This means Claude is hallucinating or there's a field name mismatch.")
            print(f"\n    All available storyIDs:")
            for c in available_candidates:
                print(f"      - {c.get('fields', {}).get('storyID', 'MISSING')}")

    except Exception as e:
        print(f"    ERROR calling Claude: {e}")
        import traceback
        traceback.print_exc()


def debug_field_names():
    """Debug: Check exact field names in Pre-Filter Log table."""
    print("\n" + "="*80)
    print("DEBUG: Checking Pre-Filter Log field names via Airtable API")
    print("="*80)

    import requests

    api_key = os.getenv('AIRTABLE_API_KEY')
    base_id = os.getenv('AI_EDITOR_BASE_ID', 'appglKSJZxmA9iHpl')
    table_id = os.getenv('AI_EDITOR_PREFILTER_LOG_TABLE', 'tbl72YMsm9iRHj3sp')

    url = f"https://api.airtable.com/v0/{base_id}/{table_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"maxRecords": 1}

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

        if data.get('records'):
            record = data['records'][0]
            fields = record.get('fields', {})
            print("\nField names in Pre-Filter Log:")
            for key in sorted(fields.keys()):
                value = fields[key]
                if isinstance(value, str) and len(value) > 50:
                    value = value[:50] + "..."
                print(f"  - {key}: {value}")
        else:
            print("No records found in Pre-Filter Log")

    except Exception as e:
        print(f"ERROR: {e}")


if __name__ == "__main__":
    print("="*80)
    print("SLOT SELECTION DEBUG SCRIPT")
    print(f"Started at: {datetime.utcnow().isoformat()}")
    print("="*80)

    # Check environment
    print("\nEnvironment check:")
    print(f"  AIRTABLE_API_KEY: {'SET' if os.getenv('AIRTABLE_API_KEY') else 'MISSING'}")
    print(f"  ANTHROPIC_API_KEY: {'SET' if os.getenv('ANTHROPIC_API_KEY') else 'MISSING'}")
    print(f"  AI_EDITOR_BASE_ID: {os.getenv('AI_EDITOR_BASE_ID', 'NOT SET')}")

    # Run debug steps
    debug_field_names()
    debug_prefilter_candidates()
    debug_recent_issues()
    debug_claude_selection()

    print("\n" + "="*80)
    print("DEBUG COMPLETE")
    print("="*80)
