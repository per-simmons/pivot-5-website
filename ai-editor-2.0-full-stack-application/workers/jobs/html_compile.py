"""
Step 4: HTML Compile

Compiles the 5 decorated stories into the final HTML email template.

Part of n8n workflow: NKjC8hb0EDHIXx3U
"""

import os
from datetime import datetime
from typing import Dict, Any, List
from ..utils.airtable import AirtableClient

# Newsletter HTML template
EMAIL_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pivot 5 - {issue_date}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }}
        .container {{ max-width: 640px; margin: 0 auto; background: white; }}
        .header {{ padding: 24px; text-align: center; border-bottom: 3px solid #ff6f00; }}
        .header h1 {{ margin: 0; font-size: 32px; color: #1a1a1a; }}
        .tagline {{ color: #666; font-size: 14px; margin-top: 8px; }}
        .story {{ padding: 24px; border-bottom: 1px solid #eee; }}
        .story:last-child {{ border-bottom: none; }}
        .topic-label {{ display: inline-block; background: #ff6f00; color: white; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }}
        .headline {{ font-size: 22px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px 0; line-height: 1.3; }}
        .story-image {{ width: 100%; height: auto; border-radius: 8px; margin-bottom: 16px; }}
        .bullets {{ margin: 0; padding: 0; list-style: none; }}
        .bullets li {{ position: relative; padding-left: 20px; margin-bottom: 12px; font-size: 15px; line-height: 1.5; color: #333; }}
        .bullets li::before {{ content: "•"; position: absolute; left: 0; color: #ff6f00; font-weight: bold; }}
        .read-more {{ display: inline-block; margin-top: 12px; color: #ff6f00; text-decoration: none; font-weight: 600; font-size: 14px; }}
        .read-more:hover {{ text-decoration: underline; }}
        .footer {{ padding: 24px; text-align: center; background: #f9f9f9; font-size: 12px; color: #666; }}
        .footer a {{ color: #ff6f00; }}
        .preheader {{ display: none; max-height: 0; overflow: hidden; }}
    </style>
</head>
<body>
    <div class="preheader">{preheader}</div>
    <div class="container">
        <div class="header">
            <h1>PIVOT <span style="color: #ff6f00;">5</span></h1>
            <div class="tagline">5 headlines • 5 minutes • 5 days a week</div>
        </div>

        {stories_html}

        <div class="footer">
            <p>You're receiving this because you subscribed to Pivot 5.</p>
            <p><a href="{{{{unsubscribe_url}}}}">Unsubscribe</a> | <a href="{{{{preferences_url}}}}">Manage Preferences</a></p>
            <p>© {year} Pivot Media. All rights reserved.</p>
        </div>
    </div>
</body>
</html>'''

STORY_TEMPLATE = '''<div class="story">
    <span class="topic-label">{label}</span>
    <h2 class="headline">{headline}</h2>
    <img src="{image_url}" alt="{headline}" class="story-image">
    <ul class="bullets">
        <li>{bullet_1}</li>
        <li>{bullet_2}</li>
        <li>{bullet_3}</li>
    </ul>
    <a href="{url}" class="read-more">Read More →</a>
</div>'''

SLOT_LABELS = {
    1: "Impact",
    2: "Big Tech",
    3: "Industry",
    4: "Emerging",
    5: "Human Interest",
}


def compile_newsletter_html(
    issue_date: str = None,
    job_id: str = None,
) -> Dict[str, Any]:
    """
    Compile the newsletter HTML from decorated stories.

    Args:
        issue_date: Optional issue date string
        job_id: Optional job ID for tracking

    Returns:
        Dict with compiled HTML and metadata
    """
    print(f"[Step 4] Compiling newsletter HTML")

    airtable = AirtableClient()

    if not issue_date:
        issue_date = datetime.now().strftime("%b %d, %Y")

    results = {
        "job_id": job_id,
        "issue_date": issue_date,
        "started_at": datetime.now().isoformat(),
    }

    # Get decorated stories for today
    decorated_stories = airtable.get_decorated_stories_for_issue()

    if len(decorated_stories) < 5:
        results["error"] = f"Only {len(decorated_stories)} stories decorated, need 5"
        results["status"] = "incomplete"
        return results

    # Get subject line from selected slots
    selected_slots = airtable.get_today_selected_slots()
    subject_line = selected_slots.get('subject_line', f"Pivot 5 - {issue_date}")

    # Compile stories HTML
    stories_html_parts = []
    for story in sorted(decorated_stories, key=lambda x: x.get('slot_order', 99)):
        slot_order = story.get('slot_order', 1)
        story_html = STORY_TEMPLATE.format(
            label=SLOT_LABELS.get(slot_order, "News"),
            headline=story.get('ai_headline', 'Untitled'),
            image_url=story.get('image_url', ''),
            bullet_1=story.get('ai_bullet_1', ''),
            bullet_2=story.get('ai_bullet_2', ''),
            bullet_3=story.get('ai_bullet_3', ''),
            url=story.get('original_url', '#'),
        )
        stories_html_parts.append(story_html)

    stories_html = "\n".join(stories_html_parts)

    # Generate full HTML
    full_html = EMAIL_TEMPLATE.format(
        issue_date=issue_date,
        preheader=subject_line[:100],
        stories_html=stories_html,
        year=datetime.now().year,
    )

    results.update({
        "html": full_html,
        "subject_line": subject_line,
        "story_count": len(decorated_stories),
        "status": "compiled",
        "completed_at": datetime.now().isoformat(),
    })

    # Save to Newsletter Issues table
    airtable.create_newsletter_issue({
        "issue_id": f"pivot5_{datetime.now().strftime('%Y%m%d')}",
        "newsletter_id": "pivot_ai",
        "html": full_html,
        "subject_line": subject_line,
        "status": "compiled",
    })

    print(f"[Step 4] Newsletter compiled: {len(decorated_stories)} stories")
    return results
