#!/usr/bin/env python3
"""
Direct test runner for Step 1 Pre-Filter
Runs the actual prefilter job to test all changes end-to-end
"""

import os
import sys
from datetime import datetime

# Add workers directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    print("=" * 60)
    print("STEP 1 PRE-FILTER - FULL EXECUTION TEST")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Import and run the actual prefilter job
    from jobs.prefilter import prefilter_stories

    print("\nRunning prefilter_stories()...\n")

    try:
        result = prefilter_stories()

        print("\n" + "=" * 60)
        print("EXECUTION COMPLETE")
        print("=" * 60)
        print(f"\nResult: {result}")

        if result.get('errors'):
            print(f"\n⚠ Errors encountered: {result['errors']}")
            return 1
        else:
            print("\n✓ Pre-filter completed successfully!")
            return 0

    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
