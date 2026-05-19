#!/usr/bin/env node
/**
 * Extract complete restaurant data from scraped HTML
 * Uses Claude Haiku for fast, cheap extraction of ALL restaurant info
 *
 * Usage:
 *   node agents/extract-restaurants-haiku.js                 # extract all 700 restaurants
 *   node agents/extract-restaurants-haiku.js --retry         # only retry failed extractions
 *   node agents/extract-restaurants-haiku.js --force         # force re-extract all (overwrite)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic();
const SCRAPED_DIR = path.join(__dirname, '../raw-page-data');
const OUTPUT_DIR = path.join(__dirname, '../restaurant-extractions');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const EXTRACTION_PROMPT = `You are a restaurant data extraction expert. Extract ALL available information from this restaurant website HTML and return ONLY valid JSON (no markdown, no code blocks, just raw JSON).

Return this exact JSON structure:
{
  "business_name": "string",
  "cuisine_type": "string (e.g., 'Seafood, American')",
  "atmosphere": "string (e.g., 'casual, beachfront, family-friendly')",
  "contact": {
    "phone": "string or null",
    "address": "string or null",
    "website": "string or null",
    "email": "string or null",
    "social_media": {
      "facebook": "string or null",
      "instagram": "string or null",
      "twitter": "string or null"
    }
  },
  "hours": {
    "monday": "string (e.g., '11:00 AM - 10:00 PM') or null",
    "tuesday": "string or null",
    "wednesday": "string or null",
    "thursday": "string or null",
    "friday": "string or null",
    "saturday": "string or null",
    "sunday": "string or null",
    "seasonal_notes": "string or null (e.g., 'closed January-February')",
    "holiday_hours": "string or null"
  },
  "delivery_takeout": {
    "delivery_available": "boolean",
    "takeout_available": "boolean",
    "delivery_fee": "number or null",
    "minimum_order": "number or null",
    "platforms": "array of strings (e.g., ['DoorDash', 'Uber Eats'])"
  },
  "reservations": {
    "accepts_reservations": "boolean",
    "online_booking": "string or null (e.g., 'OpenTable, Resy')",
    "private_events": "boolean",
    "max_party_size": "number or null",
    "catering_available": "boolean"
  },
  "menu": {
    "sections": [
      {
        "name": "string (e.g., 'Appetizers')",
        "items": [
          {
            "name": "string",
            "description": "string or null",
            "price": "number or null",
            "dietary_flags": ["array of strings: 'vegetarian', 'vegan', 'gluten-free', 'keto', 'dairy-free']",
            "is_signature": "boolean (true if it's a signature/popular dish)"
          }
        ]
      }
    ],
    "dietary_options": {
      "vegetarian_available": "boolean",
      "vegan_available": "boolean",
      "gluten_free_available": "boolean",
      "keto_available": "boolean",
      "allergen_warnings": "string or null"
    }
  },
  "happy_hour": {
    "available": "boolean",
    "schedule": "string or null (e.g., 'Mon-Fri 4-6 PM')",
    "drink_specials": "string or null",
    "food_specials": "string or null",
    "details_url": "string or null"
  },
  "specials_and_promotions": [
    {
      "type": "string (e.g., 'daily_special', 'seasonal', 'limited_time', 'member_discount')",
      "day_of_week": "string or null (e.g., 'Monday')",
      "description": "string",
      "discount_percentage": "number or null",
      "valid_until": "string or null (e.g., '2026-05-31')"
    }
  ],
  "entertainment_events": [
    {
      "type": "string (e.g., 'live_music', 'trivia', 'karaoke', 'special_event')",
      "name": "string",
      "schedule": "string (e.g., 'Friday & Saturday 8 PM', 'Every Tuesday')",
      "description": "string or null",
      "cover_charge": "number or null"
    }
  ],
  "reviews_and_ratings": {
    "google_rating": "number or null (0-5)",
    "review_count": "number or null",
    "popular_dishes": "array of strings",
    "customer_highlights": "array of strings (e.g., ['Great service', 'Fresh seafood', 'Lively atmosphere'])",
    "common_complaints": "array of strings or null"
  },
  "parking": "string or null (e.g., 'Free lot, valet available')",
  "kid_friendly": "boolean",
  "pets_allowed": "boolean",
  "wheelchair_accessible": "boolean",
  "extraction_confidence": "string ('high', 'medium', 'low')",
  "extraction_notes": "string or null (e.g., 'Menu prices may be outdated', 'No happy hour info found')"
}

Extract as much data as possible from the HTML. For missing information, use null. Be conservative with high-confidence extraction - if you're unsure about prices or details, set confidence accordingly and note in extraction_notes. Return ONLY the JSON object, no other text.`;

async function extractRestaurantData(htmlFile, businessName) {
  try {
    const html = fs.readFileSync(htmlFile, 'utf8');

    // Truncate HTML to fit in context (keep first 90k chars - most important content is at top)
    const truncated = html.substring(0, 90000);

    console.log(`    🤖 Extracting with Claude Haiku...`);

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

    // Parse JSON response
    let parsed;
    try {
      // Try to find JSON in the response (in case there's extra text)
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
    console.log(`    ❌ Extraction error: ${err.message}`);
    return null;
  }
}

async function findHtmlFiles() {
  const results = [];

  try {
    const folders = fs.readdirSync(SCRAPED_DIR);

    for (const folder of folders) {
      const folderPath = path.join(SCRAPED_DIR, folder);
      const stat = fs.statSync(folderPath);

      if (!stat.isDirectory()) continue;

      // Check for both naming conventions
      let htmlFile = null;
      let businessName = folder;

      // Try standard naming: page.html
      const standardHtml = path.join(folderPath, 'page.html');
      if (fs.existsSync(standardHtml)) {
        htmlFile = standardHtml;
      }

      // Try alt naming: 01_raw_html.html
      const altHtml = path.join(folderPath, '01_raw_html.html');
      if (!htmlFile && fs.existsSync(altHtml)) {
        htmlFile = altHtml;
      }

      // Try to get business name from metadata
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

  const websites = await findHtmlFiles();
  console.log(`\n📊 Found ${websites.length} websites with HTML\n`);

  if (websites.length === 0) {
    console.log('No HTML files found in ' + SCRAPED_DIR);
    process.exit(1);
  }

  const results = { success: 0, failed: 0, skipped: 0, list: [] };

  for (let i = 0; i < websites.length; i++) {
    const { folder, htmlFile, businessName } = websites[i];
    const outputFile = path.join(OUTPUT_DIR, folder + '.json');

    // Check if already extracted
    if (fs.existsSync(outputFile) && !forceReextract) {
      if (retryOnly) {
        // In retry mode, check if previous extraction failed
        try {
          const existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
          if (existing && existing.extraction_confidence !== 'failed') {
            console.log(`[${i+1}/${websites.length}] ⏭️  ${businessName} (already extracted)`);
            results.skipped++;
            continue;
          }
        } catch {
          // If can't parse, re-extract
        }
      } else {
        console.log(`[${i+1}/${websites.length}] ⏭️  ${businessName} (already extracted)`);
        results.skipped++;
        continue;
      }
    }

    console.log(`[${i+1}/${websites.length}] ${businessName}`);

    const extracted = await extractRestaurantData(htmlFile, businessName);

    if (extracted) {
      // Add metadata
      extracted.folder = folder;
      extracted.extracted_at = new Date().toISOString();
      extracted.html_source = htmlFile;

      fs.writeFileSync(outputFile, JSON.stringify(extracted, null, 2));
      console.log(`    ✅ Saved → ${outputFile}`);
      results.success++;
      results.list.push({ folder, businessName, status: 'success' });
    } else {
      results.failed++;
      results.list.push({ folder, businessName, status: 'failed' });
    }

    // Rate limit: small delay between API calls
    if (i < websites.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Save summary
  const summary = {
    total: websites.length,
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
  console.log('EXTRACTION COMPLETE');
  console.log('═'.repeat(72));
  console.log(`  ✅ Success:  ${results.success}`);
  console.log(`  ❌ Failed:   ${results.failed}`);
  console.log(`  ⏭️  Skipped:  ${results.skipped}`);
  console.log(`  📁 Output:   ${OUTPUT_DIR}`);
  console.log(`  📄 Summary:  ${path.join(OUTPUT_DIR, '_extraction-summary.json')}`);
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
