#!/usr/bin/env python3
"""
Root-level worker entry point for Render deployment.

This wrapper script changes to the workers directory and runs the actual worker.
This is needed because Render's Python services run from rootDir which is now the repo root.
"""

import os
import sys

# Change to workers directory so relative imports work correctly
workers_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workers')
os.chdir(workers_dir)

# Add workers directory to Python path
sys.path.insert(0, workers_dir)

# Now run the actual worker
if __name__ == '__main__':
    # Import after path setup
    from worker import run_worker, run_scheduler

    if '--with-scheduler' in sys.argv or '--scheduler' in sys.argv:
        run_scheduler()
    else:
        run_worker()
