"""
Step 4c: Gmail Manual Send Job
Schedule: Manual trigger only (not automated)

Sends test newsletter via Gmail to verification recipients.
Created 1/2/26 for Step 4 migration.
"""

import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

import pytz

from utils.airtable import AirtableClient
from utils.gmail import GmailClient

logger = logging.getLogger(__name__)

# Timezone for timestamps
ET_TIMEZONE = pytz.timezone('America/New_York')


def send_via_gmail(
    recipients: Optional[List[str]] = None,
    issue_id: Optional[str] = None
) -> dict:
    """
    Step 4c: Gmail Manual Send - Main entry point

    Sends test newsletter via Gmail for deliverability verification.
    Uses plain_html (stripped) content for testing actual delivery.

    Args:
        recipients: Optional list of email addresses (defaults to GmailClient.DEFAULT_RECIPIENTS)
        issue_id: Optional specific issue ID to send

    Returns:
        {
            "sent": bool,
            "issue_id": str,
            "subject_line": str,
            "recipients": list,
            "message_id": str,
            "thread_id": str,
            "errors": list
        }
    """
    logger.info(f"[Step 4c] Starting Gmail manual send at {datetime.now(ET_TIMEZONE).isoformat()}")

    # Initialize clients
    airtable = AirtableClient()

    # Track results
    results = {
        "sent": False,
        "issue_id": "",
        "subject_line": "",
        "recipients": [],
        "message_id": None,
        "thread_id": None,
        "errors": []
    }

    try:
        gmail = GmailClient()
    except (ImportError, ValueError) as e:
        error_msg = f"Gmail client initialization failed: {e}"
        logger.error(f"[Step 4c] {error_msg}")
        results["errors"].append({"step": "init", "error": str(e)})
        return results

    try:
        # =====================================================================
        # Step 1: Fetch newsletter issue (status='next-send')
        # =====================================================================
        logger.info("[Step 4c] Fetching newsletter issue for manual send...")

        issue = airtable.get_newsletter_issue_for_send()

        if not issue:
            error_msg = "No newsletter issue with status='next-send' found"
            logger.warning(f"[Step 4c] {error_msg}")
            results["errors"].append({"step": "fetch_issue", "warning": error_msg})
            return results

        fields = issue.get('fields', {})

        found_issue_id = fields.get('issue_id', '')
        subject_line = fields.get('subject_line', '5 headlines. 5 minutes. 5 days a week.')
        plain_html = fields.get('plain_html', '') or fields.get('html', '')

        # If specific issue_id requested, verify match
        if issue_id and found_issue_id != issue_id:
            error_msg = f"Found issue '{found_issue_id}' does not match requested '{issue_id}'"
            logger.warning(f"[Step 4c] {error_msg}")
            results["errors"].append({"step": "fetch_issue", "warning": error_msg})

        results["issue_id"] = found_issue_id
        results["subject_line"] = subject_line
        logger.info(f"[Step 4c] Processing issue: {found_issue_id}")

        if not plain_html:
            error_msg = "No HTML content found in newsletter issue"
            logger.error(f"[Step 4c] {error_msg}")
            results["errors"].append({"step": "fetch_issue", "error": error_msg})
            return results

        # =====================================================================
        # Step 2: Send via Gmail
        # =====================================================================
        logger.info("[Step 4c] Sending test email via Gmail...")

        send_result = gmail.send_email(
            to=recipients,  # Uses DEFAULT_RECIPIENTS if None
            subject=subject_line,
            html_body=plain_html
        )

        results["recipients"] = send_result.get("recipients", [])
        results["message_id"] = send_result.get("message_id")
        results["thread_id"] = send_result.get("thread_id")

        if send_result.get("success"):
            results["sent"] = True
            logger.info(f"[Step 4c] Email sent successfully to {len(results['recipients'])} recipients")
        else:
            error_msg = send_result.get("error", "Unknown error")
            logger.error(f"[Step 4c] Gmail send failed: {error_msg}")
            results["errors"].append({"step": "send", "error": error_msg})

        # =====================================================================
        # Complete!
        # =====================================================================
        logger.info(f"[Step 4c] Gmail manual send complete for {found_issue_id}")
        logger.info(f"[Step 4c] Results: {results}")

        return results

    except Exception as e:
        logger.error(f"[Step 4c] Fatal error: {e}", exc_info=True)
        results["errors"].append({"fatal": str(e)})
        raise


def verify_gmail_credentials() -> Dict[str, Any]:
    """
    Verify Gmail API credentials are working.

    Returns:
        {
            "valid": bool,
            "email": str,
            "error": str (if invalid)
        }
    """
    try:
        gmail = GmailClient()
        return gmail.verify_credentials()
    except Exception as e:
        return {
            "valid": False,
            "email": None,
            "error": str(e)
        }


def send_test_to_single_recipient(email: str) -> Dict[str, Any]:
    """
    Send test email to a single recipient.

    Convenience method for testing deliverability to specific address.

    Args:
        email: Single email address to send to

    Returns:
        Same as send_via_gmail()
    """
    logger.info(f"[Step 4c] Sending test to single recipient: {email}")
    return send_via_gmail(recipients=[email])


# No JOB_CONFIG - this is a manual trigger only
