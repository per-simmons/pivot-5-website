"""
Prompt Loading Utility for AI Editor 2.0 Workers
Loads system prompts from PostgreSQL database

Usage:
    from utils.prompts import get_prompt, get_slot_prompt

    # Get any prompt by key
    prompt = get_prompt('slot_1_prefilter')

    # Get slot-specific prompt
    prompt = get_slot_prompt(step=1, slot=1)  # Returns slot_1_prefilter
"""

import logging
from typing import Optional, Dict, Any
from .db import get_db

logger = logging.getLogger(__name__)

# Cache for prompts (refreshed per job for freshness)
_prompt_cache: Dict[str, Dict[str, Any]] = {}
_cache_initialized = False


def get_prompt(prompt_key: str, use_cache: bool = True) -> Optional[str]:
    """
    Get prompt content by key from database

    Args:
        prompt_key: The prompt key (e.g., 'slot_1_prefilter', 'headline_generator')
        use_cache: Whether to use cached value (default True)

    Returns:
        The prompt content string, or None if not found
    """
    global _prompt_cache, _cache_initialized

    # Check cache first
    if use_cache and prompt_key in _prompt_cache:
        return _prompt_cache[prompt_key].get('content')

    try:
        db = get_db()
        prompt_data = db.get_prompt_by_key(prompt_key)

        if prompt_data:
            _prompt_cache[prompt_key] = prompt_data
            return prompt_data.get('content')
        else:
            logger.warning(f"Prompt not found: {prompt_key}")
            return None

    except Exception as e:
        logger.error(f"Error loading prompt {prompt_key}: {e}")
        return None


def get_prompt_with_metadata(prompt_key: str) -> Optional[Dict[str, Any]]:
    """
    Get prompt with full metadata (model, temperature, etc.)

    Returns:
        {
            prompt_key, content, model, temperature,
            step_id, slot_number, name, description
        }
    """
    try:
        db = get_db()
        return db.get_prompt_by_key(prompt_key)
    except Exception as e:
        logger.error(f"Error loading prompt metadata {prompt_key}: {e}")
        return None


def get_slot_prompt(step: int, slot: int) -> Optional[str]:
    """
    Get the prompt for a specific step and slot

    Args:
        step: Step number (1-5)
        slot: Slot number (1-5)

    Returns:
        Prompt content string

    Prompt key patterns:
        Step 1: slot_1_prefilter, slot_2_prefilter, ...
        Step 2: slot_1_agent, slot_2_agent, ...
    """
    if step == 1:
        key = f"slot_{slot}_prefilter"
    elif step == 2:
        key = f"slot_{slot}_agent"
    else:
        logger.warning(f"get_slot_prompt called for step {step} which doesn't have slot-specific prompts")
        return None

    return get_prompt(key)


def get_step_prompts(step_id: int) -> Dict[str, str]:
    """
    Get all prompts for a step as a dict of {prompt_key: content}

    Args:
        step_id: Step number (1-5)

    Returns:
        Dict mapping prompt keys to their content
    """
    try:
        db = get_db()
        prompts = db.get_prompts_by_step(step_id)
        return {p['prompt_key']: p['content'] for p in prompts if p.get('content')}
    except Exception as e:
        logger.error(f"Error loading step {step_id} prompts: {e}")
        return {}


def refresh_cache():
    """Clear prompt cache to force fresh load from database"""
    global _prompt_cache, _cache_initialized
    _prompt_cache = {}
    _cache_initialized = False
    logger.info("Prompt cache cleared")


def preload_all_prompts():
    """
    Preload all prompts into cache
    Call this at worker startup for better performance
    """
    global _prompt_cache, _cache_initialized

    try:
        db = get_db()
        all_prompts = db.get_all_prompts()

        for prompt in all_prompts:
            key = prompt.get('prompt_key')
            if key:
                _prompt_cache[key] = prompt

        _cache_initialized = True
        logger.info(f"Preloaded {len(_prompt_cache)} prompts into cache")

    except Exception as e:
        logger.error(f"Error preloading prompts: {e}")


# =========================================================================
# PROMPT KEY CONSTANTS
# =========================================================================

# Step 1: Pre-Filter (Gemini 3 Flash)
SLOT_1_PREFILTER = "slot_1_prefilter"
SLOT_2_PREFILTER = "slot_2_prefilter"
SLOT_3_PREFILTER = "slot_3_prefilter"
SLOT_4_PREFILTER = "slot_4_prefilter"
SLOT_5_PREFILTER = "slot_5_prefilter"

# Step 2: Slot Selection (Claude Sonnet)
SLOT_1_AGENT = "slot_1_agent"
SLOT_2_AGENT = "slot_2_agent"
SLOT_3_AGENT = "slot_3_agent"
SLOT_4_AGENT = "slot_4_agent"
SLOT_5_AGENT = "slot_5_agent"
SUBJECT_LINE = "subject_line"

# Step 3: Decoration (Claude + Gemini)
CONTENT_CLEANER = "content_cleaner"
HEADLINE_GENERATOR = "headline_generator"
BULLET_GENERATOR = "bullet_generator"
BOLD_FORMATTER = "bold_formatter"
IMAGE_PROMPT = "image_prompt"
IMAGE_GENERATOR = "image_generator"

# Step 4: HTML Compile
SUMMARY_GENERATOR = "summary_generator"
