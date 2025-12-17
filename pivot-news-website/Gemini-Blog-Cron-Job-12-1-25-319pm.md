# Gemini Blog Generation Cron Job Documentation

**Date Created:** December 1, 2025, 3:19 PM
**Status:** Deployed, awaiting testing

---

## Overview

This document describes the automatic blog story generation system that uses Google Gemini 3 Pro Preview to transform raw newsletter content into 500-800 word blog posts. The system runs as a Vercel cron job.

---

## Architecture

### Data Flow

```
Airtable (P5 Social Posts)          Vercel Cron Job              Gemini API
        |                                 |                           |
        |  1. Record status = "ready"     |                           |
        |  2. Blog Post Raw is empty      |                           |
        |                                 |                           |
        |<------ 3. Fetch records --------|                           |
        |                                 |                           |
        |                                 |------- 4. Generate ------>|
        |                                 |<------ 5. Story ----------|
        |                                 |                           |
        |<------ 6. Save to record -------|                           |
```

### Components

1. **Airtable Base:** P5 Social Posts (`appRUgK44hQnXH1PM`)
2. **Table:** Social Post Input
3. **Cron Endpoint:** `/api/cron/generate-stories`
4. **Gemini Model:** `gemini-3-pro-preview`
5. **Schedule:** Daily at 6 AM UTC (`0 6 * * *`)

---

## Files Created/Modified

### 1. Cron Route
**File:** `src/app/api/cron/generate-stories/route.ts`

This is the main cron job handler. Key logic:

```typescript
// Filter: Only "ready" status with empty Blog Post Raw
const filterFormula = encodeURIComponent(
  `AND({publish_status}="ready",OR({Blog Post Raw}="",{Blog Post Raw}=BLANK()))`
);
```

```typescript
// Gemini API call using gemini-3-pro-preview
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
  ...
);
```

**What it does:**
1. Fetches up to 5 records from Airtable where:
   - `publish_status` = "ready"
   - `Blog Post Raw` is empty or blank
2. For each record, builds a prompt from Headline + Bullets + Raw Text
3. Calls Gemini 3 Pro Preview with a system prompt for newsletter-style writing
4. Saves the generated story back to the `Blog Post Raw` field
5. Returns a JSON response with processing results

### 2. Vercel Configuration
**File:** `vercel.json`

```json
{
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/generate-stories",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Note:** Vercel Hobby plan only allows daily cron jobs (no hourly/minute intervals).

### 3. Homepage Loading Spinner
**File:** `src/app/page.tsx`

Added a loading spinner that displays while posts are being fetched from Airtable:

```tsx
{loading && (
  <div className="flex flex-col items-center justify-center py-20">
    <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
    <p className="mt-4 text-sm text-slate-500">Loading stories...</p>
  </div>
)}
```

---

## Environment Variables Required

In Vercel Dashboard (Settings > Environment Variables):

| Variable | Value | Notes |
|----------|-------|-------|
| `GEMINI_API_KEY` | Your Gemini API key | Get from [Google AI Studio](https://aistudio.google.com/apikey) |
| `NEXT_PUBLIC_AIRTABLE_TOKEN` | Your Airtable token | Already configured |

---

## Airtable Field Requirements

The cron job expects these fields in the "Social Post Input" table:

| Field Name | Type | Required | Purpose |
|------------|------|----------|---------|
| `Headline` | Single line text | Yes | Used in prompt |
| `Raw Text` | Long text | Yes | Source material for story |
| `Bullets` | Long text | No | Additional key points |
| `Blog Post Raw` | Long text | Yes (output) | Where generated story is saved |
| `publish_status` | Single select | Yes | Must be "ready" to trigger |

---

## Why I Believe This Will Work

### 1. Proven Pattern
The `/api/generate-story/route.ts` endpoint already works - we used it earlier today to regenerate all 5 Dec 1 stories. The cron job uses the exact same:
- Gemini API call structure
- System prompt
- Airtable save logic

### 2. Correct Model
The cron route now uses `gemini-3-pro-preview` (verified in the code at line 75).

### 3. Correct Filter Logic
The Airtable filter only selects records where:
- `publish_status = "ready"` (not "Published")
- `Blog Post Raw` is empty

This means:
- It won't overwrite existing stories
- It only processes records explicitly marked as ready
- It's idempotent (safe to run multiple times)

### 4. Error Handling
The cron job:
- Continues processing other records if one fails
- Returns detailed results for each record
- Logs errors to Vercel console

### 5. Rate Limiting Protection
There's a 1-second delay between Gemini API calls to avoid rate limiting:

```typescript
await new Promise((resolve) => setTimeout(resolve, 1000));
```

---

## Potential Issues to Watch For

### 1. Gemini API Key
- Make sure `GEMINI_API_KEY` is set in Vercel environment variables
- Verify the key has access to `gemini-3-pro-preview` model
- Check API quota limits

### 2. Airtable Token Permissions
- The token needs read AND write access to the P5 Social Posts base
- Check `NEXT_PUBLIC_AIRTABLE_TOKEN` is set correctly

### 3. Model Availability
`gemini-3-pro-preview` is a preview model. If Google deprecates it, the API calls will fail. We may need to update to a different model name in the future.

### 4. Cron Timing
- Vercel Hobby plan: cron runs once daily at 6 AM UTC
- If you add many records throughout the day, they won't be processed until the next morning
- Workaround: Manually trigger the endpoint via browser/curl

### 5. Max Records Per Run
Currently limited to 5 records per cron run (`maxRecords=5`). If you have more than 5 pending records, it will take multiple days to process them all.

---

## Testing Checklist

### Pre-deployment
- [x] Code committed and pushed to GitHub
- [x] Vercel auto-deploy triggered
- [ ] `GEMINI_API_KEY` added to Vercel environment variables

### Manual Testing
To test without waiting for the cron schedule:

```bash
# Test the endpoint directly (after deployment)
curl https://pivotnews.com/api/cron/generate-stories
```

Expected responses:
- `{"message":"No pending records to process","processed":0}` - No records match criteria
- `{"message":"Processed X/Y records","processed":X,...}` - Records were processed
- `{"error":"GEMINI_API_KEY not configured"}` - Missing env var

### Verify in Airtable
1. Create a test record with:
   - Headline: "Test Story"
   - Raw Text: [some content]
   - publish_status: "ready"
   - Blog Post Raw: (leave empty)

2. Call the cron endpoint manually
3. Check if `Blog Post Raw` was populated

---

## Frontend Behavior

### Homepage (`/`)
- Shows cards for posts where `publish_status` is "Published" OR "ready"
- Displays: headline, bullets, image, label, date, source
- Shows loading spinner while fetching

### Post Detail Page (`/post/[slug]`)
- If `Blog Post Raw` exists: displays the generated story
- If `Blog Post Raw` is empty: falls back to `Raw Text`
- This means posts are viewable immediately, even before the cron generates the story

---

## Rollback Plan

If issues arise:

1. **Disable cron:** Remove the crons section from `vercel.json`
2. **Manual generation:** Use the existing `/api/generate-story` endpoint to generate stories one at a time
3. **Airtable automation:** Set up Airtable's native automation (requires Pro plan) using the script in `airtable-automation/generate-story-script.js`

---

## Summary

The system is designed to:
1. Automatically detect records ready for story generation
2. Use Gemini 3 Pro Preview to create newsletter-style content
3. Save results back to Airtable without manual intervention
4. Run daily at 6 AM UTC

The frontend will show cards immediately when status is set to "ready", and the full blog story will be available after the cron runs (or can be triggered manually).
