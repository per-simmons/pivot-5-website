"""
Claude API Client for AI Editor 2.0 Workers
Used for: Slot Selection (Step 2), Decoration (Step 3), Summaries (Step 4)

Prompts are loaded from PostgreSQL database via utils.prompts
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from anthropic import Anthropic

from .prompts import get_prompt, get_prompt_with_metadata

logger = logging.getLogger(__name__)


class ClaudeClient:
    """Claude API wrapper for AI Editor 2.0"""

    def __init__(self):
        self.api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")

        self.client = Anthropic(api_key=self.api_key)

        # Default model (can be overridden by prompt metadata)
        self.default_model = "claude-sonnet-4-5-20250929"

    # =========================================================================
    # STEP 2: SLOT SELECTION
    # =========================================================================

    def select_slot(
        self,
        slot: int,
        candidates: List[dict],
        yesterday_data: dict,
        cumulative_state: dict
    ) -> dict:
        """
        Step 2, Nodes 18-22: Claude agent for slot selection

        Args:
            slot: Slot number (1-5)
            candidates: List of story candidates for this slot
            yesterday_data: {headlines, storyIds, pivotIds, slot1Company}
            cumulative_state: {selectedToday, selectedCompanies, selectedSources}

        Returns:
            {selected_storyId, selected_pivotId, selected_headline, company, source_id, reasoning}
        """
        system_prompt = self._build_slot_system_prompt(slot, yesterday_data, cumulative_state)
        user_prompt = self._build_slot_user_prompt(candidates)

        response = self.client.messages.create(
            model=self.default_model,
            max_tokens=2000,
            temperature=0.5,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )

        try:
            result = json.loads(response.content[0].text)
            return result
        except json.JSONDecodeError:
            return self._parse_slot_response(response.content[0].text, candidates)

    def _build_slot_system_prompt(self, slot: int, yesterday_data: dict, cumulative_state: dict) -> str:
        """Build slot-specific system prompt from database"""

        # Load the base prompt from database
        prompt_key = f"slot_{slot}_agent"
        base_prompt = get_prompt(prompt_key)

        if not base_prompt:
            logger.warning(f"Prompt {prompt_key} not found in database, using fallback")
            # Fallback to hardcoded if database unavailable
            slot_focus = {
                1: "Jobs, economy, stock market, broad societal impact. Must be FRESH (0-24 hours).",
                2: "Tier 1 AI companies (OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon), economic themes, research breakthroughs.",
                3: "Industry verticals: Healthcare, Government, Education, Legal, Accounting, Retail, Security, Transportation, Manufacturing, Real Estate, Agriculture, Energy.",
                4: "Emerging companies: product launches, fundraising, acquisitions, new AI tools. Must be FRESH (0-48 hours).",
                5: "Consumer AI, human interest, ethics, entertainment, societal impact, fun/quirky uses."
            }
            base_prompt = f"You are a senior editor for Pivot 5. SLOT {slot} FOCUS: {slot_focus.get(slot, '')}"

        # Build dynamic context to inject
        yesterday_headlines = yesterday_data.get('headlines', [])
        selected_today = cumulative_state.get('selectedToday', [])
        selected_companies = cumulative_state.get('selectedCompanies', [])
        selected_sources = cumulative_state.get('selectedSources', [])

        context = f"""

CURRENT CONTEXT:
1. YESTERDAY'S HEADLINES - Do NOT select stories covering same topics:
{chr(10).join(f"   - {h}" for h in yesterday_headlines) if yesterday_headlines else '   (none)'}

2. ALREADY SELECTED TODAY - Do NOT select these storyIDs:
   {selected_today if selected_today else '(none yet)'}

3. COMPANY DIVERSITY - Each company appears at most ONCE across all 5 slots:
   Already featured today: {selected_companies if selected_companies else '(none yet)'}

4. SOURCE DIVERSITY - Max 2 stories per source per day:
   Already used today: {selected_sources if selected_sources else '(none yet)'}
"""

        # Slot 1 has special two-day rotation rule
        if slot == 1 and yesterday_data.get('slot1Company'):
            context += f"""
5. TWO-DAY ROTATION (Slot 1 only) - Do NOT feature this company:
   Yesterday's Slot 1 company: {yesterday_data['slot1Company']}
"""

        context += """

