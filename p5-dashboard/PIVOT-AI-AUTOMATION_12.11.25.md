# Pivot AI Blog Post Generation Automation

## Overview

When a new record is created in the Pivot AI Airtable, it automatically generates a full blog post using Google Gemini and saves it back to Airtable.

## Architecture

```
[New Record Created in Airtable]
          ↓
[Airtable Automation Trigger]
          ↓
[Run Script Action]
          ↓
[Call pivotnews.com/api/generate-story]
          ↓
[Gemini generates 500-800 word story]
          ↓
[Story saved to blog_post_raw field]
```

## Airtable Configuration

- **Base ID:** `appwSozYTkrsQWUXB`
- **Table ID:** `tblaHcFFG6Iw3w7lL`
- **Output Field:** `blog_post_raw`

## Airtable Automation Setup

### Trigger
- **Type:** When a record is created
- **Table:** Pivot AI stories table

### Action: Run Script

```javascript
// Pivot AI Blog Post Generator
// Triggers when a new record is created and generates a full story

// Input config: recordId = Record ID from trigger
const recordId = input.config().recordId;

const response = await fetch('https://pivotnews.com/api/generate-story', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ recordId })
});

const result = await response.json();
console.log(`Generated ${result.wordCount || 0} words, saved: ${result.saved}`);
output.set('result', result);
```

### Input Configuration
- **recordId:** Link to "Record ID" from the trigger step

## API Endpoint Details

**Endpoint:** `POST https://pivotnews.com/api/generate-story`

**Request Body:**
```json
{
  "recordId": "recXXXXXXXXXXXXXX"
}
```

**Response:**
```json
{
  "success": true,
  "story": "Generated story text...",
  "saved": true,
  "recordId": "recXXXXXXXXXXXXXX",
  "headline": "Story headline",
  "wordCount": 650
}
```

## Source Fields Used

The API reads these fields from the Airtable record:
- `ai_headline` - The headline for the story
- `markdown (from story_link)` - Source material (lookup field)
- `bullet_1`, `bullet_2`, `bullet_3` - Key points

## Generated Content

- **Model:** Google Gemini 3 Pro Preview (`gemini-3-pro-preview`)
- **Word Count:** 500-800 words minimum
- **Style:** Conversational but professional newsletter tone
- **Structure:** Opening hook, 4-6 body paragraphs, forward-looking closing

## Environment Variables Required

```
GEMINI_API_KEY=your_gemini_api_key
AIRTABLE_TOKEN=your_airtable_token
```

## Backup: Daily Cron Job

In addition to the real-time Airtable automation, there's a daily cron job as backup:

- **Schedule:** 6 AM UTC daily
- **Endpoint:** `/api/cron/generate-stories`
- **Processes:** Up to 5 records per run that have `date_og_published` set but no `blog_post_raw`

## Files

- `/src/app/api/generate-story/route.ts` - Main API endpoint
- `/src/app/api/cron/generate-stories/route.ts` - Backup cron endpoint
- `/vercel.json` - Cron configuration

## Troubleshooting

### Story not generating
1. Check if `ai_headline` and `markdown (from story_link)` fields are populated
2. Check Airtable automation run history for errors
3. Verify GEMINI_API_KEY is valid

### Story generated but not saved
1. Check if `blog_post_raw` field exists in Airtable table
2. Verify AIRTABLE_TOKEN has write permissions
3. Check API response for `saveError` field

## Last Updated
December 11, 2025
