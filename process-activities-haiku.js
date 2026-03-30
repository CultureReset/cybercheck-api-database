// ============================================================
// Process activities with Claude Haiku before seeding
// Organizes data, extracts highlights, cleans descriptions
// ============================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');

const client = new Anthropic();
const ACTIVITIES_DIR = '/Users/owner/build-main/activities';

async function processActivity(data) {
    const prompt = `Process this activity data and return ONLY valid JSON (no markdown, no explanations). Extract and organize:

{
  "title": "${data.title || ''}",
  "category": "${data.category || ''}",
  "description": "${(data.description || '').substring(0, 200)}",
  "rating": ${data.rating ? parseFloat(data.rating) : 'null'},
  "review_count": ${data.review_count || 0},
  "url": "${data.url || ''}",
  "images": ${JSON.stringify(data.images || [])}
}

Return ONLY the JSON object, nothing else. Fix any issues with the data.`;

    try {
        const message = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }]
        });

        let text = message.content[0].type === 'text' ? message.content[0].text : '{}';
        // Remove markdown code blocks if present
        text = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const cleaned = JSON.parse(text);
        return cleaned;
    } catch (e) {
        console.log(`  ⚠️  Haiku error: ${e.message}, using raw data`);
        return data;
    }
}

async function processAll() {
    console.log('🤖 Processing activities with Haiku...\n');

    const folders = fs.readdirSync(ACTIVITIES_DIR).filter(f => !f.startsWith('.'));
    let processed = 0;

    for (const folder of folders) {
        const dataPath = path.join(ACTIVITIES_DIR, folder, 'data.json');
        if (!fs.existsSync(dataPath)) continue;

        try {
            const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            console.log(`Processing: ${raw.title?.substring(0, 50)}...`);

            const cleaned = await processActivity(raw);

            // Save cleaned version
            const cleanPath = path.join(ACTIVITIES_DIR, folder, 'data-cleaned.json');
            fs.writeFileSync(cleanPath, JSON.stringify(cleaned, null, 2));

            processed++;
            console.log(`  ✅ Cleaned`);
        } catch (e) {
            console.log(`  ❌ Failed: ${e.message}`);
        }
    }

    console.log(`\n✨ Processed ${processed} activities. Ready to seed!`);
    console.log('Next: node migrations/seed-activities.js');
}

processAll().catch(e => console.error('Fatal error:', e.message));
