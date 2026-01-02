"""
Step 4b: Mautic Send Job
Workflow ID: NKjC8hb0EDHIXx3U (same as html_compile)
Schedule: 5 AM EST (0 10 * * 1-5 UTC) - Mon-Fri

Sends compiled newsletter via Mautic and archives the issue.
Migrated from n8n 1/2/26 to match workflow exactly.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Any

import pytz

from utils.airtable import AirtableClient
from utils.mautic import MauticClient

logger = logging.getLogger(__name__)

# Timezone for timestamps
ET_TIMEZONE = pytz.timezone('America/New_York')


def send_via_mautic() -> dict:
    """
    Step 4b: Mautic Send - Main entry point

    Matches n8n workflow nodes:
    - List6: Query Newsletter Issues Final (status='next-send')
    - Strip HTML for Deliverability: Already done in compile step
    - Create Email: POST to Mautic /api/emails/new
    - Attach Transport: POST to Mautic transport endpoint (ID: 3)
    - SEND: POST to Mautic send endpoint
    - Update Newsletter Issues Archive: UPSERT with send metrics
    - Delete a record3: Remove from Newsletter Issues Final

    Returns:
        {
            "sent": bool,
            "issue_id": str,
            "mautic_email_id": int,
            "sent_count": int,
            "failed_recipients": int,
            "mautic_send_status": str,
            "archived": bool,
            "deleted": bool,
            "errors": list
        }
    """
    logger.info(f"[Step 4b] Starting Mautic send at {datetime.now(ET_TIMEZONE).isoformat()}")

    # Initialize clients
    airtable = AirtableClient()

    # Track results
    results = {
        "sent": False,
        "issue_id": "",
        "mautic_email_id": None,
        "sent_count": 0,
        "failed_recipients": 0,
        "mautic_send_status": "",
        "archived": False,
        "deleted": False,
        "errors": []
    }

    try:
        mautic = MauticClient()
    except ValueError as e:
        error_msg = f"Mautic client initialization failed: {e}"
        logger.error(f"[Step 4b] {error_msg}")
        results["errors"].append({"step": "init", "error": str(e)})
        return results

    try:
        # =====================================================================
        # Step 1: Fetch newsletter issue (status='next-send')
        # Matches n8n node: List6
        # =====================================================================
        logger.info("[Step 4b] Fetching newsletter issue (status='next-send')...")

        issue = airtable.get_newsletter_issue_for_send()

        if not issue:
            error_msg = "No newsletter issue with status='next-send' found"
            logger.warning(f"[Step 4b] {error_msg}")
            results["errors"].append({"step": "fetch_issue", "warning": error_msg})
            return results

        record_id = issue.get('id', '')
        fields = issue.get('fields', {})

        issue_id = fields.get('issue_id', '')
        subject_line = fields.get('subject_line', '5 headlines. 5 minutes. 5 days a week.')
        plain_html = fields.get('plain_html', '') or fields.get('html', '')
        full_html = fields.get('html', '')
        summary = fields.get('summary', '')

        results["issue_id"] = issue_id
        logger.info(f"[Step 4b] Processing issue: {issue_id}")

        if not plain_html:
            error_msg = "No HTML content found in newsletter issue"
            logger.error(f"[Step 4b] {error_msg}")
            results["errors"].append({"step": "fetch_issue", "error": error_msg})
            return results

        # =====================================================================
        # Step 2: Create email in Mautic
        # Matches n8n node: Create Email
        # =====================================================================
        logger.info("[Step 4b] Creating email in Mautic...")

        try:
            email = mautic.create_email(
                name=issue_id,
                subject=subject_line,
                html=plain_html  # Use stripped HTML for deliverability
            )

            mautic_email_id = email.get('id')
            if not mautic_email_id:
                raise Exception("Mautic did not return email ID")

            results["mautic_email_id"] = mautic_email_id
            logger.info(f"[Step 4b] Created Mautic email: {mautic_email_id}")

        except Exception as e:
            error_msg = f"Failed to create email in Mautic: {e}"
            logger.error(f"[Step 4b] {error_msg}")
            results["errors"].append({"step": "create_email", "error": str(e)})
            return results

        # =====================================================================
        # Step 3: Attach transport (ID: 3)
        # Matches n8n node: Attach Transport
        # =====================================================================
        logger.info("[Step 4b] Attaching GreenArrow transport...")

        try:
            mautic.attach_transport(mautic_email_id)
            logger.info("[Step 4b] Transport attached successfully")
        except Exception as e:
            # Log warning but continue - transport may already be default
            logger.warning(f"[Step 4b] Transport attachment warning: {e}")
            results["errors"].append({"step": "attach_transport", "warning": str(e)})

        # =====================================================================
        # Step 4: Send email
        # Matches n8n node: SEND
        # =====================================================================
        logger.info("[Step 4b] Sending email...")

        try:
            send_response = mautic.send_email(mautic_email_id)

            results["sent_count"] = send_response.get("sentCount", 0)
            results["failed_recipients"] = send_response.get("failedRecipients", 0)

            # Determine status
            if results["sent_count"] > 0 and results["failed_recipients"] == 0:
                results["mautic_send_status"] = "success"
                results["sent"] = True
            elif results["sent_count"] > 0 and results["failed_recipients"] > 0:
                results["mautic_send_status"] = "partial_failure"
                results["sent"] = True
            else:
                results["mautic_send_status"] = "failed"

            logger.info(f"[Step 4b] Send complete - sent: {results['sent_count']}, failed: {results['failed_recipients']}")

        except Exception as e:
            error_msg = f"Failed to send email: {e}"
            logger.error(f"[Step 4b] {error_msg}")
            results["errors"].append({"step": "send", "error": str(e)})
            results["mautic_send_status"] = "failed"
            # Continue to archive with failure status

        # =====================================================================
        # Step 5: Archive with send metrics
        # Matches n8n node: Update Newsletter Issues Archive
        # =====================================================================
        logger.info("[Step 4b] Archiving newsletter issue...")

        now_et = datetime.now(ET_TIMEZONE)

        try:
            archive_data = {
                "issue_id": issue_id,
                "newsletter_id": "pivot_ai",
                "send_date": now_et.strftime('%Y-%m-%d'),
                "sent_at": now_et.isoformat(),
                "subject_line": subject_line,
                "status": "sent" if results["sent"] else "failed",
                "html": full_html,
                "summary": summary,
                "mautic_sent_count": results["sent_count"],
                "mautic_failed_recipients": results["failed_recipients"],
                "mautic_send_status": results["mautic_send_status"],
                "mautic_response_raw": json.dumps(send_response if results["sent"] else {"error": results["errors"]})
            }

            airtable.archive_newsletter_issue_ai_editor(archive_data)
            results["archived"] = True
            logger.info(f"[Step 4b] Issue archived successfully")

        except Exception as e:
            error_msg = f"Failed to archive issue: {e}"
            logger.error(f"[Step 4b] {error_msg}")
            results["errors"].append({"step": "archive", "error": str(e)})

        # =====================================================================
        # Step 6: Delete from Newsletter Issues Final
        # Matches n8n node: Delete a record3
        # Only delete if send was successful
        # =====================================================================
        if results["sent"]:
            logger.info("[Step 4b] Deleting from Newsletter Issues Final...")

            try:
                deleted = airtable.delete_newsletter_issue_final(record_id)
                results["deleted"] = deleted
                logger.info(f"[Step 4b] Deleted from Newsletter Issues Final: {deleted}")
            except Exception as e:
                error_msg = f"Failed to delete from Newsletter Issues Final: {e}"
                logger.error(f"[Step 4b] {error_msg}")
                results["errors"].append({"step": "delete", "error": str(e)})
        else:
            logger.info("[Step 4b] Skipping delete - send was not successful")

        # =====================================================================
        # Complete!
        # =====================================================================
        logger.info(f"[Step 4b] Mautic send complete for {issue_id}")
        logger.info(f"[Step 4b] Results: {results}")

        return results

    except Exception as e:
        logger.error(f"[Step 4b] Fatal error: {e}", exc_info=True)
        results["errors"].append({"fatal": str(e)})
        raise


def test_mautic_connection() -> Dict[str, Any]:
    """
    Test Mautic API connection and authentication.

    Returns:
        {
            "connected": bool,
            "auth_method": str,
            "segments": list,
            "error": str (if failed)
        }
    """
    result = {
        "connected": False,
        "auth_method": "",
        "segments": [],
        "error": None
    }

    try:
        mautic = MauticClient()
        result["auth_method"] = "OAuth2" if mautic.use_oauth else "Basic Auth"

        # Try to list segments to verify connection
        segments = mautic.list_segments()
        result["segments"] = [
            {"id": s.get("id"), "name": s.get("name")}
            for s in segments[:5]  # First 5 segments
        ]
        result["connected"] = True

        logger.info(f"[Step 4b] Mautic connection test successful")

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"[Step 4b] Mautic connection test failed: {e}")

    return result


def get_send_stats(issue_id: str) -> Dict[str, Any]:
    """
    Get send statistics for a sent newsletter.

    Args:
        issue_id: Issue ID (e.g., "Pivot 5 - Jan 02")

    Returns:
        Statistics from Mautic
    """
    airtable = AirtableClient()

    try:
        # Look up archived issue to get mautic email ID
        # This would need a lookup method in airtable.py

        return {
            "issue_id": issue_id,
            "stats": "Not yet implemented"
        }

    except Exception as e:
        return {"error": str(e)}


# Job configuration for RQ scheduler
JOB_CONFIG = {
    "func": send_via_mautic,
    "trigger": "cron",
    "hour": 10,  # 10 AM UTC = 5 AM EST
    "minute": 0,
    "day_of_week": "mon-fri",  # Mon-Fri (matching n8n)
    "id": "step4b_mautic_send",
    "replace_existing": True
}
