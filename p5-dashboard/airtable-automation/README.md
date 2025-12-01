# Airtable Automation: Auto-Generate Blog Stories

This automation automatically generates blog stories using Google Gemini when new records are added to the P5 Social Posts Airtable base.

## Prerequisites

- Access to the **P5 Social Posts** Airtable base (ID: `appRUgK44hQnXH1PM`)
- A Google Gemini API key (same one used in the dashboard)
- Airtable Pro or higher plan (required for Automations with scripts)

## Setup Instructions

### Step 1: Open the P5 Social Posts Base

Go to [airtable.com](https://airtable.com) and open the **P5 Social Posts** base.

### Step 2: Create a New Automation

1. Click on **Automations** in the top-right corner of the base
2. Click **Create automation**
3. Name it: `Auto-Generate Blog Story`

### Step 3: Configure the Trigger

Choose one of these trigger options:

**Option A: When record is created**
- Click **Add trigger**
- Select **When record is created**
- Table: `Social Post Input`

**Option B: When record matches conditions (recommended)**
- Click **Add trigger**
- Select **When record matches conditions**
- Table: `Social Post Input`
- Conditions:
  - `publish_status` is `ready`
  - `Blog Post Raw` is empty

### Step 4: Add the Script Action

1. Click **Add action**
2. Select **Run script**
3. Click **Expand** to open the full script editor

### Step 5: Configure Input Variables

Click **Add input variable** for each of these:

| Variable Name | Type | Field |
|---------------|------|-------|
| `recordId` | Record ID | (The record that triggered the automation) |
| `headline` | Text | Headline |
| `rawText` | Text | Raw Text |
| `bullets` | Text | Bullets |
| `blogPostRaw` | Text | Blog Post Raw |

To add each variable:
1. Click **Add input variable**
2. Enter the variable name (e.g., `recordId`)
3. For `recordId`: Select "Record ID" from the trigger
4. For other fields: Select the corresponding field from the trigger record

### Step 6: Paste the Script

1. Copy the entire contents of `generate-story-script.js`
2. Paste it into the script editor in Airtable
3. **Important**: Replace `YOUR_GEMINI_API_KEY_HERE` with your actual Gemini API key

### Step 7: Test the Automation

1. Click **Test action** in the script editor
2. Select a test record that has:
   - A headline
   - Raw text content
   - An empty "Blog Post Raw" field
3. Verify the script runs successfully and generates a story

### Step 8: Enable the Automation

1. Click the toggle in the top-right to enable the automation
2. The automation is now live!

## How It Works

1. When a record is created (or matches conditions), the automation triggers
2. The script checks if "Blog Post Raw" is already filled (skips if so)
3. The script sends the headline, bullets, and raw text to Gemini 3 Pro Preview
4. Gemini generates a 500-800 word blog-style story
5. The story is saved back to the "Blog Post Raw" field

## Troubleshooting

### "Blog Post Raw already exists"
This is normal - the script skips records that already have content to avoid overwriting.

### "Missing required fields"
The record needs both a Headline and Raw Text to generate a story.

### Gemini API Errors
- Verify your API key is correct
- Check that you have API quota remaining
- Ensure the key has access to `gemini-3-pro-preview`

### Script timeout
Airtable scripts have a 30-second timeout. The Gemini call typically takes 5-15 seconds, so this shouldn't be an issue. If it times out, try again - it may be a temporary API slowdown.

## Gemini API Key

Your Gemini API key is: Check `.env.local` in the p5-dashboard project or get a new one from [Google AI Studio](https://aistudio.google.com/apikey).

## Field Requirements

The automation expects these fields in the "Social Post Input" table:

| Field Name | Type | Required |
|------------|------|----------|
| Headline | Single line text | Yes |
| Raw Text | Long text | Yes |
| Bullets | Long text | No |
| Blog Post Raw | Long text | Yes (output) |
| publish_status | Single select | For condition trigger |
