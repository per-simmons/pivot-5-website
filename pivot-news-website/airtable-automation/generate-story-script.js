/**
 * Airtable Automation Script: Auto-Generate Blog Story
 *
 * This script runs when a record is created or updated in the "Social Post Input" table.
 * It uses Google Gemini to generate a blog-style story from the raw text and bullets.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a new Automation in the P5 Social Posts base
 * 2. Trigger: "When record is created" or "When record matches conditions"
 *    - For conditions, set: publish_status = "ready" AND Blog Post Raw is empty
 * 3. Add Action: "Run script"
 * 4. Copy this entire script into the script action
 * 5. Configure Input Variables (click "Add input variable" for each):
 *    - recordId: Record ID from the trigger
 *    - headline: Field "Headline" from the trigger record
 *    - rawText: Field "Raw Text" from the trigger record
 *    - bullets: Field "Bullets" from the trigger record (if available)
 *    - blogPostRaw: Field "Blog Post Raw" from the trigger record
 * 6. Add your Gemini API key in the GEMINI_API_KEY constant below
 */

// ============= CONFIGURATION =============
// Replace with your actual Gemini API key
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// System prompt for story generation
const SYSTEM_PROMPT = `You are a skilled newsletter writer for "Pivot 5," a daily business and technology newsletter that delivers 5 headlines in 5 minutes, 5 days a week.

Transform the provided source material into an engaging blog-style story. Your story MUST be at least 500 words and can be up to 800 words. This is a firm requirement - do not write less than 500 words.

Structure your story with:
- A compelling opening paragraph that hooks the reader with the most important or surprising information
- 4-6 body paragraphs that explore different aspects of the story
- Context and background to help readers understand the significance
- Specific details, numbers, and quotes pulled directly from the source material
- Analysis of why this matters to busy professionals
- A forward-looking closing paragraph with insights or implications

Writing style:
- Conversational but professional tone
- Keep paragraphs short (2-3 sentences) for easy scanning
- Use transitions between paragraphs for smooth flow

IMPORTANT: Only use facts and information from the provided source material. Do not make up statistics, quotes, or details. If the source doesn't provide enough detail on a topic, focus on what IS provided rather than speculating.

Do NOT include:
- A headline (displayed separately)
- Bullet points (shown separately)
- Phrases like "In conclusion" or "To summarize"
- Promotional language or calls to action
- Information not found in the source material

Write as flowing prose paragraphs only. Remember: minimum 500 words.`;

// ============= MAIN SCRIPT =============

// Get input variables from the automation trigger
const inputConfig = input.config();
const { recordId, headline, rawText, bullets, blogPostRaw } = inputConfig;

// Skip if blog post already exists
if (blogPostRaw && blogPostRaw.trim().length > 0) {
    console.log(`Skipping record ${recordId}: Blog Post Raw already exists`);
    output.set("status", "skipped");
    output.set("message", "Blog post already exists");
} else if (!headline || !rawText) {
    console.log(`Skipping record ${recordId}: Missing headline or rawText`);
    output.set("status", "error");
    output.set("message", "Missing required fields: headline or rawText");
} else {
    // Build the prompt
    let bulletText = "";
    if (bullets && bullets.length > 0) {
        // Handle bullets as either string or array
        if (Array.isArray(bullets)) {
            bulletText = `\n\nKey points:\n${bullets.map(b => `- ${b}`).join("\n")}`;
        } else if (typeof bullets === "string" && bullets.trim()) {
            // If it's a string, split by newlines
            bulletText = `\n\nKey points:\n${bullets}`;
        }
    }

    const prompt = `Headline: ${headline}${bulletText}

Source material:
${rawText}`;

    try {
        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                    systemInstruction: {
                        parts: [
                            {
                                text: SYSTEM_PROMPT,
                            },
                        ],
                    },
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const generatedStory = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedStory) {
            throw new Error("No text generated from Gemini");
        }

        // Update the record with the generated story
        const table = base.getTable("Social Post Input");
        await table.updateRecordAsync(recordId, {
            "Blog Post Raw": generatedStory.trim(),
        });

        const wordCount = generatedStory.trim().split(/\s+/).length;
        console.log(`Successfully generated story for record ${recordId}: ${wordCount} words`);

        output.set("status", "success");
        output.set("message", `Generated ${wordCount} word story`);
        output.set("wordCount", wordCount);

    } catch (error) {
        console.error(`Error generating story for record ${recordId}:`, error);
        output.set("status", "error");
        output.set("message", error.message || "Unknown error");
    }
}
