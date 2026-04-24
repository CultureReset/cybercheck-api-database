#!/usr/bin/env node
/**
 * Extract structured menu data from raw.json files using Claude Haiku
 * Runs on all scraped-menus folders that have raw.json but no data.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SCRAPED_DIR = path.join(__dirname, 'scraped-menus');

const MENU_KEYWORDS = ['menu','food','drink','appetizer','entree','dinner','lunch','breakfast',
  'seafood','pizza','burger','sandwich','salad','dessert','cocktail','beer','wine','happy hour'];

const EXTRACTION_PROMPT = `Extract structured data from this restaurant website text.

Return ONLY valid JSON with this exact structure:
{
  "business_name": "exact restaurant name",
  "contact": {
    "address": "street address",
    "city": "city name",
    "state": "AL",
    "zip": "zip code",
    "phone": "phone number"
  },
  "hours": {
    "monday": "11am-9pm or closed",
    "tuesday": "11am-9pm or closed",
    "wednesday": "11am-9pm or closed",
    "thursday": "11am-9pm or closed",
    "friday": "11am-10pm or closed",
    "saturday": "11am-10pm or closed",
    "sunday": "11am-9pm or closed"
  },
  "menu": {
    "categories": [
      {
        "name": "Category Name",
        "items": [
          {
            "name": "Item Name",
            "description": "description or null",
            "price": "$12.99 or null",
            "dietary": []
          }
        ]
      }
    ]
  },
  "happy_hour": {
    "available": true,
    "days": "Mon-Fri",
    "start_time": "3:00 PM",
    "end_time": "6:00 PM",
    "deals": "description of deals"
  },
  "specials": [
    { "name": "special name", "description": "details", "day": "Tuesday or null" }
  ],
  "about": {
    "description": "1-2 sentence description",
    "cuisine_type": "seafood/italian/mexican/etc"
  },
  "price_range": "$ or $$ or $$$ or $$$$",
  "tags": ["tag1","tag2"]
}

Rules:
- Extract ALL menu items with exact names and prices
- If no menu found, return empty categories array
- Use null for missing fields, never empty string
- Return ONLY the JSON, no explanation`;

function pickBestPages(pages, maxChars = 12000) {
  // Prioritize menu-related pages
  const scored = pages.map(p => {
    const url = (p.url || '').toLowerCase();
    const text = (p.text || '').trim();
    let score = 0;
    MENU_KEYWORDS.forEach(kw => {
      if (url.includes(kw)) score += 3;
      if (text.toLowerCase().includes(kw)) score += 1;
    });
    return { url, text, score };
  });
  scored.sort((a, b) => b.score - a.score);

  let combined = '';
  for (const p of scored) {
    if (!p.text || p.text.length < 100) continue;
    const snippet = `\n\n=== PAGE: ${p.url} ===\n${p.text.substring(0, 3000)}`;
    if (combined.length + snippet.length > maxChars) break;
    combined += snippet;
  }
  return combined;
}

async function extractFromRaw(folder) {
  const rawPath = path.join(SCRAPED_DIR, folder, 'raw.json');
  const dataPath = path.join(SCRAPED_DIR, folder, 'data.json');

  let raw;
  try { raw = JSON.parse(fs.readFileSync(rawPath, 'utf8')); }
  catch { return null; }

  const pages = raw.pages || [];
  const pdfText = (raw.pdfTexts || []).join('\n').substring(0, 3000);
  const pageText = pickBestPages(pages);
  const combined = pageText + (pdfText ? '\n\n=== PDF ===\n' + pdfText : '');

  if (combined.trim().length < 100) {
    console.log(`  SKIP (no usable text): ${folder}`);
    return null;
  }

  const resp = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: EXTRACTION_PROMPT + '\n\n' + combined }],
  });

  let text = resp.content[0].text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { data = JSON.parse(match[0]); }
      catch { console.log(`  PARSE ERROR: ${folder}`); return null; }
    } else {
      console.log(`  PARSE ERROR: ${folder}`);
      return null;
    }
  }

  // Add metadata
  data.url = raw.url;
  data.scraped_at = raw.scraped_at;
  data.extracted_at = new Date().toISOString();
  data.model = 'claude-haiku-4-5';

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return data;
}

async function run() {
  const folders = fs.readdirSync(SCRAPED_DIR).filter(f => {
    if (f.startsWith('_')) return false;
    const dir = path.join(SCRAPED_DIR, f);
    if (!fs.statSync(dir).isDirectory()) return false;
    const hasRaw  = fs.existsSync(path.join(dir, 'raw.json'));
    const hasData = fs.existsSync(path.join(dir, 'data.json'));
    return hasRaw && !hasData;
  });

  console.log(`\nExtracting ${folders.length} restaurants with Haiku...\n${'═'.repeat(60)}`);

  let done = 0, failed = 0;

  for (const folder of folders) {
    process.stdout.write(`[${done + failed + 1}/${folders.length}] ${folder}... `);
    try {
      const data = await extractFromRaw(folder);
      if (data) {
        const cats = (data.menu || {}).categories || [];
        const items = cats.reduce((n, c) => n + (c.items || []).length, 0);
        console.log(`✓ ${cats.length} sections, ${items} items`);
        done++;
      } else {
        failed++;
      }
    } catch (e) {
      console.log(`✗ ${e.message.substring(0, 60)}`);
      failed++;
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Done: ${done} extracted, ${failed} failed`);
  console.log(`Run import script next to push to GCR.`);
}

run().catch(console.error);
