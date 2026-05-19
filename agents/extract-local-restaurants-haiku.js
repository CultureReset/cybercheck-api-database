#!/usr/bin/env node
/**
 * Extract complete data from LOCAL/INDEPENDENT restaurants only
 * Uses Claude Haiku for fast, cheap extraction of ALL restaurant info
 * Filters out franchises/chains (Subway, Hooters, Rotolo's, etc.)
 *
 * Usage:
 *   node agents/extract-local-restaurants-haiku.js                 # extract all local restaurants
 *   node agents/extract-local-restaurants-haiku.js --retry         # only retry failed extractions
 *   node agents/extract-local-restaurants-haiku.js --force         # force re-extract all (overwrite)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const SCRAPED_DIR = path.join(__dirname, '../raw-page-data');
const OUTPUT_DIR = path.join(__dirname, '../restaurant-extractions-local');
const FOOD_CATEGORY_FILE = path.join(__dirname, '../category-food-and-dining-ob-gs.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Franchise/chain keywords to filter OUT
const CHAIN_KEYWORDS = [
  'subway', 'mcdonald', 'burger king', 'wendy', 'taco bell', 'kfc',
  'chick-fil-a', 'popeyes', 'chipotle', 'panera', 'hooters',
  'applebee', 'olive garden', 'red robin', 'cheesecake factory',
  'outback', 'cracker barrel', 'lambertś', 'rotolo'
];

const EXTRACTION_PROMPT = `You are a restaurant data extraction expert. Extract ABSOLUTELY EVERYTHING from this restaurant website HTML and return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

Extract every detail you can find: menus, pricing, hours, events, specials, photos, descriptions, staff, awards, policies, delivery info, catering, group bookings, wine lists, dietary info, reviews, contact, social media, parking, accessibility, payments accepted, gift cards, loyalty programs, blog posts, about text, chef info, sourcing, anything visible on the website.

Return this comprehensive JSON structure:
{
  "business_name": "string",
  "cuisine_type": "string",
  "price_range": "string (e.g., '\$\$' or '\$15-25')",
  "description": "string (full about/description text from website)",
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
    "delivery_partners": ["array: DoorDash, Uber Eats, Grubhub, etc"],
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
    "kids_menu": "string or null (full kids menu if available)",
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
    "packages": "string or null (full event packages description)"
  },
  "parking": "string or null (free lot, valet, street, garage, etc)",
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
    "payment_methods": ["array of accepted payment types"],
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
    "popular_dishes_mentioned": ["array of frequently praised dishes"],
    "common_praise": ["array of praise themes"],
    "common_complaints": ["array of complaint themes"]
  },
  "photos_and_media": [
    {
      "type": "string (food, restaurant, staff, event, etc)",
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
  "newsletters_and_updates": "string or null (newsletter signup, SMS alerts, etc)",
  "raw_text_content": "string (all visible text from the page, cleaned up)",
  "extraction_confidence": "string (high, medium, low)",
  "extraction_notes": "string or null (what data was found, what was missing, any caveats)"
}

Extract EVERY detail you find. For missing sections, use null. Return ONLY the JSON object, no other text.`;

function isLocalRestaurant(name) {
  const lowercased = (name || '').toLowerCase();
  return !CHAIN_KEYWORDS.some(keyword => lowercased.includes(keyword));
}

async function extractRestaurantData(htmlFile, businessName) {
  try {
    const html = fs.readFileSync(htmlFile, 'utf8');
    const truncated = html.substring(0, 90000);

    console.log(`    🤖 Extracting...`);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract restaurant data from this HTML:\n\n${truncated}`
        }
      ],
      system: EXTRACTION_PROMPT
    });

    const content = response.content[0].text;

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log(`      ⚠️  JSON parse failed: ${e.message}`);
      return null;
    }

    return parsed;
  } catch (err) {
    console.log(`    ❌ Error: ${err.message}`);
    return null;
  }
}

async function findLocalRestaurants() {
  const results = [];

  // Load food-and-dining category and filter for local restaurants
  let localNames = new Set();
  try {
    const foodData = JSON.parse(fs.readFileSync(FOOD_CATEGORY_FILE, 'utf8'));
    foodData
      .filter(r => isLocalRestaurant(r.name))
      .forEach(r => localNames.add(r.name));
    console.log(`✅ Loaded ${localNames.size} local restaurants from category file\n`);
  } catch (err) {
    console.error(`⚠️  Could not load category file: ${err.message}`);
    console.log(`   Will extract from all HTML folders instead\n`);
  }

  try {
    const folders = fs.readdirSync(SCRAPED_DIR);

    for (const folder of folders) {
      const folderPath = path.join(SCRAPED_DIR, folder);
      const stat = fs.statSync(folderPath);

      if (!stat.isDirectory()) continue;

      // Get business name from metadata
      let businessName = folder;
      const metaFiles = ['00_metadata.json', 'metadata.json'];
      for (const mf of metaFiles) {
        const metaPath = path.join(folderPath, mf);
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.business_name || meta.name) {
              businessName = meta.business_name || meta.name;
              break;
            }
          } catch {}
        }
      }

      // Filter: only local restaurants
      if (localNames.size > 0 && !localNames.has(businessName)) {
        continue;
      }

      // Find HTML file
      let htmlFile = null;
      const standardHtml = path.join(folderPath, 'page.html');
      if (fs.existsSync(standardHtml)) {
        htmlFile = standardHtml;
      } else {
        const altHtml = path.join(folderPath, '01_raw_html.html');
        if (fs.existsSync(altHtml)) {
          htmlFile = altHtml;
        }
      }

      if (htmlFile) {
        results.push({ folder, htmlFile, businessName });
      }
    }
  } catch (err) {
    console.error(`Error scanning directories: ${err.message}`);
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const forceReextract = args.includes('--force');
  const retryOnly = args.includes('--retry');

  const websites = await findLocalRestaurants();
  console.log(`📊 Found ${websites.length} local restaurants with HTML\n`);

  if (websites.length === 0) {
    console.log('⚠️  No local restaurants found');
    process.exit(1);
  }

  const results = { success: 0, failed: 0, skipped: 0 };

  for (let i = 0; i < websites.length; i++) {
    const { folder, htmlFile, businessName } = websites[i];
    const outputFile = path.join(OUTPUT_DIR, folder + '.json');

    // Check if already extracted
    if (fs.existsSync(outputFile) && !forceReextract) {
      if (retryOnly) {
        try {
          const existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
          if (existing && existing.extraction_confidence !== 'failed') {
            console.log(`[${i+1}/${websites.length}] ⏭️  ${businessName} (cached)`);
            results.skipped++;
            continue;
          }
        } catch {
          // Re-extract if can't parse
        }
      } else {
        console.log(`[${i+1}/${websites.length}] ⏭️  ${businessName}`);
        results.skipped++;
        continue;
      }
    }

    console.log(`[${i+1}/${websites.length}] ${businessName}`);

    const extracted = await extractRestaurantData(htmlFile, businessName);

    if (extracted) {
      extracted.folder = folder;
      extracted.extracted_at = new Date().toISOString();
      extracted.html_source = htmlFile;

      fs.writeFileSync(outputFile, JSON.stringify(extracted, null, 2));
      console.log(`    ✅ Extracted`);
      results.success++;
    } else {
      results.failed++;
    }

    if (i < websites.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Save summary
  const summary = {
    total_local_restaurants: websites.length,
    succeeded: results.success,
    failed: results.failed,
    skipped: results.skipped,
    extraction_timestamp: new Date().toISOString(),
    output_directory: OUTPUT_DIR
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_extraction-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n' + '═'.repeat(72));
  console.log('LOCAL RESTAURANT EXTRACTION COMPLETE');
  console.log('═'.repeat(72));
  console.log(`  ✅ Success:  ${results.success}`);
  console.log(`  ❌ Failed:   ${results.failed}`);
  console.log(`  ⏭️  Skipped:  ${results.skipped}`);
  console.log(`  📁 Output:   ${OUTPUT_DIR}`);
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
