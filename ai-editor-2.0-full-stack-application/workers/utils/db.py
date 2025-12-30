"""
PostgreSQL Database Client for AI Editor 2.0 Workers
Loads system prompts and configuration from the database
"""

import os
import logging
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class DatabaseClient:
    """PostgreSQL database client for AI Editor 2.0 workers"""

    def __init__(self):
        self.database_url = os.environ.get('DATABASE_URL')
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")

        # Connection pool settings
        self._connection = None

    def _get_connection(self):
        """Get or create database connection"""
        if self._connection is None or self._connection.closed:
            self._connection = psycopg2.connect(
                self.database_url,
                cursor_factory=RealDictCursor,
                sslmode='require' if os.environ.get('NODE_ENV') == 'production' else 'prefer'
            )
        return self._connection

    @contextmanager
    def get_cursor(self):
        """Context manager for database cursor"""
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            cursor.close()

    def close(self):
        """Close database connection"""
        if self._connection and not self._connection.closed:
            self._connection.close()

    # =========================================================================
    # PROMPT QUERIES
    # =========================================================================

    def get_prompt_by_key(self, prompt_key: str) -> Optional[Dict[str, Any]]:
        """
        Get a prompt by its key with current content

        Returns:
            {
                id, prompt_key, step_id, name, description,
                model, temperature, slot_number, is_active,
                content, current_version, last_modified_by
            }
        """
        sql = """
            SELECT
                sp.id,
                sp.prompt_key,
                sp.step_id,
                sp.name,
                sp.description,
                sp.model,
                sp.temperature,
                sp.slot_number,
                sp.is_active,
                sp.created_at,
                sp.updated_at,
                spv.content,
                spv.version as current_version,
                spv.created_by_email as last_modified_by
            FROM system_prompts sp
            LEFT JOIN system_prompt_versions spv ON sp.id = spv.prompt_id AND spv.is_current = true
            WHERE sp.prompt_key = %s AND sp.is_active = true
        """
        with self.get_cursor() as cursor:
            cursor.execute(sql, (prompt_key,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_prompts_by_step(self, step_id: int) -> List[Dict[str, Any]]:
        """Get all prompts for a specific step"""
        sql = """
            SELECT
                sp.id,
                sp.prompt_key,
                sp.step_id,
                sp.name,
                sp.description,
                sp.model,
                sp.temperature,
                sp.slot_number,
                sp.is_active,
                spv.content,
                spv.version as current_version,
                spv.created_by_email as last_modified_by
            FROM system_prompts sp
            LEFT JOIN system_prompt_versions spv ON sp.id = spv.prompt_id AND spv.is_current = true
            WHERE sp.step_id = %s AND sp.is_active = true
            ORDER BY sp.slot_number NULLS LAST, sp.name
        """
        with self.get_cursor() as cursor:
            cursor.execute(sql, (step_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_all_prompts(self) -> List[Dict[str, Any]]:
        """Get all active prompts across all steps"""
        sql = """
            SELECT
                sp.id,
                sp.prompt_key,
                sp.step_id,
                sp.name,
                sp.model,
                sp.temperature,
                sp.slot_number,
                spv.content
            FROM system_prompts sp
            LEFT JOIN system_prompt_versions spv ON sp.id = spv.prompt_id AND spv.is_current = true
            WHERE sp.is_active = true
            ORDER BY sp.step_id, sp.slot_number NULLS LAST
        """
        with self.get_cursor() as cursor:
            cursor.execute(sql)
            return [dict(row) for row in cursor.fetchall()]

    # =========================================================================
    # JOB TRACKING
    # =========================================================================

    def create_job(self, job_type: str, step_id: int, payload: Dict = None) -> str:
        """Create a job record and return the job ID"""
        sql = """
            INSERT INTO jobs (job_type, step_id, status, payload)
            VALUES (%s, %s, 'pending', %s)
            RETURNING id
        """
        import json
        with self.get_cursor() as cursor:
            cursor.execute(sql, (job_type, step_id, json.dumps(payload or {})))
            row = cursor.fetchone()
            return str(row['id'])

    def update_job_status(self, job_id: str, status: str, result: Dict = None, error: str = None):
        """Update job status"""
        sql = """
            UPDATE jobs
            SET status = %s, result = %s, error_message = %s, updated_at = NOW()
            WHERE id = %s
        """
        import json
        with self.get_cursor() as cursor:
            cursor.execute(sql, (status, json.dumps(result) if result else None, error, job_id))

    # =========================================================================
    # AUDIT LOGGING
    # =========================================================================

    def log_audit(self, action: str, entity_type: str, entity_id: str = None,
                  details: Dict = None, user_email: str = None):
        """Log an audit event"""
        sql = """
            INSERT INTO audit_log (action, entity_type, entity_id, details, user_email)
            VALUES (%s, %s, %s, %s, %s)
        """
        import json
        with self.get_cursor() as cursor:
            cursor.execute(sql, (action, entity_type, entity_id,
                                 json.dumps(details) if details else None, user_email))


# Singleton instance
_db_client: Optional[DatabaseClient] = None


def get_db() -> DatabaseClient:
    """Get or create the database client singleton"""
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client
