#!/usr/bin/env node
/**
 * Build Master Business List
 * Scans every JSON file, deduplicates by place_id,
 * merges best data from each source, saves MASTER-ALL-BUSINESSES.json
 *
 * Usage:
 *   node agents/build-master-list.js
 */

const fs   = require('fs');
const path = require('path');

const DIR      = path.join(__dirname, '..');
const OUT_FILE = path.join(DIR, 'MASTER-ALL-BUSINESSES.json');

// Files to scan — root + consolidation
function getAllJsonFiles() {
  const files = [];
  fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('MASTER-ALL')).forEach(f => files.push(path.join(DIR, f)));
  const consDir = path.join(DIR, 'consolidation');
  if (fs.existsSync(consDir)) fs.readdirSync(consDir).filter(f => f.endsWith('.json')).forEach(f => files.push(path.join(consDir, f)));
  return files;
}

// Normalize category names
function normalizeCategory(b) {
  const raw = (b.main_category || b.type || b.category || b.business_type || '').toLowerCase();
  if (/food|dining|restaurant|bar|cafe|coffee|brewery|bakery|pizza|seafood|grill|eat/.test(raw)) return 'Food & Dining';
  if (/hotel|motel|resort|inn|suites|lodge|condo|vacation|rental|accommodat|lodging/.test(raw)) return 'Travel & Lodging';
  if (/activit|entertainment|tour|charter|fishing|parasail|dolphin|cruise|kayak|boat|pontoon|adventure|fun|attraction|golf|mini/.test(raw)) return 'Activities & Entertainment';
  if (/retail|shop|store|boutique|gift|souvenir|market|mall/.test(raw)) return 'Retail & Shopping';
  if (/salon|spa|health|fitness|gym|yoga|medical|dental|clinic|beauty/.test(raw)) return 'Health & Beauty';
  if (/service|repair|bank|insurance|real.estate|mortgage|finance/.test(raw)) return 'Services';
  if (/venue|event|wedding|banquet|hall/.test(raw)) return 'Venues & Events';
  if (raw === 'boat/marine') return 'Activities & Entertainment';
  if (raw === 'shopping_tourist_service') return 'Retail & Shopping';
  if (raw === 'specialty') return 'Specialty';
  return 'Other';
}

// Pick best non-empty value across multiple records
function best(...vals) {
  return vals.find(v => v && String(v).trim() !== '' && v !== 'null' && v !== 'undefined') || null;
}

function mergeHours(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  // Merge day by day, prefer non-null
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const merged = {};
  days.forEach(d => { merged[d] = best(a[d], b[d]); });
  return merged;
}

// Authoritative category files — place_id → category
const CATEGORY_FILES = {
  'category-food-and-dining-ob-gs.json':            'Food & Dining',
  'category-activities-and-entertainment-ob-gs.json': 'Activities & Entertainment',
  'category-retail-and-services-ob-gs.json':        'Retail & Services',
  'category-travel-and-lodging-ob-gs.json':         'Travel & Lodging',
  'category-other-ob-gs.json':                      'Other',
};

function buildCategoryLookup() {
  const lookup = {};
  for (const [file, cat] of Object.entries(CATEGORY_FILES)) {
    const fpath = path.join(DIR, file);
    if (!fs.existsSync(fpath)) continue;
    try {
      JSON.parse(fs.readFileSync(fpath)).forEach(b => {
        const pid = b.place_id || b.google_place_id;
        if (pid) lookup[pid] = cat;
      });
    } catch {}
  }
  return lookup;
}

function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  BUILD MASTER BUSINESS LIST                          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const categoryLookup = buildCategoryLookup();
  console.log(`  Category lookup built: ${Object.keys(categoryLookup).length} businesses\n`);

  const master = new Map(); // place_id → merged record
  let totalScanned = 0;
  let filesScanned = 0;

  for (const fpath of getAllJsonFiles()) {
    let arr;
    try {
      const raw = JSON.parse(fs.readFileSync(fpath, 'utf8'));
      arr = Array.isArray(raw) ? raw : [];
    } catch { continue; }

    if (arr.length === 0) continue;
    filesScanned++;

    for (const b of arr) {
      const pid = b.place_id || b.google_place_id;
      if (!pid) continue;
      totalScanned++;

      const existing = master.get(pid) || {};

      const merged = {
        place_id:      pid,
        name:          best(existing.name, b.name, b.business_name, b.venue_name),
        category:      categoryLookup[pid] || best(existing.category, normalizeCategory(b), normalizeCategory(existing)),
        address:       best(existing.address, b.address, b.formatted_address),
        city:          best(existing.city, b.city),
        state:         best(existing.state, b.state) || 'AL',
        zip:           best(existing.zip, b.zip, b.postal_code),
        phone:         best(existing.phone, b.phone),
        website:       best(existing.website, b.website),
        google_maps_url: best(existing.google_maps_url, b.google_maps_url),
        lat:           best(existing.lat, b.lat, b.latitude, b.geometry?.location?.lat),
        lng:           best(existing.lng, b.lng, b.longitude, b.geometry?.location?.lng),
        rating:        best(existing.rating, b.rating),
        reviews_count: best(existing.reviews_count, b.reviews_count, b.review_count, b.user_ratings_total),
        price_level:   best(existing.price_level, b.price_level),
        hours:         mergeHours(existing.hours, b.hours),
        photos:        existing.photos?.length ? existing.photos : (b.photos || []),
        types:         existing.types?.length  ? existing.types  : (b.types  || []),
        business_status: best(existing.business_status, b.business_status),
      };

      master.set(pid, merged);
    }
  }

  const results = [...master.values()];

  // Sort: Orange Beach first, then Gulf Shores, then others, alpha by name within
  results.sort((a, b) => {
    const cityOrder = { 'Orange Beach': 0, 'Gulf Shores': 1 };
    const ca = cityOrder[a.city] ?? 2;
    const cb = cityOrder[b.city] ?? 2;
    if (ca !== cb) return ca - cb;
    return (a.name || '').localeCompare(b.name || '');
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));

  // Stats
  const byCat = {};
  const byCity = {};
  results.forEach(b => {
    byCat[b.category]  = (byCat[b.category]  || 0) + 1;
    byCity[b.city||'?'] = (byCity[b.city||'?'] || 0) + 1;
  });

  console.log(`  Files scanned:    ${filesScanned}`);
  console.log(`  Records scanned:  ${totalScanned}`);
  console.log(`  Unique businesses: ${results.length}\n`);

  console.log('  By city:');
  Object.entries(byCity).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`    ${String(n).padStart(4)}  ${c}`));

  console.log('\n  By category:');
  Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`    ${String(n).padStart(4)}  ${c}`));

  const withAddr    = results.filter(b=>b.address).length;
  const withPhone   = results.filter(b=>b.phone).length;
  const withSite    = results.filter(b=>b.website).length;
  const withCoords  = results.filter(b=>b.lat).length;
  const withHours   = results.filter(b=>b.hours).length;
  const withRating  = results.filter(b=>b.rating).length;

  console.log('\n  Data completeness:');
  console.log(`    Address:  ${withAddr}/${results.length}`);
  console.log(`    Phone:    ${withPhone}/${results.length}`);
  console.log(`    Website:  ${withSite}/${results.length}`);
  console.log(`    Lat/Lng:  ${withCoords}/${results.length}`);
  console.log(`    Hours:    ${withHours}/${results.length}`);
  console.log(`    Rating:   ${withRating}/${results.length}`);

  console.log(`\n  ✅ Saved → ${OUT_FILE}`);
}

main();