Return JSON with:
- selected_storyId: the chosen story's storyID
- selected_pivotId: the chosen story's pivotId
- selected_headline: the chosen story's headline
- company: primary company mentioned (or null)
- source_id: the story's source
- reasoning: 1-2 sentence explanation"""

        return base_prompt + context

    def _build_slot_user_prompt(self, candidates: List[dict]) -> str:
        """Build user prompt with candidate stories"""
        prompt = "CANDIDATE STORIES:\n\n"

        for i, candidate in enumerate(candidates, 1):
            fields = candidate.get('fields', candidate)
            prompt += f"""Story {i}:
- storyID: {fields.get('storyID', '')}
- pivotId: {fields.get('pivotId', '')}
- headline: {fields.get('headline', '')}
- source: {fields.get('source_id', '')}
- published: {fields.get('date_og_published', '')}

"""

        prompt += "Select the BEST story for this slot. Return JSON only."
        return prompt

    def _parse_slot_response(self, text: str, candidates: List[dict]) -> dict:
        """Fallback parser for non-JSON responses"""
        import re

        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Default to first candidate
        if candidates:
            fields = candidates[0].get('fields', candidates[0])
            return {
                "selected_storyId": fields.get('storyID', ''),
                "selected_pivotId": fields.get('pivotId', ''),
                "selected_headline": fields.get('headline', ''),
                "company": None,
                "source_id": fields.get('source_id', ''),
                "reasoning": "Fallback: selected first candidate"
            }

        return {"error": "No candidates available"}

    def generate_subject_line(self, headlines: List[str]) -> str:
        """
        Step 2, Node 29: Generate email subject line from 5 headlines
        """
        # Load base prompt from database
        base_prompt = get_prompt('subject_line')

        if base_prompt:
            # Inject today's headlines into the prompt
            headlines_text = "\n".join([f"{i+1}. {h}" for i, h in enumerate(headlines[:5])])
            prompt = base_prompt + f"\n\nTODAY'S HEADLINES:\n{headlines_text}\n\nReturn ONLY the subject line, no quotes or explanation."
        else:
            logger.warning("subject_line prompt not found in database, using fallback")
            prompt = f"""Generate a compelling email subject line for this daily AI newsletter.

TODAY'S HEADLINES:
1. {headlines[0] if len(headlines) > 0 else ''}
2. {headlines[1] if len(headlines) > 1 else ''}
3. {headlines[2] if len(headlines) > 2 else ''}
4. {headlines[3] if len(headlines) > 3 else ''}
5. {headlines[4] if len(headlines) > 4 else ''}

REQUIREMENTS:
- Maximum 60 characters
- Create urgency and curiosity
- Reference 1-2 key stories
- Avoid clickbait, be substantive
- Match professional newsletter tone

Return ONLY the subject line, no quotes or explanation."""

        # Get model/temperature from database if available
        prompt_meta = get_prompt_with_metadata('subject_line')
        model = prompt_meta.get('model', self.default_model) if prompt_meta else self.default_model
        temperature = prompt_meta.get('temperature', 0.7) if prompt_meta else 0.7

        response = self.client.messages.create(
            model=model,
            max_tokens=100,
            temperature=float(temperature),
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text.strip().strip('"\'')

    # =========================================================================
    # STEP 3: DECORATION
    # =========================================================================

    def decorate_story(self, story_data: dict, cleaned_content: str) -> dict:
        """
        Step 3: Generate headline, dek, bullets, and image prompt

        Args:
            story_data: {headline, source, url, topic}
            cleaned_content: Cleaned article markdown

        Returns:
            {ai_headline, ai_dek, b1, b2, b3, image_prompt, label}
        """
        # Load prompts from database - combine headline, bullet, and image prompts
        headline_prompt = get_prompt('headline_generator')
        bullet_prompt = get_prompt('bullet_generator')
        image_prompt_template = get_prompt('image_prompt')

        # Build combined prompt with story context
        story_context = f"""ORIGINAL HEADLINE: {story_data.get('headline', '')}
SOURCE: {story_data.get('source', '')}
TOPIC: {story_data.get('topic', '')}

ARTICLE CONTENT:
{cleaned_content[:6000]}"""

        if headline_prompt and bullet_prompt and image_prompt_template:
            # Use database prompts
            prompt = f"""{headline_prompt}

{bullet_prompt}

{image_prompt_template}

{story_context}

Generate all of the above in JSON format with keys: ai_headline, ai_dek, b1, b2, b3, label, image_prompt

Return JSON only."""
        else:
            logger.warning("Decoration prompts not found in database, using fallback")
            prompt = f"""You are decorating a story for Pivot 5, a professional AI newsletter.

{story_context}

Generate the following in JSON format:

