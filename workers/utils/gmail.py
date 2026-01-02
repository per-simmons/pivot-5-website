"""
Gmail API Client for AI Editor 2.0 Workers

Handles sending test emails via Gmail API for deliverability testing.
Created 1/2/26 for Step 4 Manual Send migration.
"""

import os
import base64
import json
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Try to import Google API client
try:
    from google.oauth2 import service_account
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    GOOGLE_API_AVAILABLE = True
except ImportError:
    GOOGLE_API_AVAILABLE = False
    logger.warning("[Gmail] Google API client not installed. Run: pip install google-api-python-client google-auth")


class GmailClient:
    """
    Gmail API wrapper for AI Editor 2.0 manual test sends.

    Supports both service account and OAuth2 authentication.
    Matches n8n workflow Gmail node configuration.
    """

    # Default configuration from n8n workflow
    DEFAULT_SENDER_EMAIL = "pivot2034@gmail.com"
    DEFAULT_SENDER_NAME = "Daily AI Briefing"
    DEFAULT_RECIPIENTS = [
        "patsimmons21@gmail.com",
        "hi@kunal.live",
        "pat@persimmons.studio"
    ]

    # Gmail API scopes required
    SCOPES = ['https://www.googleapis.com/auth/gmail.send']

    def __init__(self):
        if not GOOGLE_API_AVAILABLE:
            raise ImportError(
                "Google API client required. Install with: "
                "pip install google-api-python-client google-auth"
            )

        self.sender_email = os.environ.get('GMAIL_SENDER_EMAIL', self.DEFAULT_SENDER_EMAIL)
        self.sender_name = os.environ.get('GMAIL_SENDER_NAME', self.DEFAULT_SENDER_NAME)
        self.service = None

        # Try different authentication methods
        self._authenticate()

        logger.info(f"[Gmail] Initialized for sender: {self.sender_email}")

    def _authenticate(self) -> None:
        """Authenticate with Gmail API using available credentials."""
        credentials = None

        # Method 1: Service account JSON (base64 encoded in env var)
        service_account_b64 = os.environ.get('GMAIL_SERVICE_ACCOUNT_JSON')
        if service_account_b64:
            try:
                service_account_json = base64.b64decode(service_account_b64).decode('utf-8')
                service_account_info = json.loads(service_account_json)
                credentials = service_account.Credentials.from_service_account_info(
                    service_account_info,
                    scopes=self.SCOPES
                )
                # For service accounts, need to delegate to the sender email
                credentials = credentials.with_subject(self.sender_email)
                logger.info("[Gmail] Using service account authentication")
            except Exception as e:
                logger.warning(f"[Gmail] Service account auth failed: {e}")

        # Method 2: OAuth2 credentials
        if not credentials:
            oauth_client_id = os.environ.get('GMAIL_CLIENT_ID')
            oauth_client_secret = os.environ.get('GMAIL_CLIENT_SECRET')
            refresh_token = os.environ.get('GMAIL_REFRESH_TOKEN')

            if oauth_client_id and oauth_client_secret and refresh_token:
                try:
                    credentials = Credentials(
                        token=None,
                        refresh_token=refresh_token,
                        token_uri='https://oauth2.googleapis.com/token',
                        client_id=oauth_client_id,
                        client_secret=oauth_client_secret,
                        scopes=self.SCOPES
                    )
                    logger.info("[Gmail] Using OAuth2 authentication")
                except Exception as e:
                    logger.warning(f"[Gmail] OAuth2 auth failed: {e}")

        # Method 3: Credentials JSON file path
        if not credentials:
            credentials_path = os.environ.get('GMAIL_CREDENTIALS_PATH')
            if credentials_path and os.path.exists(credentials_path):
                try:
                    credentials = service_account.Credentials.from_service_account_file(
                        credentials_path,
                        scopes=self.SCOPES
                    )
                    credentials = credentials.with_subject(self.sender_email)
                    logger.info("[Gmail] Using credentials file authentication")
                except Exception as e:
                    logger.warning(f"[Gmail] Credentials file auth failed: {e}")

        if not credentials:
            raise ValueError(
                "Gmail credentials required. Set one of:\n"
                "  - GMAIL_SERVICE_ACCOUNT_JSON (base64 encoded)\n"
                "  - GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN\n"
                "  - GMAIL_CREDENTIALS_PATH (path to credentials.json)"
            )

        # Build the Gmail service
        self.service = build('gmail', 'v1', credentials=credentials)

    def _create_message(
        self,
        to: List[str],
        subject: str,
        html_body: str,
        sender_name: Optional[str] = None,
        sender_email: Optional[str] = None
    ) -> dict:
        """
        Create a message for the Gmail API.

        Args:
            to: List of recipient email addresses
            subject: Email subject line
            html_body: HTML content of the email
            sender_name: Display name for sender
            sender_email: Sender email address

        Returns:
            Gmail API message object
        """
        sender = sender_email or self.sender_email
        name = sender_name or self.sender_name

        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = f"{name} <{sender}>"
        message['To'] = ', '.join(to)

        # Create plain text version (strip HTML tags for fallback)
        import re
        plain_text = re.sub(r'<[^>]+>', '', html_body)
        plain_text = re.sub(r'\s+', ' ', plain_text).strip()

        # Attach both versions
        part1 = MIMEText(plain_text, 'plain')
        part2 = MIMEText(html_body, 'html')
        message.attach(part1)
        message.attach(part2)

        # Encode the message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

        return {'raw': raw_message}

    def send_email(
        self,
        to: Optional[List[str]] = None,
        subject: str = "",
        html_body: str = "",
        sender_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email via Gmail API.

        Args:
            to: List of recipient emails (defaults to DEFAULT_RECIPIENTS)
            subject: Email subject line
            html_body: HTML content (should be plain_html for deliverability)
            sender_name: Display name for sender (defaults to "Daily AI Briefing")

        Returns:
            {
                "success": bool,
                "message_id": str,
                "thread_id": str,
                "recipients": list,
                "error": str (if failed)
            }
        """
        recipients = to or self.DEFAULT_RECIPIENTS

        result = {
            "success": False,
            "message_id": None,
            "thread_id": None,
            "recipients": recipients,
            "error": None
        }

        try:
            # Create the message
            message = self._create_message(
                to=recipients,
                subject=subject,
                html_body=html_body,
                sender_name=sender_name
            )

            logger.info(f"[Gmail] Sending email to {len(recipients)} recipients: {recipients}")

            # Send via Gmail API
            sent_message = self.service.users().messages().send(
                userId='me',
                body=message
            ).execute()

            result["success"] = True
            result["message_id"] = sent_message.get('id')
            result["thread_id"] = sent_message.get('threadId')

            logger.info(f"[Gmail] Email sent successfully. Message ID: {result['message_id']}")

        except HttpError as e:
            error_msg = f"Gmail API error: {e.status_code} - {e.reason}"
            logger.error(f"[Gmail] {error_msg}")
            result["error"] = error_msg

        except Exception as e:
            error_msg = f"Failed to send email: {str(e)}"
            logger.error(f"[Gmail] {error_msg}")
            result["error"] = error_msg

        return result

    def send_test_newsletter(
        self,
        subject_line: str,
        plain_html: str,
        issue_id: str
    ) -> Dict[str, Any]:
        """
        Send test newsletter to default recipients.

        Convenience method matching n8n manual send workflow.

        Args:
            subject_line: Email subject
            plain_html: Deliverability-optimized HTML content
            issue_id: Issue identifier for logging

        Returns:
            {
                "success": bool,
                "issue_id": str,
                "recipients": list,
                "message_id": str,
                "error": str (if failed)
            }
        """
        logger.info(f"[Gmail] Sending test newsletter: {issue_id}")

        result = self.send_email(
            subject=subject_line,
            html_body=plain_html
        )

        result["issue_id"] = issue_id

        if result["success"]:
            logger.info(f"[Gmail] Test newsletter sent successfully to {len(result['recipients'])} recipients")
        else:
            logger.error(f"[Gmail] Test newsletter send failed: {result.get('error')}")

        return result

    def verify_credentials(self) -> Dict[str, Any]:
        """
        Verify Gmail credentials are working.

        Returns:
            {
                "valid": bool,
                "email": str,
                "error": str (if invalid)
            }
        """
        result = {
            "valid": False,
            "email": None,
            "error": None
        }

        try:
            # Get the authenticated user's profile
            profile = self.service.users().getProfile(userId='me').execute()
            result["valid"] = True
            result["email"] = profile.get('emailAddress')
            logger.info(f"[Gmail] Credentials verified for: {result['email']}")
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"[Gmail] Credential verification failed: {e}")

        return result
