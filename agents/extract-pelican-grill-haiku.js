#!/usr/bin/env node
/**
 * Extract ALL data from Pelican Grill's raw.json using Claude Haiku
 * Gets menus, hours, events, contact, reviews, specials, everything
 *
 * Run:
 *   node agents/extract-pelican-grill-haiku.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const SLUG = 'pelican-grill';
const RAW_FILE = path.join(__dirname, `../scraped-menus/${SLUG}/raw.json`);
const OUT_FILE = path.join(__dirname, `../scraped-menus/${SLUG}/extracted.json`);

const EXTRACTION_PROMPT = `You are a restaurant data extraction expert. Extract ABSOLUTELY EVERYTHING from this restaurant's scraped data and return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

Extract every detail you can find: menus with ALL items and prices, hours, events, specials, photos, descriptions, staff, awards, policies, delivery info, catering, group bookings, wine lists, dietary info, reviews, contact, social media, parking, accessibility, payments accepted, gift cards, loyalty programs, anything visible.

Return this comprehensive JSON structure:
{
  "business_name": "string",
  "cuisine_type": "string",
  "price_range": "string (e.g., '\$\$' or '\$15-25')",
  "description": "string (full about/description text)",
  "atmosphere": "string",
  "chef_info": "string or null",
  "awards": ["array of awards/recognition"],
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
    "wine_list": "string or null (full wine list if available)",
    "beer_selection": "string or null",
    "cocktails": "string or null (cocktail list/descriptions)",
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
      "type": "string (daily_special, seasonal, limited_time, discount, etc)",
      "day_of_week": "string or null",
      "name": "string",
      "description": "string",
      "discount": "string or null",
      "valid_until": "string or null"
    }
  ],
  "entertainment_and_events": [
    {
      "type": "string (live_music, dj, trivia, karaoke, comedy, sports, special_event, etc)",
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

async function extractPelicanGrill() {
  console.log('\n🔍 Extracting: Pelican Grill');
  console.log('═'.repeat(70));

  if (!fs.existsSync(RAW_FILE)) {
    console.error(`❌ File not found: ${RAW_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));

  console.log(`URL: ${raw.url}`);
  console.log(`Pages scraped: ${raw.pages?.length || 0}`);
  console.log(`PDFs: ${raw.pdfTexts?.length || 0}`);
  console.log(`Images: ${raw.imageUrls?.length || 0}`);
  console.log('');

  // Combine all text from pages and PDFs
  const allText = [
    ...(raw.pages || []).map(p => `[PAGE: ${p.url}]\n${p.text}`),
    ...(raw.pdfTexts || [])
  ].join('\n\n').substring(0, 100000);

  console.log(`Sending ${allText.length.toLocaleString()} chars to Claude Haiku...\n`);

  try {
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

    // Parse JSON with aggressive markdown stripping
    let parsed;
    try {
      const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error(`❌ JSON parse failed: ${e.message}`);
      console.log('Raw response (first 800 chars):');
      console.log(content.substring(0, 800));
      process.exit(1);
    }

    // Save extraction
    parsed.extracted_at = new Date().toISOString();
    parsed.slug = SLUG;

    fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2));

    console.log('✅ EXTRACTION COMPLETE');
    console.log('═'.repeat(70));
    console.log(`Business: ${parsed.business_name}`);
    console.log(`Cuisine: ${parsed.cuisine_type}`);
    console.log(`Menu sections: ${(parsed.menu?.sections || []).length}`);
    console.log(`Menu items: ${(parsed.menu?.sections || []).reduce((s, sec) => s + (sec.items?.length || 0), 0)}`);
    console.log(`Events: ${(parsed.entertainment_and_events || []).length}`);
    console.log(`Specials: ${(parsed.specials_and_promotions || []).length}`);
    console.log(`Confidence: ${parsed.extraction_confidence}`);
    console.log('');
    console.log(`📄 Saved: ${OUT_FILE}`);

    if (parsed.extraction_notes) {
      console.log(`📝 Notes: ${parsed.extraction_notes}`);
    }

    console.log('');

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

extractPelicanGrill().catch(e => {
  console.error('💥', e.message);
  process.exit(1);
});