1. ai_headline: Punchy headline in Title Case. Max 80 characters. Create intrigue.

2. ai_dek: One sentence hook that expands on headline. Professional tone.

3. b1: First bullet - Main announcement (2 sentences, max 260 characters). Start with action verb.

4. b2: Second bullet - Key details/context (2 sentences, max 260 characters).

5. b3: Third bullet - Business impact or "why it matters" (2 sentences, max 260 characters).

6. label: Topic label in ALL CAPS (e.g., "JOBS & ECONOMY", "BIG TECH", "HEALTHCARE AI", "EMERGING TECH", "CONSUMER AI")

7. image_prompt: Description for AI image generation. Professional, editorial style. Abstract representation of the story theme. No text, logos, or faces.

Return JSON only."""

        # Get model/temperature from headline_generator prompt metadata
        prompt_meta = get_prompt_with_metadata('headline_generator')
        model = prompt_meta.get('model', self.default_model) if prompt_meta else self.default_model
        temperature = prompt_meta.get('temperature', 0.5) if prompt_meta else 0.5

        response = self.client.messages.create(
            model=model,
            max_tokens=1500,
            temperature=float(temperature),
            messages=[{"role": "user", "content": prompt}]
        )

        try:
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return self._parse_decoration_response(response.content[0].text)

    def apply_bolding(self, bullets: List[str]) -> List[str]:
        """
        Step 3: Apply markdown bold to key phrases in bullets
        """
        # Load bold_formatter prompt from database
        base_prompt = get_prompt('bold_formatter')

        bullets_text = f"""Bullet 1: {bullets[0] if len(bullets) > 0 else ''}
Bullet 2: {bullets[1] if len(bullets) > 1 else ''}
Bullet 3: {bullets[2] if len(bullets) > 2 else ''}"""

        if base_prompt:
            prompt = f"""{base_prompt}

{bullets_text}

Return JSON array with the 3 bolded bullets."""
        else:
            logger.warning("bold_formatter prompt not found in database, using fallback")
            prompt = f"""Apply markdown bold (**text**) to 1-2 key phrases in each bullet point.
Bold the most impactful/newsworthy phrases.

{bullets_text}

Return JSON array with the 3 bolded bullets. Example:
["**Key phrase** rest of bullet one.", "Bullet two with **important part**.", "Third bullet **highlight** here."]"""

        # Get model/temperature from database
        prompt_meta = get_prompt_with_metadata('bold_formatter')
        model = prompt_meta.get('model', self.default_model) if prompt_meta else self.default_model
        temperature = prompt_meta.get('temperature', 0.3) if prompt_meta else 0.3

        response = self.client.messages.create(
            model=model,
            max_tokens=500,
            temperature=float(temperature),
            messages=[{"role": "user", "content": prompt}]
        )

        try:
            return json.loads(response.content[0].text)
        except json.JSONDecodeError:
            return bullets  # Return original if parsing fails

    def _parse_decoration_response(self, text: str) -> dict:
        """Fallback parser for decoration response"""
        import re

        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return {
            "ai_headline": "",
            "ai_dek": "",
            "b1": "",
            "b2": "",
            "b3": "",
            "label": "AI NEWS",
            "image_prompt": "",
            "error": "Failed to parse response"
        }

    # =========================================================================
    # STEP 4: SUMMARIES
    # =========================================================================

    def generate_summary(self, headlines: List[str], max_words: int = 15) -> str:
        """
        Step 4: Generate newsletter summary (15-word or 20-word)
        """
        # Load summary_generator prompt from database
        base_prompt = get_prompt('summary_generator')

        headlines_text = "\n".join([f"{i+1}. {h}" for i, h in enumerate(headlines[:5])])

        if base_prompt:
            prompt = f"""{base_prompt}

Max words: {max_words}

HEADLINES:
{headlines_text}

Return ONLY the summary, no explanation."""
        else:
            logger.warning("summary_generator prompt not found in database, using fallback")
            prompt = f"""Summarize today's AI newsletter in exactly {max_words} words or fewer.

HEADLINES:
{headlines_text}

Write a single sentence summarizing the key themes. Professional tone.
Return ONLY the summary, no explanation."""

        # Get model/temperature from database
        prompt_meta = get_prompt_with_metadata('summary_generator')
        model = prompt_meta.get('model', self.default_model) if prompt_meta else self.default_model
        temperature = prompt_meta.get('temperature', 0.5) if prompt_meta else 0.5

        response = self.client.messages.create(
            model=model,
            max_tokens=100,
            temperature=float(temperature),
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text.strip()
