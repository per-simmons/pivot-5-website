"""
Mautic API Client for AI Editor 2.0 Workers

Handles email campaign creation and sending via Mautic.
Updated 1/2/26 to match n8n workflow exactly.
"""

import os
import json
import logging
import requests
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class MauticClient:
    """
    Mautic API wrapper for AI Editor 2.0.

    Supports both OAuth2 (preferred) and Basic Auth authentication.
    Matches n8n workflow configuration exactly.
    """

    # Default configuration from n8n workflow
    DEFAULT_FROM_ADDRESS = "pivotnews@daily.pivotnews.com"
    DEFAULT_FROM_NAME = "Daily AI Briefing"
    DEFAULT_REPLY_TO = "pivotnews@daily.pivotnews.com"
    DEFAULT_LISTS = [5, 14]  # Mautic segment IDs
    DEFAULT_TRANSPORT_ID = 3  # GreenArrow transport
    DEFAULT_TEMPLATE = "mautic_code_mode"
    GREENARROW_MAIL_CLASS = "daily.pivotnews.com"

    def __init__(self):
        self.base_url = os.environ.get('MAUTIC_BASE_URL', 'https://app.pivotnews.com')
        self.api_base = f"{self.base_url}/api"

        # OAuth2 credentials (preferred)
        self.client_id = os.environ.get('MAUTIC_CLIENT_ID')
        self.client_secret = os.environ.get('MAUTIC_CLIENT_SECRET')
        self.oauth_token = None
        self.refresh_token = os.environ.get('MAUTIC_REFRESH_TOKEN')

        # Basic auth fallback
        self.username = os.environ.get('MAUTIC_USERNAME')
        self.password = os.environ.get('MAUTIC_PASSWORD')

        # Determine auth method
        self.use_oauth = bool(self.client_id and self.client_secret)

        if not self.use_oauth and not (self.username and self.password):
            raise ValueError(
                "Mautic credentials required. Set either MAUTIC_CLIENT_ID/SECRET "
                "for OAuth2 or MAUTIC_USERNAME/PASSWORD for Basic Auth"
            )

        logger.info(f"[Mautic] Initialized with {'OAuth2' if self.use_oauth else 'Basic Auth'} authentication")

    def _get_auth_header(self) -> str:
        """Get authorization header for API requests."""
        if self.use_oauth:
            if not self.oauth_token:
                self._refresh_oauth_token()
            return f"Bearer {self.oauth_token}"
        else:
            import base64
            credentials = f"{self.username}:{self.password}"
            b64_credentials = base64.b64encode(credentials.encode()).decode()
            return f"Basic {b64_credentials}"

    def _refresh_oauth_token(self) -> None:
        """Refresh OAuth2 access token."""
        if not self.refresh_token:
            raise ValueError("MAUTIC_REFRESH_TOKEN required for OAuth2")

        url = f"{self.base_url}/oauth/v2/token"
        payload = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token
        }

        response = requests.post(url, data=payload, timeout=30)

        if response.status_code != 200:
            raise Exception(f"OAuth token refresh failed: {response.status_code} - {response.text[:500]}")

        data = response.json()
        self.oauth_token = data.get("access_token")

        # Update refresh token if provided
        if data.get("refresh_token"):
            self.refresh_token = data["refresh_token"]
            # In production, store this securely
            logger.info("[Mautic] OAuth token refreshed successfully")

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
        retry_on_auth_error: bool = True
    ) -> dict:
        """Make authenticated request to Mautic API."""
        url = f"{self.api_base}/{endpoint}"

        headers = {
            "Authorization": self._get_auth_header(),
            "Content-Type": "application/json"
        }

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=data,
            params=params,
            timeout=60
        )

        # Handle OAuth token expiration
        if response.status_code == 401 and self.use_oauth and retry_on_auth_error:
            logger.info("[Mautic] Token expired, refreshing...")
            self._refresh_oauth_token()
            return self._make_request(method, endpoint, data, params, retry_on_auth_error=False)

        if response.status_code >= 400:
            raise Exception(f"Mautic API error: {response.status_code} - {response.text[:500]}")

        return response.json()

    def create_email(
        self,
        name: str,
        subject: str,
        html: str,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        lists: Optional[List[int]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Create a new email campaign in Mautic.

        Matches n8n "Create Email" node configuration exactly.

        Args:
            name: Campaign name (typically issue_id like "Pivot 5 - Jan 02")
            subject: Email subject line
            html: Full HTML content (should be plain_html for deliverability)
            from_address: Sender email (default: pivotnews@daily.pivotnews.com)
            from_name: Sender display name (default: Daily AI Briefing)
            reply_to: Reply-to address (default: pivotnews@daily.pivotnews.com)
            lists: Mautic segment IDs to send to (default: [5, 14])
            headers: Custom email headers (default includes GreenArrow header)

        Returns:
            {
                "id": email_id,
                "name": name,
                ...
            }
        """
        # Build default headers with GreenArrow mail class
        email_headers = headers or {}
        if "X-GreenArrow-MailClass" not in email_headers:
            email_headers["X-GreenArrow-MailClass"] = self.GREENARROW_MAIL_CLASS

        # Build Mautic email payload matching n8n exactly
        payload = {
            "name": name,
            "subject": subject,
            "customHtml": html,
            "emailType": "list",
            "lists": lists or self.DEFAULT_LISTS,
            "fromAddress": from_address or self.DEFAULT_FROM_ADDRESS,
            "fromName": from_name or self.DEFAULT_FROM_NAME,
            "replyToAddress": reply_to or self.DEFAULT_REPLY_TO,
            "headers": email_headers,
            "isPublished": True,
            "template": self.DEFAULT_TEMPLATE
        }

        logger.info(f"[Mautic] Creating email: {name}")
        response = self._make_request("POST", "emails/new", data=payload)
        email = response.get("email", {})

        logger.info(f"[Mautic] Created email ID: {email.get('id')}")
        return email

    def attach_transport(self, email_id: int, transport_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Attach GreenArrow transport to email for delivery.

        Matches n8n "Attach Transport" node:
        POST /api/multipleTransport/transportEmail/{email_id}

        Args:
            email_id: Mautic email ID
            transport_id: GreenArrow transport ID (default: 3)

        Returns:
            API response
        """
        tid = transport_id or self.DEFAULT_TRANSPORT_ID

        payload = {
            "transportId": tid
        }

        logger.info(f"[Mautic] Attaching transport {tid} to email {email_id}")

        # Note: This uses a custom endpoint path
        response = self._make_request(
            "POST",
            f"multipleTransport/transportEmail/{email_id}",
            data=payload
        )

        logger.info(f"[Mautic] Transport attached successfully")
        return response

    def send_email(self, email_id: int) -> Dict[str, Any]:
        """
        Send email to all attached segments.

        Matches n8n "SEND" node:
        POST /api/emails/{email_id}/send

        Args:
            email_id: Mautic email ID

        Returns:
            {
                "sentCount": number_sent,
                "failedRecipients": number_failed
            }
        """
        logger.info(f"[Mautic] Sending email {email_id}")

        response = self._make_request("POST", f"emails/{email_id}/send")

        sent_count = response.get("sentCount", 0)
        failed = response.get("failedRecipients", 0)

        logger.info(f"[Mautic] Send complete - sent: {sent_count}, failed: {failed}")
        return response

    def update_email(self, email_id: int, update_data: dict) -> Dict[str, Any]:
        """
        Update an existing email.

        Args:
            email_id: Mautic email ID
            update_data: Fields to update

        Returns:
            Updated email data
        """
        response = self._make_request("PATCH", f"emails/{email_id}/edit", data=update_data)
        return response.get("email", {})

    def get_email_stats(self, email_id: int) -> Dict[str, Any]:
        """
        Get email statistics (opens, clicks, etc.)

        Args:
            email_id: Mautic email ID

        Returns:
            Statistics dictionary
        """
        response = self._make_request("GET", f"emails/{email_id}")
        email = response.get("email", {})

        return {
            "sentCount": email.get("sentCount", 0),
            "readCount": email.get("readCount", 0),
            "readRate": email.get("readRate", 0),
            "clickCount": email.get("clickCount", 0),
            "clickRate": email.get("clickRate", 0),
            "unsubscribeCount": email.get("unsubscribeCount", 0),
            "bounceCount": email.get("bounceCount", 0)
        }

    def get_segment(self, segment_id: int) -> Dict[str, Any]:
        """Get segment details."""
        response = self._make_request("GET", f"segments/{segment_id}")
        return response.get("list", {})

    def list_segments(self) -> List[Dict[str, Any]]:
        """List all segments."""
        response = self._make_request("GET", "segments")
        return response.get("lists", [])

    def send_full_campaign(
        self,
        issue_id: str,
        subject_line: str,
        plain_html: str
    ) -> Dict[str, Any]:
        """
        Complete send workflow: create email, attach transport, send.

        Convenience method that chains all three n8n send nodes.

        Args:
            issue_id: Issue identifier (e.g., "Pivot 5 - Jan 02")
            subject_line: Email subject
            plain_html: Deliverability-optimized HTML content

        Returns:
            {
                "success": bool,
                "email_id": int,
                "sent_count": int,
                "failed_recipients": int,
                "raw_response": dict
            }
        """
        result = {
            "success": False,
            "email_id": None,
            "sent_count": 0,
            "failed_recipients": 0,
            "raw_response": {}
        }

        try:
            # Step 1: Create email
            email = self.create_email(
                name=issue_id,
                subject=subject_line,
                html=plain_html
            )
            result["email_id"] = email.get("id")

            if not result["email_id"]:
                raise Exception("Failed to get email ID from Mautic response")

            # Step 2: Attach transport
            self.attach_transport(result["email_id"])

            # Step 3: Send
            send_response = self.send_email(result["email_id"])

            result["sent_count"] = send_response.get("sentCount", 0)
            result["failed_recipients"] = send_response.get("failedRecipients", 0)
            result["raw_response"] = send_response
            result["success"] = result["sent_count"] > 0

            logger.info(f"[Mautic] Campaign sent successfully: {result}")

        except Exception as e:
            logger.error(f"[Mautic] Campaign send failed: {e}")
            result["error"] = str(e)

        return result
