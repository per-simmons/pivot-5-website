"""
Execution Logger for AI Editor 2.0 Workers

Logs execution details to the execution_logs table for dashboard display.
Each execution creates a single log record with:
- Summary metrics (articles_extracted, etc.)
- Detailed log entries (timestamp, level, message)
- Status tracking (running, success, error)

Usage:
    logger = ExecutionLogger(step_id=0, job_type='ingest')
    logger.info("Starting ingest job")
    logger.set_summary('articles_extracted', 150)
    await logger.complete('success')
"""

import os
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from utils.db import get_db

# Standard Python logger for stdout (Render captures this)
py_logger = logging.getLogger(__name__)


class ExecutionLogger:
    """
    Execution logger that writes to both stdout and the execution_logs database table.

    The log is persisted to the database when complete() is called.
    """

    def __init__(self, step_id: int, job_type: str, slot_number: Optional[int] = None):
        """
        Initialize a new execution logger.

        Args:
            step_id: Pipeline step (0 = ingest, 1 = pre-filter, etc.)
            job_type: Type of job ('ingest', 'ai_scoring', 'newsletter_links', 'pre_filter')
            slot_number: For pre-filter, which slot (1-5)
        """
        self.run_id = str(uuid.uuid4())
        self.step_id = step_id
        self.job_type = job_type
        self.slot_number = slot_number
        self.entries: List[Dict[str, Any]] = []
        self.summary: Dict[str, Any] = {}
        self.started_at = datetime.utcnow()
        self._db_record_id: Optional[str] = None

        # Create initial database record with 'running' status
        self._create_initial_record()

    def _create_initial_record(self):
        """Create the initial execution_logs record with running status"""
        try:
            db = get_db()
            sql = """
                INSERT INTO execution_logs (
                    step_id, job_type, slot_number, run_id,
                    started_at, status, summary, log_entries
                ) VALUES (%s, %s, %s, %s, %s, 'running', %s, %s)
                RETURNING id
            """
            with db.get_cursor() as cursor:
                cursor.execute(sql, (
                    self.step_id,
                    self.job_type,
                    self.slot_number,
                    self.run_id,
                    self.started_at.isoformat(),
                    json.dumps({}),
                    json.dumps([])
                ))
                row = cursor.fetchone()
                if row:
                    self._db_record_id = str(row['id'])
                    py_logger.info(f"Created execution log record: {self._db_record_id}")
        except Exception as e:
            py_logger.error(f"Failed to create execution log record: {e}")

    def _add_entry(self, level: str, message: str, metadata: Optional[Dict] = None):
        """Add a log entry to the internal list"""
        entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': level,
            'message': message
        }
        if metadata:
            entry['metadata'] = metadata
        self.entries.append(entry)

    def log(self, level: str, message: str, metadata: Optional[Dict] = None):
        """
        Log a message at the specified level.

        Writes to both stdout (for Render logs) and the internal entries list
        (for database persistence).
        """
        self._add_entry(level, message, metadata)

        # Also write to stdout for Render logs
        log_msg = f"[{level.upper()}] {message}"
        if metadata:
            log_msg += f" {json.dumps(metadata)}"

        if level == 'error':
            py_logger.error(log_msg)
        elif level == 'warn':
            py_logger.warning(log_msg)
        elif level == 'debug':
            py_logger.debug(log_msg)
        else:
            py_logger.info(log_msg)

    def info(self, message: str, metadata: Optional[Dict] = None):
        """Log an info message"""
        self.log('info', message, metadata)

    def warn(self, message: str, metadata: Optional[Dict] = None):
        """Log a warning message"""
        self.log('warn', message, metadata)

    def error(self, message: str, metadata: Optional[Dict] = None):
        """Log an error message"""
        self.log('error', message, metadata)

    def debug(self, message: str, metadata: Optional[Dict] = None):
        """Log a debug message"""
        self.log('debug', message, metadata)

    def set_summary(self, key: str, value: Any):
        """
        Set a summary metric.

        Summary is displayed at the top of the log viewer in the dashboard.
        Examples: 'articles_extracted', 'articles_scored', 'errors_count'
        """
        self.summary[key] = value
        py_logger.info(f"Summary: {key} = {value}")

    def increment_summary(self, key: str, amount: int = 1):
        """Increment a summary counter"""
        current = self.summary.get(key, 0)
        self.summary[key] = current + amount

    def complete(self, status: str = 'success', error_message: Optional[str] = None,
                 error_stack: Optional[str] = None):
        """
        Mark the execution as complete and persist to database.

        Args:
            status: 'success' or 'error'
            error_message: Error message if status is 'error'
            error_stack: Stack trace if available
        """
        completed_at = datetime.utcnow()
        duration_ms = int((completed_at - self.started_at).total_seconds() * 1000)

        if not self._db_record_id:
            py_logger.error("No database record to update - complete() called before record created")
            return

        try:
            db = get_db()
            sql = """
                UPDATE execution_logs SET
                    completed_at = %s,
                    duration_ms = %s,
                    status = %s,
                    summary = %s,
                    log_entries = %s,
                    error_message = %s,
                    error_stack = %s
                WHERE id = %s
            """
            with db.get_cursor() as cursor:
                cursor.execute(sql, (
                    completed_at.isoformat(),
                    duration_ms,
                    status,
                    json.dumps(self.summary),
                    json.dumps(self.entries),
                    error_message,
                    error_stack,
                    self._db_record_id
                ))

            py_logger.info(f"Execution complete: status={status}, duration={duration_ms}ms")

        except Exception as e:
            py_logger.error(f"Failed to update execution log: {e}")

    def update_progress(self):
        """
        Update the database record with current progress (useful for long-running jobs).

        This allows the dashboard to show real-time progress without waiting
        for complete() to be called.
        """
        if not self._db_record_id:
            return

        try:
            db = get_db()
            sql = """
                UPDATE execution_logs SET
                    summary = %s,
                    log_entries = %s
                WHERE id = %s
            """
            with db.get_cursor() as cursor:
                cursor.execute(sql, (
                    json.dumps(self.summary),
                    json.dumps(self.entries),
                    self._db_record_id
                ))
        except Exception as e:
            py_logger.warning(f"Failed to update progress: {e}")


