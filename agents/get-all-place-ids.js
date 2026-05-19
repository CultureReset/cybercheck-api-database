#!/usr/bin/env node
/**
 * Get Google Place IDs for every business across all JSON files
 * 1. Builds a name→place_id lookup from files that already have them
 * 2. Collects all businesses from every file that are missing place_ids
 * 3. Tries fuzzy name match against existing data first (free)
 * 4. Calls Google Places Find Place API for anything still unmatched
 * 5. Saves master-place-id-lookup.json  — name → place_id for everything
 *
 * Usage:
 *   node agents/get-all-place-ids.js --dry-run   — show what needs lookup
 *   node agents/get-all-place-ids.js             — run all API lookups
 *   node agents/get-all-place-ids.js --start 50  — resume from index 50
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const https = require('https');

const API_KEY  = process.env.GOOGLE_PLACES_API_KEY;
const BASE_DIR = path.join(__dirname, '..');
const OUT_FILE = path.join(BASE_DIR, 'master-place-id-lookup.json');
const LOG_FILE = path.join(BASE_DIR, 'place-id-results.json');

// Center of Orange Beach / Gulf Shores area
const LOCATION_BIAS = 'circle:20000@30.2700,-87.6500';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(name) {
  return (name || '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Files with place_ids (sources of truth) ─────────────────────────────────
const KNOWN_FILES = [
  'MASTER-BUSINESSES.json',
  'all-businesses-organized-ob-gs.json',
  'activities-accommodations-ob-gs.json',
  'breweries-transport-fitness-seafood-attractions-ob-gs.json',
  'category-food-and-dining-ob-gs.json',
  'category-activities-and-entertainment-ob-gs.json',
  'category-retail-and-services-ob-gs.json',
  'category-travel-and-lodging-ob-gs.json',
  'category-other-ob-gs.json',
  'shopping-tourist-services-ob-gs.json',
  'shopping-tourist-services-OLD-API-enhanced.json',
  'restaurants-ob-gs-complete.json',
  'restaurants-ob-gs-enhanced.json',
  'featured-partners-scraped.json',
  'venue-place-ids.json',
];

// ─── All files that may have businesses needing place_ids ────────────────────
const NEED_CHECK_FILES = [
  'all-condos.json',
  'backup-deleted-venues-2026-05-09.json',
  'businesses-117.json',
  'businesses-gcr.json',
  'businesses.json',
  'condos-complexes.json',
  'phoenix-condos.json',
  'restaurants-ob-gs.json',
  'restaurants-with-specials.json',
  'restaurants.json',
  'retry-blocked.json',
  'retry-restaurants.json',
  'venues-to-extract.json',
  'venues.json',
  'business-index.json',
];

// ─── Build name→place_id lookup from known files ─────────────────────────────
function buildKnownLookup() {
  const lookup = {}; // normalized name → { place_id, name }

  for (const file of KNOWN_FILES) {
    const fpath = path.join(BASE_DIR, file);
    if (!fs.existsSync(fpath)) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(fpath));
      if (!Array.isArray(arr)) continue;
      for (const b of arr) {
        const pid  = b.place_id || b.google_place_id;
        const name = b.name || b.business_name || b.venue_name;
        if (pid && name) {
          lookup[normalize(name)] = { place_id: pid, name };
        }
      }
    } catch {}
  }

  return lookup;
}

// ─── Collect all unique businesses missing place_ids ─────────────────────────
function collectMissing(knownLookup) {
  const seen    = new Set(); // normalized names already queued
  const missing = [];

  for (const file of NEED_CHECK_FILES) {
    const fpath = path.join(BASE_DIR, file);
    if (!fs.existsSync(fpath)) continue;
    try {
      const arr = JSON.parse(fs.readFileSync(fpath));
      if (!Array.isArray(arr)) continue;
      for (const b of arr) {
        const name = b.name || b.business_name || b.venue_name || b.title;
        if (!name) continue;
        const key = normalize(name);
        if (seen.has(key)) continue;
        seen.add(key);
        if (knownLookup[key]) continue; // already have it
        missing.push({
          name,
          key,
          url:  b.website || b.url || '',
          city: b.city || '',
          source: file,
        });
      }
    } catch {}
  }

  // Also check scraped-menus directory for business names without place_ids
  const scrapedDir = path.join(BASE_DIR, 'scraped-menus');
  if (fs.existsSync(scrapedDir)) {
    const dirs = fs.readdirSync(scrapedDir).filter(d =>
      fs.statSync(path.join(scrapedDir, d)).isDirectory()
    );
    for (const slug of dirs) {
      const rawPath = path.join(scrapedDir, slug, 'raw.json');
      if (!fs.existsSync(rawPath)) continue;
      try {
        const raw  = JSON.parse(fs.readFileSync(rawPath));
        const name = raw.business_name;
        if (!name) continue;
        const key = normalize(name);
        if (seen.has(key) || knownLookup[key]) continue;
        seen.add(key);
        missing.push({
          name,
          key,
          url:    raw.url || '',
          city:   '',
          source: `scraped-menus/${slug}`,
        });
      } catch {}
    }
  }

  return missing;
}

// ─── Google Places Find Place API ────────────────────────────────────────────
function googleFindPlace(name) {
  return new Promise((resolve) => {
    const query = encodeURIComponent(`${name} Orange Beach Alabama`);
    const url   = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=30.2700,-87.6500&radius=30000&key=${API_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results.length > 0) {
            const r = json.results[0];
            resolve({
              place_id:          r.place_id,
              name:              r.name,
              formatted_address: r.formatted_address,
              geometry:          r.geometry,
            });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const startAt = args.includes('--start') ? parseInt(args[args.indexOf('--start')+1])||0 : 0;

  if (!API_KEY && !dryRun) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in .env');
    process.exit(1);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  GET ALL GOOGLE PLACE IDs                            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Load existing lookup (if we've run before, continue from it)
  const knownLookup = buildKnownLookup();

  // Merge any previously saved results
  if (fs.existsSync(OUT_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_FILE));
      for (const [k, v] of Object.entries(prev)) {
        if (!knownLookup[k]) knownLookup[k] = v;
      }
      console.log(`  Loaded ${Object.keys(prev).length} previously saved place IDs`);
    } catch {}
  }

  console.log(`  Already have place IDs for: ${Object.keys(knownLookup).length} businesses`);

  const missing = collectMissing(knownLookup);
  console.log(`  Businesses needing lookup:  ${missing.length}\n`);

  if (dryRun) {
    console.log('── DRY RUN — businesses that need Google lookup ──\n');
    missing.forEach((b, i) => {
      console.log(`  ${String(i+1).padStart(3)}. ${b.name}`);
      console.log(`       Source: ${b.source}`);
      if (b.url) console.log(`       URL: ${b.url}`);
    });
    console.log(`\nTotal needing API lookup: ${missing.length}`);
    console.log(`Estimated API cost: ~${missing.length} requests`);
    return;
  }

  const toProcess = missing.slice(startAt);
  console.log(`Starting at #${startAt+1} — ${toProcess.length} to look up\n`);

  const found    = [];
  const notFound = [];

  for (let i = 0; i < toProcess.length; i++) {
    const b      = toProcess[i];
    const global = startAt + i + 1;

    process.stdout.write(`  [${global}/${missing.length}] ${b.name.substring(0, 50).padEnd(50)} `);

    const result = await googleFindPlace(b.name);

    if (result && result.place_id) {
      process.stdout.write(`✅ ${result.place_id}\n`);
      if (result.formatted_address) {
        process.stdout.write(`       ${result.formatted_address}\n`);
      }
      knownLookup[b.key] = {
        place_id:        result.place_id,
        name:            result.name || b.name,
        formatted_address: result.formatted_address || '',
        lat:             result.geometry?.location?.lat,
        lng:             result.geometry?.location?.lng,
        source_name:     b.name,
        source_file:     b.source,
      };
      found.push(b.name);
    } else {
      process.stdout.write(`❌ not found\n`);
      notFound.push(b.name);
    }

    // Save after every business
    fs.writeFileSync(OUT_FILE, JSON.stringify(knownLookup, null, 2));
    fs.writeFileSync(LOG_FILE, JSON.stringify({ found, notFound, lastIndex: global, total: missing.length }, null, 2));

    await sleep(200); // 5 req/sec max, well under limit
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  DONE                                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Found:     ${found.length}`);
  console.log(`  Not found: ${notFound.length}`);
  console.log(`  Total in lookup: ${Object.keys(knownLookup).length}`);
  console.log(`  Saved → ${OUT_FILE}`);

  if (notFound.length) {
    console.log('\n  Not found (may need manual lookup or different name):');
    notFound.forEach(n => console.log(`    ❌ ${n}`));
  }
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
