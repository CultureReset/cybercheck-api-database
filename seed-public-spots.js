#!/usr/bin/env node
/**
 * seed-public-spots.js
 *
 * Inserts the 10 public-spot entities that used to be hardcoded on
 * launching-GCR/public-spots.html into the GCR entity table.
 *
 * Safety:
 *   - Writes ONLY to `entity` and `entity_features` tables.
 *   - Skips any entity whose slug already exists (never overwrites).
 *   - Dry-run by default. Use --apply to write.
 *
 * Usage:
 *   node seed-public-spots.js             # dry run
 *   node seed-public-spots.js --apply     # insert missing entities
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;

if (!process.env.GCR_SUPABASE_URL || !process.env.GCR_SUPABASE_KEY) {
  console.error('Missing GCR_SUPABASE_URL or GCR_SUPABASE_KEY in .env');
  process.exit(1);
}
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const SPOTS = [
  { slug: 'gulf-place-beach-access',               name: 'Gulf Place Beach Access',               subtype: 'beach_access',  city: 'Orange Beach', state: 'AL', icon: '🏖️', subtitle: 'Popular public beach entry with wide sandy beach',                        features: ['Showers','Restrooms','Free Parking','Family Friendly'] },
  { slug: 'romar-beach-access',                    name: 'Romar Beach Access',                    subtype: 'beach_access',  city: 'Orange Beach', state: 'AL', icon: '🏖️', subtitle: 'Simpler beach entry with less buildup than main public beach zones',      features: ['Beach Access','Free','Parking Nearby'] },
  { slug: 'gulf-shores-public-beach',              name: 'Gulf Shores Public Beach',              subtype: 'beach_access',  city: 'Gulf Shores',  state: 'AL', icon: '🏖️', subtitle: 'Main public beach with lifeguards, restrooms, showers, and central setup', features: ['Lifeguards','Restrooms','Showers','Paid Parking'] },
  { slug: 'gulf-state-park-beach',                 name: 'Gulf State Park Beach',                 subtype: 'beach_access',  city: 'Gulf Shores',  state: 'AL', icon: '🏖️', subtitle: 'State park beach with better facilities and more organized setup',        features: ['Park Fee','Restrooms','Showers','Snorkeling'] },
  { slug: 'boggy-point-boat-launch',               name: 'Boggy Point Boat Launch',               subtype: 'boat_launch',   city: 'Orange Beach', state: 'AL', icon: '🚤', subtitle: 'Popular public launch with trailer parking and water access',              features: ['Boat Ramp','Trailer Parking','Fishing Access'] },
  { slug: 'cotton-bayou-boat-launch',              name: 'Cotton Bayou Boat Launch',              subtype: 'boat_launch',   city: 'Orange Beach', state: 'AL', icon: '🚤', subtitle: 'Direct water access without going through private marinas',                features: ['Boat Ramp','Parking','Water Access'] },
  { slug: 'gulf-state-park-pier',                  name: 'Gulf State Park Pier',                  subtype: 'pier',          city: 'Gulf Shores',  state: 'AL', icon: '🎣', subtitle: 'Large public pier with bait shop and no fishing license required',         features: ['No License Needed','Bait Shop','Small Fee'] },
  { slug: 'gulf-shores-public-beach-pavilion',     name: 'Gulf Shores Public Beach Pavilion',     subtype: 'park',          city: 'Gulf Shores',  state: 'AL', icon: '🚽', subtitle: 'Main facility stop with bathrooms, showers, and convenience',              features: ['Restrooms','Showers','ADA Accessible'] },
  { slug: 'orange-beach-waterfront-park',          name: 'Orange Beach Waterfront Park',          subtype: 'park',          city: 'Orange Beach', state: 'AL', icon: '🌳', subtitle: 'Park facilities for restrooms and family convenience',                     features: ['Restrooms','Family Friendly','Park Access'] },
  { slug: 'bon-secour-wildlife-refuge-trails',     name: 'Bon Secour Wildlife Refuge Trails',     subtype: 'park',          city: 'Fort Morgan',  state: 'AL', icon: '🌳', subtitle: 'Nature-focused area for trails, quiet spaces, and wildlife viewing',       features: ['Nature Trails','Wildlife','Free'] },
];

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Seed Public Spots — GCR entity table');
  console.log('═══════════════════════════════════════════════════');
  console.log(DRY ? '  MODE: DRY RUN (no writes)' : '  MODE: APPLYING');
  console.log('');

  const { data: existing, error: exErr } = await db.from('entity').select('slug').in('slug', SPOTS.map(s => s.slug));
  if (exErr) { console.error('Failed to check existing slugs:', exErr.message); process.exit(1); }
  const existingSet = new Set((existing || []).map(r => r.slug));

  let toInsert = 0, skipped = 0, inserted = 0, errors = 0;

  for (const spot of SPOTS) {
    if (existingSet.has(spot.slug)) {
      console.log(`  SKIP (exists): ${spot.slug}`);
      skipped++; continue;
    }
    toInsert++;
    console.log(`  NEW: [${spot.subtype}] ${spot.name}  (${spot.slug})`);
    if (DRY) continue;

    // Insert entity
    const { data: ent, error: entErr } = await db.from('entity').insert({
      slug: spot.slug,
      name: spot.name,
      subtitle: spot.subtitle,
      entity_type: 'public_spot',
      entity_subtype: spot.subtype,
      icon: spot.icon,
      city: spot.city,
      state: spot.state,
      is_active: true,
    }).select('id').single();

    if (entErr) { console.log(`         ERROR inserting entity: ${entErr.message}`); errors++; continue; }

    // Insert features
    if (spot.features && spot.features.length) {
      const rows = spot.features.map((f, i) => ({ entity_id: ent.id, label: f, sort_order: i }));
      const { error: fErr } = await db.from('entity_features').insert(rows);
      if (fErr) console.log(`         warn: features insert failed: ${fErr.message}`);
    }

    inserted++;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(` existing (skipped): ${skipped}   to insert: ${toInsert}   inserted: ${inserted}   errors: ${errors}`);
  console.log(DRY ? ' (DRY RUN — no changes were made. Use --apply to insert.)' : ' DONE — changes applied.');
  console.log('═══════════════════════════════════════════════════');
})().catch(e => { console.error(e); process.exit(1); });
