"""
Step 4b: Mautic Send

Sends the compiled newsletter via Mautic email marketing platform.

Part of n8n workflow: NKjC8hb0EDHIXx3U
"""

import os
import base64
from datetime import datetime
from typing import Dict, Any
import httpx
from ..utils.airtable import AirtableClient


def send_via_mautic(
    issue_id: str,
    html: str,
    subject_line: str,
    job_id: str = None,
) -> Dict[str, Any]:
    """
    Send newsletter via Mautic.

    Args:
        issue_id: Newsletter issue ID
        html: Compiled HTML content
        subject_line: Email subject line
        job_id: Optional job ID for tracking

    Returns:
        Dict with send status and Mautic response
    """
    print(f"[Step 4b] Sending newsletter via Mautic: {issue_id}")

    airtable = AirtableClient()

    results = {
        "job_id": job_id,
        "issue_id": issue_id,
        "started_at": datetime.now().isoformat(),
    }

    mautic_base = os.getenv('MAUTIC_BASE_URL', 'https://app.pivotnews.com')
    mautic_user = os.getenv('MAUTIC_USERNAME')
    mautic_pass = os.getenv('MAUTIC_PASSWORD')

    # Basic auth header
    auth_string = f"{mautic_user}:{mautic_pass}"
    auth_bytes = base64.b64encode(auth_string.encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_bytes}",
        "Content-Type": "application/json",
    }

    try:
        # Step 1: Create email in Mautic
        email_data = {
            "name": f"Pivot 5 - {datetime.now().strftime('%Y-%m-%d')}",
            "subject": subject_line,
            "customHtml": html,
            "emailType": "list",
            "isPublished": True,
            "lists": [1],  # Main subscriber list
        }

        response = httpx.post(
            f"{mautic_base}/api/emails/new",
            json=email_data,
            headers=headers,
            timeout=30.0,
        )
        response.raise_for_status()
        email_response = response.json()

        email_id = email_response.get('email', {}).get('id')
        if not email_id:
            raise ValueError("Failed to create email in Mautic")

        results["mautic_email_id"] = email_id

        # Step 2: Send the email
        send_response = httpx.post(
            f"{mautic_base}/api/emails/{email_id}/send",
            headers=headers,
            timeout=60.0,
        )
        send_response.raise_for_status()
        send_data = send_response.json()

        results.update({
            "status": "sent",
            "mautic_response": send_data,
            "sent_count": send_data.get('sentCount', 0),
            "failed_count": send_data.get('failedCount', 0),
        })

        # Update Airtable archive
        airtable.archive_newsletter_issue(issue_id, {
            "sent_status": "sent",
            "mautic_email_id": email_id,
            "sent_at": datetime.now().isoformat(),
            "recipient_count": send_data.get('sentCount', 0),
        })

    except httpx.HTTPStatusError as e:
        results.update({
            "status": "failed",
            "error": f"HTTP {e.response.status_code}: {e.response.text}",
        })
        airtable.archive_newsletter_issue(issue_id, {
            "sent_status": "failed",
            "error": str(e),
        })

    except Exception as e:
        results.update({
            "status": "error",
            "error": str(e),
        })
        airtable.archive_newsletter_issue(issue_id, {
            "sent_status": "error",
            "error": str(e),
        })

    results["completed_at"] = datetime.now().isoformat()
    print(f"[Step 4b] Mautic send complete: {results.get('status')}")

    return results


def get_mautic_analytics(email_id: int) -> Dict[str, Any]:
    """
    Get analytics for a sent email from Mautic.

    Args:
        email_id: Mautic email ID

    Returns:
        Dict with analytics data (opens, clicks, etc.)
    """
    mautic_base = os.getenv('MAUTIC_BASE_URL', 'https://app.pivotnews.com')
    mautic_user = os.getenv('MAUTIC_USERNAME')
    mautic_pass = os.getenv('MAUTIC_PASSWORD')

    auth_string = f"{mautic_user}:{mautic_pass}"
    auth_bytes = base64.b64encode(auth_string.encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_bytes}",
    }

    response = httpx.get(
        f"{mautic_base}/api/emails/{email_id}",
        headers=headers,
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()

    email = data.get('email', {})

    # Filter out bot opens (security servers)
    # This is a simplified heuristic - real implementation would be more sophisticated
    total_reads = email.get('readCount', 0)
    unique_reads = email.get('uniqueReadCount', 0)
    sent_count = email.get('sentCount', 0)

    # Estimate real opens (filter obvious bots)
    # Bots typically open within milliseconds - real users take longer
    estimated_real_opens = int(unique_reads * 0.7)  # Conservative estimate

    return {
        "email_id": email_id,
        "subject": email.get('subject'),
        "sent_count": sent_count,
        "delivered_count": sent_count - email.get('bounceCount', 0),
        "total_opens": total_reads,
        "unique_opens": unique_reads,
        "estimated_real_opens": estimated_real_opens,
        "open_rate": round((estimated_real_opens / sent_count * 100), 2) if sent_count > 0 else 0,
        "click_count": email.get('clickCount', 0),
        "unique_clicks": email.get('uniqueClickCount', 0),
        "click_rate": round((email.get('uniqueClickCount', 0) / sent_count * 100), 2) if sent_count > 0 else 0,
        "unsubscribe_count": email.get('unsubscribeCount', 0),
        "bounce_count": email.get('bounceCount', 0),
    }
