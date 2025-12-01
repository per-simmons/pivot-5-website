# Airtable Automation Setup for Story Generation

This guide explains how to set up automatic story generation when posts are published in Airtable.

## Overview

When a post is marked as "Published" in Airtable, an automation can trigger the story generation API to create the "Here's the Full Story" content using Google Gemini.

## Prerequisites

- Airtable Pro or higher (for Automations with webhooks)
- The p5-dashboard deployed to Vercel (or running locally for testing)
- The "Blog Post Raw" column exists in your Social Post Input table

## Setup Steps

### 1. Open Airtable Automations

1. Go to your Airtable base: `appRUgK44hQnXH1PM`
2. Click **Automations** in the top-right corner
3. Click **+ Create automation**

### 2. Configure the Trigger

**Trigger Type:** When a record matches conditions

**Conditions:**
- `Status` is `Published`
- `Blog Post Raw` is empty
- `Headline` is not empty
- `Raw` is not empty

This ensures the automation only fires for newly published posts that don't already have a generated story.

### 3. Add the Webhook Action

**Action Type:** Send a webhook (POST request)

**Webhook URL:**
```
https://your-vercel-domain.vercel.app/api/generate-story
```

For local testing:
```
http://localhost:3002/api/generate-story
```

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "recordId": "{Record ID}",
  "headline": "{Headline}",
  "rawText": "{Raw}",
  "bullets": ["{B1}", "{B2}", "{B3}"]
}
```

Replace the `{Field Name}` placeholders with Airtable's dynamic field references by clicking the **+** button and selecting the appropriate fields.

### 4. Test the Automation

1. Click **Test** in the automation editor
2. Select a recently published record
3. Verify the webhook returns successfully
4. Check that `Blog Post Raw` is populated in Airtable

### 5. Activate the Automation

Once tested, toggle the automation **On** to activate it.

## API Endpoints Reference

### Single Post Generation
```
POST /api/generate-story
```

**Body:**
```json
{
  "recordId": "recXXXXXXXXXXXX",
  "headline": "Post headline here",
  "rawText": "Source material text...",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"]
}
```

**Response:**
```json
{
  "story": "Generated story content...",
  "saved": true,
  "recordId": "recXXXXXXXXXXXX"
}
```

### Batch Generation (Manual)
```
POST /api/generate-stories
```

**Body:**
```json
{
  "date": "2025-12-01"
}
```

**Response:**
```json
{
  "date": "2025-12-01",
  "processed": 5,
  "successful": 5,
  "failed": 0,
  "results": [...]
}
```

## Troubleshooting

### Stories not generating

1. Check that the record has `Status = "Published"`
2. Verify `Headline` and `Raw` fields are populated
3. Confirm `Blog Post Raw` is empty (won't regenerate existing stories)
4. Check Airtable automation run history for errors

### API Errors

- **403 Forbidden**: Check Airtable token has write permissions
- **500 Internal Server Error**: Verify `GEMINI_API_KEY` is set in environment
- **Rate limit errors**: Wait 1 minute (Gemini free tier: 15 req/min)

## Rate Limits

- **Gemini 2.0 Flash**: 15 requests/minute, 1M tokens/month (free tier)
- **Airtable API**: 5 requests/second
- The batch endpoint includes a 4.5s delay between stories to respect limits

## Environment Variables Required

```env
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_AIRTABLE_TOKEN=your_airtable_token
NEXT_PUBLIC_AIRTABLE_BASE_ID=appRUgK44hQnXH1PM
NEXT_PUBLIC_AIRTABLE_TABLE=Social Post Input
```
