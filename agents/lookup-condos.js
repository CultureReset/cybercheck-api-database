#!/usr/bin/env node
/**
 * Look up Google Place IDs for all condo properties
 * Uses textsearch with "condo Orange Beach Alabama" appended
 * Adds found condos into MASTER-ALL-BUSINESSES.json
 *
 * Usage:
 *   node agents/lookup-condos.js --dry-run
 *   node agents/lookup-condos.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const API_KEY    = process.env.GOOGLE_PLACES_API_KEY;
const DIR        = path.join(__dirname, '..');
const MASTER     = path.join(DIR, 'MASTER-ALL-BUSINESSES.json');
const LOG_FILE   = path.join(DIR, 'condo-lookup-results.json');

const CONDO_FILES = ['all-condos.json', 'condos-complexes.json', 'phoenix-condos.json'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function collectCondos() {
  const seen = new Set();
  const list = [];
  for (const f of CONDO_FILES) {
    const fpath = path.join(DIR, f);
    if (!fs.existsSync(fpath)) continue;
    try {
      JSON.parse(fs.readFileSync(fpath)).forEach(b => {
        const name = b.name;
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        // Skip obvious non-places
        if (/vacation homes|airbnb|vacasa/i.test(name)) return;
        list.push({ name, url: b.url || '' });
      });
    } catch {}
  }
  return list;
}

function googleTextSearch(name) {
  return new Promise((resolve) => {
    // Try with "condo" appended for tower-style names
    const suffix = /phoenix|tower|resort|suites|place|dunes|shores|village|racquet/i.test(name)
      ? 'condo Orange Beach Alabama'
      : 'Orange Beach Alabama';
    const query = encodeURIComponent(`${name} ${suffix}`);
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
              lat:               r.geometry?.location?.lat,
              lng:               r.geometry?.location?.lng,
              rating:            r.rating,
              types:             r.types,
            });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (!API_KEY && !dryRun) { console.error('❌ GOOGLE_PLACES_API_KEY not in .env'); process.exit(1); }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  CONDO PLACE ID LOOKUP                               ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const condos = collectCondos();
  console.log(`  Condos to look up: ${condos.length}\n`);

  // Load existing master to check what's already there
  let master = [];
  if (fs.existsSync(MASTER)) master = JSON.parse(fs.readFileSync(MASTER));
  const existingIds = new Set(master.map(b => b.place_id));

  if (dryRun) {
    condos.forEach((c, i) => console.log(`  ${String(i+1).padStart(2)}. ${c.name}`));
    return;
  }

  const found = [], notFound = [];

  for (let i = 0; i < condos.length; i++) {
    const c = condos[i];
    process.stdout.write(`  [${i+1}/${condos.length}] ${c.name.padEnd(45)} `);

    const result = await googleTextSearch(c.name);

    if (result && result.place_id) {
      process.stdout.write(`✅ ${result.place_id}\n`);
      if (result.formatted_address) process.stdout.write(`       ${result.formatted_address}\n`);

      found.push({ original_name: c.name, ...result });

      // Add to master if not already there
      if (!existingIds.has(result.place_id)) {
        master.push({
          place_id:         result.place_id,
          name:             result.name || c.name,
          category:         'Travel & Lodging',
          address:          result.formatted_address || '',
          city:             /gulf shores/i.test(result.formatted_address||'') ? 'Gulf Shores' : 'Orange Beach',
          state:            'AL',
          phone:            null,
          website:          c.url || null,
          lat:              result.lat,
          lng:              result.lng,
          rating:           result.rating || null,
          types:            result.types || [],
          source:           'condo-lookup',
        });
        existingIds.add(result.place_id);
      }
    } else {
      process.stdout.write(`❌ not found\n`);
      notFound.push(c.name);
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify({ found, notFound }, null, 2));
    await sleep(200);
  }

  // Save updated master
  master.sort((a, b) => {
    const co = { 'Orange Beach': 0, 'Gulf Shores': 1 };
    const ca = co[a.city] ?? 2, cb = co[b.city] ?? 2;
    if (ca !== cb) return ca - cb;
    return (a.name||'').localeCompare(b.name||'');
  });
  fs.writeFileSync(MASTER, JSON.stringify(master, null, 2));

  console.log('\n  ─────────────────────────────');
  console.log(`  Found:     ${found.length}`);
  console.log(`  Not found: ${notFound.length}`);
  console.log(`  Master now has: ${master.length} businesses`);
  console.log(`  ✅ Updated → ${MASTER}`);
  if (notFound.length) {
    console.log('\n  Not found:');
    notFound.forEach(n => console.log(`    ❌ ${n}`));
  }
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
