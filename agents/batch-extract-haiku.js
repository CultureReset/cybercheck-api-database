#!/usr/bin/env node
/**
 * Batch extract ALL restaurants using Claude Haiku
 * Reads all raw.json files and extracts structured data
 *
 * Usage:
 *   node agents/batch-extract-haiku.js                    # extract all
 *   node agents/batch-extract-haiku.js --limit 10         # first 10 only
 *   node agents/batch-extract-haiku.js --retry            # retry failed only
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const BASE_DIR = path.join(__dirname, '../scraped-menus');

const EXTRACTION_PROMPT = `You are a restaurant data extraction expert. Extract ABSOLUTELY EVERYTHING from this restaurant's scraped data and return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

Extract every detail: menus, pricing, hours, events, specials, photos, descriptions, staff, awards, policies, delivery info, catering, group bookings, wine lists, dietary info, reviews, contact, social media, parking, accessibility, payments, gift cards, loyalty programs, anything visible.

Return this comprehensive JSON structure:
{
  "business_name": "string",
  "cuisine_type": "string",
  "price_range": "string",
  "description": "string",
  "atmosphere": "string",
  "chef_info": "string or null",
  "awards": ["array"],
  "contact": {
    "phone": "string or null",
    "email": "string or null",
    "address": "string or null",
    "website": "string or null",
    "hours_phone": "string or null",
    "reservations_phone": "string or null",
    "social_media": {
      "facebook": "string or null",
      "instagram": "string or null",
      "twitter": "string or null",
      "tiktok": "string or null",
      "youtube": "string or null"
    }
  },
  "hours": {
    "monday": "string or null",
    "tuesday": "string or null",
    "wednesday": "string or null",
    "thursday": "string or null",
    "friday": "string or null",
    "saturday": "string or null",
    "sunday": "string or null",
    "seasonal_hours": "string or null",
    "holiday_hours": "string or null",
    "last_seating": "string or null"
  },
  "delivery_and_takeout": {
    "dine_in": "boolean",
    "takeout_available": "boolean",
    "delivery_available": "boolean",
    "curbside_available": "boolean",
    "delivery_partners": ["array"],
    "delivery_fee": "string or null",
    "minimum_order": "string or null",
    "delivery_areas": "string or null"
  },
  "menu": {
    "sections": [
      {
        "name": "string",
        "description": "string or null",
        "items": [
          {
            "name": "string",
            "description": "string or null",
            "price": "string or null",
            "dietary_flags": ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto"],
            "allergens": "string or null",
            "is_signature": "boolean",
            "is_seasonal": "boolean",
            "availability": "string or null"
          }
        ]
      }
    ],
    "wine_list": "string or null",
    "beer_selection": "string or null",
    "cocktails": "string or null",
    "kids_menu": "string or null",
    "catering_menu": "string or null",
    "dietary_accommodations": {
      "vegetarian": "boolean",
      "vegan": "boolean",
      "gluten_free": "boolean",
      "dairy_free": "boolean",
      "nut_free": "boolean",
      "kosher": "boolean",
      "halal": "boolean"
    }
  },
  "happy_hour": {
    "available": "boolean",
    "days": "string or null",
    "start_time": "string or null",
    "end_time": "string or null",
    "drink_specials": "string or null",
    "food_specials": "string or null",
    "full_details": "string or null"
  },
  "specials_and_promotions": [
    {
      "type": "string",
      "day_of_week": "string or null",
      "name": "string",
      "description": "string",
      "discount": "string or null",
      "valid_until": "string or null"
    }
  ],
  "entertainment_and_events": [
    {
      "type": "string",
      "name": "string",
      "days": "string",
      "start_time": "string or null",
      "end_time": "string or null",
      "description": "string or null",
      "cover_charge": "string or null",
      "featured_artist": "string or null"
    }
  ],
  "private_events": {
    "available": "boolean",
    "event_spaces": "string or null",
    "max_capacity": "string or null",
    "min_spend": "string or null",
    "catering_available": "boolean",
    "packages": "string or null"
  },
  "parking": "string or null",
  "accessibility": {
    "wheelchair_accessible": "boolean",
    "accessible_restroom": "boolean",
    "parking_accessible": "boolean",
    "details": "string or null"
  },
  "policies": {
    "dress_code": "string or null",
    "age_restrictions": "string or null",
    "cancellation_policy": "string or null",
    "payment_methods": ["array"],
    "kids_policy": "string or null",
    "pets_allowed": "boolean"
  },
  "reservations_and_groups": {
    "accepts_reservations": "boolean",
    "online_booking_platform": "string or null",
    "phone_reservations": "string or null",
    "group_size_limit": "string or null",
    "advance_notice_required": "string or null",
    "group_rates": "boolean",
    "private_dining": "boolean"
  },
  "loyalty_and_rewards": {
    "loyalty_program": "string or null",
    "gift_cards_available": "boolean",
    "email_signup": "string or null",
    "rewards_details": "string or null"
  },
  "sourcing_and_philosophy": {
    "locally_sourced": "boolean",
    "farm_to_table": "boolean",
    "sustainable": "boolean",
    "organic": "boolean",
    "details": "string or null"
  },
  "reviews_and_ratings": {
    "google_rating": "number or null",
    "google_review_count": "number or null",
    "popular_dishes_mentioned": ["array"],
    "common_praise": ["array"],
    "common_complaints": ["array"]
  },
  "photos_and_media": [
    {
      "type": "string",
      "url": "string or null",
      "description": "string or null"
    }
  ],
  "blog_and_articles": [
    {
      "title": "string",
      "url": "string or null",
      "excerpt": "string or null"
    }
  ],
  "newsletters_and_updates": "string or null",
  "extraction_confidence": "string (high, medium, low)",
  "extraction_notes": "string or null"
}

Extract EVERY detail. For missing sections, use null. Return ONLY the JSON object, no other text.`;

async function extractRestaurant(slug, rawFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));

    // Combine all text from pages and PDFs
    const allText = [
      ...(raw.pages || []).map(p => `[PAGE: ${p.url}]\n${p.text}`),
      ...(raw.pdfTexts || [])
    ].join('\n\n').substring(0, 100000);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract ALL restaurant data from this scraped content:\n\n${allText}`
        }
      ],
      system: EXTRACTION_PROMPT
    });

    let content = response.content[0].text;

    let parsed;
    try {
      // Strip markdown code blocks (aggressive matching from working version)
      const cleaned = content.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();

      parsed = JSON.parse(cleaned);
    } catch (e) {
      return { slug, status: 'parse-error', error: e.message };
    }

    // Save extraction
    const outputFile = path.join(BASE_DIR, slug, 'extracted.json');
    parsed.extracted_at = new Date().toISOString();
    parsed.slug = slug;

    fs.writeFileSync(outputFile, JSON.stringify(parsed, null, 2));

    return {
      slug,
      status: 'success',
      business: parsed.business_name,
      menuSections: (parsed.menu?.sections || []).length,
      menuItems: (parsed.menu?.sections || []).reduce((s, sec) => s + (sec.items?.length || 0), 0),
      events: (parsed.entertainment_and_events || []).length,
      confidence: parsed.extraction_confidence
    };
  } catch (err) {
    return { slug, status: 'error', error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;
  const retryOnly = args.includes('--retry');

  // Find all raw.json files
  const folders = fs.readdirSync(BASE_DIR)
    .filter(f => !f.startsWith('.') && fs.statSync(path.join(BASE_DIR, f)).isDirectory());

  let toProcess = [];

  for (const folder of folders) {
    const rawFile = path.join(BASE_DIR, folder, 'raw.json');
    const extractedFile = path.join(BASE_DIR, folder, 'extracted.json');

    if (!fs.existsSync(rawFile)) continue;

    if (retryOnly) {
      // Only process if extracted doesn't exist or is invalid
      if (!fs.existsSync(extractedFile)) {
        toProcess.push({ slug: folder, rawFile });
      }
    } else {
      toProcess.push({ slug: folder, rawFile });
    }
  }

  if (limitArg) {
    toProcess = toProcess.slice(0, limitArg);
  }

  console.log(`\n🤖 Batch Extract with Claude Haiku`);
  console.log('═'.repeat(70));
  console.log(`Total to process: ${toProcess.length}`);
  console.log('');

  const results = { success: 0, failed: 0, error: 0 };
  const failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const { slug, rawFile } = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${slug}`);

    const result = await extractRestaurant(slug, rawFile);

    if (result.status === 'success') {
      console.log(`  ✅ ${result.business} (${result.confidence})`);
      console.log(`     Menu: ${result.menuSections} sections, ${result.menuItems} items | Events: ${result.events}`);
      results.success++;
    } else {
      console.log(`  ❌ ${result.status}: ${result.error}`);
      results.failed++;
      failures.push({ slug, status: result.status, error: result.error });
    }

    // Rate limit
    if (i < toProcess.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`  ✅ Success:  ${results.success}`);
  console.log(`  ❌ Failed:   ${results.failed}`);
  console.log('');

  if (failures.length > 0 && failures.length <= 10) {
    console.log('Failed extractions:');
    failures.forEach(f => console.log(`  • ${f.slug}: ${f.error}`));
  }
}

main().catch(e => {
  console.error('💥', e.message);
  process.exit(1);
});
