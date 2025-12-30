"""
Airtable Client for AI Editor 2.0

Wraps pyairtable for accessing Pivot Media Airtable bases.
"""

import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pyairtable import Api, Table


class AirtableClient:
    """
    Client for interacting with Pivot Media Airtable bases.

    Bases:
    - Pivot Media Master (appwSozYTkrsQWUXB): Articles, Newsletter Stories, Issues
    - AI Editor 2.0 (appglKSJZxmA9iHpl): Pre-Filter Log, Selected Slots, Decoration
    """

    def __init__(self):
        self.api_key = os.getenv('AIRTABLE_API_KEY')
        if not self.api_key:
            raise ValueError("AIRTABLE_API_KEY not set")

        self.api = Api(self.api_key)

        # Pivot Media Master base
        self.master_base_id = os.getenv('AIRTABLE_BASE_ID', 'appwSozYTkrsQWUXB')
        self.articles_table_id = os.getenv('AIRTABLE_ARTICLES_TABLE', 'tblGumae8KDpsrWvh')
        self.stories_table_id = os.getenv('AIRTABLE_NEWSLETTER_STORIES_TABLE', 'tblY78ziWp5yhiGXp')
        self.issues_table_id = os.getenv('AIRTABLE_NEWSLETTER_ISSUES_TABLE', 'tbl7mcCCGbjEfli25')
        self.archive_table_id = os.getenv('AIRTABLE_NEWSLETTER_ISSUES_ARCHIVE_TABLE', 'tblHo0xNj8nbzMHNI')

        # AI Editor 2.0 base
        self.editor_base_id = os.getenv('AI_EDITOR_BASE_ID', 'appglKSJZxmA9iHpl')
        self.prefilter_table_id = os.getenv('AI_EDITOR_PREFILTER_LOG_TABLE', 'tbl72YMsm9iRHj3sp')
        self.slots_table_id = os.getenv('AI_EDITOR_SELECTED_SLOTS_TABLE', 'tblzt2z7r512Kto3O')
        self.decoration_table_id = os.getenv('AI_EDITOR_DECORATION_TABLE', 'tbla16LJCf5Z6cRn3')
        self.source_scores_table_id = os.getenv('AI_EDITOR_SOURCE_SCORES_TABLE', 'tbl3Zkdl1No2edDLK')

        # P5 Social Posts base (separate)
        self.social_base_id = os.getenv('P5_SOCIAL_BASE_ID', 'appRUgK44hQnXH1PM')
        self.social_posts_table_id = os.getenv('P5_SOCIAL_POSTS_TABLE', 'Social Post Input')

    def _get_table(self, base_id: str, table_id: str) -> Table:
        """Get a table instance."""
        return self.api.table(base_id, table_id)

    # === Articles Table (Pivot Media Master) ===

    def get_article_by_pivot_id(self, pivot_id: str) -> Optional[Dict[str, Any]]:
        """Get article by pivot_Id."""
        table = self._get_table(self.master_base_id, self.articles_table_id)
        records = table.all(formula=f"{{pivot_Id}} = '{pivot_id}'", max_records=1)
        return records[0]['fields'] if records else None

    # === Newsletter Stories Table (Pivot Media Master) ===

    def get_newsletter_stories(self, since_date: str = None) -> List[Dict[str, Any]]:
        """Get newsletter stories, optionally filtered by date."""
        table = self._get_table(self.master_base_id, self.stories_table_id)

        formula = None
        if since_date:
            formula = f"IS_AFTER({{date_og_published}}, '{since_date}')"

        records = table.all(formula=formula)
        return [{'id': r['id'], **r['fields']} for r in records]

    # === Pre-Filter Log Table (AI Editor 2.0) ===

    def create_prefilter_log(self, data: Dict[str, Any]) -> str:
        """Create a pre-filter log entry."""
        table = self._get_table(self.editor_base_id, self.prefilter_table_id)
        record = table.create(data)
        return record['id']

    def get_prefilter_candidates(self, slot: int, date: str = None) -> List[Dict[str, Any]]:
        """Get pre-filter candidates for a slot."""
        table = self._get_table(self.editor_base_id, self.prefilter_table_id)

        if not date:
            date = datetime.now().strftime('%Y-%m-%d')

        formula = f"AND({{slot}} = {slot}, {{date_prefiltered}} = '{date}')"
        records = table.all(formula=formula)
        return [{'id': r['id'], **r['fields']} for r in records]

    # === Selected Slots Table (AI Editor 2.0) ===

    def create_selected_slots(self, data: Dict[str, Any]) -> str:
        """Create a selected slots record."""
        table = self._get_table(self.editor_base_id, self.slots_table_id)

        # Flatten slots data for Airtable
        airtable_data = {
            "issue_date": data.get("issue_date"),
            "subject_line": data.get("subject_line"),
        }

        for slot_num, slot_data in data.get("slots", {}).items():
            airtable_data[f"slot_{slot_num}_headline"] = slot_data.get("headline")
            airtable_data[f"slot_{slot_num}_storyId"] = slot_data.get("storyId")
            airtable_data[f"slot_{slot_num}_pivotId"] = slot_data.get("pivotId")

        record = table.create(airtable_data)
        return record['id']

    def get_yesterday_selected_stories(self) -> List[Dict[str, Any]]:
        """Get yesterday's selected stories."""
        table = self._get_table(self.editor_base_id, self.slots_table_id)

        yesterday = (datetime.now() - timedelta(days=1)).strftime('%b %d')
        formula = f"SEARCH('{yesterday}', {{issue_date}})"

        records = table.all(formula=formula, max_records=1)
        if not records:
            return []

        # Extract stories from the flattened format
        fields = records[0]['fields']
        stories = []
        for i in range(1, 6):
            if fields.get(f'slot_{i}_storyId'):
                stories.append({
                    'storyID': fields.get(f'slot_{i}_storyId'),
                    'headline': fields.get(f'slot_{i}_headline'),
                    'pivotId': fields.get(f'slot_{i}_pivotId'),
                    'slot': i,
                })
        return stories

    def get_today_selected_slots(self) -> Dict[str, Any]:
        """Get today's selected slots."""
        table = self._get_table(self.editor_base_id, self.slots_table_id)

        today = datetime.now().strftime('%b %d')
        formula = f"SEARCH('{today}', {{issue_date}})"

        records = table.all(formula=formula, max_records=1)
        return records[0]['fields'] if records else {}

    # === Source Scores Table (AI Editor 2.0) ===

    def get_source_scores(self) -> Dict[str, int]:
        """Get all source credibility scores as a dict."""
        table = self._get_table(self.editor_base_id, self.source_scores_table_id)
        records = table.all()

        scores = {}
        for r in records:
            name = r['fields'].get('source_name', '')
            score = r['fields'].get('credibility_score', 3)
            if name:
                scores[name] = score

        return scores

    def update_source_score(self, source_name: str, score: int) -> None:
        """Update or create a source credibility score."""
        table = self._get_table(self.editor_base_id, self.source_scores_table_id)

        # Find existing record
        records = table.all(formula=f"{{source_name}} = '{source_name}'", max_records=1)

        if records:
            table.update(records[0]['id'], {'credibility_score': score})
        else:
            table.create({'source_name': source_name, 'credibility_score': score})

    # === Decoration Table (AI Editor 2.0) ===

    def create_decoration_record(self, data: Dict[str, Any]) -> str:
        """Create a decoration record."""
        table = self._get_table(self.editor_base_id, self.decoration_table_id)
        record = table.create(data)
        return record['id']

    def update_decoration_image(self, story_id: str, image_url: str) -> None:
        """Update decoration record with image URL."""
        table = self._get_table(self.editor_base_id, self.decoration_table_id)

        records = table.all(formula=f"{{storyID}} = '{story_id}'", max_records=1)
        if records:
            table.update(records[0]['id'], {
                'image_url': image_url,
                'image_status': 'generated',
            })

    def update_decoration_image_status(self, story_id: str, status: str) -> None:
        """Update decoration record image status."""
        table = self._get_table(self.editor_base_id, self.decoration_table_id)

        records = table.all(formula=f"{{storyID}} = '{story_id}'", max_records=1)
        if records:
            table.update(records[0]['id'], {'image_status': status})

    def get_decorated_stories_for_issue(self) -> List[Dict[str, Any]]:
        """Get decorated stories ready for newsletter compilation."""
        table = self._get_table(self.editor_base_id, self.decoration_table_id)

        today = datetime.now().strftime('%Y-%m-%d')
        formula = f"AND({{image_status}} = 'generated', IS_SAME({{created_at}}, '{today}', 'day'))"

        records = table.all(formula=formula)
        return [{'id': r['id'], **r['fields']} for r in records]

    # === Newsletter Issues Table (Pivot Media Master) ===

    def create_newsletter_issue(self, data: Dict[str, Any]) -> str:
        """Create a newsletter issue record."""
        table = self._get_table(self.master_base_id, self.issues_table_id)
        record = table.create(data)
        return record['id']

    def update_newsletter_issue_status(self, issue_id: str, status: str) -> None:
        """Update newsletter issue status."""
        table = self._get_table(self.master_base_id, self.issues_table_id)

        records = table.all(formula=f"{{issue_id}} = '{issue_id}'", max_records=1)
        if records:
            table.update(records[0]['id'], {'status': status})

    # === Archive Table (Pivot Media Master) ===

    def archive_newsletter_issue(self, issue_id: str, data: Dict[str, Any]) -> None:
        """Archive a newsletter issue with send results."""
        table = self._get_table(self.master_base_id, self.archive_table_id)
        table.create({
            'issue_id': issue_id,
            **data,
        })

    # === Social Posts (P5 Social) ===

    def social_post_exists(self, story_id: str) -> bool:
        """Check if a social post already exists for a story."""
        table = self._get_table(self.social_base_id, self.social_posts_table_id)
        records = table.all(formula=f"{{source_record_id}} = '{story_id}'", max_records=1)
        return len(records) > 0

    def create_social_post(self, data: Dict[str, Any]) -> str:
        """Create a social post record."""
        table = self._get_table(self.social_base_id, self.social_posts_table_id)
        record = table.create(data)
        return record['id']

    def get_stories_for_social_sync(self) -> List[Dict[str, Any]]:
        """Get decorated stories that need social sync."""
        table = self._get_table(self.editor_base_id, self.decoration_table_id)

        formula = "AND({image_status} = 'generated', OR({social_status} = '', {social_status} = BLANK()))"
        records = table.all(formula=formula)
        return [{'id': r['id'], **r['fields']} for r in records]

    def update_story_social_status(self, story_id: str, status: str) -> None:
        """Update story's social sync status."""
        table = self._get_table(self.editor_base_id, self.decoration_table_id)

        records = table.all(formula=f"{{storyID}} = '{story_id}'", max_records=1)
        if records:
            table.update(records[0]['id'], {'social_status': status})
