"""
AI Editor 2.0 - RQ Worker Entry Point

This is the main worker process that processes background jobs from Redis Queue.
Run with: python worker.py
"""

import os
import sys
from redis import Redis
from rq import Worker, Queue
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the workers directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Redis connection
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

def get_redis_connection():
    """Create Redis connection from URL."""
    return Redis.from_url(REDIS_URL)

def main():
    """Start the RQ worker."""
    redis_conn = get_redis_connection()

    # Define queues to listen to (in priority order)
    queues = [
        Queue('high', connection=redis_conn),
        Queue('default', connection=redis_conn),
        Queue('low', connection=redis_conn),
    ]

    print(f"Starting AI Editor worker...")
    print(f"Connected to Redis: {REDIS_URL}")
    print(f"Listening on queues: {[q.name for q in queues]}")

    # Start the worker
    worker = Worker(queues, connection=redis_conn)
    worker.work(with_scheduler=True)

if __name__ == '__main__':
    main()
