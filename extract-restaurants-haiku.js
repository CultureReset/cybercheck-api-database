#!/usr/bin/env node
/**
 * Extract restaurant data from raw.json using Claude Haiku (fast + cheap)
 * Only processes restaurants, skips other business types
 *
 * Usage:
 *   node extract-restaurants-haiku.js           # extract all restaurant raw.json files
 *   node extract-restaurants-haiku.js --retry   # only retry failed extractions
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();
const SCRAPED_DIR = path.join(__dirname, 'scraped-menus');
const RETRY_MODE = process.argv.includes('--retry');
const FORCE_MODE = process.argv.includes('--force');

const RESTAURANT_KEYWORDS = [
  'restaurant', 'cafe', 'diner', 'bistro', 'grill', 'seafood', 'oyster',
  'steamer', 'shack', 'pizza', 'taco', 'bbq', 'burger', 'chicken', 'kitchen',
  'pub', 'bar', 'brewery', 'wing', 'lulu', 'luna', 'cobalt', 'cove', 'hangout'
];

async function claudeCall(allText, businessName) {
  const prompt = `Extract ALL restaurant data from this website HTML. Return ONLY valid JSON (no markdown, no explanation).

Business Name: ${businessName}

HTML Content:
---
${allText.substring(0, 150000)}
---

Return this JSON structure (extract everything you can find):
{
  "business_name": "string",
  "cuisine_type": "string or null",
  "price_range": "$ $$ $$$ $$$$ or null",
  "description": "full description from website or null",
  "contact": {
    "phone": "string or null",
    "email": "string or null",
    "address": "full street address or null",
    "city": "string or null",
    "state": "string or null",
    "zip": "string or null",
    "website": "URL or null"
  },
  "hours": {
    "monday": "11am-10pm or null",
    "tuesday": "11am-10pm or null",
    "wednesday": "11am-10pm or null",
    "thursday": "11am-10pm or null",
    "friday": "11am-10pm or null",
    "saturday": "11am-10pm or null",
    "sunday": "11am-10pm or null"
  },
  "menu": {
    "categories": [
      {
        "name": "Appetizers",
        "items": [
          {
            "name": "item name",
            "description": "string or null",
            "price": 12.99,
            "dietary_flags": ["vegetarian", "gluten-free", etc]
          }
        ]
      }
    ]
  },
  "specials": [
    {
      "name": "Happy Hour",
      "description": "string",
      "days": ["Monday", "Tuesday"],
      "time": "4-6pm"
    }
  ],
  "features": ["full bar", "outdoor seating", "takeout", "delivery", "live music"],
  "social_media": {
    "facebook": "URL or null",
    "instagram": "URL or null",
    "twitter": "URL or null"
  },
  "images": ["url1", "url2"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const text = response.content[0].text;
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.error(`  ❌ JSON parse error: ${e.message}`);
      return null;
    }
  } catch (err) {
    console.error(`  ⚠️ Claude API error: ${err.message}`);
    return null;
  }
}

function isRestaurant(folderName) {
  const lower = folderName.toLowerCase();
  return RESTAURANT_KEYWORDS.some(kw => lower.includes(kw));
}

async function main() {
  console.log('\n🍽️  RESTAURANT EXTRACTION — Haiku\n');
  console.log('Scanning for restaurant raw.json files...\n');

  const subdirs = fs.readdirSync(SCRAPED_DIR).filter(name => {
    const fullPath = path.join(SCRAPED_DIR, name);
    return fs.statSync(fullPath).isDirectory();
  });

  let restaurants = subdirs.filter(isRestaurant).sort();

  // TEST MODE: limit to 5 if --test flag
  const testMode = process.argv.includes('--test');
  if (testMode) {
    restaurants = restaurants.slice(0, 5);
    console.log(`TEST MODE: Processing first 5 restaurants only\n`);
  }

  console.log(`Found ${restaurants.length} restaurants (${subdirs.length} total folders)\n`);

  let extracted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < restaurants.length; i++) {
    const folder = restaurants[i];
    const rawPath = path.join(SCRAPED_DIR, folder, 'raw.json');
    const dataPath = path.join(SCRAPED_DIR, folder, 'data.json');

    // Check if already extracted (skip unless --force)
    if (!FORCE_MODE && !RETRY_MODE && fs.existsSync(dataPath)) {
      console.log(`[${i + 1}/${restaurants.length}] ⏭️  SKIP (already extracted): ${folder}`);
      skipped++;
      continue;
    }

    if (!fs.existsSync(rawPath)) {
      console.log(`[${i + 1}/${restaurants.length}] ❌ NO RAW.JSON: ${folder}`);
      failed++;
      continue;
    }

    try {
      const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

      // Combine all text from all pages
      let allText = '';
      if (raw.pages && Array.isArray(raw.pages)) {
        for (const page of raw.pages) {
          allText += `\n--- ${page.url} ---\n`;
          allText += page.text || '';
          if (page.structuredData) {
            allText += '\n' + JSON.stringify(page.structuredData).substring(0, 5000);
          }
        }
      }

      if (!allText.trim()) {
        console.log(`[${i + 1}/${restaurants.length}] ⚠️  NO TEXT CONTENT: ${folder}`);
        failed++;
        continue;
      }

      console.log(`[${i + 1}/${restaurants.length}] 🔄 Extracting: ${folder}`);
      const data = await claudeCall(allText, raw.business_name || folder);

      if (data) {
        data.extracted_at = new Date().toISOString();
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        console.log(`        ✅ Saved`);
        extracted++;
      } else {
        console.log(`        ❌ Extraction failed`);
        failed++;
      }

      // Rate limit: wait 500ms between API calls
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log(`[${i + 1}/${restaurants.length}] ❌ ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Extracted: ${extracted}`);
  console.log(`⏭️  Skipped:   ${skipped}`);
  console.log(`❌ Failed:    ${failed}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
