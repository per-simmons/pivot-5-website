"""
Step 2: Slot Selection

5 sequential Claude agent calls select one story per slot, tracking previously
selected companies/sources/IDs to enforce diversity rules.

Replaces n8n workflow: SZmPztKNEmisG3Zf
"""

import os
from datetime import datetime
from typing import Dict, Any, List, Set
import anthropic
from ..utils.airtable import AirtableClient

# Claude model for slot selection
CLAUDE_MODEL = "claude-sonnet-4-20250514"


def select_slots(job_id: str = None) -> Dict[str, Any]:
    """
    Select one story for each of the 5 newsletter slots using Claude agents.

    Args:
        job_id: Optional job ID for tracking

    Returns:
        Dict with selected stories and subject line
    """
    print(f"[Step 2] Starting slot selection job {job_id or 'manual'}")

    # Initialize clients
    airtable = AirtableClient()
    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    # Get yesterday's issue for context
    yesterday = airtable.get_yesterday_selected_stories()

    # Track what we've already selected today
    selected_story_ids: Set[str] = set()
    selected_companies: Set[str] = set()
    selected_sources: Set[str] = set()

    # Yesterday's data for rules
    yesterday_companies = {s.get('company', '') for s in yesterday if s.get('company')}
    yesterday_slot1_company = yesterday[0].get('company', '') if yesterday else ''

    results = {
        "job_id": job_id,
        "started_at": datetime.now().isoformat(),
        "issue_date": f"Pivot 5 - {datetime.now().strftime('%b %d')}",
        "slots": {},
        "subject_line": "",
        "errors": [],
    }

    # Process each slot sequentially
    for slot_num in range(1, 6):
        print(f"[Step 2] Processing slot {slot_num}...")

        try:
            # Get candidates for this slot
            candidates = airtable.get_prefilter_candidates(slot=slot_num)

            # Filter out already selected stories
            candidates = [c for c in candidates if c.get('storyID') not in selected_story_ids]

            if not candidates:
                results["errors"].append({
                    "slot": slot_num,
                    "error": "No candidates available",
                })
                continue

            # Select best story using Claude
            selected = _select_story_for_slot(
                client=client,
                slot_num=slot_num,
                candidates=candidates,
                selected_companies=selected_companies,
                selected_sources=selected_sources,
                yesterday_companies=yesterday_companies,
                yesterday_slot1_company=yesterday_slot1_company if slot_num == 1 else None,
            )

            if selected:
                story_id = selected.get('storyID')
                selected_story_ids.add(story_id)

                # Extract company/source for tracking
                company = selected.get('company', '')
                source = selected.get('source_id', '')
                if company:
                    selected_companies.add(company)
                if source:
                    selected_sources.add(source)

                results["slots"][slot_num] = {
                    "storyId": story_id,
                    "pivotId": selected.get('pivotId'),
                    "headline": selected.get('headline'),
                    "company": company,
                    "source": source,
                }

        except Exception as e:
            results["errors"].append({
                "slot": slot_num,
                "error": str(e),
            })

    # Generate subject line
    try:
        results["subject_line"] = _generate_subject_line(
            client=client,
            selected_slots=results["slots"],
        )
    except Exception as e:
        results["errors"].append({
            "subject_line": str(e),
        })

    # Write to Selected Slots table
    airtable.create_selected_slots(results)

    results["completed_at"] = datetime.now().isoformat()
    print(f"[Step 2] Slot selection complete: {len(results['slots'])} slots filled")

    return results


