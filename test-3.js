require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const fs = require('fs');
const path = require('path');
const { Anthropic } = require('@anthropic-ai/sdk');

const client = new Anthropic();

async function processActivity(data) {
    const prompt = `Return ONLY valid JSON (no markdown, no backticks):
{
  "title": "${(data.title || '').replace(/"/g, '\\"').substring(0, 100)}",
  "category": "${(data.category || '').substring(0, 50)}",
  "description": "${(data.description || '').replace(/"/g, '\\"').substring(0, 200)}",
  "rating": ${data.rating ? parseFloat(data.rating) : null},
  "review_count": ${parseInt(data.review_count) || 0}
}`;

    const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
    });

    let text = message.content[0].text.trim();
    // Remove markdown code blocks if present
    text = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    
    return JSON.parse(text);
}

async function testThree() {
    const ACTIVITIES_DIR = '/Users/owner/build-main/activities';
    const folders = fs.readdirSync(ACTIVITIES_DIR).filter(f => !f.startsWith('.')).slice(0, 3);

    console.log('Testing Haiku processor on 3 activities...\n');

    for (const folder of folders) {
        const dataPath = path.join(ACTIVITIES_DIR, folder, 'data.json');
        if (!fs.existsSync(dataPath)) continue;

        const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log(`\n📝 Processing: ${raw.title?.substring(0, 50)}...`);
        
        const cleaned = await processActivity(raw);
        console.log(`✅ Clean title: ${cleaned.title}`);
        console.log(`   Category: ${cleaned.category}`);
        console.log(`   Rating: ${cleaned.rating} stars (${cleaned.review_count} reviews)`);
    }

    console.log('\n✨ Processor works! Ready for all 56.');
}

testThree().catch(e => console.error('Error:', e.message));
