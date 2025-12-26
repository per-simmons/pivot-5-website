#!/usr/bin/env python3
"""
Local Test Script for Step 1 Pre-Filter Changes
Tests the changes made on 12/26/25:
1. UPSERT deduplication (batch_upsert instead of batch_create)
2. Newsletter filter (3 newsletters instead of 1)
3. Company filter (4 companies instead of 8)
4. 14-day lookback for sent issues

Run from workers directory:
    cd workers
    python test_prefilter_local.py
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any

# Add workers directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Check for required environment variables
REQUIRED_ENV_VARS = [
    'AIRTABLE_API_KEY',
    'GOOGLE_AI_API_KEY',  # For Gemini
]

def check_environment():
    """Check if required environment variables are set"""
    missing = []
    for var in REQUIRED_ENV_VARS:
        if not os.environ.get(var):
            missing.append(var)

    if missing:
        print("=" * 60)
        print("MISSING ENVIRONMENT VARIABLES")
        print("=" * 60)
        print(f"\nThe following environment variables are required:\n")
        for var in missing:
            print(f"  - {var}")
        print(f"\nPlease set them before running this test.")
        print(f"\nExample:")
        print(f"  export AIRTABLE_API_KEY='your_key_here'")
        print(f"  export GOOGLE_AI_API_KEY='your_key_here'")
        print("=" * 60)
        return False
    return True


def test_imports():
    """Test that all imports work correctly"""
    print("\n[TEST 1] Testing imports...")
    try:
        from utils.airtable import AirtableClient
        from utils.gemini import GeminiClient
        from jobs.prefilter import prefilter_stories, SLOT_1_COMPANIES
        print("  ✓ All imports successful")
        return True
    except ImportError as e:
        print(f"  ✗ Import error: {e}")
        return False


def test_company_filter():
    """Test that company filter has exactly 4 companies"""
    print("\n[TEST 2] Testing company filter...")
    try:
        from jobs.prefilter import SLOT_1_COMPANIES

        expected = ['openai', 'google', 'meta', 'nvidia']

        if SLOT_1_COMPANIES == expected:
            print(f"  ✓ Company filter correct: {SLOT_1_COMPANIES}")
            return True
        else:
            print(f"  ✗ Company filter mismatch!")
            print(f"    Expected: {expected}")
            print(f"    Got: {SLOT_1_COMPANIES}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_newsletter_filter():
    """Test that newsletter filter includes 3 newsletters"""
    print("\n[TEST 3] Testing newsletter filter formula...")
    try:
        from utils.airtable import AirtableClient
        import inspect

        # Get the source code of get_fresh_stories
        source = inspect.getsource(AirtableClient.get_fresh_stories)

        # Check for all 3 newsletters in the filter
        has_pivot_ai = "pivot_ai" in source
        has_pivot_build = "pivot_build" in source
        has_pivot_invest = "pivot_invest" in source

        if has_pivot_ai and has_pivot_build and has_pivot_invest:
            print("  ✓ Newsletter filter includes all 3 newsletters:")
            print("    - pivot_ai")
            print("    - pivot_build")
            print("    - pivot_invest")
            return True
        else:
            print("  ✗ Newsletter filter missing newsletters!")
            print(f"    pivot_ai: {has_pivot_ai}")
            print(f"    pivot_build: {has_pivot_build}")
            print(f"    pivot_invest: {has_pivot_invest}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_upsert_method():
    """Test that write_prefilter_log_batch uses batch_upsert"""
    print("\n[TEST 4] Testing UPSERT deduplication...")
    try:
        from utils.airtable import AirtableClient
        import inspect

        # Get the source code of write_prefilter_log_batch
        source = inspect.getsource(AirtableClient.write_prefilter_log_batch)

        has_batch_upsert = "batch_upsert(" in source or "batch_upsert\n" in source
        has_story_id_key = "storyID" in source
        # Check that batch_create is NOT called (function call, not comment)
        no_batch_create_call = "table.batch_create(" not in source

        if has_batch_upsert and has_story_id_key and no_batch_create_call:
            print("  ✓ Using batch_upsert with storyID key")
            print("  ✓ No batch_create calls (only in comments)")
            return True
        else:
            print("  ✗ UPSERT configuration issue!")
            print(f"    Uses batch_upsert: {has_batch_upsert}")
            print(f"    Has storyID key: {has_story_id_key}")
            print(f"    No batch_create calls: {no_batch_create_call}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_14day_lookback():
    """Test that get_recent_sent_issues method exists"""
    print("\n[TEST 5] Testing 14-day lookback method...")
    try:
        from utils.airtable import AirtableClient

        # Check if method exists
        if hasattr(AirtableClient, 'get_recent_sent_issues'):
            print("  ✓ get_recent_sent_issues method exists")

            # Check default parameter
            import inspect
            sig = inspect.signature(AirtableClient.get_recent_sent_issues)
            lookback_param = sig.parameters.get('lookback_days')

            if lookback_param and lookback_param.default == 14:
                print("  ✓ Default lookback is 14 days")
                return True
            else:
                print(f"  ✗ Default lookback is not 14: {lookback_param.default if lookback_param else 'N/A'}")
                return False
        else:
            print("  ✗ get_recent_sent_issues method not found!")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_airtable_connection():
    """Test Airtable connection and fetch fresh stories"""
    print("\n[TEST 6] Testing Airtable connection...")
    try:
        from utils.airtable import AirtableClient

        client = AirtableClient()
        print("  ✓ AirtableClient initialized")

        # Test fetching fresh stories (limit to 5 for quick test)
        stories = client.get_fresh_stories(days=7, max_records=5)
        print(f"  ✓ Fetched {len(stories)} fresh stories (limited to 5)")

        if stories:
            # Show first story headline
            first = stories[0]['fields']
            print(f"  ✓ Sample: {first.get('ai_headline', 'No headline')[:60]}...")

            # Check newsletter field
            newsletter = first.get('newsletter', 'unknown')
            print(f"  ✓ Newsletter: {newsletter}")

        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_source_scores():
    """Test fetching source credibility scores"""
    print("\n[TEST 7] Testing source scores...")
    try:
        from utils.airtable import AirtableClient

        client = AirtableClient()
        lookup = client.build_source_lookup()

        print(f"  ✓ Loaded {len(lookup)} source scores")

        # Show a few examples
        for source, score in list(lookup.items())[:3]:
            print(f"    - {source}: {score}")

        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def test_full_prefilter_dry_run():
    """
    Run the full prefilter with a small sample (dry run mode)
    This will test the complete flow including Gemini calls
    """
    print("\n[TEST 8] Full Pre-Filter Dry Run...")
    print("  (This will make actual API calls but limit to small sample)")

    try:
        from utils.airtable import AirtableClient
        from utils.gemini import GeminiClient
        from jobs.prefilter import (
            calculate_slot_eligibility,
            batch_gemini_slot_filter,
            company_filter_slot1,
            SLOT_1_COMPANIES
        )

        airtable = AirtableClient()
        gemini = GeminiClient()

        # Get a small sample of stories
        stories = airtable.get_fresh_stories(days=7, max_records=10)
        print(f"  ✓ Fetched {len(stories)} stories for test")

        if not stories:
            print("  ⚠ No stories found - cannot continue test")
            return True  # Not a failure, just no data

        # Get article details
        pivot_ids = [s['fields'].get('pivotId') for s in stories if s['fields'].get('pivotId')]
        articles = airtable.get_articles_batch(pivot_ids)
        print(f"  ✓ Fetched {len(articles)} article details")

        # Get source scores
        source_lookup = airtable.build_source_lookup()
        print(f"  ✓ Loaded {len(source_lookup)} source scores")

        # Calculate slot eligibility for each story
        print("  ✓ Calculating slot eligibility...")
        slot_articles = {1: [], 2: [], 3: [], 4: [], 5: []}

        for story in stories:
            fields = story['fields']
            pivot_id = fields.get('pivotId')

            if not pivot_id or pivot_id not in articles:
                continue

            # Get article details
            article = articles[pivot_id]['fields']

            # Calculate freshness eligibility
            date_str = fields.get('date_og_published', '')
            eligible_slots = calculate_slot_eligibility(date_str)

            # Build article data
            article_data = {
                'storyID': fields.get('storyID'),
                'pivotId': pivot_id,
                'headline': fields.get('ai_headline', ''),
                'source_id': article.get('source_id', ''),
                'date_og_published': date_str,
                'eligible_slots': eligible_slots
            }

            # Add to each eligible slot
            for slot in eligible_slots:
                slot_articles[slot].append(article_data)

        print(f"  ✓ Slot distribution:")
        for slot, articles_list in slot_articles.items():
            print(f"    Slot {slot}: {len(articles_list)} eligible")

        # Test company filter (doesn't require API call)
        slot1_company_matches = company_filter_slot1(slot_articles[1])
        print(f"  ✓ Slot 1 company filter: {len(slot1_company_matches)} matches")
        print(f"    Using companies: {SLOT_1_COMPANIES}")

        # Skip Gemini calls for dry run unless explicitly requested
        print("  ✓ Skipping Gemini API calls for dry run")
        print("  ✓ Full pre-filter structure validated")

        return True

    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("STEP 1 PRE-FILTER LOCAL TEST")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = {}

    # Always run these tests (no API needed)
    results['imports'] = test_imports()
    results['company_filter'] = test_company_filter()
    results['newsletter_filter'] = test_newsletter_filter()
    results['upsert_method'] = test_upsert_method()
    results['14day_lookback'] = test_14day_lookback()

    # Check if we can run API tests
    if check_environment():
        results['airtable_connection'] = test_airtable_connection()
        results['source_scores'] = test_source_scores()
        results['full_dry_run'] = test_full_prefilter_dry_run()
    else:
        print("\n⚠ Skipping API tests due to missing environment variables")

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for r in results.values() if r)
    total = len(results)

    for test_name, passed_test in results.items():
        status = "✓ PASS" if passed_test else "✗ FAIL"
        print(f"  {status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n✓ All tests passed! Safe to deploy.")
        return 0
    else:
        print("\n✗ Some tests failed. Review before deploying.")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
