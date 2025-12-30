"""
Step 3: Story Decoration

Creates AI-generated headlines, deks, bullet points for each selected story.

Replaces part of n8n workflow: HCbd2g852rkQgSqr
"""

import os
from datetime import datetime
from typing import Dict, Any
import anthropic
import google.generativeai as genai
from ..utils.airtable import AirtableClient

CLAUDE_MODEL = "claude-sonnet-4-20250514"


def decorate_story(
    story_id: str,
    pivot_id: str,
    slot_order: int,
    job_id: str = None,
) -> Dict[str, Any]:
    """
    Decorate a single story with AI-generated content.

    Args:
        story_id: Airtable story record ID
        pivot_id: Pivot ID for article lookup
        slot_order: Newsletter slot position (1-5)
        job_id: Optional job ID for tracking

    Returns:
        Dict with decorated content
    """
    print(f"[Step 3] Decorating story {story_id} for slot {slot_order}")

    # Initialize clients
    airtable = AirtableClient()
    claude = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
    genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
    gemini = genai.GenerativeModel('gemini-3-flash-preview')

    # Get article content
    article = airtable.get_article_by_pivot_id(pivot_id)
    if not article:
        raise ValueError(f"Article not found: {pivot_id}")

    markdown = article.get('markdown', '')
    original_url = article.get('original_url', '')
    source = article.get('source_id', '')

    results = {
        "job_id": job_id,
        "story_id": story_id,
        "pivot_id": pivot_id,
        "slot_order": slot_order,
        "started_at": datetime.now().isoformat(),
    }

    # Step 1: Clean content with Gemini
    cleaned_content = _clean_content(gemini, markdown)

    # Step 2: Generate decorated content with Claude
    decorated = _generate_decoration(claude, cleaned_content, source, original_url)

    # Step 3: Apply bolding pass
    decorated = _apply_bolding(claude, decorated)

    # Step 4: Generate image prompt
    image_prompt = _generate_image_prompt(claude, decorated)

    results.update({
        "ai_headline": decorated.get('headline'),
        "ai_dek": decorated.get('dek'),
        "ai_bullet_1": decorated.get('bullet_1'),
        "ai_bullet_2": decorated.get('bullet_2'),
        "ai_bullet_3": decorated.get('bullet_3'),
        "image_prompt": image_prompt,
        "image_status": "pending",
        "completed_at": datetime.now().isoformat(),
    })

    # Write to Decoration table
    airtable.create_decoration_record(results)

    print(f"[Step 3] Story {story_id} decorated successfully")
    return results


def _clean_content(model: Any, markdown: str) -> str:
    """
    Use Gemini to clean raw article content.

    Removes navigation, ads, footers, and other non-article content.
    """
    prompt = f"""Clean this raw article content by removing:
- Navigation menus and headers
- Advertisement text
- Footer content (copyright, social links, etc.)
- Subscription prompts
- Related article suggestions
- Author bios (keep byline)

Return ONLY the main article content, preserving the headline and body text.

CONTENT:
{markdown[:8000]}"""  # Limit input size

    response = model.generate_content(prompt)
    return response.text.strip()


def _generate_decoration(
    client: anthropic.Anthropic,
    content: str,
    source: str,
    url: str,
) -> Dict[str, str]:
    """
    Generate headline, dek, and 3 bullet points using Claude.
    """
    prompt = f"""You are an AI newsletter editor for Pivot 5, a daily AI news digest.

Generate the following for this article:

1. HEADLINE: Title Case, punchy, <80 characters. Focus on the key development.
2. DEK: One sentence (15-25 words) providing context/why it matters.
3. BULLET 1: Main announcement (2 sentences, <260 chars). Start with the news.
4. BULLET 2: Key details (2 sentences, <260 chars). Specifics, numbers, context.
5. BULLET 3: Business impact (2 sentences, <260 chars). What this means for industry/readers.

AUDIENCE: AI professionals, investors, builders. Tone is professional, skeptical of hype, sharp but accessible.

SOURCE: {source}
URL: {url}

ARTICLE:
{content[:6000]}

Respond in this exact JSON format:
{{
  "headline": "...",
  "dek": "...",
  "bullet_1": "...",
  "bullet_2": "...",
  "bullet_3": "..."
}}"""

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    text = response.content[0].text.strip()

    # Extract JSON from response
    try:
        # Handle potential markdown code blocks
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback parsing
        return {
            "headline": "Error parsing response",
            "dek": "",
            "bullet_1": text[:260],
            "bullet_2": "",
            "bullet_3": "",
        }


def _apply_bolding(
    client: anthropic.Anthropic,
    decorated: Dict[str, str],
) -> Dict[str, str]:
    """
    Apply markdown bold formatting to key phrases in bullets.
    """
    for key in ['bullet_1', 'bullet_2', 'bullet_3']:
        if not decorated.get(key):
            continue

        prompt = f"""Add markdown bold (**text**) to 1-2 key phrases in this bullet point.
Bold the most important numbers, company names, or key terms.
Do not change any text, only add ** around important phrases.

BULLET: {decorated[key]}

Return ONLY the bullet with bolding added, nothing else."""

        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        decorated[key] = response.content[0].text.strip()

    return decorated


def _generate_image_prompt(
    client: anthropic.Anthropic,
    decorated: Dict[str, str],
) -> str:
    """
    Generate an image prompt for the story.
    """
    headline = decorated.get('headline', '')
    dek = decorated.get('dek', '')

    prompt = f"""Create an image generation prompt for this AI newsletter story.

HEADLINE: {headline}
DEK: {dek}

REQUIREMENTS:
- Professional, editorial style
- Vibrant orange/coral accent color (#ff6f00)
- Clean, modern tech aesthetic
- NO text, logos, or human faces
- Abstract or conceptual representation
- Suitable for 636px width newsletter image

Return ONLY the image prompt (50-100 words), no explanation."""

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text.strip()
