"""
Gemini API Client for AI Editor 2.0 Workers
Used for: Pre-filtering (Step 1), Content cleaning (Step 3)

Prompts are loaded from PostgreSQL database via utils.prompts
"""

import os
import json
import logging
from typing import Dict, Any, Optional
import google.generativeai as genai

from .prompts import get_prompt, get_prompt_with_metadata

logger = logging.getLogger(__name__)


class GeminiClient:
    """Gemini API wrapper for AI Editor 2.0"""

    def __init__(self):
        self.api_key = os.environ.get('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

        genai.configure(api_key=self.api_key)

        # Model for pre-filtering (fast, cheap)
        self.flash_model = genai.GenerativeModel('gemini-2.0-flash')

    def prefilter_story(self, story_data: dict, yesterday_headlines: list, source_score: int) -> dict:
        """
        Step 1, Node 13: Gemini pre-filter for slot eligibility

        Args:
            story_data: {storyId, pivotId, headline, dek, topic, source, hoursAgo, originalUrl}
            yesterday_headlines: List of 5 headlines from yesterday's issue
            source_score: Credibility score 1-5

        Returns:
            {eligible_slots: [1,2,3], primary_slot: 2, reasoning: "..."}
        """
        prompt = self._build_prefilter_prompt(story_data, yesterday_headlines, source_score)

        response = self.flash_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                max_output_tokens=256,
                response_mime_type="application/json"
            )
        )

        try:
            result = json.loads(response.text)
            return result
        except json.JSONDecodeError:
            # Fallback: try to extract JSON from response
            return self._parse_prefilter_response(response.text)

    def _build_prefilter_prompt(self, story: dict, yesterday_headlines: list, source_score: int) -> str:
        """Build the pre-filter prompt from database or fallback"""

        # Build story context that will be injected into the prompt
        story_context = f"""STORY TO EVALUATE:
- Headline: {story.get('headline', '')}
- Dek: {story.get('dek', '')}
- Topic: {story.get('topic', '')}
- Source: {story.get('source', '')} (credibility: {source_score}/5)
- Hours since published: {story.get('hoursAgo', 0)}
- URL: {story.get('originalUrl', '')}

YESTERDAY'S HEADLINES (avoid similar topics):
{chr(10).join(f"- {h}" for h in yesterday_headlines)}"""

        # Try to load slot-specific prefilter prompts from database
        # We combine all 5 slot criteria into one prompt for efficiency
        slot_prompts = []
        for slot in range(1, 6):
            slot_prompt = get_prompt(f'slot_{slot}_prefilter')
            if slot_prompt:
                slot_prompts.append(f"- Slot {slot}: {slot_prompt}")

        if slot_prompts:
            # Use database prompts
            slot_criteria = "\n".join(slot_prompts)
            return f"""You are a newsletter editor for Pivot 5, a daily AI industry newsletter.

{story_context}

SLOT CRITERIA:
{slot_criteria}

RULES:
1. Minimum source credibility score: 2
2. Story must match at least one slot's topic criteria
3. Story freshness must fall within slot's time window
4. Avoid stories covering same topics as yesterday

Return JSON with:
- eligible_slots: array of slot numbers (1-5) this story qualifies for
- primary_slot: the single best-fit slot number
- reasoning: brief explanation (1-2 sentences)

If story doesn't qualify for any slot, return eligible_slots: []"""
        else:
            # Fallback to hardcoded prompts
            logger.warning("Prefilter prompts not found in database, using fallback")
            return f"""You are a newsletter editor for Pivot 5, a daily AI industry newsletter.

{story_context}

SLOT CRITERIA:
- Slot 1: AI impact on jobs/economy/stock market/broad societal impact. Freshness: 0-24 hours.
- Slot 2: Tier 1 AI companies (OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon) + economic themes + research. Freshness: 24-48 hours.
- Slot 3: Industry verticals (Healthcare, Government, Education, Legal, Accounting, Retail, Security, Transportation, Manufacturing, Real Estate, Agriculture, Energy). Freshness: 0-7 days.
- Slot 4: Emerging companies (product launches, fundraising, acquisitions, new AI tools). Freshness: 0-48 hours.
- Slot 5: Consumer AI / human interest (ethics, entertainment, societal impact, fun/quirky uses). Freshness: 0-7 days.

RULES:
1. Minimum source credibility score: 2
2. Story must match at least one slot's topic criteria
3. Story freshness must fall within slot's time window
4. Avoid stories covering same topics as yesterday

Return JSON with:
- eligible_slots: array of slot numbers (1-5) this story qualifies for
- primary_slot: the single best-fit slot number
- reasoning: brief explanation (1-2 sentences)

If story doesn't qualify for any slot, return eligible_slots: []"""

    def _parse_prefilter_response(self, text: str) -> dict:
        """Fallback parser for non-JSON responses"""
        import re

        # Try to find JSON in the response
        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Default: no eligible slots
        return {
            "eligible_slots": [],
            "primary_slot": None,
            "reasoning": "Failed to parse response"
        }

    def clean_content(self, markdown: str) -> str:
        """
        Step 3: Clean article content (remove navigation, ads, footers)

        Args:
            markdown: Raw article markdown

        Returns:
            Cleaned markdown content
        """
        # Load content_cleaner prompt from database
        base_prompt = get_prompt('content_cleaner')

        if base_prompt:
            prompt = f"""{base_prompt}

ARTICLE:
{markdown[:8000]}

Return ONLY the cleaned article content, no explanations."""
        else:
            logger.warning("content_cleaner prompt not found in database, using fallback")
            prompt = f"""Clean the following article content by removing:
- Navigation elements
- Advertisements
- Footer content
- Subscription prompts
- Social media buttons
- Related articles sections
- Author bios (keep byline if part of story)

Keep ONLY the main article content. Preserve the article structure and formatting.

ARTICLE:
{markdown[:8000]}

Return ONLY the cleaned article content, no explanations."""

        # Get temperature from database if available
        prompt_meta = get_prompt_with_metadata('content_cleaner')
        temperature = float(prompt_meta.get('temperature', 0.1)) if prompt_meta else 0.1

        response = self.flash_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=4096
            )
        )

        return response.text.strip()
