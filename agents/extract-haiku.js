#!/usr/bin/env node
/**
 * Haiku Extractor — runs Claude Haiku on scraped raw.json files
 * Cheaper + faster than Sonnet. Good for bulk extraction.
 *
 * Usage:
 *   node agents/extract-haiku.js --only phoenix-i,turquoise-place
 *   node agents/extract-haiku.js --folder condos
 *   node agents/extract-haiku.js --all
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../scraped-menus');
const MODEL    = 'claude-haiku-4-5-20251001';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildText(raw) {
    const parts = [];
    for (const p of raw.pages || []) {
        if (p.structuredData?.length)
            parts.push(`[STRUCTURED DATA]\n${JSON.stringify(p.structuredData, null, 2)}`);
    }
    for (const p of raw.pages || []) {
        if (p.text) parts.push(`[PAGE: ${p.url}]\n${p.text}`);
    }
    for (const t of raw.pdfTexts || []) parts.push(t);
    return parts.join('\n\n---\n\n');
}

async function haiku(prompt) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    if (!res.ok) throw new Error(`Haiku API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'').trim();
    try { return JSON.parse(cleaned); } catch(e) { throw new Error('JSON parse failed: ' + e.message + '\n' + text.substring(0,300)); }
}

// ── DETECT TYPE ──
function detectType(url, name) {
    const s = (url + ' ' + (name||'')).toLowerCase();
    if (/charter|fishing|cruise|dolphin|parasail|jet ski|kayak|boat|tour|watersport|snorkel|zip/i.test(s)) return 'activity';
    if (/condo|resort|hotel|suites|vacation|rental|lodging|beach club|tower|place/i.test(s)) return 'lodging';
    return 'restaurant';
}

// ── RESTAURANT PROMPT ──
function restaurantPrompt(text, url, name) {
    const t = text.length > 50000 ? text.substring(0, 50000) + '\n[TRUNCATED]' : text;
    return `Extract ALL data from this restaurant website. Business: ${name || url}

Text:
---
${t}
---

Return ONLY raw JSON:
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
  "features": ["full bar", "outdoor seating", "live music", "etc."],
  "price_range": "$ or $$ or $$$ or $$$$",
  "social_links": { "instagram": "or null", "facebook": "or null", "website": "${url}" },
  "specials": [{ "name": "string", "description": "string", "days": [], "time": "or null" }],
  "events": [{ "name": "string", "description": "string", "recurring": true, "day": "or null", "time": "or null" }],
  "menu": {
    "categories": [
      {
        "name": "Lunch",
        "type": "breakfast|lunch|dinner|brunch|drinks|desserts|specials|dietary|kids",
        "items": [
          { "name": "item name", "description": "or null", "price": 12.99, "tags": [], "allergens": [] }
        ]
      }
    ]
  }
}`;
}

// ── ACTIVITY PROMPT ──
function activityPrompt(text, url, name) {
    const t = text.length > 50000 ? text.substring(0, 50000) + '\n[TRUNCATED]' : text;
    return `Extract ALL data from this activity/tour/charter/experience business website. Business: ${name || url}

Text:
---
${t}
---

Return ONLY raw JSON:
{
  "business_name": "string",
  "tagline": "or null",
  "type": "Fishing Charter | Dolphin Cruise | Boat Rental | Water Sports | Attraction | etc.",
  "contact": { "phone": "or null", "email": "or null", "address": "or null", "city": "or null", "state": "or null", "zip": "or null" },
  "hours": { "monday": "or null", "tuesday": "or null", "wednesday": "or null", "thursday": "or null", "friday": "or null", "saturday": "or null", "sunday": "or null", "notes": "or null" },
  "about": {
    "description": "string",
    "elevator_pitch": "1 sentence",
    "vibe": "short description",
    "best_for": ["families", "groups", "etc."],
    "capacity": "or null",
    "duration_options": ["2 hours", "half day", "full day"],
    "departure_location": "or null",
    "what_provided": ["rods", "bait", "life jackets", "etc."],
    "what_to_bring": ["sunscreen", "cooler", "etc."],
    "age_restriction": "or null",
    "weight_restriction": "or null",
    "reservations": "or null",
    "cancellation_policy": "or null",
    "insider_tip": "or null"
  },
  "tags": ["fishing", "family fun", "offshore", "etc."],
  "features": ["private charter", "BYOB", "restroom on board", "etc."],
  "social_links": { "instagram": "or null", "facebook": "or null", "tripadvisor": "or null", "website": "${url}" },
  "specials": [{ "name": "string", "description": "string", "days": [], "time": "or null" }],
  "events": [],
  "packages": [
    {
      "name": "Half Day Fishing Trip",
      "type": "fishing|cruise|rental|tour|attraction|other",
      "description": "what is included",
      "duration": "4 hours",
      "price": 85.00,
      "price_type": "per person | per boat | flat rate | per hour",
      "price_note": "or null",
      "min_people": 1,
      "max_people": 6,
      "what_included": ["rods", "bait", "license"],
      "departure_times": ["6am", "1pm"],
      "days_available": "Daily",
      "booking_url": "or null",
      "notes": "or null"
    }
  ]
}`;
}

// ── LODGING PROMPT ──
function lodgingPrompt(text, url, name) {
    const t = text.length > 50000 ? text.substring(0, 50000) + '\n[TRUNCATED]' : text;
    return `Extract ALL data from this condo/resort/hotel/vacation rental website. Business: ${name || url}

Text:
---
${t}
---

Return ONLY raw JSON:
{
  "business_name": "string",
  "tagline": "or null",
  "type": "Condo | Resort | Hotel | Vacation Rental | etc.",
  "contact": { "phone": "or null", "email": "or null", "address": "or null", "city": "or null", "state": "or null", "zip": "or null" },
  "location": {
    "beachfront": true,
    "bay_view": false,
    "description": "beachfront on Gulf of Mexico, etc."
  },
  "about": {
    "description": "full description",
    "elevator_pitch": "1 sentence",
    "total_units": "or null",
    "floors": "or null",
    "year_built": "or null",
    "pet_friendly": true,
    "minimum_stay": "3 nights or null",
    "check_in": "4:00 PM or null",
    "check_out": "10:00 AM or null",
    "age_restriction": "Must be 25+ or null"
  },
  "amenities": {
    "pools": ["outdoor heated pool", "indoor pool", "lazy river"],
    "hot_tubs": true,
    "fitness_center": true,
    "tennis_courts": false,
    "pickleball_courts": false,
    "private_beach_access": true,
    "parking": "covered garage",
    "elevators": true,
    "gated": false,
    "bbq_grills": true,
    "business_center": false,
    "spa": false,
    "restaurant_on_site": true,
    "bar_on_site": true,
    "kids_splash_pad": false,
    "other": ["sauna", "game room", "etc."]
  },
  "unit_types": [
    {
      "name": "2 Bedroom Gulf Front",
      "bedrooms": 2,
      "bathrooms": 2,
      "sleeps": 8,
      "view": "gulf front",
      "sq_ft": "or null",
      "starting_price": "or null",
      "features": ["full kitchen", "washer/dryer", "balcony"]
    }
  ],
  "tags": ["beachfront", "family", "luxury", "pool", "etc."],
  "features": ["covered parking", "private beach", "on-site management", "etc."],
  "social_links": { "instagram": "or null", "facebook": "or null", "website": "${url}" },
  "dining": [{ "name": "restaurant name", "type": "Restaurant | Bar", "description": "or null" }],
  "specials": [{ "name": "string", "description": "string", "dates": "or null" }]
}`;
}

// ── MAIN ──
async function main() {
    const args = process.argv.slice(2);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error('❌ ANTHROPIC_API_KEY not set'); process.exit(1); }

    // Determine which slugs to process
    let slugs = [];
    const onlyArg   = args.includes('--only')   ? args[args.indexOf('--only') + 1]   : null;
    const folderArg = args.includes('--folder') ? args[args.indexOf('--folder') + 1] : null;
    const allFlag   = args.includes('--all');

    const searchDir = folderArg ? path.join(BASE_DIR, folderArg) : BASE_DIR;

    if (onlyArg) {
        slugs = onlyArg.split(',').map(s => s.trim());
    } else {
        slugs = fs.readdirSync(searchDir).filter(d => {
            return fs.existsSync(path.join(searchDir, d, 'raw.json'));
        });
        if (!allFlag) {
            // Skip already extracted unless --all
            slugs = slugs.filter(d => !fs.existsSync(path.join(searchDir, d, 'data.json')));
        }
    }

    console.log(`\n🤖 Haiku Extractor — model: ${MODEL}`);
    console.log(`📁 Folder: ${folderArg || 'scraped-menus (root)'}`);
    console.log(`📋 To extract: ${slugs.length}\n`);

    let done = 0, failed = 0;

    for (let i = 0; i < slugs.length; i++) {
        const slug    = slugs[i];
        const dir     = path.join(searchDir, slug);
        const rawFile = path.join(dir, 'raw.json');
        const outFile = path.join(dir, 'data.json');

        if (!fs.existsSync(rawFile)) {
            console.log(`[${i+1}/${slugs.length}] ⚠️  No raw.json: ${slug}`);
            continue;
        }

        console.log(`[${i+1}/${slugs.length}] ${slug}`);

        try {
            const raw  = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
            const text = buildText(raw);
            const type = detectType(raw.url || '', raw.business_name || slug);
            console.log(`  Type: ${type} | Chars: ${text.length.toLocaleString()}`);

            let prompt;
            if (type === 'lodging')    prompt = lodgingPrompt(text, raw.url, raw.business_name);
            else if (type === 'activity') prompt = activityPrompt(text, raw.url, raw.business_name);
            else                       prompt = restaurantPrompt(text, raw.url, raw.business_name);

            const extracted = await haiku(prompt);

            const final = {
                ...extracted,
                business_name: extracted.business_name || raw.business_name,
                url:           raw.url,
                scraped_at:    raw.scraped_at,
                extracted_at:  new Date().toISOString(),
                model:         MODEL,
                gallery:       raw.imageUrls || [],
                sources:       (raw.pages||[]).map(p => p.url),
            };

            fs.writeFileSync(outFile, JSON.stringify(final, null, 2));
            console.log(`  ✅ Saved → ${outFile}`);
            done++;

        } catch(err) {
            console.error(`  ❌ ${err.message}`);
            failed++;
        }

        if (i < slugs.length - 1) await sleep(500);
    }

    console.log(`\n╔══════════════════════╗`);
    console.log(`║  EXTRACT COMPLETE    ║`);
    console.log(`╚══════════════════════╝`);
    console.log(`  Done: ${done} | Failed: ${failed}\n`);
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
