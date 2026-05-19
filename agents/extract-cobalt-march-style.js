#!/usr/bin/env node
/**
 * Extract Cobalt using the March extraction format (the one that worked better)
 * Matches the original extract-haiku.js prompt structure
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const COBALT_SLUG = 'cobalt-the-restaurant';
const RAW_FILE = path.join(__dirname, `../scraped-menus/${COBALT_SLUG}/raw.json`);
const OUT_FILE = path.join(__dirname, `../scraped-menus/${COBALT_SLUG}/extracted-march-style.json`);

const EXTRACTION_PROMPT = `Extract ALL data from this restaurant website. Business: Cobalt

Return ONLY raw JSON (no markdown, no code blocks):
{
  "business_name": "string",
  "tagline": "or null",
  "type": "Restaurant | Bar | Cafe | etc.",
  "contact": { "phone": "or null", "email": "or null", "address": "or null", "city": "or null", "state": "or null", "zip": "or null" },
  "hours": { "monday": "or null", "tuesday": "or null", "wednesday": "or null", "thursday": "or null", "friday": "or null", "saturday": "or null", "sunday": "or null", "notes": "or null" },
  "about": {
    "description": "string",
    "elevator_pitch": "1 sentence",
    "vibe": "short description",
    "best_for": ["families", "date night", "etc."],
    "established": "or null",
    "reservations": "or null",
    "insider_tip": "or null"
  },
  "tags": ["seafood", "casual", "happy hour", "etc."],
  "features": ["full bar", "outdoor seating", "live music", "waterfront", "etc."],
  "price_range": "\$ or \$\$ or \$\$\$ or \$\$\$\$",
  "social_links": { "instagram": "or null", "facebook": "or null", "website": "https://cobaltrestaurant.net/" },
  "specials": [{ "name": "string", "description": "string", "days": [], "time": "or null" }],
  "events": [{ "name": "string", "description": "string", "recurring": true, "day": "or null", "time": "or null" }],
  "menu": {
    "categories": [
      {
        "name": "Appetizers",
        "type": "breakfast|lunch|dinner|brunch|drinks|desserts|specials|dietary|kids",
        "items": [
          { "name": "item name", "description": "or null", "price": 12.99, "tags": [], "allergens": [] }
        ]
      }
    ]
  }
}

Extract EVERY detail, every menu item, every price, every special. Return ONLY JSON.`;

async function extract() {
  console.log('\n🔍 Extracting: Cobalt (March-style format)');
  console.log('═'.repeat(70));

  if (!fs.existsSync(RAW_FILE)) {
    console.error(`❌ File not found: ${RAW_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));

  console.log(`Pages: ${raw.pages?.length}`);
  console.log(`HTML chars: ${raw.pages?.reduce((s, p) => s + (p.html?.length || 0), 0).toLocaleString()}`);
  console.log(`Text chars: ${raw.pages?.reduce((s, p) => s + (p.text?.length || 0), 0).toLocaleString()}`);
  console.log('');

  // Use HTML if available, otherwise text
  const allText = raw.pages
    ?.map((p, i) => {
      if (p.html) {
        // Extract just text from HTML, remove script/style
        const cleaned = p.html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return `[PAGE ${i + 1}: ${p.url}]\n${cleaned}`;
      }
      return `[PAGE ${i + 1}: ${p.url}]\n${p.text}`;
    })
    .join('\n\n')
    .substring(0, 120000);

  console.log(`Sending ${allText.length.toLocaleString()} chars to Claude Haiku...\n`);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract ALL restaurant data from this content:\n\n${allText}`
        }
      ],
      system: EXTRACTION_PROMPT
    });

    let content = response.content[0].text;

    let parsed;
    try {
      const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error(`❌ JSON parse failed: ${e.message}`);
      console.log('Response:', content.substring(0, 500));
      process.exit(1);
    }

    parsed.extracted_at = new Date().toISOString();
    parsed.slug = COBALT_SLUG;

    fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2));

    console.log('✅ EXTRACTION COMPLETE');
    console.log('═'.repeat(70));
    console.log(`Business: ${parsed.business_name}`);
    console.log(`Menu categories: ${(parsed.menu?.categories || []).length}`);
    const totalItems = (parsed.menu?.categories || []).reduce((s, c) => s + (c.items?.length || 0), 0);
    console.log(`Total menu items: ${totalItems}`);
    console.log(`Events: ${(parsed.events || []).length}`);
    console.log(`Specials: ${(parsed.specials || []).length}`);
    console.log(`Tags: ${(parsed.tags || []).length}`);
    console.log(`Features: ${(parsed.features || []).length}`);
    console.log('');
    console.log(`📄 Saved: ${OUT_FILE}`);
    console.log('');

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

extract().catch(e => {
  console.error('💥', e.message);
  process.exit(1);
});