def _select_story_for_slot(
    client: anthropic.Anthropic,
    slot_num: int,
    candidates: List[Dict[str, Any]],
    selected_companies: Set[str],
    selected_sources: Set[str],
    yesterday_companies: Set[str],
    yesterday_slot1_company: str = None,
) -> Dict[str, Any]:
    """
    Use Claude to select the best story for a slot.

    Args:
        client: Anthropic client
        slot_num: Slot number (1-5)
        candidates: List of candidate stories
        selected_companies: Companies already selected today
        selected_sources: Sources already selected today
        yesterday_companies: Companies from yesterday's issue
        yesterday_slot1_company: Company from yesterday's slot 1 (for slot 1 only)

    Returns:
        Selected story dict or None
    """
    slot_focus = {
        1: "AI impact on jobs, economy, stock market, or broad societal impact. Choose the most impactful, urgent story.",
        2: "Tier 1 AI companies (OpenAI, Google, Meta, NVIDIA, Microsoft, Anthropic, xAI, Amazon) plus economic themes and research. Choose the most significant announcement or development.",
        3: "Industry impact across sectors like Healthcare, Government, Education, Legal, Manufacturing. Choose the story with clearest real-world implications.",
        4: "Emerging companies - product launches, fundraising, acquisitions, new AI tools. Choose the most promising or disruptive story.",
        5: "Consumer AI and human interest - ethics, entertainment, societal impact, fun or quirky uses. Choose the most engaging, shareable story.",
    }

    # Build candidates text
    candidates_text = ""
    for i, c in enumerate(candidates[:15], 1):  # Limit to 15 candidates
        candidates_text += f"""
{i}. ID: {c.get('storyID')}
   Headline: {c.get('headline', 'N/A')}
   Source: {c.get('source_id', 'unknown')}
   Company: {c.get('company', 'N/A')}
   Summary: {c.get('ai_dek', '')[:200]}
"""

    # Build exclusion rules
    exclusions = []
    if selected_companies:
        exclusions.append(f"Already selected companies today: {', '.join(selected_companies)}")
    if selected_sources and len([s for s in candidates if s.get('source_id') in selected_sources]) >= 2:
        exclusions.append(f"Sources at 2/day limit: {', '.join(selected_sources)}")
    if slot_num == 1 and yesterday_slot1_company:
        exclusions.append(f"Yesterday's Slot 1 company (avoid for 2-day rotation): {yesterday_slot1_company}")

    exclusions_text = "\n".join(exclusions) if exclusions else "None"

    prompt = f"""You are an AI newsletter editor selecting the best story for Slot {slot_num}.

SLOT {slot_num} FOCUS: {slot_focus[slot_num]}

CANDIDATES:
{candidates_text}

EXCLUSION RULES:
{exclusions_text}

EDITORIAL GUIDELINES:
1. Each company should appear at most once across all 5 slots
2. Maximum 2 stories per source per day
3. Prefer stories with clear, specific impact over vague announcements
4. Prioritize breaking news and exclusive information

Select the single best story for this slot. Return ONLY the story ID (e.g., "recXYZ123").
If no suitable story exists, return "NONE"."""

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )

    selected_id = response.content[0].text.strip()

    if selected_id == "NONE":
        return None

    # Find the selected story in candidates
    for c in candidates:
        if c.get('storyID') == selected_id:
            return c

    return None


def _generate_subject_line(
    client: anthropic.Anthropic,
    selected_slots: Dict[int, Dict[str, Any]],
) -> str:
    """
    Generate an email subject line based on selected stories.

    Args:
        client: Anthropic client
        selected_slots: Dict of slot number to story data

    Returns:
        Subject line string
    """
    headlines = []
    for slot_num in range(1, 6):
        if slot_num in selected_slots:
            headlines.append(f"Slot {slot_num}: {selected_slots[slot_num].get('headline', 'TBD')}")

    prompt = f"""Generate a compelling email subject line for the Pivot 5 AI newsletter.

TODAY'S STORIES:
{chr(10).join(headlines)}

GUIDELINES:
- Maximum 60 characters
- Lead with the most impactful story
- Use active voice
- Create urgency without being clickbait
- Reference specific companies/developments when possible

Return ONLY the subject line, no quotes or explanation."""

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text.strip()
