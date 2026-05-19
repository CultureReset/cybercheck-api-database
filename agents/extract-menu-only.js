#!/usr/bin/env node
/**
 * Extract ONLY menu items from raw scraped data
 * Uses Claude Haiku to parse menus from any restaurant website
 *
 * Usage:
 *   node agents/extract-menu-only.js <slug>
 *   node agents/extract-menu-only.js pelican-grill
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const SLUG = process.argv[2] || 'pelican-grill';
const RAW_FILE = path.join(__dirname, `../scraped-menus/${SLUG}/raw.json`);
const OUT_FILE = path.join(__dirname, `../scraped-menus/${SLUG}/menu.json`);

const EXTRACTION_PROMPT = `Extract ONLY the menu items from this restaurant website. Return ONLY valid JSON.

Return this JSON structure (array of categories):
[
  {
    "name": "category name (Appetizers, Lunch, Dinner, etc.)",
    "items": [
      {
        "name": "item name",
        "description": "description or null",
        "price": "price or null"
      }
    ]
  }
]

Rules:
- Extract every menu item with its name, description, and price
- Group items into categories (Appetizers, Lunch, Dinner, Desserts, Drinks, etc.)
- Keep descriptions short and accurate
- Prices as strings (preserve currency symbols and ranges)
- Return ONLY the JSON array, no markdown, no code blocks`;

async function extract() {
  console.log(`\n🍽️  Extracting Menu: ${SLUG}`);
  console.log('═'.repeat(70));

  if (!fs.existsSync(RAW_FILE)) {
    console.error(`❌ File not found: ${RAW_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));

  // Find menu-related pages
  const menuPages = raw.pages.filter(p =>
    /menu|food|drink|appetizer|entree|dessert|lunch|dinner|brunch/i.test(p.text)
  );

  console.log(`Total pages: ${raw.pages?.length}`);
  console.log(`Menu pages: ${menuPages.length}`);
  console.log('');

  // Combine just menu page text
  const menuText = menuPages
    .map((p, i) => `[PAGE ${i + 1}: ${p.url}]\n${p.text}`)
    .join('\n\n')
    .substring(0, 100000);

  console.log(`Sending ${menuText.length.toLocaleString()} chars to Claude Haiku...\n`);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract all menu items from this restaurant content:\n\n${menuText}`
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
      console.log('Response (first 600 chars):');
      console.log(content.substring(0, 600));
      process.exit(1);
    }

    // Ensure it's an array of categories
    if (!Array.isArray(parsed)) {
      parsed = [{ name: 'Menu', items: Array.isArray(parsed.items) ? parsed.items : [] }];
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2));

    console.log('✅ MENU EXTRACTION COMPLETE');
    console.log('═'.repeat(70));
    const totalItems = parsed.reduce((s, c) => s + (c.items?.length || 0), 0);
    console.log(`Categories: ${parsed.length}`);
    console.log(`Total items: ${totalItems}`);
    parsed.forEach(cat => {
      console.log(`  • ${cat.name}: ${cat.items?.length || 0} items`);
    });
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