def get_recent_logs(step_id: int, job_type: Optional[str] = None,
                    slot_number: Optional[int] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch recent execution logs from the database.

    Args:
        step_id: Pipeline step to filter by
        job_type: Optional job type filter
        slot_number: Optional slot number filter
        limit: Maximum number of records to return

    Returns:
        List of execution log records
    """
    db = get_db()

    conditions = ["step_id = %s"]
    params = [step_id]

    if job_type:
        conditions.append("job_type = %s")
        params.append(job_type)

    if slot_number is not None:
        conditions.append("slot_number = %s")
        params.append(slot_number)

    where_clause = " AND ".join(conditions)
    params.append(limit)

    sql = f"""
        SELECT id, step_id, job_type, slot_number, run_id,
               started_at, completed_at, duration_ms, status,
               summary, log_entries, error_message, created_at
        FROM execution_logs
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT %s
    """

    with db.get_cursor() as cursor:
        cursor.execute(sql, tuple(params))
        return [dict(row) for row in cursor.fetchall()]


def get_last_run(step_id: int, job_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Get the most recent completed execution for a step.

    Used for "Last Run" display in the dashboard.
    """
    db = get_db()

    conditions = ["step_id = %s", "status != 'running'"]
    params = [step_id]

    if job_type:
        conditions.append("job_type = %s")
        params.append(job_type)

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT id, step_id, job_type, slot_number,
               started_at, completed_at, duration_ms, status,
               summary, error_message
        FROM execution_logs
        WHERE {where_clause}
        ORDER BY completed_at DESC NULLS LAST
        LIMIT 1
    """

    with db.get_cursor() as cursor:
        cursor.execute(sql, tuple(params))
        row = cursor.fetchone()
        return dict(row) if row else None
