#!/usr/bin/env python3
"""
Verify Pre-Filter Log records in Airtable
"""
import os
import sys
from datetime import datetime

# Add workers directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment from parent .env.local
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env.local')
load_dotenv(env_path)

def main():
    from utils.airtable import AirtableClient

    print("=" * 60)
    print("AIRTABLE VERIFICATION")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    client = AirtableClient()

    # Get recent pre-filter records
    table = client._get_table(client.ai_editor_base_id, client.prefilter_log_table_id)

    # Get most recent records
    records = table.all(
        sort=['-date_prefiltered'],
        max_records=20
    )

    print(f"\nFound {len(records)} records from today")
    print("-" * 60)

    # Count by slot
    slot_counts = {}
    for r in records:
        slot = r['fields'].get('slot', 'unknown')
        slot_counts[slot] = slot_counts.get(slot, 0) + 1

    print(f"\nSlot distribution: {slot_counts}")

    # Show first 5 records
    print(f"\nSample records:")
    for i, r in enumerate(records[:5]):
        fields = r['fields']
        print(f"\n  [{i+1}] {fields.get('headline', 'No headline')[:60]}...")
        print(f"      Story ID: {fields.get('storyID')}")
        print(f"      Slot: {fields.get('slot')}")
        print(f"      Source: {fields.get('source_id')}")
        print(f"      Date: {fields.get('date_prefiltered')}")

    print("\n" + "=" * 60)
    print("✓ Verification complete")
    print("=" * 60)

if __name__ == "__main__":
    main()
