#!/usr/bin/env node
/**
 * Extract food & drinks focused data: menus, happy hours, specials, cocktails, etc.
 * Skips non-food stuff (policies, parking, accessibility, etc.)
 *
 * Usage:
 *   node agents/extract-food-drinks.js <slug>
 *   node agents/extract-food-drinks.js pelican-grill
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const SLUG = process.argv[2] || 'pelican-grill';
const RAW_FILE = path.join(__dirname, `../scraped-menus/${SLUG}/raw.json`);
const OUT_FILE = path.join(__dirname, `../scraped-menus/${SLUG}/food-drinks.json`);

const EXTRACTION_PROMPT = `Extract ALL food and drinks related data from this restaurant website. Return ONLY valid JSON (no markdown, no code blocks).

Return this structure:
{
  "menus": [
    {
      "name": "category name (Appetizers, Lunch, Dinner, Desserts, etc.)",
      "items": [
        {
          "name": "item name",
          "description": "description or null",
          "price": "price or null",
          "dietary": ["vegetarian", "vegan", "gluten-free"] or []
        }
      ]
    }
  ],
  "drinks": {
    "cocktails": [
      {
        "name": "cocktail name",
        "description": "description or null",
        "price": "price or null"
      }
    ],
    "beer": [
      {
        "name": "beer name",
        "type": "IPA, Lager, Stout, etc.",
        "price": "price or null"
      }
    ],
    "wine": [
      {
        "name": "wine name",
        "type": "Red, White, Rosé, Sparkling",
        "price": "price or null"
      }
    ],
    "other": "coffee, juice, soft drinks, etc. or null"
  },
  "happy_hour": {
    "available": true or false,
    "days": "which days (Mon-Fri, Weekdays, Daily, etc.) or null",
    "start_time": "time or null",
    "end_time": "time or null",
    "drink_specials": "description or null",
    "food_specials": "description or null",
    "details": "full happy hour details or null"
  },
  "specials_and_promotions": [
    {
      "name": "special name",
      "description": "what it includes",
      "days": "when available (Daily, Weekends, Mon-Fri, etc.)",
      "discount": "discount details or null"
    }
  ],
  "dietary_info": {
    "vegetarian": true or false,
    "vegan": true or false,
    "gluten_free": true or false,
    "keto": true or false,
    "dairy_free": true or false,
    "notes": "dietary accommodations or null"
  }
}

Extract EVERY menu item, every drink, every special, happy hour details. Return ONLY the JSON object.`;

async function extract() {
  console.log(`\n🍽️  Extracting Food & Drinks: ${SLUG}`);
  console.log('═'.repeat(70));

  if (!fs.existsSync(RAW_FILE)) {
    console.error(`❌ File not found: ${RAW_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));

  // Filter to food/drink related pages
  const relevantPages = raw.pages.filter(p =>
    /menu|food|drink|appetizer|entree|dessert|lunch|dinner|brunch|cocktail|beer|wine|happy.hour|special|promo/i.test(p.text)
  );

  console.log(`Total pages: ${raw.pages?.length}`);
  console.log(`Relevant pages: ${relevantPages.length}`);
  console.log('');

  // Combine relevant page text
  const allText = relevantPages
    .map((p, i) => `[PAGE ${i + 1}: ${p.url}]\n${p.text}`)
    .join('\n\n')
    .substring(0, 120000);

  console.log(`Sending ${allText.length.toLocaleString()} chars to Claude Haiku...\n`);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `Extract all food and drinks data from this content:\n\n${allText}`
        }
      ],
      system: EXTRACTION_PROMPT
    });

    let content = response.content[0].text;

    // Strip markdown code blocks
    const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error(`❌ JSON parse failed: ${e.message}`);
      console.log('Response (first 800 chars):');
      console.log(content.substring(0, 800));
      process.exit(1);
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2));

    console.log('✅ EXTRACTION COMPLETE');
    console.log('═'.repeat(70));

    const menuItems = (parsed.menus || []).reduce((s, c) => s + (c.items?.length || 0), 0);
    console.log(`Menu categories: ${(parsed.menus || []).length}`);
    console.log(`Menu items: ${menuItems}`);

    console.log(`Cocktails: ${(parsed.drinks?.cocktails || []).length}`);
    console.log(`Beer: ${(parsed.drinks?.beer || []).length}`);
    console.log(`Wine: ${(parsed.drinks?.wine || []).length}`);

    console.log(`Happy hour: ${parsed.happy_hour?.available ? '✅ Yes' : '❌ No'}`);
    console.log(`Specials: ${(parsed.specials_and_promotions || []).length}`);
    console.log('');
    console.log(`📄 Saved: ${OUT_FILE}\n`);

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

extract().catch(e => {
  console.error('💥', e.message);
  process.exit(1);
});
